import { searchYouTubeVideos, SearchResultItem } from '@/lib/youtube';
import { parseYouTubeVideoId } from '@/lib/roomUtils';
import { parseTrackAndArtist, normalizeStr, cleanArtistName } from '@/lib/trackParser';
import { fetchSimilarTracksFromLastFm } from '@/lib/lastfmApi';
import { searchYTMusic } from '@/lib/ytmusicSearch';
import { isProxyConfigured } from '@/lib/proxyConfig';

/**
 * Searches for tracks during autoplay: prefers YouTube Music via CORS proxy if configured,
 * seamlessly falling back to YouTube Data API if proxy is unconfigured or returns no results.
 */
async function searchForAutoplay(query: string): Promise<{ results: SearchResultItem[]; error?: string; hasApiKey: boolean }> {
  if (isProxyConfigured()) {
    try {
      const ytMusicQuery = query.replace(/\s+topic$/i, '');
      console.log('[Autoplay] Attempting YTMusic search for:', ytMusicQuery);
      const results = await searchYTMusic(ytMusicQuery);
      if (results && results.length > 0) {
        console.log(`[Autoplay] Using ${results.length} YTMusic results for: "${ytMusicQuery}"`);
        return { results, hasApiKey: true };
      }
      console.log('[Autoplay] YTMusic returned 0 results, falling back to YouTube Data API...');
    } catch (err: any) {
      console.warn('[Autoplay] YTMusic search failed, falling back to YouTube Data API:', err?.message || err);
    }
  }

  // Restrict YouTube Data API fallback to Music category (videoCategoryId: '10')
  return searchYouTubeVideos(query, { videoCategoryId: '10' });
}

/**
 * Checks if two artist names are identical or have fuzzy substring match after cleaning.
 */
export const isSameArtist = (a: string, b: string): boolean => {
  const normA = normalizeStr(cleanArtistName(a));
  const normB = normalizeStr(cleanArtistName(b));
  if (!normA || !normB) return false;
  if (normA === normB) return true;
  if (normA.length > 3 && normB.length > 3) {
    if (normA.includes(normB) || normB.includes(normA)) return true;
  }
  return false;
};

/**
 * Checks if candidate artist would result in more than 2 consecutive songs by the same artist.
 */
export const isArtistRepeatLimitReached = (
  candidateArtist: string,
  recentArtistHistory: string[]
): boolean => {
  if (!candidateArtist || recentArtistHistory.length < 2) return false;
  return (
    isSameArtist(candidateArtist, recentArtistHistory[0]) &&
    isSameArtist(candidateArtist, recentArtistHistory[1])
  );
};

/**
 * Checks if a YouTube channel is a YouTube Music auto-generated "- Topic" channel.
 */
export const isTopicChannel = (channel: string): boolean => {
  return channel.trim().endsWith(' - Topic') || channel.toLowerCase().includes('topic');
};

/**
 * Detects whether a video title indicates a non-standard music track, such as:
 * - Multi-hour / 1-hour loops or extended mixes
 * - Full albums, compilations, or discographies
 * - 24/7 live streams
 */
export const isUnwantedLongOrCompilation = (title: string): boolean => {
  const t = title.toLowerCase();

  // Multi-hour or hour indicators (e.g. "1 hour", "10 hours", "2 hrs", "10h")
  if (/\b\d+\s*(hours?|hrs?|h)\b/.test(t)) return true;
  if (/\b(10\s*hours?|1\s*hour|hour\s*loop|hours\s*loop|\d+\s*h\s*loop)\b/.test(t)) return true;

  // Loops & extended versions
  if (/\b(infinite\s*loop|continuous\s*loop|1\s*hour\s*version|10\s*hour\s*version)\b/.test(t)) return true;
  if (/\bloop\b/.test(t) && /\b(hour|hrs|\d+h|extended|repeat)\b/.test(t)) return true;

  // Compilations / Full albums / Discographies / Mixes
  if (/\b(full\s*album|complete\s*album|discography|all\s*songs|greatest\s*hits\s*full)\b/.test(t)) return true;
  if (/\b(compilation|mega\s*mix|megamix|mashup\s*mix|dj\s*mix|album\s*mix|live\s*stream|24\/7)\b/.test(t)) return true;

  return false;
};

