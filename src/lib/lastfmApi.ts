import { parseTrackAndArtist, normalizeStr } from './trackParser';

export interface LastFmTrackRecommendation {
  title: string;
  artist: string;
  query: string;
}

const queryLastFmSimilar = async (
  targetTrack: string,
  targetArtist: string,
  apiKey: string
): Promise<any[] | null> => {
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

/**
 * Fetches similar tracks from Last.fm API with multi-stage fallbacks:
 * Stage 1: track.getSimilar (track + artist)
 * Stage 2: track.getSimilar (artist + track swapped)
 * Stage 3: track.getSimilar (track only)
 * Stage 4: track.search -> track.getSimilar
 * Stage 5: artist.getTopTracks fallback
 */
export const fetchSimilarTracksFromLastFm = async (
  currentPlayingTitle: string,
  channelTitle: string = '',
  recentHistory: string[] = []
): Promise<LastFmTrackRecommendation[]> => {
  const apiKey = import.meta.env.VITE_LASTFM_API_KEY || '09e1f1c026f13aed192a7cf26b26f003';
  const { artist, track } = parseTrackAndArtist(currentPlayingTitle, channelTitle);

  console.log(`[Last.fm Autoplay] Parsed track="${track}", artist="${artist}" (from rawTitle="${currentPlayingTitle}", channel="${channelTitle}")`);

  const cleanCurrentTitleNorm = normalizeStr(currentPlayingTitle);
  const cleanTrackNorm = normalizeStr(track);
  const historyNorms = recentHistory.map(normalizeStr);

  const recommendations: LastFmTrackRecommendation[] = [];

  let candidateTracks: any[] | null = null;

  // Stage 1: Try track.getSimilar with track + artist
  if (artist && track) {
    candidateTracks = await queryLastFmSimilar(track, artist, apiKey);
  }

  // Stage 2: Try with swapped artist / track
  if (!candidateTracks && artist && track) {
    candidateTracks = await queryLastFmSimilar(artist, track, apiKey);
  }

  // Stage 3: Try track only
  if (!candidateTracks && track) {
    candidateTracks = await queryLastFmSimilar(track, '', apiKey);
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
            candidateTracks = await queryLastFmSimilar(topMatch.name, topMatch.artist, apiKey);
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
        (cleanTrackNorm.length > 2 && candidateNameNorm.includes(cleanTrackNorm));

      const isRecent = historyNorms.some(
        (h) => h && (h === candidateNorm || h === candidateNameNorm || (h.length > 2 && candidateNameNorm.includes(h)))
      );

      if (!isCurrent && !isRecent) {
        const resultQuery = candidateArtist ? `${candidateArtist} ${candidateName}` : candidateName;
        recommendations.push({
          title: candidateName,
          artist: candidateArtist,
          query: resultQuery,
        });
      }
    }
  }

  // Stage 5: Final Fallback - Query artist top tracks or general music search
  if (artist && recommendations.length === 0) {
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
              recommendations.push({
                title: candidateName,
                artist: candidateArtist,
                query: `${candidateArtist} ${candidateName}`,
              });
            }
          }
        }
      }
    } catch (e) {
      console.warn('[Last.fm API] artist.getTopTracks fallback failed:', e);
    }

    if (recommendations.length === 0) {
      recommendations.push({
        title: `${artist} song`,
        artist: artist,
        query: `${artist} music`,
      });
    }
  }

  return recommendations;
};
