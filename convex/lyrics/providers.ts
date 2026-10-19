import { type LyricsResult, detectSyncType } from "./types";

// Extracts featured performers from (feat. ...), [ft. ...], (with ...)
const FEAT_WITH_RE = /\s*[\(\[](?:feat\.?|ft\.?|featuring|with)\s+([^\)\]]+)[\)\]]/gi;

// Only strips true YouTube video upload noise; PRESERVES remix, edit, version!
const NOISE_TAGS_RE = /\s*[\(\[](?:(?:official\s+)?(?:music\s+video|lyric\s+video|video|audio|visualizer)|official|lyrics?|4k|hd)[\)\]]/gi;

/**
 * Cleans YouTube video upload noise from track titles while preserving remix and edit indicators.
 */
export function cleanTrackTitle(title: string): string {
  if (!title) return "";
  return title
    .replace(FEAT_WITH_RE, "")
    .replace(NOISE_TAGS_RE, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Extracts featured artist names from parenthetical feat/with clauses.
 */
export function extractFeaturedArtists(title: string): string[] {
  if (!title) return [];
  const re = /\s*[\(\[](?:feat\.?|ft\.?|featuring|with)\s+([^\)\]]+)[\)\]]/gi;
  const artists: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(title)) !== null) {
    if (m[1]) {
      const parts = m[1].split(/[,/&+]|\b(?:and)\b/i).map((s) => s.trim()).filter(Boolean);
      artists.push(...parts);
    }
  }
  return artists;
}

/**
 * Normalizes artist names by replacing &, +, /, and, feat, ft with standard comma separators.
 */
export function normalizeToCommaSeparated(artist: string): string {
  if (!artist) return "";
  const s = artist
    .replace(/\s+&\s+/g, ", ")
    .replace(/\s*\+\s*/g, ", ")
    .replace(/\s+\/\s+/g, ", ")
    .replace(/\s+(?:feat\.?|ft\.?|featuring|vs\.?)\s+/gi, ", ")
    .replace(/\s+and\s+/gi, ", ");
  return s.split(",").map((p) => p.trim()).filter(Boolean).join(", ");
}

/**
 * Extracts primary/main artist before any delimiter.
 */
export function getPrimaryArtist(artist: string): string {
  if (!artist) return "";
  const comma = normalizeToCommaSeparated(artist);
  return comma.split(",")[0]?.trim() || artist.trim();
}

/**
 * Normalizes artist string for fuzzy comparison by stripping non-alphanumeric chars.
 */
function normalizeArtistForMatch(str: string): string {
  return str.toLowerCase().replace(/&/g, " and ").replace(/\b(feat\.?|ft\.?)\b/g, " and ").replace(/[^a-z0-9]/g, "");
}

/**
 * Matches query artist and candidate artist with delimiter tolerance.
 */
export function matchArtist(query: string, candidate: string): boolean {
  if (!query || !candidate) return false;
  const q = query.toLowerCase().trim();
  const c = candidate.toLowerCase().trim();
  if (q === c || q.includes(c) || c.includes(q)) return true;

  const nq = normalizeArtistForMatch(q);
  const nc = normalizeArtistForMatch(c);
  if (nq === nc || nq.includes(nc) || nc.includes(nq)) return true;

  const splitRe = /[,/&+]|\b(?:and|feat\.?|ft\.?|vs\.?)\b/i;
  const qParts = q.split(splitRe).map((s) => normalizeArtistForMatch(s)).filter(Boolean);
  const cParts = c.split(splitRe).map((s) => normalizeArtistForMatch(s)).filter(Boolean);

  if (qParts[0] && cParts[0] && (qParts[0] === cParts[0] || qParts[0].includes(cParts[0]) || cParts[0].includes(qParts[0]))) {
    return true;
  }
  return false;
}

/**
 * Returns prioritized artist queries:
 * 1. Comma-normalized artist ("David Guetta, Bebe Rexha")
 * 2. Raw YTM metadata ("David Guetta & Bebe Rexha") if different
 * 3. Primary author ("David Guetta") if different
 */
export function getArtistVariations(artist: string): string[] {
  const comma = normalizeToCommaSeparated(artist);
  const raw = artist.trim();
  const primary = getPrimaryArtist(artist);
  const list = [comma];
  if (raw && !list.includes(raw)) list.push(raw);
  if (primary && !list.includes(primary)) list.push(primary);
  return list;
}

/**
 * Provider 1: Unison by YouTube videoId (exact 1:1 video match)
 */