/**
 * Scores a YouTube search result item for audio purity (0 to 3) when preferMusicVideos is false.
 * Score 3: Topic channel (official YouTube Music audio track)
 * Score 2: Dedicated audio track (official audio, lyric video, audio) or label channel (without VEVO)
 * Score 1: Ambiguous / standard video without clear audio or music video markers
 * Score 0: Music video / VEVO (kept as a last resort, never hard-blocked)
 */
export const scoreAudioPurity = (item: SearchResultItem): number => {
  // If the video is a long compilation/loop or > 12 minutes, penalize purity score to 0
  if (isUnwantedLongOrCompilation(item.title) || (typeof item.durationSeconds === 'number' && item.durationSeconds > 720)) {
    return 0;
  }

  const channel = (item.channelTitle || '').toLowerCase();
  const title = (item.title || '').toLowerCase();

  // Tier 3: YouTube Music auto-generated "- Topic" channel
  if (isTopicChannel(item.channelTitle || '')) return 3;

  // Tier 2: Dedicated audio track (official audio, lyric video, audio) or label channel (without VEVO)
  const isAudioTitle = /\b(official\s+audio|audio|lyric\s+video|lyric)\b/.test(title);
  const isLabelChannel = /\bmusic\b/.test(channel) && !channel.includes('vevo');
  if (isAudioTitle || isLabelChannel) return 2;

  // Tier 0: Explicit music video indicators or VEVO channel
  const isMusicVideoTitle = /\b(official\s+(music\s+)?video|music\s+video|\bmv\b|official\s+mv|video\s+clip)\b/.test(title);
  const isVevo = channel.includes('vevo');
  if (isMusicVideoTitle || isVevo) return 0;

  // Tier 1: Neutral / ambiguous
  return 1;
};

/**
 * Determines whether a search result item matches the currently playing track or recent history.
 */
export const isDuplicateSong = (
  itemTitle: string,
  itemChannelTitle: string,
  cleanCurrentTrackNorm: string,
  historyNorms: string[]
): boolean => {
  const parsed = parseTrackAndArtist(itemTitle, itemChannelTitle);
  const candidateTrackNorm = normalizeStr(parsed.track || itemTitle);

  if (cleanCurrentTrackNorm && candidateTrackNorm === cleanCurrentTrackNorm) {
    return true;
  }
  if (cleanCurrentTrackNorm && cleanCurrentTrackNorm.length > 3 && candidateTrackNorm.includes(cleanCurrentTrackNorm)) {
    return true;
  }
  if (cleanCurrentTrackNorm && candidateTrackNorm.length > 3 && cleanCurrentTrackNorm.includes(candidateTrackNorm)) {
    return true;
  }
  return historyNorms.some(
    (h) => h && (h === candidateTrackNorm || (h.length > 3 && candidateTrackNorm.includes(h)))
  );
};

/**
 * Resolves next autoplay YouTube track based on current song metadata.
 * Explicitly excludes current playing YouTube video ID, recent URL history, duplicate song names/artists,
 * and limits consecutive artist repeats to at most 2.
 * Supports preferring pure audio/YouTube Music uploads vs. music videos based on preferMusicVideos setting.
 */
