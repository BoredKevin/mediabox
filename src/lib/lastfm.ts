import { searchYouTubeVideos } from './youtube';

export interface LastFmTrackRecommendation {
  title: string;
  artist: string;
  query: string;
}

/**
 * Robustly parses YouTube video title and channel name into clean track and artist names.
 * Handles patterns:
 * - "h6itam - MONTAGEM ALQUIMIA (Official Video)" -> { artist: "h6itam", track: "MONTAGEM ALQUIMIA" }
 * - "MONTAGEM ALQUIMIA" (channel: "h6itam - Topic") -> { artist: "h6itam", track: "MONTAGEM ALQUIMIA" }
 * - "NO ERA AMOR - Slowed" (channel: "DJ Asul") -> { artist: "DJ Asul", track: "NO ERA AMOR - Slowed" }
 */
export const parseTrackAndArtist = (
  rawTitle: string,
  channelTitle?: string
): { artist: string; track: string } => {
  if (!rawTitle) return { artist: '', track: '' };

  // 1. Clean channel name if available (remove "- Topic", "VEVO", "Official", etc.)
  let cleanChannel = (channelTitle || '')
    .replace(/\s*-\s*Topic$/i, '')
    .replace(/\s*VEVO$/i, '')
    .replace(/^VEVO\s*/i, '')
    .replace(/\s*Official$/i, '')
    .replace(/\s*Records$/i, '')
    .replace(/\s*Music$/i, '')
    .replace(/\s*Channel$/i, '')
    .trim();

  // 2. Comprehensive noise tag removal from title (remove parens/brackets containing official, video, audio, lyric, slowed, etc.)
  let cleanTitle = rawTitle
    .replace(/[\(\[\{][^\)\]\}]*(official|music\s+video|video|audio|lyric|visualizer|slowed|reverb|speed|mv|hd|4k|clip|explicit|prod|remix|version|edit|cover)[^\)\]\}]*[\)\]\}]/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleanTitle) {
    cleanTitle = rawTitle.replace(/[\(\[\{\)\]\}]/g, '').trim();
  }

  // 3. Check for "Artist - Track" or "Track - Artist" dividers
  const hyphens = [' - ', ' – ', ' — ', ' : '];
  let extractedArtist = '';
  let extractedTrack = '';

  for (const h of hyphens) {
    if (cleanTitle.includes(h)) {
      const parts = cleanTitle.split(h);
      if (parts.length >= 2) {
        const p1 = parts[0].trim().replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, '');
        const p2 = parts.slice(1).join(h).trim();

        // If part 2 matches channel name better than part 1 (e.g. "Track - Artist")
        if (cleanChannel && p2.toLowerCase().includes(cleanChannel.toLowerCase())) {
          extractedArtist = p2;
          extractedTrack = p1;
        } else {
          extractedArtist = p1;
          extractedTrack = p2;
        }
        break;
      }
    }
  }

  // If no divider in title, track is cleanTitle and artist is cleanChannel
  if (!extractedTrack) {
    extractedTrack = cleanTitle;
    extractedArtist = cleanChannel;
  }

  // Final noise checks
  const noisePattern = /^(official|music\s+video|video|audio|lyric|hd|4k|mv)$/i;
  if (!extractedArtist || noisePattern.test(extractedArtist)) {
    extractedArtist = cleanChannel;
  }

  if (!extractedTrack || noisePattern.test(extractedTrack)) {
    extractedTrack = cleanTitle || rawTitle;
  }

  return { artist: extractedArtist.trim(), track: extractedTrack.trim() };
};

/**
 * Normalizes string for fuzzy comparison.
 */
const normalizeStr = (str: string): string => {
  return (str || '').toLowerCase().replace(/[^a-z0-9]/g, '');
};

/**
 * Fetches similar tracks from Last.fm API with multi-stage fallbacks:
 * Stage 1: track.getSimilar (track + artist)
 * Stage 2: track.getSimilar (artist + track swapped)
 * Stage 3: track.getSimilar (track only)
 * Stage 4: track.search -> track.getSimilar
 * Stage 5: artist.getTopTracks fallback
 */
