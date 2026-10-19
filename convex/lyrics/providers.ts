import { LyricsResult, detectSyncType } from "./types";

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
function getArtistVariations(artist: string): string[] {
  const comma = normalizeToCommaSeparated(artist);
  const raw = artist.trim();
  const primary = getPrimaryArtist(artist);
  const list = [comma];
  if (raw && !list.includes(raw)) list.push(raw);
  if (primary && !list.includes(primary)) list.push(primary);
  return list;
}

/**
 * Provider 1: Unison (Better Lyrics community-fed source)
 * Primary lookup by videoId: GET https://unison.boidu.dev/lyrics?v=${videoId}
 */
export async function fetchUnison(
  videoId: string,
  logs: string[]
): Promise<LyricsResult | null> {
  if (!videoId) return null;
  try {
    const url = `https://unison.boidu.dev/lyrics?v=${encodeURIComponent(videoId)}`;
    logs.push(`[Unison] Querying videoId=${videoId}`);
    const res = await fetch(url, { signal: AbortSignal.timeout(3500) });
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
      logs.push(`[Unison] HTTP ${res.status}`);
    }
  } catch (err: any) {
    logs.push(`[Unison] Fetch error: ${err?.message || err}`);
  }
  return null;
}

/**
 * Provider 2: LRC.red Native API (https://lrc.red/api/v1)
 * Queries track & artist from YouTube Music.
 * Priority order:
 * 1. Comma-separated normalized artist
 * 2. Raw YTM author metadata
 * 3. Primary artist fallback
 */
export async function fetchLrcRed(
  song: string,
  artist: string,
  logs: string[]
): Promise<LyricsResult | null> {
  if (!song || !artist) return null;

  const artistVariations = getArtistVariations(artist);

  for (const artistQuery of artistVariations) {
    try {
      const url = new URL("https://lrc.red/api/v1");
      url.searchParams.set("track", song);
      url.searchParams.set("artist", artistQuery);

      logs.push(`[LRC.red] Querying: ${url.toString()}`);
      const res = await fetch(url.toString(), {
        signal: AbortSignal.timeout(4000),
      });

      if (!res.ok) {
        logs.push(`[LRC.red] HTTP ${res.status} ${res.statusText}`);
        continue;
      }

      const json = await res.json();
      const results: any[] = Array.isArray(json?.results) ? json.results : [];
      if (results.length === 0) {
        logs.push(`[LRC.red] Returned 0 results for artist="${artistQuery}" (source: ${json?.source || "unknown"})`);
        continue;
      }

      const valid = results.filter((r) => {
        const cand = r.artist_name || "";
        return matchArtist(artist, cand) || matchArtist(artistQuery, cand);
      });

      if (valid.length === 0) {
        logs.push(`[LRC.red] 0 candidates matched artist query "${artistQuery}"`);
        continue;
      }

      // Prioritize word-synced -> line-synced -> first candidate
      const best =
        valid.find((r) => r.timing_type === "word") ||
        valid.find((r) => r.timing_type === "line") ||
        valid[0];

      const lyricsUrl = best.lyricsUrl || (best.isrc ? `https://lrc.red/s/${best.isrc}.ttml` : null);
      if (!lyricsUrl) {
        logs.push(`[LRC.red] Candidate ${best.id} missing lyricsUrl`);
        continue;
      }

      logs.push(`[LRC.red] Fetching TTML from ${lyricsUrl} (ISRC: ${best.isrc || best.id}, timing: ${best.timing_type})`);
      const ttmlRes = await fetch(lyricsUrl, {
        signal: AbortSignal.timeout(3500),
      });

      if (!ttmlRes.ok) {
        logs.push(`[LRC.red] TTML fetch returned HTTP ${ttmlRes.status}`);
        continue;
      }

      const ttml = await ttmlRes.text();
      if (!ttml || ttml.trim().length === 0) {
        logs.push(`[LRC.red] Fetched TTML was empty`);
        continue;
      }

      const isrc = (best.isrc || best.id || "").trim().toUpperCase() || undefined;
      const syncType = detectSyncType(ttml, best.timing_type);
      logs.push(`[LRC.red] Hit: Resolved TTML for ISRC=${isrc || "unknown"} (syncType: ${syncType})`);

      return {
        data: ttml.trim(),
        sourceLabel: "LRC.red",
        syncType,
        isrc,
      };
    } catch (err: any) {
      logs.push(`[LRC.red] Fetch error for artist="${artistQuery}": ${err?.message || err}`);
    }
  }

  return null;
}

/**
 * Provider 3: QQ Music Fallback (Better Lyrics /qq/getLyrics)
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
        signal: AbortSignal.timeout(3500),
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
 * Provider 4: Kugou Fallback (Better Lyrics /kugou/getLyrics)
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
        signal: AbortSignal.timeout(3500),
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
 * Provider 5: LRCLib Fallback (https://lrclib.net/api/get)
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
        signal: AbortSignal.timeout(3500),
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
 * Cascades across lyrics providers with priority: word-synced -> line-synced -> plain unsynced.
 */
export async function fetchLyricsWaterfall(
  videoId: string,
  song: string,
  artist: string,
  logs: string[]
): Promise<LyricsResult | null> {
  let bestLine: LyricsResult | null = null;
  let bestUnsynced: LyricsResult | null = null;

  const handleResult = (res: LyricsResult | null): boolean => {
    if (!res) return false;
    if (res.syncType === "word") {
      logs.push(`[Sync Level] Found WORD-SYNCED lyrics from ${res.sourceLabel}. Halting search.`);
      return true;
    }
    if (res.syncType === "line" && !bestLine) {
      logs.push(`[Sync Level] Stashed LINE-SYNCED lyrics from ${res.sourceLabel}. Continuing search for word-synced...`);
      bestLine = res;
    } else if (res.syncType === "none" && !bestUnsynced) {
      logs.push(`[Sync Level] Stashed UNSYNCED lyrics from ${res.sourceLabel}. Continuing search for word-synced...`);
      bestUnsynced = res;
    }
    return false;
  };

  // STEP 1: Unison by videoId
  const unison = await fetchUnison(videoId, logs);
  if (handleResult(unison)) return unison;

  // STEP 2: LRC.red by song & artist (with comma normalization and YTM author fallback)
  const lrcred = await fetchLrcRed(song, artist, logs);
  if (handleResult(lrcred)) return lrcred;

  // STEP 3: QQ Music fallback
  const qq = await fetchQq(song, artist, logs);
  if (handleResult(qq)) return qq;

  // STEP 4: Kugou fallback
  const kugou = await fetchKugou(song, artist, logs);
  if (handleResult(kugou)) return kugou;

  // STEP 5: LRCLib fallback
  const lrclib = await fetchLrclib(song, artist, logs);
  if (handleResult(lrclib)) return lrclib;

  // Fallback priorities
  const finalLine = bestLine as LyricsResult | null;
  if (finalLine) {
    logs.push(`[Cascade Fallback] Serving LINE-SYNCED lyrics from ${finalLine.sourceLabel}.`);
    return finalLine;
  }
  const finalUnsynced = bestUnsynced as LyricsResult | null;
  if (finalUnsynced) {
    logs.push(`[Cascade Fallback] Serving UNSYNCED lyrics from ${finalUnsynced.sourceLabel} as last resort.`);
    return finalUnsynced;
  }

  return null;
}