export const getAutoplayNextYouTubeTrack = async (
  currentPlayingTitle: string,
  channelTitle: string = '',
  recentHistory: string[] = [],
  currentPlayingUrl: string = '',
  recentUrls: string[] = [],
  preferMusicVideos: boolean = true,
  recentArtistHistory: string[] = []
): Promise<{ url: string; title: string; artist?: string } | null> => {
  try {
    const excludedVideoIds = new Set<string>();

    const currentVideoId = parseYouTubeVideoId(currentPlayingUrl);
    if (currentVideoId) {
      excludedVideoIds.add(currentVideoId);
    }

    for (const u of recentUrls) {
      const vId = parseYouTubeVideoId(u);
      if (vId) {
        excludedVideoIds.add(vId);
      }
    }

    const { artist, track: cleanCurrentTrack } = parseTrackAndArtist(currentPlayingTitle, channelTitle);
    const cleanCurrentTrackNorm = normalizeStr(cleanCurrentTrack);
    const historyNorms = recentHistory.map(normalizeStr);

    console.log('[Autoplay] Current playing track:', cleanCurrentTrack, 'artist:', artist);
    console.log('[Autoplay] preferMusicVideos:', preferMusicVideos);
    console.log('[Autoplay] Recent artist history (last played first):', recentArtistHistory);
    console.log('[Autoplay] Excluded Video IDs:', Array.from(excludedVideoIds));

    const recommendations = await fetchSimilarTracksFromLastFm(currentPlayingTitle, channelTitle, recentHistory);

    // Try recommendations from Last.fm
    for (const rec of recommendations) {
      if (rec.artist && isArtistRepeatLimitReached(rec.artist, recentArtistHistory)) {
        console.log(`[Autoplay Filter] Skipped Last.fm recommendation due to artist repeat (>2 consecutive): "${rec.artist}" - "${rec.title}"`);
        continue;
      }

      const searchQuery = !preferMusicVideos ? `${rec.query} topic` : rec.query;

      console.log('[Autoplay] Searching YouTube for recommendation:', searchQuery);
      const searchRes = await searchForAutoplay(searchQuery);

      if (searchRes.error) {
        console.warn(`[Autoplay] YouTube search error for "${searchQuery}":`, searchRes.error);
      }
      if (!searchRes.hasApiKey) {
        console.warn('[Autoplay] No active YouTube API key available. Aborting recommendation searches.');
        break;
      }

      if (searchRes.results && searchRes.results.length > 0) {
        const candidateResults = preferMusicVideos
          ? searchRes.results
          : [...searchRes.results].sort((a, b) => scoreAudioPurity(b) - scoreAudioPurity(a));

        const validMatch = candidateResults.find((item: SearchResultItem) => {
          const itemVideoId = parseYouTubeVideoId(item.url) || item.id;
          if (itemVideoId && excludedVideoIds.has(itemVideoId)) {
            return false;
          }
          // Duration filter: exclude shorts (<60s) and long videos/loops (>12m)
          if (typeof item.durationSeconds === 'number') {
            if (item.durationSeconds < 60) {
              console.log(`[Autoplay Filter] Skipped short track (${item.durationSeconds}s): "${item.title}"`);
              return false;
            }
            if (item.durationSeconds > 720) {
              console.log(`[Autoplay Filter] Skipped long track (${item.durationSeconds}s): "${item.title}"`);
              return false;
            }
          }
          // Title filter: exclude loops, compilations, full albums
          if (isUnwantedLongOrCompilation(item.title)) {
            console.log(`[Autoplay Filter] Skipped long/compilation title: "${item.title}"`);
            return false;
          }
          if (isDuplicateSong(item.title, item.channelTitle, cleanCurrentTrackNorm, historyNorms)) {
            console.log(`[Autoplay Filter] Skipped duplicate/recent song version: "${item.title}"`);
            return false;
          }
          const itemParsed = parseTrackAndArtist(item.title, item.channelTitle);
          const candidateArtist = itemParsed.artist || rec.artist || item.channelTitle;
          if (isArtistRepeatLimitReached(candidateArtist, recentArtistHistory)) {
            console.log(`[Autoplay Filter] Skipped artist repeat (>2 consecutive): "${candidateArtist}" for "${item.title}"`);
            return false;
          }
          return true;
        });

        if (validMatch) {
          const matchedParsed = parseTrackAndArtist(validMatch.title, validMatch.channelTitle);
          const matchedArtist = matchedParsed.artist || rec.artist || validMatch.channelTitle;
          console.log(
            '[Autoplay] Resolved non-duplicate YouTube track:',
            validMatch.title,
            validMatch.url,
            'artist:',
            matchedArtist,
            typeof validMatch.durationSeconds === 'number' ? `(${validMatch.durationSeconds}s)` : '',
            preferMusicVideos ? '' : `(purity score: ${scoreAudioPurity(validMatch)})`
          );
          return {
            url: validMatch.url,
            title: validMatch.title,
            artist: matchedArtist,
          };
        }
      }
    }

    // Fallback: search using track/artist name directly if recommendations were empty or all returned excluded videos
    const isCurrentArtistRepeat = isArtistRepeatLimitReached(artist, recentArtistHistory);

    const fallbackQueries = (
      preferMusicVideos
        ? [
            !isCurrentArtistRepeat && artist ? `${artist} music` : null,
            cleanCurrentTrack ? `${cleanCurrentTrack} music` : null,
            'popular music video',
          ]
        : [
            !isCurrentArtistRepeat && artist ? `${artist} topic` : null,
            cleanCurrentTrack ? `${cleanCurrentTrack} topic` : null,
            'popular music',
          ]
    ).filter(Boolean) as string[];

    for (const searchQuery of fallbackQueries) {
      console.log('[Autoplay] Fallback searching YouTube for:', searchQuery);
      const searchRes = await searchForAutoplay(searchQuery);

      if (searchRes.error) {
        console.warn(`[Autoplay] Fallback search error for "${searchQuery}":`, searchRes.error);
      }
      if (!searchRes.hasApiKey) {
        console.warn('[Autoplay] No active YouTube API key available for fallback.');
        break;
      }

      if (searchRes.results && searchRes.results.length > 0) {
        const candidateResults = preferMusicVideos
          ? searchRes.results
          : [...searchRes.results].sort((a, b) => scoreAudioPurity(b) - scoreAudioPurity(a));

        const validMatch = candidateResults.find((item: SearchResultItem) => {
          const itemVideoId = parseYouTubeVideoId(item.url) || item.id;
          if (itemVideoId && excludedVideoIds.has(itemVideoId)) {
            return false;
          }
          // Duration filter: exclude shorts (<60s) and long videos/loops (>12m)
          if (typeof item.durationSeconds === 'number') {
            if (item.durationSeconds < 60) {
              console.log(`[Autoplay Filter] Skipped short track in fallback (${item.durationSeconds}s): "${item.title}"`);
              return false;
            }
            if (item.durationSeconds > 720) {
              console.log(`[Autoplay Filter] Skipped long track in fallback (${item.durationSeconds}s): "${item.title}"`);
              return false;
            }
          }
          // Title filter: exclude loops, compilations, full albums
          if (isUnwantedLongOrCompilation(item.title)) {
            console.log(`[Autoplay Filter] Skipped long/compilation title in fallback: "${item.title}"`);
            return false;
          }
          if (isDuplicateSong(item.title, item.channelTitle, cleanCurrentTrackNorm, historyNorms)) {
            console.log(`[Autoplay Filter] Skipped duplicate/recent song version in fallback: "${item.title}"`);
            return false;
          }
          const itemParsed = parseTrackAndArtist(item.title, item.channelTitle);
          const candidateArtist = itemParsed.artist || item.channelTitle;
          if (isArtistRepeatLimitReached(candidateArtist, recentArtistHistory)) {
            console.log(`[Autoplay Filter] Skipped artist repeat (>2 consecutive) in fallback: "${candidateArtist}" for "${item.title}"`);
            return false;
          }
          return true;
        });

        if (validMatch) {
          const matchedParsed = parseTrackAndArtist(validMatch.title, validMatch.channelTitle);
          const matchedArtist = matchedParsed.artist || validMatch.channelTitle;
          console.log(
            '[Autoplay] Resolved fallback YouTube track:',
            validMatch.title,
            validMatch.url,
            'artist:',
            matchedArtist,
            typeof validMatch.durationSeconds === 'number' ? `(${validMatch.durationSeconds}s)` : '',
            preferMusicVideos ? '' : `(purity score: ${scoreAudioPurity(validMatch)})`
          );
          return {
            url: validMatch.url,
            title: validMatch.title,
            artist: matchedArtist,
          };
        }
      }
    }
  } catch (err) {
    console.error('[Autoplay] Failed to resolve autoplay track:', err);
  }
  return null;
};
