import { SearchResultItem, parseYouTubeVideoId } from '@/lib/roomUtils';
import { parseTrackAndArtist, normalizeStr, cleanArtistName } from '@/lib/trackParser';

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
 * Checks if candidate artist would result in consecutive repeat of the same artist.
 * Prevents playing the same artist twice in a row, mirroring YouTube Music radio.
 */
export const isArtistRepeatLimitReached = (
  candidateArtist: string,
  recentArtistHistory: string[]
): boolean => {
  if (!candidateArtist || recentArtistHistory.length === 0) return false;
  return isSameArtist(candidateArtist, recentArtistHistory[0]);
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
 */
export const scoreAudioPurity = (item: SearchResultItem): number => {
  if (isUnwantedLongOrCompilation(item.title) || (typeof item.durationSeconds === 'number' && item.durationSeconds > 720)) {
    return 0;
  }

  const channel = (item.channelTitle || '').toLowerCase();
  const title = (item.title || '').toLowerCase();

  if (isTopicChannel(item.channelTitle || '')) return 3;

  const isAudioTitle = /\b(official\s+audio|audio|lyric\s+video|lyric)\b/.test(title);
  const isLabelChannel = /\bmusic\b/.test(channel) && !channel.includes('vevo');
  if (isAudioTitle || isLabelChannel) return 2;

  const isMusicVideoTitle = /\b(official\s+(music\s+)?video|music\s+video|\bmv\b|official\s+mv|video\s+clip)\b/.test(title);
  const isVevo = channel.includes('vevo');
  if (isMusicVideoTitle || isVevo) return 0;

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
 * Filters a raw list of candidates according to all MediaBox quality and freshness guardrails.
 * Returns an array of clean, ordered candidates.
 */
export function filterRadioCandidates(
  candidates: SearchResultItem[],
  excludedVideoIds: Set<string>,
  cleanCurrentTrackNorm: string,
  historyNorms: string[],
  recentArtistHistory: string[],
  preferMusicVideos: boolean
): SearchResultItem[] {
  const sorted = preferMusicVideos
    ? candidates
    : [...candidates].sort((a, b) => scoreAudioPurity(b) - scoreAudioPurity(a));

  const validItems: SearchResultItem[] = [];
  const seenIds = new Set<string>();

  for (const item of sorted) {
    const itemVideoId = parseYouTubeVideoId(item.url) || item.id;
    if (!itemVideoId || excludedVideoIds.has(itemVideoId) || seenIds.has(itemVideoId)) {
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
    // Artist repeat limit check (no consecutive repeats of the same artist)
    const itemParsed = parseTrackAndArtist(item.title, item.channelTitle);
    const candidateArtist = itemParsed.artist || item.channelTitle;
    if (isArtistRepeatLimitReached(candidateArtist, recentArtistHistory)) {
      continue;
    }

    seenIds.add(itemVideoId);
    validItems.push(item);
  }

  return validItems;
}

/**
 * Fetches the native YouTube Music Automix / Radio queue for a seed video ID,
 * and filters all candidates against duration, duplicate, loop, and artist repetition guardrails.
 */
export async function fetchAndFilterRadioQueue(
  seedVideoId: string,
  excludedVideoIds: Set<string>,
  recentHistory: string[] = [],
  recentArtistHistory: string[] = [],
  preferMusicVideos: boolean = true
): Promise<SearchResultItem[]> {
  try {
    const { getYTMusicUpNext } = await import('@/lib/ytmusicSearch');
    console.log(`[Autoplay] Fetching YTM Radio Automix queue for seed: "${seedVideoId}"`);
    const rawRadioTracks = await getYTMusicUpNext(seedVideoId);
    if (!rawRadioTracks || rawRadioTracks.length === 0) {
      return [];
    }

    const historyNorms = recentHistory.map(normalizeStr);
    return filterRadioCandidates(
      rawRadioTracks,
      excludedVideoIds,
      '',
      historyNorms,
      recentArtistHistory,
      preferMusicVideos
    );
  } catch (err) {
    console.warn(`[Autoplay] Error fetching radio queue for "${seedVideoId}":`, err);
    return [];
  }
}

/**
 * Built-in fallback search algorithm when YouTube Music Radio is unavailable or exhausted.
 * Searches related music tracks without repeating the previous artist.
 */
export async function getFallbackAutoplayTrack(
  cleanCurrentTrack: string,
  currentArtist: string,
  excludedVideoIds: Set<string>,
  historyNorms: string[],
  recentArtistHistory: string[],
  preferMusicVideos: boolean
): Promise<{ url: string; title: string; artist?: string } | null> {
  try {
    const { searchYTMusic, searchYouTube } = await import('@/lib/ytmusicSearch');

    // Create a diverse query centered on track/genre rather than identical artist repeat
    const fallbackQuery = cleanCurrentTrack
      ? `${cleanCurrentTrack} music`
      : (currentArtist ? `${currentArtist} songs` : 'popular music');

    console.log('[Autoplay] Running fallback search for:', fallbackQuery);
    const searchResults = preferMusicVideos
      ? await searchYTMusic(fallbackQuery)
      : await searchYouTube(fallbackQuery);

    const validCandidates = filterRadioCandidates(
      searchResults,
      excludedVideoIds,
      normalizeStr(cleanCurrentTrack),
      historyNorms,
      recentArtistHistory,
      preferMusicVideos
    );

    if (validCandidates.length > 0) {
      const match = validCandidates[0];
      const itemParsed = parseTrackAndArtist(match.title, match.channelTitle);
      const matchedArtist = itemParsed.artist || match.channelTitle;
      return {
        url: match.url,
        title: match.title,
        artist: matchedArtist,
      };
    }
  } catch (err) {
    console.error('[Autoplay] Fallback search error:', err);
  }
  return null;
}

/**
 * Resolves next autoplay YouTube track based on current song metadata.
 * Uses YouTube Music's native algorithmic Automix/Radio API in a single network call.
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

    // 1. Primary path: Native YouTube Music Automix / Radio queue
    if (currentVideoId) {
      const radioTracks = await fetchAndFilterRadioQueue(
        currentVideoId,
        excludedVideoIds,
        recentHistory,
        recentArtistHistory,
        preferMusicVideos
      );

      if (radioTracks.length > 0) {
        const match = radioTracks[0];
        const itemParsed = parseTrackAndArtist(match.title, match.channelTitle);
        const matchedArtist = itemParsed.artist || match.channelTitle;
        console.log('[Autoplay] Resolved via YTM Radio:', match.title, 'artist:', matchedArtist);
        return {
          url: match.url,
          title: match.title,
          artist: matchedArtist,
        };
      }
    }

    // 2. Fallback path: built-in query search
    return await getFallbackAutoplayTrack(
      cleanCurrentTrack,
      artist,
      excludedVideoIds,
      historyNorms,
      recentArtistHistory,
      preferMusicVideos
    );
  } catch (err) {
    console.error('[Autoplay] Failed to resolve autoplay track:', err);
  }
  return null;
};
