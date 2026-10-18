"use node";

import { action } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { v } from "convex/values";

export type LyricsResult = {
  data: string;
  sourceLabel: string;
  syncType: "word" | "line" | "none";
  isrc?: string;
};

export type YouTubeMetaResult = {
  song: string;
  artist: string;
  isYouTubeMusic: boolean;
  channelName: string;
  rawTitle: string;
};

/**
 * Detects whether lyrics payload is word-synced, line-synced, or unsynced (plain).
 */
export function detectSyncType(data: string, explicitType?: string): "word" | "line" | "none" {
  if (explicitType === "word" || explicitType === "richsync") return "word";
  if (explicitType === "line") return "line";
  if (explicitType === "none" || explicitType === "unsynced") return "none";

  if (!data) return "none";

  // Syllable / word timing indicators:
  // TTML syllable tags: <span begin="..." ...>
  if (/<span\b[^>]*\bbegin=/i.test(data) || /<span\b[^>]*\bend=/i.test(data)) return "word";
  // Kugou KRC: <100,200,0>
  if (/<\d+,\d+,\d+>/.test(data)) return "word";
  // QQ QRC: (100,200,0)
  if (/\(\d+,\d+,\d+\)/.test(data)) return "word";

  // Line-synced timestamp: [00:12.34]
  if (/\[\d{1,2}:\d{2}(?:\.\d{1,3})?\]/.test(data)) return "line";

  return "none";
}

/**
 * Verifies Cloudflare Turnstile token for human clearance.
 */
async function verifyTurnstile(token: string | undefined): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true; // dev bypass
  if (!token) return false;

  try {
    const formData = new URLSearchParams();
    formData.append("secret", secret);
    formData.append("response", token);

    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: formData,
      headers: { "content-type": "application/x-www-form-urlencoded" },
      signal: AbortSignal.timeout(4000),
    });
    const data = (await res.json()) as { success: boolean };
    return data.success === true;
  } catch (err) {
    console.error("[Turnstile] Verification error:", err);
    return false;
  }
}

/**
 * Resolves YouTube video metadata strictly from the YouTube oEmbed API.
 * For YouTube Music tracks (channels ending with " - Topic"):
 * - Title is the clean song name (strictly standardized to match LRC.red/streaming releases).
 * - Artist is the channel name with " - Topic" stripped.
 * Non-YouTube Music videos are marked with isYouTubeMusic=false so they do not play lyrics.
 */
export async function fetchYouTubeVideoMeta(
  videoId: string
): Promise<YouTubeMetaResult | null> {
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}&format=json`,
      { signal: AbortSignal.timeout(3500) }
    );
    if (!res.ok) return null;
    const json = await res.json();
    const rawTitle = String(json?.title || "").trim();
    const channelName = String(json?.author_name || "").trim();

    const isTopic = /\s*-\s*Topic$/i.test(channelName) || channelName.toLowerCase().endsWith("- topic");
    const artist = isTopic ? channelName.replace(/\s*-\s*Topic$/i, "").trim() : channelName;
    const song = rawTitle;

    return {
      song,
      artist,
      isYouTubeMusic: isTopic,
      channelName,
      rawTitle,
    };
  } catch {
    return null;
  }
}

/**
 * Provider 1: Unison (Better Lyrics community-fed source)
 * Primary lookup by videoId: GET https://unison.boidu.dev/lyrics?v=${videoId}
 */
async function fetchUnison(
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
 * Directly queries track & artist from YouTube Music.
 * Selects word-synced -> line-synced -> first matching artist result.
 */
async function fetchLrcRed(
  song: string,
  artist: string,
  logs: string[]
): Promise<LyricsResult | null> {
  if (!song || !artist) return null;
  try {
    const url = new URL("https://lrc.red/api/v1");
    url.searchParams.set("track", song);
    url.searchParams.set("artist", artist);

    logs.push(`[LRC.red] Querying: ${url.toString()}`);
    const res = await fetch(url.toString(), {
      signal: AbortSignal.timeout(4000),
    });

    if (!res.ok) {
      logs.push(`[LRC.red] HTTP ${res.status} ${res.statusText}`);
      return null;
    }

    const json = await res.json();
    const results: any[] = Array.isArray(json?.results) ? json.results : [];
    if (results.length === 0) {
      logs.push(`[LRC.red] Returned 0 results (source: ${json?.source || "unknown"})`);
      return null;
    }

    const artistLower = artist.toLowerCase();
    const valid = results.filter((r) => {
      const cand = (r.artist_name || "").toLowerCase();
      return cand.includes(artistLower) || artistLower.includes(cand);
    });

    if (valid.length === 0) {
      logs.push(`[LRC.red] 0 candidates matched artist "${artist}"`);
      return null;
    }

    // Prioritize word-synced -> line-synced -> first candidate
    const best =
      valid.find((r) => r.timing_type === "word") ||
      valid.find((r) => r.timing_type === "line") ||
      valid[0];

    const lyricsUrl = best.lyricsUrl || (best.isrc ? `https://lrc.red/s/${best.isrc}.ttml` : null);
    if (!lyricsUrl) {
      logs.push(`[LRC.red] Candidate ${best.id} missing lyricsUrl`);
      return null;
    }

    logs.push(`[LRC.red] Fetching TTML from ${lyricsUrl} (ISRC: ${best.isrc || best.id}, timing: ${best.timing_type})`);
    const ttmlRes = await fetch(lyricsUrl, {
      signal: AbortSignal.timeout(3500),
    });

    if (!ttmlRes.ok) {
      logs.push(`[LRC.red] TTML fetch returned HTTP ${ttmlRes.status}`);
      return null;
    }

    const ttml = await ttmlRes.text();
    if (!ttml || ttml.trim().length === 0) {
      logs.push(`[LRC.red] Fetched TTML was empty`);
      return null;
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
    logs.push(`[LRC.red] Fetch error: ${err?.message || err}`);
    return null;
  }
}

