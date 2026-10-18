import { EnrichedTrackMeta } from './types';

// In-memory cache for iTunes metadata
const metaCache = new Map<string, EnrichedTrackMeta>();

// In-memory cache for resolved ISRCs
const isrcCache = new Map<string, string[]>();

// In-memory cache for Deezer track IDs
export const deezerTrackIdCache = new Map<string, string>();

/**
 * Enriches track metadata (album name, duration in seconds, official title/artist, artwork)
 * via iTunes Search API.
 */
export async function fetchEnrichedMeta(
  song: string,
  artist: string,
  signal?: AbortSignal
): Promise<EnrichedTrackMeta | null> {
  const query = `${artist} ${song}`.trim();
  if (!query) return null;

  const cached = metaCache.get(query.toLowerCase());
  if (cached) return cached;

  try {
    const res = await fetch(
      `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=1`,
      { signal }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const item = data?.results?.[0];
    if (!item) return null;

    const result: EnrichedTrackMeta = {
      song: item.trackName || song,
      artist: item.artistName || artist,
      album: item.collectionName || '',
      duration: Math.round((item.trackTimeMillis || 0) / 1000),
      artworkUrl: item.artworkUrl100 ? item.artworkUrl100.replace('100x100bb', '600x600bb') : undefined,
    };

    metaCache.set(query.toLowerCase(), result);
    return result;
  } catch {
    return null;
  }
}

/**
 * Performs a JSONP lookup on Deezer Search API in browser environments.
 */
function fetchDeezerJsonp(query: string, timeoutMs = 4000): Promise<string[]> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.resolve([]);
  }

  return new Promise((resolve) => {
    const callbackName = `deezer_cb_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    let timer: any = null;

    const cleanup = () => {
      if (timer) clearTimeout(timer);
      try {
        delete (window as any)[callbackName];
      } catch {}
      const script = document.getElementById(callbackName);
      if (script && script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };

    (window as any)[callbackName] = (data: any) => {
      cleanup();
      const isrcs: string[] = [];
      if (Array.isArray(data?.data)) {
        for (const item of data.data) {
          if (item?.id && !deezerTrackIdCache.has(query.toLowerCase())) {
            deezerTrackIdCache.set(query.toLowerCase(), String(item.id));
          }
          if (item?.isrc && typeof item.isrc === 'string') {
            isrcs.push(item.isrc.trim().toUpperCase());
          }
        }
      }
      resolve(isrcs);
    };

    timer = setTimeout(() => {
      cleanup();
      resolve([]);
    }, timeoutMs);

    const script = document.createElement('script');
    script.id = callbackName;
    script.src = `https://api.deezer.com/search?q=${encodeURIComponent(query)}&limit=5&output=jsonp&callback=${callbackName}`;
    script.onerror = () => {
      cleanup();
      resolve([]);
    };
    document.body.appendChild(script);
  });
}

/**
 * Searches Deezer API for ISRCs.
 */
async function fetchDeezerIsrcs(
  song: string,
  artist: string,
  signal?: AbortSignal
): Promise<string[]> {
  const query = `${song} ${artist}`.trim();

  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    return await fetchDeezerJsonp(query);
  }

  try {
    const res = await fetch(`https://api.deezer.com/search?q=${encodeURIComponent(query)}&limit=5`, {
      signal,
    });
    if (!res.ok) return [];
    const data = await res.json();
    const isrcs: string[] = [];
    if (Array.isArray(data?.data)) {
      for (const item of data.data) {
        if (item?.id && !deezerTrackIdCache.has(query.toLowerCase())) {
          deezerTrackIdCache.set(query.toLowerCase(), String(item.id));
        }
        if (item?.isrc && typeof item.isrc === 'string') {
          isrcs.push(item.isrc.trim().toUpperCase());
        }
      }
    }
    return isrcs;
  } catch {
    return [];
  }
}

/**
 * Searches MusicBrainz recordings for ISRCs.
 */
async function fetchMusicBrainzIsrcs(
  song: string,
  artist: string,
  signal?: AbortSignal
): Promise<string[]> {
  try {
    const url = `https://musicbrainz.org/ws/2/recording?query=recording:%22${encodeURIComponent(song)}%22%20AND%20artist:%22${encodeURIComponent(artist)}%22&fmt=json&limit=5`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'MediaBox/1.0 (https://github.com/boredkevin/mediabox)',
      },
      signal,
    });
    if (!res.ok) return [];
    const data = await res.json();
    const isrcs: string[] = [];
    for (const r of data?.recordings || []) {
      if (Array.isArray(r.isrcs)) {
        for (const isrc of r.isrcs) {
          if (isrc && typeof isrc === 'string' && !isrcs.includes(isrc.toUpperCase())) {
            isrcs.push(isrc.trim().toUpperCase());
          }
        }
      }
    }
    return isrcs;
  } catch {
    return [];
  }
}

/**
 * Queries LRC.red search endpoint for matching track IDs / ISRCs.
 */
async function fetchLrcRedSearchIsrcs(
  song: string,
  artist: string,
  duration?: number,
  album?: string,
  signal?: AbortSignal
): Promise<string[]> {
  try {
    const url = new URL('https://lrc.red/api/v1');
    url.searchParams.set('track', song);
    url.searchParams.set('artist', artist);
    if (duration && duration > 0) url.searchParams.set('duration', String(duration));
    if (album) url.searchParams.set('album', album);

    const res = await fetch(url.toString(), { signal });
    if (!res.ok) return [];
    const data = await res.json();
    const isrcs: string[] = [];
    if (Array.isArray(data?.results)) {
      for (const r of data.results) {
        const id = r.isrc || r.id;
        if (id && typeof id === 'string' && !isrcs.includes(id.toUpperCase())) {
          isrcs.push(id.trim().toUpperCase());
        }
      }
    }
    return isrcs;
  } catch {
    return [];
  }
}

/**
 * Fetches candidate ISRCs from publicly accessible music metadata APIs.
 */
export async function fetchIsrcsFromPublicApis(
  song: string,
  artist: string,
  duration?: number,
  album?: string,
  signal?: AbortSignal
): Promise<string[]> {
  const cacheKey = `${song}___${artist}`.toLowerCase();
  if (isrcCache.has(cacheKey)) {
    return isrcCache.get(cacheKey) || [];
  }

  const [deezerRes, mbRes, lrcredRes] = await Promise.allSettled([
    fetchDeezerIsrcs(song, artist, signal),
    fetchMusicBrainzIsrcs(song, artist, signal),
    fetchLrcRedSearchIsrcs(song, artist, duration, album, signal),
  ]);

  const candidates: string[] = [];
  const pushUnique = (list: any) => {
    if (Array.isArray(list)) {
      for (const id of list) {
        if (id && typeof id === 'string') {
          const upper = id.trim().toUpperCase();
          if (!candidates.includes(upper)) {
            candidates.push(upper);
          }
        }
      }
    }
  };

  if (deezerRes.status === 'fulfilled') pushUnique(deezerRes.value);
  if (mbRes.status === 'fulfilled') pushUnique(mbRes.value);
  if (lrcredRes.status === 'fulfilled') pushUnique(lrcredRes.value);

  isrcCache.set(cacheKey, candidates);
  return candidates;
}
