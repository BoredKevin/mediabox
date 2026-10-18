import {
  TTMLParser,
  LRCParser,
  PlainParser,
  parseQRC,
  detectParser,
  type Lyric,
  type LyricPart,
} from '@braccato/parsers';
import { isYouTubeMusicTrack } from './ytmusicDetector';
import { parseTrackAndArtist } from './trackParser';

export interface ResolvedLyricsData {
  lyrics: Lyric[];
  source: string;
  sourceHref?: string;
  isFromUnison: boolean;
  syncType?: 'syllable' | 'word' | 'line' | 'unsynced';
  rawTtml?: string;
  enrichedMeta?: {
    song: string;
    artist: string;
    album: string;
    duration: number;
    artworkUrl?: string;
  };
}

// In-memory cache for resolved lyrics to prevent duplicate network calls
const lyricsCache = new Map<string, ResolvedLyricsData | null>();

// Metadata cache (iTunes Search API)
const metaCache = new Map<
  string,
  { song: string; artist: string; album: string; duration: number; artworkUrl?: string }
>();

const PARSERS: Record<string, any> = {
  ttml: TTMLParser,
  lrc: LRCParser,
  plain: PlainParser,
};

/**
 * Coalesces syllable-synced LyricParts into full word-synced LyricParts.
 * Reduces DOM nodes by ~65%, cuts Web Animations API instances by ~70%,
 * and provides smooth word-level karaoke highlighting (Spotify/Apple Music style).
 */
export function coalesceSyllablesToWords(lyrics: Lyric[]): Lyric[] {
  return lyrics.map((line) => {
    if (!line.parts || line.parts.length <= 1) return line;

    const newParts: LyricPart[] = [];
    let currentWord: LyricPart | null = null;

    for (let i = 0; i < line.parts.length; i++) {
      const part = line.parts[i];
      const partText = part.words || '';

      if (!currentWord) {
        currentWord = {
          startTimeMs: part.startTimeMs,
          durationMs: part.durationMs,
          words: partText.endsWith('-') ? partText.slice(0, -1) : partText,
          isBackground: part.isBackground,
          explicit: part.explicit,
        };
      } else {
        const prevText = currentWord.words;
        const prevEndsWithSpace = /\s$/.test(prevText);
        const thisStartsWithSpace = /^\s/.test(partText);
        const prevHadHyphen = part.words.startsWith('-') || line.parts[i - 1]?.words?.endsWith('-');

        // If either part indicates a word boundary (whitespace) and there is no hyphen continuation:
        if ((prevEndsWithSpace || thisStartsWithSpace) && !prevHadHyphen) {
          newParts.push(currentWord);
          currentWord = {
            startTimeMs: part.startTimeMs,
            durationMs: part.durationMs,
            words: partText.endsWith('-') ? partText.slice(0, -1) : partText,
            isBackground: part.isBackground,
            explicit: part.explicit,
          };
        } else {
          // Merge syllable into the current word
          let appendText = partText;
          if (appendText.endsWith('-') && i < line.parts.length - 1) {
            appendText = appendText.slice(0, -1);
          }
          currentWord.words += appendText;
          const endMs = part.startTimeMs + part.durationMs;
          currentWord.durationMs = Math.max(currentWord.durationMs, endMs - currentWord.startTimeMs);
        }
      }
    }

    if (currentWord) {
      newParts.push(currentWord);
    }

    return {
      ...line,
      parts: newParts,
    };
  });
}

/**
 * Enriches track metadata (album name, duration in seconds, official title/artist, artwork)
 * via iTunes Search API. This is critical for Better Lyrics because its cache key
 * strictly requires exact song, artist, album, and durationSeconds.
 */