export async function fetchUnisonByVideoId(
  videoId: string,
  logs: string[]
): Promise<LyricsResult | null> {
  if (!videoId) return null;
  try {
    const url = `https://unison.boidu.dev/lyrics?v=${encodeURIComponent(videoId)}`;
    logs.push(`[Unison] Querying videoId=${videoId}`);
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      const json = await res.json();
      if (json?.success && json?.data?.lyrics) {
        const item = json.data;
        const syncType = detectSyncType(item.lyrics, item.syncType);
        logs.push(`[Unison] Hit: resolved lyrics by videoId=${videoId} (syncType=${syncType})`);
        return {
          data: item.lyrics,
          sourceLabel: "Unison",
          syncType,
          isrc: item.isrc || undefined,
        };
      }
    } else if (res.status === 404) {
      logs.push(`[Unison] videoId=${videoId} returned 404 Not Found`);
    } else {
      logs.push(`[Unison] videoId HTTP ${res.status}`);
    }
  } catch (err: any) {
    logs.push(`[Unison] videoId fetch error: ${err?.message || err}`);
  }
  return null;
}

// Backward-compatibility alias
export const fetchUnison = fetchUnisonByVideoId;

/**
 * Provider 2: Deezer ISRC Bridge
 * Searches Deezer API to resolve the canonical global ISRC and standard track title.
 */
export async function fetchDeezerIsrc(
  song: string,
  artist: string,
  duration: number | undefined,
  logs: string[]
): Promise<{ isrc: string; title: string; artist: string; duration: number } | null> {
  const cleanSong = cleanTrackTitle(song);
  const featured = extractFeaturedArtists(song);
  const primary = getPrimaryArtist(artist);

  const queryParts = [primary, cleanSong, ...featured].filter(Boolean);
  const query = queryParts.join(" ").trim();
  if (!query) return null;

  try {
    const url = `https://api.deezer.com/search?q=${encodeURIComponent(query)}&limit=5`;
    logs.push(`[Deezer] Querying: "${query}"`);
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) {
      logs.push(`[Deezer] HTTP ${res.status}`);
      return null;
    }

    const json = await res.json();
    const data: any[] = Array.isArray(json?.data) ? json.data : [];
    if (data.length === 0) {
      logs.push(`[Deezer] 0 candidates found for "${query}"`);
      return null;
    }

    // Filter by artist match (reject tribute/karaoke bands)
    const artistMatches = data.filter((item) => {
      const candArtist = item?.artist?.name || "";
      return matchArtist(artist, candArtist) || matchArtist(primary, candArtist);
    });

    const candidates = artistMatches.length > 0 ? artistMatches : data;

    // Duration Guard: Match candidate within ±7 seconds of YouTube video
    let best = candidates[0];
    if (duration && duration > 0) {
      const durationMatch = candidates.find((c) => Math.abs((c.duration || 0) - duration) <= 7);
      if (durationMatch) {
        best = durationMatch;
      }
    }

    if (best?.isrc) {
      logs.push(`[Deezer] Hit: Resolved ISRC=${best.isrc} ("${best.title}" by "${best.artist?.name}", ${best.duration}s)`);
      return {
        isrc: String(best.isrc).trim().toUpperCase(),
        title: best.title,
        artist: best.artist?.name || artist,
        duration: best.duration || 0,
      };
    }
  } catch (err: any) {
    logs.push(`[Deezer] Lookup error: ${err?.message || err}`);
  }
  return null;
}

/**
 * Fetches word/line synced TTML directly from LRC.red static CDN by ISRC.
 */
export async function fetchLrcRedByIsrc(
  isrc: string,
  logs: string[],
  canonicalMeta?: { title: string; artist: string }
): Promise<LyricsResult | null> {
  if (!isrc) return null;
  try {
    const url = `https://lrc.red/s/${encodeURIComponent(isrc)}.ttml`;
    logs.push(`[LRC.red] Fetching TTML by ISRC: ${url}`);
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) {
      logs.push(`[LRC.red] ISRC TTML fetch HTTP ${res.status}`);
      return null;
    }
    const ttml = await res.text();
    if (!ttml || !ttml.includes("<p")) {
      logs.push(`[LRC.red] ISRC TTML response contained no lyric lines`);
      return null;
    }

    const syncType = detectSyncType(ttml);
    logs.push(`[LRC.red] Hit: Resolved word/line TTML for ISRC=${isrc} (syncType=${syncType})`);
    return {
      data: ttml.trim(),
      sourceLabel: "LRC.red",
      syncType,
      isrc,
      canonicalTitle: canonicalMeta?.title,
      canonicalArtist: canonicalMeta?.artist,
    };
  } catch (err: any) {
    logs.push(`[LRC.red] ISRC TTML fetch error: ${err?.message || err}`);
  }
  return null;
}

