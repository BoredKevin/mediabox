import { searchYouTubeVideos } from './youtube';
import { parseYouTubeVideoId } from './roomUtils';

export interface LastFmTrackRecommendation {
  title: string;
  artist: string;
  query: string;
}

/**
 * Robustly parses YouTube video title and channel name (oEmbed author) into clean track and artist names.
 * Handles patterns:
 * - "PERTO (Super Slowed)" (channel: "SXYGX - Topic") -> { artist: "SXYGX", track: "PERTO" }
 * - "h6itam - MONTAGEM ALQUIMIA (Official Video)" -> { artist: "h6itam", track: "MONTAGEM ALQUIMIA" }
 * - "Song Name ft. Drake (Remix)" (channel: "Topic Channel") -> { artist: "Drake", track: "Song Name" }
 */
export const parseTrackAndArtist = (
  rawTitle: string,
  channelTitle?: string
): { artist: string; track: string } => {
  if (!rawTitle) return { artist: '', track: '' };

  // 1. Clean author/channel name from oEmbed API (remove "- Topic", "VEVO", "Official", etc.)
  let cleanChannel = (channelTitle || '')
    .replace(/\s*-\s*Topic$/i, '')
    .replace(/\s*VEVO$/i, '')
    .replace(/^VEVO\s*/i, '')
    .replace(/\s*Official$/i, '')
    .replace(/\s*Records$/i, '')
    .replace(/\s*Music$/i, '')
    .replace(/\s*Channel$/i, '')
    .trim();

  // 2. Comprehensive noise removal from raw title:
  // Remove parenthesized / bracketed noise tags: (Super Slowed), (Slowed & Reverb), (Remix), (ft. ...), (Official Video), etc.
  let cleanTitle = rawTitle
    .replace(/[\(\[\{][^\)\]\}]*(official|music\s+video|video|audio|lyric|visualizer|super\s+slowed|slowed|reverb|speed|sped|nightcore|remix|edit|version|cover|mv|hd|4k|clip|explicit|prod|feat|ft)[^\)\]\}]*[\)\]\}]/gi, '')
    .replace(/\b(super\s+slowed|slowed\s*\&\s*reverb|slowed|reverb|sped\s+up|speed\s+up|nightcore|remix|edit|official\s+video|official\s+audio|lyric\s+video)\b/gi, '')
    .replace(/\b(ft|ft\.|feat|feat\.|featuring)\s+[a-zA-Z0-9_\s&-]+/gi, '')
    .replace(/[\(\[\{\)\]\}]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleanTitle) {
    cleanTitle = rawTitle.replace(/[\(\[\{\)\]\}]/g, '').trim();
  }

  // 3. Analyze title to extract artist name vs track name
  const hyphens = [' - ', ' – ', ' — ', ' : '];
  let extractedArtist = '';
  let extractedTrack = '';

  for (const h of hyphens) {
    if (cleanTitle.includes(h)) {
      const parts = cleanTitle.split(h);
      if (parts.length >= 2) {
        const p1 = parts[0].trim().replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, '');
        const p2 = parts.slice(1).join(h).trim();

        // Check if Part 2 matches channel/author better than Part 1
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

  // 4. If no artist divider found in title, use cleanTitle as track and fall back to cleanChannel (oEmbed author with "- Topic" removed) as artist!
  if (!extractedTrack) {
    extractedTrack = cleanTitle;
    extractedArtist = cleanChannel;
  }

  // Final noise checks for artist and track
  const noisePattern = /^(official|music\s+video|video|audio|lyric|hd|4k|mv|super\s+slowed|slowed|remix)$/i;
  if (!extractedArtist || noisePattern.test(extractedArtist)) {
    extractedArtist = cleanChannel;
  }

  if (!extractedTrack || noisePattern.test(extractedTrack)) {
    extractedTrack = cleanTitle || rawTitle;
  }

  return { artist: extractedArtist.trim(), track: extractedTrack.trim() };
};

/**
 * Normalizes string for fuzzy comparison by stripping noise tags and non-alphanumeric characters.
 */
export const normalizeStr = (str: string): string => {
  return (str || '')
    .toLowerCase()
    .replace(/[\(\[\{][^\)\]\}]*(official|music\s+video|video|audio|lyric|visualizer|super\s+slowed|slowed|reverb|speed|sped|nightcore|remix|edit|version|cover|mv|hd|4k|clip|explicit|prod|feat|ft)[^\)\]\}]*[\)\]\}]/gi, '')
    .replace(/\b(super\s+slowed|slowed\s*\&\s*reverb|slowed|reverb|sped\s+up|speed\s+up|nightcore|remix|edit|official\s+video|official\s+audio|lyric\s+video)\b/gi, '')
    .replace(/\b(ft|ft\.|feat|feat\.|featuring)\s+[a-zA-Z0-9_\s&-]+/gi, '')
    .replace(/[^a-z0-9]/g, '');
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

