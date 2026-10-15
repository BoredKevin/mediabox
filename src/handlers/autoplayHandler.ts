import { SearchResultItem, parseYouTubeVideoId } from '@/lib/roomUtils';
import { parseTrackAndArtist, normalizeStr, cleanArtistName } from '@/lib/trackParser';
import { getYTMusicUpNext, searchYTMusic, searchYouTube } from '@/lib/ytmusicSearch';

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
 * Finds the first candidate from a list that satisfies all autoplay quality guards.
 */
function findValidAutoplayCandidate(
  candidates: SearchResultItem[],
  excludedVideoIds: Set<string>,
  cleanCurrentTrackNorm: string,
  historyNorms: string[],
  recentArtistHistory: string[],
  preferMusicVideos: boolean
): SearchResultItem | null {
  const sorted = preferMusicVideos
    ? candidates
    : [...candidates].sort((a, b) => scoreAudioPurity(b) - scoreAudioPurity(a));

  for (const item of sorted) {
    const itemVideoId = parseYouTubeVideoId(item.url) || item.id;
    if (itemVideoId && excludedVideoIds.has(itemVideoId)) {
      continue;
    }
    // Duration filter: exclude shorts (<60s) and long videos/loops (>12m)
    if (typeof item.durationSeconds === 'number') {
      if (item.durationSeconds < 60 || item.durationSeconds > 720) {
        continue;
      }
    }
    // Title filter: exclude loops, compilations, full albums
    if (isUnwantedLongOrCompilation(item.title)) {
      continue;
    }
    // Duplicate check
    if (isDuplicateSong(item.title, item.channelTitle, cleanCurrentTrackNorm, historyNorms)) {
      continue;
    }
    // Artist repeat limit check (<= 2 consecutive)
    const itemParsed = parseTrackAndArtist(item.title, item.channelTitle);
    const candidateArtist = itemParsed.artist || item.channelTitle;
    if (isArtistRepeatLimitReached(candidateArtist, recentArtistHistory)) {
      continue;
    }
    return item;
  }

  return null;
}

/**
 * Resolves next autoplay YouTube track based on current song metadata.
 * Uses YouTube Music's native algorithmic Automix/Radio API in a single network call.
 * Explicitly excludes current playing YouTube video ID, recent URL history, duplicate song names/artists,
 * and limits consecutive artist repeats to at most 2.
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

    console.log('[Autoplay] Resolving next track. Current:', cleanCurrentTrack, 'artist:', artist);
    console.log('[Autoplay] preferMusicVideos:', preferMusicVideos);
    console.log('[Autoplay] Recent artist history:', recentArtistHistory);

    // 1. Primary path: Native YouTube Music Automix / Radio queue
    if (currentVideoId) {
      console.log(`[Autoplay] Requesting YTM Up Next / Radio for videoId: "${currentVideoId}"`);
      const radioTracks = await getYTMusicUpNext(currentVideoId);
      const match = findValidAutoplayCandidate(
        radioTracks,
        excludedVideoIds,
        cleanCurrentTrackNorm,
        historyNorms,
        recentArtistHistory,
        preferMusicVideos
      );

      if (match) {
        const itemParsed = parseTrackAndArtist(match.title, match.channelTitle);
        const matchedArtist = itemParsed.artist || match.channelTitle;
        console.log(
          '[Autoplay] Resolved via YTM Radio:',
          match.title,
          match.url,
          'artist:',
          matchedArtist,
          typeof match.durationSeconds === 'number' ? `(${match.durationSeconds}s)` : ''
        );
        return {
          url: match.url,
          title: match.title,
          artist: matchedArtist,
        };
      }
    }

    // 2. Fallback path: If video ID was missing or radio queue had no valid candidates, run a single search
    const fallbackQuery = artist && !isArtistRepeatLimitReached(artist, recentArtistHistory)
      ? (preferMusicVideos ? `${artist} music` : `${artist} topic`)
      : (cleanCurrentTrack ? `${cleanCurrentTrack} music` : 'popular music');

    console.log('[Autoplay] Radio empty or unresolvable; running single fallback search for:', fallbackQuery);
    const fallbackResults = preferMusicVideos
      ? await searchYTMusic(fallbackQuery)
      : await searchYouTube(fallbackQuery);

    const fallbackMatch = findValidAutoplayCandidate(
      fallbackResults,
      excludedVideoIds,
      cleanCurrentTrackNorm,
      historyNorms,
      recentArtistHistory,
      preferMusicVideos
    );

    if (fallbackMatch) {
      const itemParsed = parseTrackAndArtist(fallbackMatch.title, fallbackMatch.channelTitle);
      const matchedArtist = itemParsed.artist || fallbackMatch.channelTitle;
      console.log(
        '[Autoplay] Resolved via fallback search:',
        fallbackMatch.title,
        fallbackMatch.url,
        'artist:',
        matchedArtist,
        typeof fallbackMatch.durationSeconds === 'number' ? `(${fallbackMatch.durationSeconds}s)` : ''
      );
      return {
        url: fallbackMatch.url,
        title: fallbackMatch.title,
        artist: matchedArtist,
      };
    }
  } catch (err) {
    console.error('[Autoplay] Failed to resolve autoplay track:', err);
  }
  return null;
};