/**
 * Provider 3: QQ Music Fallback (Better Lyrics /qq/getLyrics)
 */
async function fetchQq(
  song: string,
  artist: string,
  logs: string[]
): Promise<LyricsResult | null> {
  if (!song || !artist) return null;
  try {
    const url = new URL("https://api.betterlyrics.org/qq/getLyrics");
    url.searchParams.set("s", song);
    url.searchParams.set("a", artist);

    const res = await fetch(url.toString(), {
      signal: AbortSignal.timeout(3500),
    });
    if (res.ok) {
      const json = await res.json();
      if (typeof json?.lyrics === "string" && json.lyrics.trim().length > 0) {
        const lyrics = json.lyrics.trim();
        const syncType = detectSyncType(lyrics);
        logs.push(`[QQ Music] Hit: resolved lyrics for "${song}" by "${artist}" (syncType: ${syncType})`);
        return {
          data: lyrics,
          sourceLabel: "QQ Music",
          syncType,
        };
      }
    } else if (res.status === 404) {
      logs.push(`[QQ Music] 404 Not Found`);
    } else {
      logs.push(`[QQ Music] HTTP ${res.status}`);
    }
  } catch (err: any) {
    logs.push(`[QQ Music] Error: ${err?.message || err}`);
  }
  return null;
}

/**
 * Provider 4: Kugou Fallback (Better Lyrics /kugou/getLyrics)
 */
async function fetchKugou(
  song: string,
  artist: string,
  logs: string[]
): Promise<LyricsResult | null> {
  if (!song || !artist) return null;
  try {
    const url = new URL("https://api.betterlyrics.org/kugou/getLyrics");
    url.searchParams.set("s", song);
    url.searchParams.set("a", artist);

    const res = await fetch(url.toString(), {
      signal: AbortSignal.timeout(3500),
    });
    if (res.ok) {
      const json = await res.json();
      if (typeof json?.lyrics === "string" && json.lyrics.trim().length > 0) {
        const lyrics = json.lyrics.trim();
        const syncType = detectSyncType(lyrics);
        logs.push(`[Kugou] Hit: resolved lyrics for "${song}" by "${artist}" (syncType: ${syncType})`);
        return {
          data: lyrics,
          sourceLabel: "Kugou",
          syncType,
        };
      }
    } else if (res.status === 404) {
      logs.push(`[Kugou] 404 Not Found`);
    } else {
      logs.push(`[Kugou] HTTP ${res.status}`);
    }
  } catch (err: any) {
    logs.push(`[Kugou] Error: ${err?.message || err}`);
  }
  return null;
}

/**
 * Provider 5: LRCLib Fallback (https://lrclib.net/api/get)
 */