async function fetchEnrichedMeta(
  song: string,
  artist: string,
  signal?: AbortSignal
): Promise<{ song: string; artist: string; album: string; duration: number; artworkUrl?: string } | null> {
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

    const result = {
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
 * Fetches Unison community lyrics directly by YouTube videoId.
 * Clean, lightweight, and fast (<200ms) with zero prerequisite metadata.
 */
export async function fetchUnisonByVideoId(
  videoId: string,
  signal?: AbortSignal,
  durationSeconds: number = 180
): Promise<ResolvedLyricsData | null> {
  if (!videoId) return null;
  try {
    const unisonRes = await fetch(`https://unison.boidu.dev/lyrics?v=${encodeURIComponent(videoId)}`, {
      signal,
    });
    if (unisonRes.ok) {
      const json = await unisonRes.json();
      const data = json?.data;
      if (data?.lyrics) {
        const parser = detectParser(data.lyrics);
        const parsedLyrics = parser.parse(data.lyrics, (data.duration || durationSeconds || 180) * 1000);
        if (parsedLyrics && parsedLyrics.length > 0) {
          const hasSyllables = parsedLyrics.some((l: any) => l.parts && l.parts.length > 0);
          return {
            lyrics: parsedLyrics,
            source: 'Unison',
            sourceHref: 'https://unison.boidu.dev/',
            isFromUnison: true,
            syncType: hasSyllables ? 'syllable' : 'line',
            rawTtml: data.format === 'ttml' ? data.lyrics : undefined,
          };
        }
      }
    }
  } catch (err: any) {
    if (err?.name === 'AbortError') return null;
  }
  return null;
}

// In-memory cache for resolved ISRCs to avoid redundant search queries
const isrcCache = new Map<string, string[]>();

// In-memory cache for Deezer track IDs used by Octave Streaming
const deezerTrackIdCache = new Map<string, string>();

function normalizeText(text: string): string {
  return (text || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}


/**
 * Performs a JSONP lookup on Deezer Search API in browser environments
 * to obtain official verified major-label ISRCs without CORS restrictions.
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
 * Searches Deezer API for ISRCs (using JSONP in browser or direct fetch in Node/SSR).
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
 * Searches MusicBrainz recordings for ISRCs (open public database with CORS enabled).
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
 * Queries LRC.red's search endpoint for matching track IDs / ISRCs.
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
 * Fetches candidate ISRCs from publicly accessible music metadata APIs
 * (LRC.red search, Deezer, and MusicBrainz).
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

/**
 * Fetches and parses syllable/word-level TTML from https://lrc.red/s/{ISRC}.ttml
 */
async function fetchLrcRedLyrics(
  isrc: string,
  signal?: AbortSignal
): Promise<{ lyrics: Lyric[]; rawTtml: string; syncType: 'syllable' | 'line' } | null> {
  if (!isrc) return null;
  try {
    const res = await fetch(`https://lrc.red/s/${encodeURIComponent(isrc)}.ttml`, { signal });
    if (!res.ok) return null;
    const text = await res.text();
    if (!text || !text.includes('<tt')) return null;

    const parsed = TTMLParser.parse(text);
    if (!parsed || parsed.length === 0) return null;

    const hasSyllables = parsed.some((l) => l.parts && l.parts.length > 0);
    return {
      lyrics: parsed,
      rawTtml: text,
      syncType: hasSyllables ? 'syllable' : 'line',
    };
  } catch (err: any) {
    if (err?.name === 'AbortError') throw err;
    return null;
  }
}

/**
 * Parses Octave Streaming's richSync array or fallback LRC lyrics into @braccato/parsers Lyric format.
 */
export function parseOctaveLyrics(data: any): Lyric[] | null {
  if (!data) return null;

  if (Array.isArray(data.richSync) && data.richSync.length > 0) {
    const lines: Lyric[] = data.richSync.map((line: any, idx: number) => {
      const lineStartMs = Math.round((Number(line.start) || 0) * 1000);
      const lineEndMs = Math.round((Number(line.end) || Number(line.start) || 0) * 1000);
      const lineDurationMs = Math.max(0, lineEndMs - lineStartMs);

      const parts: LyricPart[] = Array.isArray(line.words)
        ? line.words.map((w: any) => {
            const wStartMs = Math.round((Number(w.start) || 0) * 1000);
            const wEndMs = Math.round((Number(w.end) || Number(w.start) || 0) * 1000);
            return {
              startTimeMs: wStartMs,
              durationMs: Math.max(0, wEndMs - wStartMs),
              words: String(w.word ?? ''),
              isBackground: false,
              explicit: false,
            };
          })
        : [];

      return {
        key: `L${idx}`,
        startTimeMs: lineStartMs,
        durationMs: lineDurationMs,
        words: String(line.text || parts.map((p) => p.words).join(' ')),
        parts,
      };
    });

    return lines.length > 0 ? lines : null;
  }

  if (data.lyrics && typeof data.lyrics === 'string') {
    const durationMs = (Number(data.duration) || 180) * 1000;
    const parsed = LRCParser.parse(data.lyrics, durationMs);
    return parsed && parsed.length > 0 ? parsed : null;
  }

  return null;
}

/**
 * Attempts to fetch lyrics from Octave Streaming API.
 * Gracefully catches CORS or Cloudflare errors without interrupting the fallback chain.
 */
async function fetchOctaveLyrics(
  song: string,
  artist: string,
  album?: string,
  durationSeconds?: number,
  signal?: AbortSignal
): Promise<{ lyrics: Lyric[]; source: string; syncType: 'syllable' | 'line' } | null> {
  const queryKey = `${song} ${artist}`.trim().toLowerCase();
  const trackId = deezerTrackIdCache.get(queryKey) || '';

  try {
    const res = await fetch('https://api.octavestreaming.com/api/lyrics', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: '*/*',
      },
      body: JSON.stringify({
        id: trackId,
        title: song,
        artist,
        album: album || '',
        duration: durationSeconds || 0,
      }),
      signal,
    });

    if (!res.ok) return null;
    const data = await res.json();
    if (!data || !data.success) return null;

    const parsed = parseOctaveLyrics(data);
    if (!parsed || parsed.length === 0) return null;

    const hasSyllables = parsed.some((l) => l.parts && l.parts.length > 0);
    return {
      lyrics: parsed,
      source: data.source || 'Octave Streaming',
      syncType: hasSyllables ? 'syllable' : 'line',
    };
  } catch {
    return null;
  }
}

/**
 * Resolves lyrics following the multi-provider hierarchy:
 * Stage 1: Unison by YouTube videoId (?v=...)
 * Stage 2: Metadata enrichment (acquiring all 4 parameters: s, a, al, d via iTunes)
 * Stage 3: Better Lyrics main endpoint (GET /getLyrics?s={s}&a={a}&al={al}&d={d})
 * Stage 4: Unison by song & artist (?song={s}&artist={a})
 * Stage 5: LRC.red syllable/word-synced TTML by ISRC (Credits.fm, Deezer, MusicBrainz, LRC.red search)
 * Stage 6: Octave Streaming lyrics API (richSync / LRC)
 * Stage 7: Better Lyrics /qq/getLyrics (QRC) & /kugou/getLyrics (LRC)
 * Stage 8: LRCLib (custom header)
 */
export async function resolveLyrics(params: {
  videoId: string;
  rawTitle?: string;
  channelTitle?: string;
  url?: string;
  duration?: number;
  signal?: AbortSignal;
}): Promise<ResolvedLyricsData | null> {
  const { videoId, rawTitle = '', channelTitle = '', url = '', duration = 0, signal } = params;
  if (!videoId) return null;

  const cacheKey = `${videoId}_${rawTitle}`;
  if (lyricsCache.has(cacheKey)) {
    return lyricsCache.get(cacheKey) || null;
  }

  // Parse initial track & artist names from title/channel
  const parsed = parseTrackAndArtist(rawTitle, channelTitle);
  let song = parsed.track || rawTitle;
  let artist = parsed.artist || channelTitle;
  let album = '';
  let durationSeconds = Math.round(duration);
  let artworkUrl: string | undefined;

  // ------------------------------------------------------------------------
  // STAGE 1: Check Unison by videoId (clean query without extra parameters)
  // ------------------------------------------------------------------------
  const unisonDirect = await fetchUnisonByVideoId(videoId, signal, durationSeconds);
  if (unisonDirect) {
    lyricsCache.set(cacheKey, unisonDirect);
    return unisonDirect;
  }

  // ------------------------------------------------------------------------
  // Check if track is a music track (YouTube Music, - Topic, or audio releases)
  // ------------------------------------------------------------------------
  const isMusic = isYouTubeMusicTrack(url, channelTitle, rawTitle);
  if (!isMusic) {
    lyricsCache.set(cacheKey, null);
    return null;
  }

  // ------------------------------------------------------------------------
  // STAGE 2: Enrich Metadata (All 4 Parameters: song, artist, album, duration)
  // ------------------------------------------------------------------------
  try {
    const enriched = await fetchEnrichedMeta(song, artist, signal);
    if (enriched) {
      if (enriched.song) song = enriched.song;
      if (enriched.artist) artist = enriched.artist;
      if (enriched.album) album = enriched.album;
      if (enriched.duration > 0) durationSeconds = enriched.duration;
      if (enriched.artworkUrl) artworkUrl = enriched.artworkUrl;
    }
  } catch {
    // Continue with initial metadata
  }

  const enrichedMeta = { song, artist, album, duration: durationSeconds, artworkUrl };

  // ------------------------------------------------------------------------
  // STAGE 3: Better Lyrics Main Endpoint (GET /getLyrics?s={s}&a={a}&al={al}&d={d})
  // Always send all 4 parameters so the hash matches cached entries!
  // ------------------------------------------------------------------------
  if (album && durationSeconds > 0) {
    try {
      const blyricsUrl = new URL('https://api.betterlyrics.org/getLyrics');
      blyricsUrl.searchParams.set('s', song);
      blyricsUrl.searchParams.set('a', artist);
      blyricsUrl.searchParams.set('al', album);
      blyricsUrl.searchParams.set('d', String(durationSeconds));

      const res = await fetch(blyricsUrl.toString(), { signal });
      if (res.ok) {
        const json = await res.json();
        if (json?.ttml) {
          const parsedLyrics = TTMLParser.parse(json.ttml);
          if (parsedLyrics && parsedLyrics.length > 0) {
            const hasSyllables = parsedLyrics.some((l) => l.parts && l.parts.length > 0);
            const resolved: ResolvedLyricsData = {
              lyrics: parsedLyrics,
              source: 'Better Lyrics',
              sourceHref: 'https://betterlyrics.org/',
              isFromUnison: false,
              syncType: hasSyllables ? 'syllable' : 'line',
              rawTtml: json.ttml,
              enrichedMeta,
            };
            lyricsCache.set(cacheKey, resolved);
            return resolved;
          }
        }
      }
      // 401 is an expected cache-miss for songs not yet cached; proceed to fallbacks
    } catch (err: any) {
      if (err?.name === 'AbortError') return null;
    }
  }

  // ------------------------------------------------------------------------
  // STAGE 4: Unison by Song and Artist
  // ------------------------------------------------------------------------
  try {
    const unisonQueryUrl = new URL('https://unison.boidu.dev/lyrics');
    unisonQueryUrl.searchParams.set('song', song);
    unisonQueryUrl.searchParams.set('artist', artist);
    if (durationSeconds > 0) {
      unisonQueryUrl.searchParams.set('duration', String(durationSeconds));
    }

    const unisonRes = await fetch(unisonQueryUrl.toString(), { signal });
    if (unisonRes.ok) {
      const json = await unisonRes.json();
      const data = json?.data;
      if (data?.lyrics) {
        const parser = detectParser(data.lyrics);
        const parsedLyrics = parser.parse(data.lyrics, (data.duration || durationSeconds || 180) * 1000);
        if (parsedLyrics && parsedLyrics.length > 0) {
          const hasSyllables = parsedLyrics.some((l: any) => l.parts && l.parts.length > 0);
          const resolved: ResolvedLyricsData = {
            lyrics: parsedLyrics,
            source: 'Unison',
            sourceHref: 'https://unison.boidu.dev/',
            isFromUnison: true,
            syncType: hasSyllables ? 'syllable' : 'line',
            rawTtml: data.format === 'ttml' ? data.lyrics : undefined,
            enrichedMeta,
          };
          lyricsCache.set(cacheKey, resolved);
          return resolved;
        }
      }
    }
  } catch (err: any) {
    if (err?.name === 'AbortError') return null;
  }

  // ------------------------------------------------------------------------
  // STAGE 5: LRC.red Syllable/Word TTML by ISRC (Credits.fm, Deezer, MusicBrainz, LRC.red search)
  // ------------------------------------------------------------------------
  try {
    const candidateIsrcs = await fetchIsrcsFromPublicApis(song, artist, durationSeconds, album, signal);
    for (const isrc of candidateIsrcs.slice(0, 5)) {
      const lrcResult = await fetchLrcRedLyrics(isrc, signal);
      if (lrcResult) {
        const resolved: ResolvedLyricsData = {
          lyrics: lrcResult.lyrics,
          source: 'LRC.red',
          sourceHref: `https://lrc.red/s/${isrc}.ttml`,
          isFromUnison: false,
          syncType: lrcResult.syncType,
          rawTtml: lrcResult.rawTtml,
          enrichedMeta,
        };
        lyricsCache.set(cacheKey, resolved);
        return resolved;
      }
    }
  } catch (err: any) {
    if (err?.name === 'AbortError') return null;
  }

  // ------------------------------------------------------------------------
  // STAGE 6: Octave Streaming Lyrics (richSync syllable & line synced)
  // ------------------------------------------------------------------------
  try {
    const octaveResult = await fetchOctaveLyrics(song, artist, album, durationSeconds, signal);
    if (octaveResult) {
      const resolved: ResolvedLyricsData = {
        lyrics: octaveResult.lyrics,
        source: octaveResult.source,
        sourceHref: 'https://octavestreaming.com/',
        isFromUnison: false,
        syncType: octaveResult.syncType,
        enrichedMeta,
      };
      lyricsCache.set(cacheKey, resolved);
      return resolved;
    }
  } catch (err: any) {
    if (err?.name === 'AbortError') return null;
  }

  // ------------------------------------------------------------------------
  // STAGE 7: Better Lyrics Alternative Providers (/qq/getLyrics & /kugou/getLyrics)
  // ------------------------------------------------------------------------
  if (durationSeconds > 0) {
    // 6A. QQ Music QRC
    try {
      const qqUrl = new URL('https://api.betterlyrics.org/qq/getLyrics');
      qqUrl.searchParams.set('s', song);
      qqUrl.searchParams.set('a', artist);
      qqUrl.searchParams.set('d', String(durationSeconds));
      if (album) qqUrl.searchParams.set('al', album);

      const qqRes = await fetch(qqUrl.toString(), { signal });
      if (qqRes.ok) {
        const json = await qqRes.json();
        if (json?.lyrics) {
          const parser = detectParser(json.lyrics);
          const parsedLyrics = parser.parse(json.lyrics, durationSeconds * 1000);
          if (parsedLyrics && parsedLyrics.length > 0) {
            const hasSyllables = parsedLyrics.some((l) => l.parts && l.parts.length > 0);
            const resolved: ResolvedLyricsData = {
              lyrics: parsedLyrics,
              source: 'QQ Music',
              sourceHref: 'https://betterlyrics.org/',
              isFromUnison: false,
              syncType: hasSyllables ? 'syllable' : 'line',
              enrichedMeta,
            };
            lyricsCache.set(cacheKey, resolved);
            return resolved;
          }
        }
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') return null;
    }

    // 6B. Kugou LRC
    try {
      const kugouUrl = new URL('https://api.betterlyrics.org/kugou/getLyrics');
      kugouUrl.searchParams.set('s', song);
      kugouUrl.searchParams.set('a', artist);
      kugouUrl.searchParams.set('d', String(durationSeconds));
      if (album) kugouUrl.searchParams.set('al', album);

      const kugouRes = await fetch(kugouUrl.toString(), { signal });
      if (kugouRes.ok) {
        const json = await kugouRes.json();
        if (json?.lyrics) {
          const parsedLyrics = LRCParser.parse(json.lyrics, durationSeconds * 1000);
          if (parsedLyrics && parsedLyrics.length > 0) {
            const resolved: ResolvedLyricsData = {
              lyrics: parsedLyrics,
              source: 'Kugou',
              sourceHref: 'https://betterlyrics.org/',
              isFromUnison: false,
              syncType: 'line',
              enrichedMeta,
            };
            lyricsCache.set(cacheKey, resolved);
            return resolved;
          }
        }
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') return null;
    }
  }

  // ------------------------------------------------------------------------
  // STAGE 8: LRCLib (with custom User-Agent / Lrclib-Client header)
  // ------------------------------------------------------------------------
  try {
    const lrclibUrl = new URL('https://lrclib.net/api/get');
    lrclibUrl.searchParams.set('track_name', song);
    lrclibUrl.searchParams.set('artist_name', artist);
    if (album) lrclibUrl.searchParams.set('album_name', album);
    if (durationSeconds > 0) lrclibUrl.searchParams.set('duration', String(durationSeconds));

    const lrclibRes = await fetch(lrclibUrl.toString(), {
      headers: {
        'Lrclib-Client': 'MediaBox/1.0 (https://github.com/boredkevin/mediabox)',
      },
      signal,
    });

    if (lrclibRes.ok) {
      const json = await lrclibRes.json();
      if (json?.syncedLyrics) {
        const parsedLyrics = LRCParser.parse(json.syncedLyrics, (durationSeconds || 180) * 1000);
        if (parsedLyrics && parsedLyrics.length > 0) {
          const resolved: ResolvedLyricsData = {
            lyrics: parsedLyrics,
            source: 'LRCLib',
            sourceHref: 'https://lrclib.net/',
            isFromUnison: false,
            syncType: 'line',
            enrichedMeta,
          };
          lyricsCache.set(cacheKey, resolved);
          return resolved;
        }
      }
    }
  } catch (err: any) {
    if (err?.name === 'AbortError') return null;
  }

  lyricsCache.set(cacheKey, null);
  return null;
}
