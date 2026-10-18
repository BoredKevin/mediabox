"use node";

import { action } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { v } from "convex/values";
import { detectSyncType, type LyricsResult, type YouTubeMetaResult } from "./lyrics/types";
import { verifyTurnstile, fetchYouTubeVideoMeta } from "./lyrics/meta";
import { fetchLyricsWaterfall } from "./lyrics/providers";

export { detectSyncType, type LyricsResult, type YouTubeMetaResult };

/**
 * Primary lyrics resolution action.
 * Strict, prioritized flow:
 * 1. Checks cache in database.
 * 2. Enforces clearance (room context, API token, or Turnstile).
 * 3. Resolves track title & artist strictly from YouTube oEmbed API.
 * 4. Filters non-YouTube Music videos immediately (no lyrics).
 * 5. Multi-provider search via fetchLyricsWaterfall (word-synced -> line-synced -> unsynced).
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

      const emptyDoc = {
        videoId,
        trackTitle: song,
        artistName: artist,
        sourceLabel: "none",
        data: "[]",
        status: "ready" as const,
        syncType: "none",
        logs,
      };

      await ctx.runMutation(internal.lyrics.storeCached, emptyDoc);
      return emptyDoc;
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

    // 5. Query providers via waterfall cascade
    const result = await fetchLyricsWaterfall(videoId, song, artist, logs);

    if (result) {
      const doc = {
        videoId,
        trackTitle: song,
        artistName: artist,
        sourceLabel: result.sourceLabel,
        data: result.data,
        status: "ready" as const,
        syncType: result.syncType,
        isrc: result.isrc,
        logs,
      };
      await ctx.runMutation(internal.lyrics.storeCached, doc);
      return doc;
    }

    // Negative cache fallback
    logs.push(`[Negative Cache] All providers yielded no lyrics for "${song}" by "${artist}".`);
    const negativeDoc = {
      videoId,
      trackTitle: song,
      artistName: artist,
      sourceLabel: "none",
      data: "[]",
      status: "ready" as const,
      syncType: "none",
      logs,
    };
    await ctx.runMutation(internal.lyrics.storeCached, negativeDoc);
    return negativeDoc;
  },
});