async function fetchLrclib(
  song: string,
  artist: string,
  logs: string[]
): Promise<LyricsResult | null> {
  if (!song || !artist) return null;
  try {
    const url = new URL("https://lrclib.net/api/get");
    url.searchParams.set("track_name", song);
    url.searchParams.set("artist_name", artist);

    const res = await fetch(url.toString(), {
      headers: { "User-Agent": "MediaBox/1.0 (https://github.com/boredkevin/mediabox)" },
      signal: AbortSignal.timeout(3500),
    });

    if (res.ok) {
      const json = await res.json();
      if (json.syncedLyrics && typeof json.syncedLyrics === "string" && json.syncedLyrics.trim().length > 0) {
        logs.push(`[LRCLib] Hit: resolved line-synced lyrics for "${song}" by "${artist}"`);
        return {
          data: json.syncedLyrics.trim(),
          sourceLabel: "LRCLib",
          syncType: "line",
        };
      }
      if (json.plainLyrics && typeof json.plainLyrics === "string" && json.plainLyrics.trim().length > 0) {
        logs.push(`[LRCLib] Hit: resolved unsynced lyrics for "${song}" by "${artist}"`);
        return {
          data: json.plainLyrics.trim(),
          sourceLabel: "LRCLib",
          syncType: "none",
        };
      }
    } else if (res.status === 404) {
      logs.push(`[LRCLib] 404 Not Found`);
    } else {
      logs.push(`[LRCLib] HTTP ${res.status}`);
    }
  } catch (err: any) {
    logs.push(`[LRCLib] Error: ${err?.message || err}`);
  }
  return null;
}

/**
 * Primary lyrics resolution action.
 * Strict, prioritized flow:
 * 1. Checks cache in database.
 * 2. Enforces clearance (room context, API token, or Turnstile).
 * 3. Resolves track title & artist strictly from YouTube oEmbed API.
 * 4. Filters non-YouTube Music videos immediately (no lyrics).
 * 5. Multi-provider search:
 *    - Priority 1: Check providers for WORD-SYNCED lyrics. If found, stop and return immediately.
 *    - Priority 2: If no word-synced lyrics found, serve LINE-SYNCED lyrics from the best provider.
 *    - Priority 3: As a last resort, serve UNSYNCED plain lyrics.
 */
