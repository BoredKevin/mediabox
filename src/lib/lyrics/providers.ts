import {
  TTMLParser,
  LRCParser,
  detectParser,
  type Lyric,
  type LyricPart,
} from '@braccato/parsers';
import { ResolvedLyricsData } from './types';
import { deezerTrackIdCache } from './metadata';

/**
 * Fetches Unison community lyrics directly by YouTube videoId.
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

/**
 * Fetches and parses syllable/word-level TTML from https://lrc.red/s/{ISRC}.ttml
 */
export async function fetchLrcRedLyrics(
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
 */
export async function fetchOctaveLyrics(
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