/**
 * Provider 3: Unison Metadata Lookup Fallback
 */
export async function fetchUnisonByMeta(
  song: string,
  artist: string,
  duration: number | undefined,
  logs: string[]
): Promise<LyricsResult | null> {
  if (!song || !artist) return null;
  try {
    const url = new URL("https://unison.boidu.dev/lyrics");
    url.searchParams.set("song", song);
    url.searchParams.set("artist", artist);
    if (duration && duration > 0) {
      url.searchParams.set("duration", String(Math.round(duration)));
    }
    logs.push(`[Unison] Querying metadata song="${song}", artist="${artist}"`);
    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      const json = await res.json();
      if (json?.success && json?.data?.lyrics) {
        const item = json.data;
        const syncType = detectSyncType(item.lyrics, item.syncType);
        logs.push(`[Unison] Hit: resolved lyrics by metadata (syncType=${syncType})`);
        return {
          data: item.lyrics,
          sourceLabel: "Unison",
          syncType,
          isrc: item.isrc || undefined,
        };
      }
    }
  } catch (err: any) {
    logs.push(`[Unison] metadata fetch error: ${err?.message || err}`);
  }
  return null;
}

/**
 * Provider 4: Single-Query LRC.red Search Fallback
 * Uses broad baseQueryTrack to avoid substring mismatch traps on remixes, then scores in-memory.
 */
export async function fetchLrcRed(
  song: string,
  artist: string,
  logs: string[],
  duration?: number
): Promise<LyricsResult | null> {
  const cleanSong = cleanTrackTitle(song);
  const primary = getPrimaryArtist(artist);
  if (!cleanSong || !primary) return null;

  // Strip parentheticals like "(Remix)" ONLY for the LRC.red query param so substring matching casts a wide net
  const baseQueryTrack = cleanSong.replace(/\s*[\(\[][^\)\]]+[\)\]]/g, "").trim() || cleanSong;

  try {
    const url = new URL("https://lrc.red/api/v1");
    url.searchParams.set("track", baseQueryTrack);
    url.searchParams.set("artist", primary);

    logs.push(`[LRC.red Search] Querying: track="${baseQueryTrack}", artist="${primary}"`);
    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(3000) });
    if (!res.ok) {
      logs.push(`[LRC.red Search] HTTP ${res.status}`);
      return null;
    }

    const json = await res.json();
    const results: any[] = Array.isArray(json?.results) ? json.results : [];
    if (results.length === 0) {
      logs.push(`[LRC.red Search] 0 results for track="${baseQueryTrack}", artist="${primary}"`);
      return null;
    }

    // Filter and score candidates in memory (0ms)
    const valid = results.filter((r) => {
      const candArtist = r.artist_name || "";
      const candTrack = (r.track_name || "").toLowerCase();
      const baseLower = baseQueryTrack.toLowerCase();
      return (
        (candTrack.includes(baseLower) || baseLower.includes(candTrack)) &&
        (matchArtist(artist, candArtist) || matchArtist(primary, candArtist))
      );
    });

    if (valid.length === 0) {
      logs.push(`[LRC.red Search] 0 candidates matched artist & title in memory`);
      return null;
    }

    // Prioritize word-sync + duration match (±7s)
    let best =
      (duration &&
        valid.find(
          (r) => r.timing_type === "word" && Math.abs((r.duration || 0) - duration) <= 7
        )) ||
      valid.find((r) => r.timing_type === "word") ||
      valid[0];

    const lyricsUrl = best.lyricsUrl || (best.isrc ? `https://lrc.red/s/${best.isrc}.ttml` : null);
    if (!lyricsUrl) return null;

    logs.push(`[LRC.red Search] Fetching TTML from ${lyricsUrl} (timing: ${best.timing_type})`);
    const ttmlRes = await fetch(lyricsUrl, { signal: AbortSignal.timeout(3000) });
    if (!ttmlRes.ok) return null;
    const ttml = await ttmlRes.text();
    if (!ttml || !ttml.includes("<p")) return null;

    const isrc = (best.isrc || best.id || "").trim().toUpperCase() || undefined;
    const syncType = detectSyncType(ttml, best.timing_type);
    logs.push(`[LRC.red Search] Hit: Resolved TTML for ISRC=${isrc || "unknown"} (syncType: ${syncType})`);

    return {
      data: ttml.trim(),
      sourceLabel: "LRC.red",
      syncType,
      isrc,
      canonicalTitle: best.track_name,
      canonicalArtist: best.artist_name,
    };
  } catch (err: any) {
    logs.push(`[LRC.red Search] Error: ${err?.message || err}`);
    return null;
  }
}