export const resolveOrFetch = action({
  args: {
    videoId: v.string(),
    trackTitle: v.optional(v.string()),
    artistName: v.optional(v.string()),
    duration: v.optional(v.number()),
    roomId: v.optional(v.id("rooms")),
    apiToken: v.optional(v.string()),
    turnstileToken: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<any> => {
    const videoId = args.videoId.trim();
    if (!videoId) throw new Error("videoId is required");

    // 1. Fast cache check
    const existing: any = await ctx.runQuery(internal.lyrics.getByVideo, { videoId });
    if (existing && existing.status === "ready") {
      return existing;
    }

    // 2. Clearance check
    let isAuthorized = false;

    if (args.roomId) {
      const room: any = await ctx.runQuery(api.rooms.getRoomById, { roomId: args.roomId });
      if (room && (room.currentlyPlaying === videoId || room.currentlyPlaying.includes(videoId))) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized && args.apiToken) {
      const tokenValid = await ctx.runQuery(internal.admins.checkApiToken, {
        token: args.apiToken,
      });
      if (tokenValid) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      const isHuman = await verifyTurnstile(args.turnstileToken);
      if (isHuman) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      throw new Error(
        "Clearance required. Please provide a valid API token or complete the human verification challenge."
      );
    }

    const logs: string[] = [];
    logs.push(`[Init] videoId="${videoId}"`);

    // 3. Resolve metadata strictly from YouTube oEmbed API
    const ytMeta = await fetchYouTubeVideoMeta(videoId);
    let song = "";
    let artist = "";
    let isYouTubeMusic = false;

    if (ytMeta) {
      song = ytMeta.song;
      artist = ytMeta.artist;
      isYouTubeMusic = ytMeta.isYouTubeMusic;
      logs.push(`[YouTube oEmbed] title="${song}", artist="${artist}", isYouTubeMusic=${isYouTubeMusic}`);
    } else {
      song = (args.trackTitle || "").trim();
      const rawArtist = (args.artistName || "").trim();
      isYouTubeMusic = /\s*-\s*Topic$/i.test(rawArtist) || rawArtist.toLowerCase().endsWith("- topic");
      artist = isYouTubeMusic ? rawArtist.replace(/\s*-\s*Topic$/i, "").trim() : rawArtist;
      logs.push(`[YouTube oEmbed] Fallback: title="${song}", artist="${artist}", isYouTubeMusic=${isYouTubeMusic}`);
    }

    // STRICT FILTER: Non-YouTube Music videos do not play lyrics
    if (!isYouTubeMusic) {
      const skipMsg = `[Filter] Video "${videoId}" (channel: "${ytMeta?.channelName || args.artistName || "Unknown"}") is not an official YouTube Music track. Non-YouTube Music videos do not play lyrics.`;
      console.log(`[lyricsActions.resolveOrFetch] ${skipMsg}`);
      logs.push(skipMsg);

      await ctx.runMutation(internal.lyrics.storeCached, {
        videoId,
        trackTitle: song,
        artistName: artist,
        sourceLabel: "none",
        data: "[]",
        status: "ready",
        syncType: "none",
        logs,
      });

      return {
        videoId,
        trackTitle: song,
        artistName: artist,
        sourceLabel: "none",
        data: "[]",
        status: "ready",
        syncType: "none",
        logs,
      };
    }

    // 4. Acquire in-flight lease
    const wonLease = await ctx.runMutation(internal.lyrics.setInFlight, {
      videoId,
      trackTitle: song,
      artistName: artist,
    });

    if (!wonLease) {
      return existing;
    }

    // Helper to store result and return standard shape
    const storeAndReturn = async (res: LyricsResult) => {
      await ctx.runMutation(internal.lyrics.storeCached, {
        videoId,
        trackTitle: song,
        artistName: artist,
        sourceLabel: res.sourceLabel,
        data: res.data,
        status: "ready",
        syncType: res.syncType,
        isrc: res.isrc,
        logs,
      });
      return {
        videoId,
        trackTitle: song,
        artistName: artist,
        sourceLabel: res.sourceLabel,
        data: res.data,
        status: "ready",
        syncType: res.syncType,
        isrc: res.isrc,
        logs,
      };
    };

    let bestLine: LyricsResult | null = null;
    let bestUnsynced: LyricsResult | null = null;

    // Evaluates provider result: stops immediately if word-synced, otherwise stashes line/unsynced fallback
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
    if (handleResult(unison)) {
      return await storeAndReturn(unison!);
    }

    // STEP 2: LRC.red by song & artist
    const lrcred = await fetchLrcRed(song, artist, logs);
    if (handleResult(lrcred)) {
      return await storeAndReturn(lrcred!);
    }

    // STEP 3: QQ Music fallback
    const qq = await fetchQq(song, artist, logs);
    if (handleResult(qq)) {
      return await storeAndReturn(qq!);
    }

    // STEP 4: Kugou fallback
    const kugou = await fetchKugou(song, artist, logs);
    if (handleResult(kugou)) {
      return await storeAndReturn(kugou!);
    }

    // STEP 5: LRCLib fallback
    const lrclib = await fetchLrclib(song, artist, logs);
    if (handleResult(lrclib)) {
      return await storeAndReturn(lrclib!);
    }

    // Priority Fallback 1: Line-synced
    if (bestLine) {
      logs.push(`[Cascade Fallback] No word-synced lyrics found across providers. Serving LINE-SYNCED lyrics from ${(bestLine as LyricsResult).sourceLabel}.`);
      return await storeAndReturn(bestLine);
    }

    // Priority Fallback 2: Unsynced (plain)
    if (bestUnsynced) {
      logs.push(`[Cascade Fallback] No synced lyrics found across providers. Serving UNSYNCED lyrics from ${(bestUnsynced as LyricsResult).sourceLabel} as last resort.`);
      return await storeAndReturn(bestUnsynced);
    }

    // Priority Fallback 3: Negative cache
    logs.push(`[Negative Cache] All providers yielded no lyrics for "${song}" by "${artist}".`);
    await ctx.runMutation(internal.lyrics.storeCached, {
      videoId,
      trackTitle: song,
      artistName: artist,
      sourceLabel: "none",
      data: "[]",
      status: "ready",
      syncType: "none",
      logs,
    });

    return {
      videoId,
      trackTitle: song,
      artistName: artist,
      sourceLabel: "none",
      data: "[]",
      status: "ready",
      syncType: "none",
      logs,
    };
  },
});
