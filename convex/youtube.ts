"use node";

import { action, internalAction } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { v } from "convex/values";
import { Innertube } from "youtubei.js";

function parseVideoId(url: string): string | null {
  if (!url) return null;
  const match = url.match(
    /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/
  );
  return match ? match[1] : null;
}

function isUnwantedTrackTitle(title: string): boolean {
  const lower = title.toLowerCase();
  return (
    /\b\d+\s*(hours?|hrs?|h)\b/.test(lower) ||
    /\b(10\s*hours?|1\s*hour|hour\s*loop|hours\s*loop|\d+\s*h\s*loop)\b/.test(lower) ||
    /\b(infinite\s*loop|continuous\s*loop|1\s*hour\s*version|10\s*hour\s*version)\b/.test(lower) ||
    (/\bloop\b/.test(lower) && /\b(hour|hrs|\d+h|extended|repeat)\b/.test(lower)) ||
    /\b(full\s*album|complete\s*album|discography|all\s*songs|greatest\s*hits\s*full)\b/.test(lower) ||
    /\b(compilation|mega\s*mix|megamix|mashup\s*mix|dj\s*mix|album\s*mix|live\s*stream|24\/7)\b/.test(lower)
  );
}

let defaultInnertubeInstance: Innertube | null = null;
async function getInnertube(): Promise<Innertube> {
  if (!defaultInnertubeInstance) {
    defaultInnertubeInstance = await Innertube.create({
      generate_session_locally: true,
      retrieve_player: false,
      retrieve_innertube_config: false,
    });
  }
  return defaultInnertubeInstance;
}

async function verifyTurnstile(token: string | undefined): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    console.warn(
      "[Convex YouTube Action] TURNSTILE_SECRET_KEY not set in Convex environment. Bypassing Turnstile in development mode."
    );
    return true;
  }
  if (!token) {
    return false;
  }
  try {
    const formData = new URLSearchParams();
    formData.append("secret", secret);
    formData.append("response", token);

    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: formData,
      headers: {
        "content-type": "application/x-www-form-urlencoded",
      },
      signal: AbortSignal.timeout(4000),
    });
    const data = (await res.json()) as { success: boolean; "error-codes"?: string[] };
    return data.success === true;
  } catch (err) {
    console.error("[Convex YouTube Action] Turnstile verification network error:", err);
    return false;
  }
}

/**
 * Searches YouTube / YouTube Music.
 * Clearance logic:
 * - If apiToken is valid (in env or apiTokens table), human verification is bypassed.
 * - Otherwise (guest phones or unauthenticated requests), turnstileToken must be valid.
 */
export const search = action({
  args: {
    query: v.string(),
    apiToken: v.optional(v.string()),
    turnstileToken: v.optional(v.string()),
    preferMusicVideos: v.optional(v.boolean()),
    maxResults: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const cleanQuery = args.query.trim();
    if (!cleanQuery) return [];

    // 1. Check API Token clearance
    let hasClearance = false;
    if (args.apiToken) {
      const validToken = await ctx.runQuery(internal.admins.checkApiToken, {
        token: args.apiToken,
      });
      if (validToken) {
        hasClearance = true;
      }
    }

    // 2. If not cleared by token, verify Turnstile token
    if (!hasClearance) {
      const isHuman = await verifyTurnstile(args.turnstileToken);
      if (!isHuman) {
        throw new Error("Human verification required. Please provide a valid API token or complete the security challenge.");
      }
    }

    // 3. Perform search via Innertube
    const maxResults = args.maxResults || 25;
    const yt = await getInnertube();

    try {
      if (args.preferMusicVideos !== false) {
        const result = await yt.music.search(cleanQuery, { type: "song" });
        const songs = result.songs?.contents || [];
        return songs.slice(0, maxResults).map((rawSong: any) => {
          const s = rawSong?.primary || rawSong;
          const id = s.id || s.video_id || "";
          const title = s.title?.text || (typeof s.title === "string" ? s.title : s.title?.runs?.[0]?.text) || "Unknown Title";
          const channelTitle = s.artists?.[0]?.name || s.author?.name || "";
          const thumb =
            s.thumbnail?.contents?.[0]?.url ||
            s.thumbnail?.[0]?.url ||
            s.thumbnails?.[0]?.url ||
            (id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : "");
          return {
            id,
            url: `https://www.youtube.com/watch?v=${id}`,
            title,
            channelTitle,
            durationSeconds: s.duration?.seconds || undefined,
            thumbnail: thumb,
            thumbnailUrl: thumb,
          };
        });
      } else {
        const result: any = await yt.search(cleanQuery, { type: "video" });
        const videos = result.videos || result.results || [];
        return videos.slice(0, maxResults).map((rawVideo: any) => {
          const v = rawVideo?.primary || rawVideo;
          const id = v.id || v.video_id || "";
          const title = v.title?.text || (typeof v.title === "string" ? v.title : v.title?.runs?.[0]?.text) || "Unknown Title";
          const channelTitle = v.author?.name || v.channel?.name || "";
          const thumb =
            v.thumbnails?.[0]?.url ||
            v.thumbnail?.[0]?.url ||
            (id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : "");
          return {
            id,
            url: `https://www.youtube.com/watch?v=${id}`,
            title,
            channelTitle,
            durationSeconds: v.duration?.seconds || undefined,
            thumbnail: thumb,
            thumbnailUrl: thumb,
          };
        });
      }
    } catch (err: any) {
      console.error("[Convex YouTube Action] Search error:", err);
      throw new Error(`YouTube search failed: ${err.message}`);
    }
  },
});