/**
 * Provider 5: QQ Music Fallback (Better Lyrics /qq/getLyrics)
 */
export async function fetchQq(
  song: string,
  artist: string,
  logs: string[]
): Promise<LyricsResult | null> {
  if (!song || !artist) return null;
  const artistVariations = getArtistVariations(artist);

  for (const artistQuery of artistVariations) {
    try {
      const url = new URL("https://api.betterlyrics.org/qq/getLyrics");
      url.searchParams.set("s", song);
      url.searchParams.set("a", artistQuery);

      const res = await fetch(url.toString(), {
        signal: AbortSignal.timeout(3000),
      });
      if (res.ok) {
        const json = await res.json();
        if (typeof json?.lyrics === "string" && json.lyrics.trim().length > 0) {
          const lyrics = json.lyrics.trim();
          const syncType = detectSyncType(lyrics);
          logs.push(`[QQ Music] Hit: resolved lyrics for "${song}" by "${artistQuery}" (syncType: ${syncType})`);
          return {
            data: lyrics,
            sourceLabel: "QQ Music",
            syncType,
          };
        }
      } else if (res.status === 404) {
        logs.push(`[QQ Music] 404 Not Found for "${artistQuery}"`);
      } else {
        logs.push(`[QQ Music] HTTP ${res.status}`);
      }
    } catch (err: any) {
      logs.push(`[QQ Music] Error: ${err?.message || err}`);
    }
  }
  return null;
}

/**
 * Provider 6: Kugou Fallback (Better Lyrics /kugou/getLyrics)
 */
export async function fetchKugou(
  song: string,
  artist: string,
  logs: string[]
): Promise<LyricsResult | null> {
  if (!song || !artist) return null;
  const artistVariations = getArtistVariations(artist);

  for (const artistQuery of artistVariations) {
    try {
      const url = new URL("https://api.betterlyrics.org/kugou/getLyrics");
      url.searchParams.set("s", song);
      url.searchParams.set("a", artistQuery);

      const res = await fetch(url.toString(), {
        signal: AbortSignal.timeout(3000),
      });
      if (res.ok) {
        const json = await res.json();
        if (typeof json?.lyrics === "string" && json.lyrics.trim().length > 0) {
          const lyrics = json.lyrics.trim();
          const syncType = detectSyncType(lyrics);
          logs.push(`[Kugou] Hit: resolved lyrics for "${song}" by "${artistQuery}" (syncType: ${syncType})`);
          return {
            data: lyrics,
            sourceLabel: "Kugou",
            syncType,
          };
        }
      } else if (res.status === 404) {
        logs.push(`[Kugou] 404 Not Found for "${artistQuery}"`);
      } else {
        logs.push(`[Kugou] HTTP ${res.status}`);
      }
    } catch (err: any) {
      logs.push(`[Kugou] Error: ${err?.message || err}`);
    }
  }
  return null;
}

/**
 * Provider 7: LRCLib Fallback (https://lrclib.net/api/get)
 */
export async function fetchLrclib(
  song: string,
  artist: string,
  logs: string[]
): Promise<LyricsResult | null> {
  if (!song || !artist) return null;
  const artistVariations = getArtistVariations(artist);

  for (const artistQuery of artistVariations) {
    try {
      const url = new URL("https://lrclib.net/api/get");
      url.searchParams.set("track_name", song);
      url.searchParams.set("artist_name", artistQuery);

      const res = await fetch(url.toString(), {
        headers: { "User-Agent": "MediaBox/1.0 (https://github.com/boredkevin/mediabox)" },
        signal: AbortSignal.timeout(3000),
      });

      if (res.ok) {
        const json = await res.json();
        if (json.syncedLyrics && typeof json.syncedLyrics === "string" && json.syncedLyrics.trim().length > 0) {
          logs.push(`[LRCLib] Hit: resolved line-synced lyrics for "${song}" by "${artistQuery}"`);
          return {
            data: json.syncedLyrics.trim(),
            sourceLabel: "LRCLib",
            syncType: "line",
          };
        }
        if (json.plainLyrics && typeof json.plainLyrics === "string" && json.plainLyrics.trim().length > 0) {
          logs.push(`[LRCLib] Hit: resolved unsynced lyrics for "${song}" by "${artistQuery}"`);
          return {
            data: json.plainLyrics.trim(),
            sourceLabel: "LRCLib",
            syncType: "none",
          };
        }
      } else if (res.status === 404) {
        logs.push(`[LRCLib] 404 Not Found for "${artistQuery}"`);
      } else {
        logs.push(`[LRCLib] HTTP ${res.status}`);
      }
    } catch (err: any) {
      logs.push(`[LRCLib] Error: ${err?.message || err}`);
    }
  }
  return null;
}

