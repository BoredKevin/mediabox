import {
  TTMLParser,
  LRCParser,
  detectParser,
} from '@braccato/parsers';
import { isYouTubeMusicTrack } from './ytmusicDetector';
import { parseTrackAndArtist } from './trackParser';
import { ResolvedLyricsData } from './lyrics/types';
import { fetchEnrichedMeta, fetchIsrcsFromPublicApis } from './lyrics/metadata';
import {
  fetchUnisonByVideoId,
  fetchLrcRedLyrics,
  fetchOctaveLyrics,
  parseOctaveLyrics,
} from './lyrics/providers';
import { coalesceSyllablesToWords } from './lyrics/coalesce';

export type { ResolvedLyricsData };
export {
  coalesceSyllablesToWords,
  fetchUnisonByVideoId,
  fetchIsrcsFromPublicApis,
  fetchOctaveLyrics,
  parseOctaveLyrics,
  fetchEnrichedMeta,
};

// In-memory cache for resolved lyrics to prevent duplicate network calls
const lyricsCache = new Map<string, ResolvedLyricsData | null>();

/**
 * Resolves lyrics following the multi-provider hierarchy:
 * Stage 1: Unison by YouTube videoId (?v=...)
 * Stage 2: Metadata enrichment (acquiring all 4 parameters: s, a, al, d via iTunes)
 * Stage 3: Better Lyrics main endpoint (GET /getLyrics?s={s}&a={a}&al={al}&d={d})
 * Stage 4: Unison by song & artist (?song={s}&artist={a})
 * Stage 5: LRC.red syllable/word-synced TTML by ISRC (Credits.fm, Deezer, MusicBrainz, LRC.red search)
 * Stage 6: Octave Streaming lyrics API (richSync / LRC)
 * Stage 7: Better Lyrics /qq/getLyrics (QRC) & /kugou/getLyrics (LRC)
 * Stage 8: LRCLib
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

  const parsed = parseTrackAndArtist(rawTitle, channelTitle);
  let song = parsed.track || rawTitle;
  let artist = parsed.artist || channelTitle;
  let album = '';
  let durationSeconds = Math.round(duration);
  let artworkUrl: string | undefined;

  // STAGE 1: Check Unison by videoId
  const unisonDirect = await fetchUnisonByVideoId(videoId, signal, durationSeconds);
  if (unisonDirect) {
    lyricsCache.set(cacheKey, unisonDirect);
    return unisonDirect;
  }

  // Filter non-music tracks
  const isMusic = isYouTubeMusicTrack(url, channelTitle, rawTitle);
  if (!isMusic) {
    lyricsCache.set(cacheKey, null);
    return null;
  }

  // STAGE 2: Enrich Metadata
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

  // STAGE 3: Better Lyrics Main Endpoint
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
    } catch (err: any) {
      if (err?.name === 'AbortError') return null;
    }
  }

  // STAGE 4: Unison by Song and Artist
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

  // STAGE 5: LRC.red Syllable/Word TTML by ISRC
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

  // STAGE 6: Octave Streaming Lyrics API
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

  // STAGE 7: Better Lyrics Fallbacks (QQ & Kugou)
  try {
    const qqUrl = new URL('https://api.betterlyrics.org/qq/getLyrics');
    qqUrl.searchParams.set('s', song);
    qqUrl.searchParams.set('a', artist);
    const qqRes = await fetch(qqUrl.toString(), { signal });
    if (qqRes.ok) {
      const json = await qqRes.json();
      if (typeof json?.lyrics === 'string') {
        const parser = detectParser(json.lyrics);
        const parsed = parser.parse(json.lyrics, (durationSeconds || 180) * 1000);
        if (parsed && parsed.length > 0) {
          const hasSyllables = parsed.some((l: any) => l.parts && l.parts.length > 0);
          const resolved: ResolvedLyricsData = {
            lyrics: parsed,
            source: 'QQ Music',
            sourceHref: 'https://y.qq.com/',
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

  // STAGE 8: LRCLib Fallback
  try {
    const lrclibUrl = new URL('https://lrclib.net/api/get');
    lrclibUrl.searchParams.set('track_name', song);
    lrclibUrl.searchParams.set('artist_name', artist);
    const lrclibRes = await fetch(lrclibUrl.toString(), {
      headers: { 'User-Agent': 'MediaBox/1.0 (https://github.com/boredkevin/mediabox)' },
      signal,
    });
    if (lrclibRes.ok) {
      const json = await lrclibRes.json();
      const rawText = json.syncedLyrics || json.plainLyrics;
      if (rawText && typeof rawText === 'string') {
        const parser = detectParser(rawText);
        const parsed = parser.parse(rawText, (durationSeconds || 180) * 1000);
        if (parsed && parsed.length > 0) {
          const resolved: ResolvedLyricsData = {
            lyrics: parsed,
            source: 'LRCLib',
            sourceHref: 'https://lrclib.net/',
            isFromUnison: false,
            syncType: json.syncedLyrics ? 'line' : 'unsynced',
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