/**
 * Extracts a clean radio track item from raw Innertube PlaylistPanelVideo or PlaylistPanelVideoWrapper.
 */
function extractRadioTrack(rawItem: any, seedVideoId: string) {
  const item = rawItem?.primary || rawItem;
  if (!item) return null;
  const id = item.video_id || item.id || item.endpoint?.payload?.videoId;
  if (!id || typeof id !== "string" || id === seedVideoId) return null;

  const rawTitle = item.title?.text || (typeof item.title === "string" ? item.title : item.title?.runs?.[0]?.text) || "";
  const title = rawTitle.trim() || "Unknown Title";
  if (isUnwantedTrackTitle(title)) return null;

  let channelTitle = "";
  if (Array.isArray(item.artists) && item.artists.length > 0) {
    channelTitle = item.artists[0]?.name || item.artists[0]?.text || "";
  } else if (item.author?.name) {
    channelTitle = item.author.name;
  }

  const durationSeconds = typeof item.duration?.seconds === "number" ? item.duration.seconds : undefined;
  const thumbUrl =
    item.thumbnail?.[0]?.url ||
    item.thumbnails?.[0]?.url ||
    (id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : undefined);

  return {
    id,
    url: `https://www.youtube.com/watch?v=${id}`,
    title,
    channelTitle,
    durationSeconds,
    thumbnailUrl: thumbUrl,
    thumbnail: thumbUrl || "",
  };
}

/**
 * Prefetches YouTube Music automix radio tracks for a seed video.
 */
export const prefetchRadio = internalAction({
  args: {
    roomId: v.id("rooms"),
    seedVideoUrl: v.string(),
  },
  handler: async (ctx, args) => {
    const videoId = parseVideoId(args.seedVideoUrl);
    if (!videoId) return;

    try {
      const yt = await getInnertube();
      const upNext: any = await yt.music.getUpNext(videoId);
      const items: any[] = [];
      for (const item of upNext?.contents || []) {
        const track = extractRadioTrack(item, videoId);
        if (track) {
          items.push(track);
          if (items.length >= 20) break;
        }
      }

      await ctx.runMutation(internal.playback.appendRadioBatch, {
        roomId: args.roomId,
        freshTracks: items,
      });
    } catch (err: any) {
      console.warn("[Convex YouTube Action] prefetchRadio failed:", err.message);
    }
  },
});

/**
 * Fetches radio recommendations and immediately sets them as active radio queue.
 */
export const fetchAndPlayNextRadio = action({
  args: {
    roomId: v.id("rooms"),
    seedVideoUrl: v.optional(v.string()),
    apiToken: v.optional(v.string()),
    turnstileToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // 1. Clearance Check
    let hasClearance = false;

    // Check API token
    if (args.apiToken) {
      const validToken = await ctx.runQuery(internal.admins.checkApiToken, {
        token: args.apiToken,
      });
      if (validToken) {
        hasClearance = true;
      }
    }

    // Check active room context
    if (!hasClearance && args.roomId) {
      const room = await ctx.runQuery(api.rooms.getRoomById, { roomId: args.roomId });
      if (room) {
        hasClearance = true;
      }
    }

    // Check Turnstile token
    if (!hasClearance) {
      const isHuman = await verifyTurnstile(args.turnstileToken);
      if (isHuman) {
        hasClearance = true;
      }
    }

    if (!hasClearance) {
      throw new Error(
        "Clearance required. Please provide a valid API token, active room context, or complete the security challenge."
      );
    }

    const room = await ctx.runQuery(api.rooms.getRoomById, { roomId: args.roomId });
    const url = args.seedVideoUrl || room?.currentlyPlaying || "";
    const videoId = parseVideoId(url);
    if (!videoId) {
      await ctx.runMutation(internal.playback.applyRadioBatch, {
        roomId: args.roomId,
        tracks: [],
      });
      return;
    }

    try {
      const yt = await getInnertube();
      const upNext: any = await yt.music.getUpNext(videoId);
      const items: any[] = [];
      for (const item of upNext?.contents || []) {
        const track = extractRadioTrack(item, videoId);
        if (track) {
          if (typeof track.durationSeconds === "number" && (track.durationSeconds < 60 || track.durationSeconds > 720)) {
            continue;
          }
          items.push(track);
          if (items.length >= 25) break;
        }
      }

      await ctx.runMutation(internal.playback.applyRadioBatch, {
        roomId: args.roomId,
        tracks: items,
      });
    } catch (err: any) {
      console.warn("[Convex YouTube Action] fetchAndPlayNextRadio failed:", err.message);
      await ctx.runMutation(internal.playback.applyRadioBatch, {
        roomId: args.roomId,
        tracks: [],
      });
    }
  },
});