/**
 * Resolves next autoplay YouTube track based on current song metadata.
 * Explicitly excludes current playing YouTube video ID, recent URL history, and duplicate song names/artists.
 */
export const getAutoplayNextYouTubeTrack = async (
  currentPlayingTitle: string,
  channelTitle: string = '',
  recentHistory: string[] = [],
  currentPlayingUrl: string = '',
  recentUrls: string[] = []
): Promise<{ url: string; title: string } | null> => {
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
    console.log('[Autoplay] Excluded Video IDs:', Array.from(excludedVideoIds));

    const isDuplicateSong = (itemTitle: string, itemChannelTitle: string): boolean => {
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

    const recommendations = await fetchSimilarTracksFromLastFm(currentPlayingTitle, channelTitle, recentHistory);

    // Try recommendations from Last.fm
    for (const rec of recommendations) {
      console.log('[Autoplay] Searching YouTube for recommendation:', rec.query);
      const searchRes = await searchYouTubeVideos(rec.query);

      if (searchRes.results && searchRes.results.length > 0) {
        const validMatch = searchRes.results.find((item) => {
          const itemVideoId = parseYouTubeVideoId(item.url) || item.id;
          if (itemVideoId && excludedVideoIds.has(itemVideoId)) {
            return false;
          }
          if (isDuplicateSong(item.title, item.channelTitle)) {
            console.log(`[Autoplay Filter] Skipped duplicate/recent song version: "${item.title}"`);
            return false;
          }
          return true;
        });

        if (validMatch) {
          console.log('[Autoplay] Resolved non-duplicate YouTube track:', validMatch.title, validMatch.url);
          return {
            url: validMatch.url,
            title: validMatch.title,
          };
        }
      }
    }

    // Fallback: search using track/artist name directly if recommendations were empty or all returned excluded videos
    const fallbackQueries = [
      artist ? `${artist} music` : null,
      cleanCurrentTrack ? `${cleanCurrentTrack} music` : null,
      'popular music video',
    ].filter(Boolean) as string[];

    for (const searchQuery of fallbackQueries) {
      console.log('[Autoplay] Fallback searching YouTube for:', searchQuery);
      const searchRes = await searchYouTubeVideos(searchQuery);

      if (searchRes.results && searchRes.results.length > 0) {
        const validMatch = searchRes.results.find((item) => {
          const itemVideoId = parseYouTubeVideoId(item.url) || item.id;
          if (itemVideoId && excludedVideoIds.has(itemVideoId)) {
            return false;
          }
          if (isDuplicateSong(item.title, item.channelTitle)) {
            console.log(`[Autoplay Filter] Skipped duplicate/recent song version in fallback: "${item.title}"`);
            return false;
          }
          return true;
        });

        if (validMatch) {
          console.log('[Autoplay] Resolved fallback YouTube track:', validMatch.title, validMatch.url);
          return {
            url: validMatch.url,
            title: validMatch.title,
          };
        }
      }
    }
  } catch (err) {
    console.error('[Autoplay] Failed to resolve autoplay track:', err);
  }
  return null;
};


