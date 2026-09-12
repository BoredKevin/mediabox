import { searchYouTubeVideos, SearchResultItem } from '@/lib/youtube';
import { parseYouTubeVideoId } from '@/lib/roomUtils';
import { parseTrackAndArtist, normalizeStr, cleanArtistName } from '@/lib/trackParser';
import { fetchSimilarTracksFromLastFm } from '@/lib/lastfmApi';

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

      let searchQuery = rec.query;
      if (!preferMusicVideos) {
        searchQuery = searchQuery.replace(/\bmusic\b/gi, '').trim() + ' audio';
      }

      console.log('[Autoplay] Searching YouTube for recommendation:', searchQuery);
      const searchRes = await searchYouTubeVideos(searchQuery);

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
          : [...searchRes.results].sort((a, b) => {
              const aTopic = isTopicChannel(a.channelTitle || '') ? 1 : 0;
              const bTopic = isTopicChannel(b.channelTitle || '') ? 1 : 0;
              return bTopic - aTopic;
            });

        const validMatch = candidateResults.find((item: SearchResultItem) => {
          const itemVideoId = parseYouTubeVideoId(item.url) || item.id;
          if (itemVideoId && excludedVideoIds.has(itemVideoId)) {
            return false;
          }
          if (isDuplicateSong(item.title, item.channelTitle, cleanCurrentTrackNorm, historyNorms)) {
            console.log(`[Autoplay Filter] Skipped duplicate/recent song version: "${item.title}"`);
            return false;
          }
          if (!preferMusicVideos && item.title.toLowerCase().includes('music video')) {
            console.log(`[Autoplay Filter] Skipped Music Video title (preferMusicVideos=false): "${item.title}"`);
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
          console.log('[Autoplay] Resolved non-duplicate YouTube track:', validMatch.title, validMatch.url, 'artist:', matchedArtist);
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
            !isCurrentArtistRepeat && artist ? `${artist} audio` : null,
            cleanCurrentTrack ? `${cleanCurrentTrack} audio` : null,
            'popular music',
          ]
    ).filter(Boolean) as string[];

    for (const searchQuery of fallbackQueries) {
      console.log('[Autoplay] Fallback searching YouTube for:', searchQuery);
      const searchRes = await searchYouTubeVideos(searchQuery);

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
          : [...searchRes.results].sort((a, b) => {
              const aTopic = isTopicChannel(a.channelTitle || '') ? 1 : 0;
              const bTopic = isTopicChannel(b.channelTitle || '') ? 1 : 0;
              return bTopic - aTopic;
            });

        const validMatch = candidateResults.find((item: SearchResultItem) => {
          const itemVideoId = parseYouTubeVideoId(item.url) || item.id;
          if (itemVideoId && excludedVideoIds.has(itemVideoId)) {
            return false;
          }
          if (isDuplicateSong(item.title, item.channelTitle, cleanCurrentTrackNorm, historyNorms)) {
            console.log(`[Autoplay Filter] Skipped duplicate/recent song version in fallback: "${item.title}"`);
            return false;
          }
          if (!preferMusicVideos && item.title.toLowerCase().includes('music video')) {
            console.log(`[Autoplay Filter] Skipped Music Video title in fallback (preferMusicVideos=false): "${item.title}"`);
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
          console.log('[Autoplay] Resolved fallback YouTube track:', validMatch.title, validMatch.url, 'artist:', matchedArtist);
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
