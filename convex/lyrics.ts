import { query, mutation, internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Public query to fetch cached synced lyrics for a YouTube videoId.
 * Used reactively by TV displays, mobile remotes, and HTTP consumers.
 */
export const get = query({
  args: {
    videoId: v.string(),
  },
  handler: async (ctx, args) => {
    if (!args.videoId) return null;
    return await ctx.db
      .query("cachedLyrics")
      .withIndex("by_video", (q) => q.eq("videoId", args.videoId))
      .first();
  },
});

/**
 * Internal query to check cached lyrics document from within actions or HTTP endpoints.
 */
export const getByVideo = internalQuery({
  args: {
    videoId: v.string(),
  },
  handler: async (ctx, args) => {
    if (!args.videoId) return null;
    return await ctx.db
      .query("cachedLyrics")
      .withIndex("by_video", (q) => q.eq("videoId", args.videoId))
      .first();
  },
});

/**
 * Internal mutation to mark a videoId as actively fetching lyrics.
 * Prevents multiple concurrent requests (thundering herd shield).
 * Returns true if this caller won the lease, or false if another fetch is already in flight.
 */
export const setInFlight = internalMutation({
  args: {
    videoId: v.string(),
    trackTitle: v.string(),
    artistName: v.string(),
  },
  handler: async (ctx, args) => {
    if (!args.videoId) return false;

    const existing = await ctx.db
      .query("cachedLyrics")
      .withIndex("by_video", (q) => q.eq("videoId", args.videoId))
      .first();

    const now = Date.now();
    if (existing) {
      // If already ready, no need to re-fetch
      if (existing.status === "ready") {
        return false;
      }
      // If fetching and not stale (< 30 seconds), prevent duplicate fetch
      if (existing.status === "fetching" && now - existing.updatedAt < 30_000) {
        return false;
      }

      await ctx.db.patch(existing._id, {
        status: "fetching",
        trackTitle: args.trackTitle || existing.trackTitle,
        artistName: args.artistName || existing.artistName,
        updatedAt: now,
      });
      return true;
    }

    await ctx.db.insert("cachedLyrics", {
      videoId: args.videoId,
      trackTitle: args.trackTitle,
      artistName: args.artistName,
      sourceLabel: "",
      data: "",
      status: "fetching",
      updatedAt: now,
    });
    return true;
  },
});

/**
 * Internal mutation to store resolved or negative-cached lyrics into cachedLyrics.
 */
export const storeCached = internalMutation({
  args: {
    videoId: v.string(),
    trackTitle: v.string(),
    artistName: v.string(),
    sourceLabel: v.string(),
    data: v.string(),
    format: v.optional(v.string()),
    syncType: v.optional(v.string()),
    isrc: v.optional(v.string()),
    status: v.union(v.literal("ready"), v.literal("error")),
    logs: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    if (!args.videoId) return null;

    const existing = await ctx.db
      .query("cachedLyrics")
      .withIndex("by_video", (q) => q.eq("videoId", args.videoId))
      .first();

    const now = Date.now();
    const docFields: any = {
      trackTitle: args.trackTitle,
      artistName: args.artistName,
      sourceLabel: args.sourceLabel,
      data: args.data,
      status: args.status,
      updatedAt: now,
    };
    if (args.format !== undefined) docFields.format = args.format;
    if (args.syncType !== undefined) docFields.syncType = args.syncType;
    if (args.isrc !== undefined) docFields.isrc = args.isrc;
    if (args.logs !== undefined) docFields.logs = args.logs;

    if (existing) {
      await ctx.db.patch(existing._id, docFields);
      return existing._id;
    }

    return await ctx.db.insert("cachedLyrics", {
      videoId: args.videoId,
      ...docFields,
    });
  },
});

export const remove = mutation({
  args: { videoId: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("cachedLyrics")
      .withIndex("by_video", (q) => q.eq("videoId", args.videoId))
      .first();
    if (existing) {
      await ctx.db.delete(existing._id);
      return true;
    }
    return false;
  },
});