/**
 * Cascades across lyrics providers with strict priority:
 * 1. Unison by videoId (exact 1:1 match)
 * 2. Deezer ISRC Bridge -> LRC.red TTML Direct (handles feat/with/remix with 100% precision)
 * 3. Unison by Metadata (cleanSong + primaryArtist + duration)
 * 4. LRC.red Single-Query Search (using baseQueryTrack without parentheticals)
 * 5. QQ Music Fallback (with cleaned metadata)
 * 6. Kugou Fallback (with cleaned metadata)
 * 7. LRCLib Fallback (with cleaned metadata)
 */
export async function fetchLyricsWaterfall(
  videoId: string,
  song: string,
  artist: string,
  logs: string[],
  duration?: number
): Promise<LyricsResult | null> {
  const stash = {
    bestLine: null as LyricsResult | null,
    bestUnsynced: null as LyricsResult | null,
  };

  const handleResult = (res: LyricsResult | null): boolean => {
    if (!res) return false;
    if (res.syncType === "word") {
      logs.push(`[Sync Level] Found WORD-SYNCED lyrics from ${res.sourceLabel}. Halting search.`);
      return true;
    }
    if (res.syncType === "line" && !stash.bestLine) {
      logs.push(`[Sync Level] Stashed LINE-SYNCED lyrics from ${res.sourceLabel}. Continuing search for word-synced...`);
      stash.bestLine = res;
    } else if (res.syncType === "none" && !stash.bestUnsynced) {
      logs.push(`[Sync Level] Stashed UNSYNCED lyrics from ${res.sourceLabel}. Continuing search for word-synced...`);
      stash.bestUnsynced = res;
    }
    return false;
  };

  const cleanSong = cleanTrackTitle(song);
  const primaryArtist = getPrimaryArtist(artist);

  // STEP 1: Unison by videoId only (~100ms, exact video match)
  const unisonVideo = await fetchUnisonByVideoId(videoId, logs);
  if (handleResult(unisonVideo)) return unisonVideo;

  // STEP 2: Deezer ISRC Bridge -> LRC.red TTML Direct (~180ms, handles feat/with/remix via ISRC + duration guard)
  const deezer = await fetchDeezerIsrc(song, artist, duration, logs);
  if (deezer?.isrc) {
    const lrcByIsrc = await fetchLrcRedByIsrc(deezer.isrc, logs, deezer);
    if (handleResult(lrcByIsrc)) return lrcByIsrc;
  }

  // STEP 3: Unison by Metadata (cleanSong + primaryArtist + duration) (~120ms)
  const unisonMeta = await fetchUnisonByMeta(cleanSong, primaryArtist, duration, logs);
  if (handleResult(unisonMeta)) return unisonMeta;

  // STEP 4: LRC.red Single-Query Search (using baseQueryTrack to avoid remix substring trap)
  const lrcred = await fetchLrcRed(song, artist, logs, duration);
  if (handleResult(lrcred)) return lrcred;

  // STEP 5: QQ Music Fallback (using cleanSong and primaryArtist)
  const qq = await fetchQq(cleanSong, primaryArtist, logs);
  if (handleResult(qq)) return qq;

  // STEP 6: Kugou Fallback (using cleanSong and primaryArtist)
  const kugou = await fetchKugou(cleanSong, primaryArtist, logs);
  if (handleResult(kugou)) return kugou;

  // STEP 7: LRCLib Fallback (using cleanSong and primaryArtist)
  const lrclib = await fetchLrclib(cleanSong, primaryArtist, logs);
  if (handleResult(lrclib)) return lrclib;

  // Cascade Fallback
  const getCascadeFallback = (): LyricsResult | null => {
    if (stash.bestLine) {
      logs.push(`[Cascade Fallback] Serving LINE-SYNCED lyrics from ${stash.bestLine.sourceLabel}.`);
      return stash.bestLine;
    }
    if (stash.bestUnsynced) {
      logs.push(`[Cascade Fallback] Serving UNSYNCED lyrics from ${stash.bestUnsynced.sourceLabel} as last resort.`);
      return stash.bestUnsynced;
    }
    return null;
  };

  return getCascadeFallback();
}