export const fetchSimilarTrackFromLastFm = async (
  currentPlayingTitle: string,
  channelTitle: string = '',
  recentHistory: string[] = []
): Promise<LastFmTrackRecommendation | null> => {
  const apiKey = import.meta.env.VITE_LASTFM_API_KEY || '09e1f1c026f13aed192a7cf26b26f003';
  const { artist, track } = parseTrackAndArtist(currentPlayingTitle, channelTitle);

  console.log(`[Last.fm Autoplay] Parsed track="${track}", artist="${artist}" (from rawTitle="${currentPlayingTitle}", channel="${channelTitle}")`);

  const cleanCurrentTitleNorm = normalizeStr(currentPlayingTitle);
  const cleanTrackNorm = normalizeStr(track);
  const historyNorms = recentHistory.map(normalizeStr);

  const queryLastFmSimilar = async (targetTrack: string, targetArtist: string) => {
    if (!targetTrack) return null;
    let url = `https://ws.audioscrobbler.com/2.0/?method=track.getSimilar&track=${encodeURIComponent(targetTrack)}&limit=15&format=json&api_key=${apiKey}`;
    if (targetArtist) {
      url += `&artist=${encodeURIComponent(targetArtist)}`;
    }

    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      const data = await res.json();
      const tracks = data?.similartracks?.track;
      if (Array.isArray(tracks) && tracks.length > 0) {
        return tracks;
      }
    } catch (err) {
      console.warn('[Last.fm API] getSimilar fetch error:', err);
    }
    return null;
  };

  let candidateTracks: any[] | null = null;

  // Stage 1: Try track.getSimilar with track + artist
  if (artist && track) {
    candidateTracks = await queryLastFmSimilar(track, artist);
  }

  // Stage 2: Try with swapped artist / track
  if (!candidateTracks && artist && track) {
    candidateTracks = await queryLastFmSimilar(artist, track);
  }

  // Stage 3: Try track only
  if (!candidateTracks && track) {
    candidateTracks = await queryLastFmSimilar(track, '');
  }

  // Stage 4: Try Last.fm track.search to find canonical track/artist first
  if (!candidateTracks && (track || artist)) {
    try {
      const searchQuery = artist ? `${artist} ${track}` : track;
      const searchUrl = `https://ws.audioscrobbler.com/2.0/?method=track.search&track=${encodeURIComponent(searchQuery)}&limit=5&format=json&api_key=${apiKey}`;
      const searchRes = await fetch(searchUrl);
      if (searchRes.ok) {
        const searchData = await searchRes.json();
        const foundTracks = searchData?.results?.trackmatches?.track;
        if (Array.isArray(foundTracks) && foundTracks.length > 0) {
          const topMatch = foundTracks[0];
          if (topMatch.name && topMatch.artist) {
            candidateTracks = await queryLastFmSimilar(topMatch.name, topMatch.artist);
          }
        }
      }
    } catch (e) {
      console.warn('[Last.fm API] track.search fallback failed:', e);
    }
  }

  // Filter candidates to exclude current track and recent history
  if (candidateTracks && candidateTracks.length > 0) {
    for (const item of candidateTracks) {
      const candidateName = item.name || '';
      const candidateArtist = item.artist?.name || '';
      const candidateFull = `${candidateArtist} - ${candidateName}`;
      const candidateNorm = normalizeStr(candidateFull);
      const candidateNameNorm = normalizeStr(candidateName);

      const isCurrent =
        candidateNorm === cleanCurrentTitleNorm ||
        candidateNameNorm === cleanTrackNorm ||
        cleanCurrentTitleNorm.includes(candidateNameNorm);

      const isRecent = historyNorms.some(
        (h) => h === candidateNorm || h.includes(candidateNameNorm)
      );

      if (!isCurrent && !isRecent) {
        const resultQuery = candidateArtist ? `${candidateArtist} ${candidateName}` : candidateName;
        return {
          title: candidateName,
          artist: candidateArtist,
          query: resultQuery,
        };
      }
    }
  }

  // Stage 5: Final Fallback - Query artist top tracks or general music search
  if (artist) {
    try {
      const topTracksUrl = `https://ws.audioscrobbler.com/2.0/?method=artist.getTopTracks&artist=${encodeURIComponent(artist)}&limit=5&format=json&api_key=${apiKey}`;
      const topRes = await fetch(topTracksUrl);
      if (topRes.ok) {
        const topData = await topRes.json();
        const topTracks = topData?.toptracks?.track;
        if (Array.isArray(topTracks) && topTracks.length > 0) {
          for (const item of topTracks) {
            const candidateName = item.name || '';
            const candidateArtist = item.artist?.name || artist;
            const candidateNameNorm = normalizeStr(candidateName);
            if (candidateNameNorm !== cleanTrackNorm && !historyNorms.includes(candidateNameNorm)) {
              return {
                title: candidateName,
                artist: candidateArtist,
                query: `${candidateArtist} ${candidateName}`,
              };
            }
          }
        }
      }
    } catch (e) {
      console.warn('[Last.fm API] artist.getTopTracks fallback failed:', e);
    }

    return {
      title: `${artist} song`,
      artist: artist,
      query: `${artist} music`,
    };
  }

  return null;
};

/**
 * Resolves next autoplay YouTube track based on current song metadata.
 */
export const getAutoplayNextYouTubeTrack = async (
  currentPlayingTitle: string,
  channelTitle: string = '',
  recentHistory: string[] = []
): Promise<{ url: string; title: string } | null> => {
  try {
    const recommendation = await fetchSimilarTrackFromLastFm(currentPlayingTitle, channelTitle, recentHistory);
    let searchQuery = recommendation?.query;

    if (!searchQuery) {
      const { artist, track } = parseTrackAndArtist(currentPlayingTitle, channelTitle);
      searchQuery = artist ? `${artist} music` : `${track} music`;
    }

    console.log('[Autoplay] Searching YouTube for recommendation:', searchQuery);
    const searchRes = await searchYouTubeVideos(searchQuery);

    if (searchRes.results && searchRes.results.length > 0) {
      const topMatch = searchRes.results[0];
      return {
        url: topMatch.url,
        title: topMatch.title,
      };
    }
  } catch (err) {
    console.error('[Autoplay] Failed to resolve autoplay track:', err);
  }
  return null;
};
