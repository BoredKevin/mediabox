import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { presence } from "./presence";
import { isAuthorized } from "./rooms/auth";
import {
  handleBeamTokenToTv,
  handleGetPendingTvToken,
  handleAcknowledgeTvToken,
} from "./rooms/tokens";

export { isAuthorized };

/**
 * Creates a new Watch Together room with a unique 6-digit PIN.
 */
export const create = mutation({
  args: {
    hostUid: v.string(),
    tvUid: v.string(),
    tvUuid: v.optional(v.string()),
    preferMusicVideos: v.optional(v.boolean()),
    lyricsOffsetMs: v.optional(v.number()),
    lyricsWordSync: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    let code = Math.floor(100000 + Math.random() * 900000).toString();
    const existing = await ctx.db
      .query("rooms")
      .withIndex("by_code", (q) => q.eq("code", code))
      .first();
    if (existing) {
      code = Math.floor(100000 + Math.random() * 900000).toString();
    }

    const now = Date.now();
    const roomId = await ctx.db.insert("rooms", {
      code,
      hostUid: args.hostUid,
      tvUid: args.tvUid,
      tvUuid: args.tvUuid,
      isLocked: false,
      isAutoplay: true,
      isCountdownEnabled: true,
      currentlyPlaying: "",
      currentlyPlayingTitle: "",
      playback: {
        status: "paused",
        positionMs: 0,
        durationMs: 0,
        volume: 80,
        updatedAt: now,
      },
      playedHistory: [],
      futureHistory: [],
      lyricsOffsetMs: args.lyricsOffsetMs,
      lyricsWordSync: args.lyricsWordSync,
      preferMusicVideos: args.preferMusicVideos,
    });

    await ctx.db.insert("radioQueue", {
      roomId,
      items: [],
    });

    return { roomId, code };
  },
});

/**
 * Queries room state by 6-digit code.
 */
export const getRoom = query({
  args: { code: v.string() },
  handler: async (ctx, args) => {
    const room = await ctx.db
      .query("rooms")
      .withIndex("by_code", (q) => q.eq("code", args.code.trim().toUpperCase()))
      .first();
    if (!room) return null;

    let tvOnline = false;
    try {
      const activePresence = await presence.listRoom(ctx, room.code, true);
      tvOnline = activePresence.some((p) => p.userId === room.tvUid);
    } catch {
      tvOnline = true;
    }

    return { ...room, tvOnline };
  },
});

/**
 * Queries room state by document ID.
 */
export const getRoomById = query({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.roomId);
    if (!room) return null;

    let tvOnline = false;
    try {
      const activePresence = await presence.listRoom(ctx, room.code, true);
      tvOnline = activePresence.some((p) => p.userId === room.tvUid);
    } catch {
      tvOnline = true;
    }

    return { ...room, tvOnline };
  },
});

/**
 * Toggles room controls lock (Host/Admin only).
 */
export const toggleLock = mutation({
  args: {
    roomId: v.id("rooms"),
    callerUid: v.string(),
  },
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.roomId);
    if (!room) throw new Error("Room not found");
    if (!(await isAuthorized(ctx, room, args.callerUid))) {
      throw new Error("Unauthorized to lock room");
    }

    const nextLock = !room.isLocked;
    const now = Date.now();
    await ctx.db.patch(args.roomId, {
      isLocked: nextLock,
      playback: nextLock
        ? { ...room.playback, status: "paused", updatedAt: now }
        : room.playback,
    });
  },
});

/**
 * Toggles smart autoplay automix.
 */
export const toggleAutoplay = mutation({
  args: {
    roomId: v.id("rooms"),
    callerUid: v.string(),
  },
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.roomId);
    if (!room) throw new Error("Room not found");
    await ctx.db.patch(args.roomId, {
      isAutoplay: !room.isAutoplay,
    });
  },
});

/**
 * Toggles 10s schedule countdown timer overlay.
 */
export const toggleCountdown = mutation({
  args: {
    roomId: v.id("rooms"),
    callerUid: v.string(),
  },
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.roomId);
    if (!room) throw new Error("Room not found");
    await ctx.db.patch(args.roomId, {
      isCountdownEnabled: !room.isCountdownEnabled,
    });
  },
});

/**
 * Updates host settings.
 */
export const updateSettings = mutation({
  args: {
    roomId: v.id("rooms"),
    callerUid: v.string(),
    settings: v.object({
      lyricsOffsetMs: v.optional(v.number()),
      lyricsWordSync: v.optional(v.boolean()),
      preferMusicVideos: v.optional(v.boolean()),
      isLocked: v.optional(v.boolean()),
      isAutoplay: v.optional(v.boolean()),
      isCountdownEnabled: v.optional(v.boolean()),
    }),
  },
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.roomId);
    if (!room) throw new Error("Room not found");
    if (!(await isAuthorized(ctx, room, args.callerUid))) {
      throw new Error("Unauthorized to update settings");
    }

    await ctx.db.patch(args.roomId, {
      ...(args.settings.lyricsOffsetMs !== undefined ? { lyricsOffsetMs: args.settings.lyricsOffsetMs } : {}),
      ...(args.settings.lyricsWordSync !== undefined ? { lyricsWordSync: args.settings.lyricsWordSync } : {}),
      ...(args.settings.preferMusicVideos !== undefined ? { preferMusicVideos: args.settings.preferMusicVideos } : {}),
      ...(args.settings.isLocked !== undefined ? { isLocked: args.settings.isLocked } : {}),
      ...(args.settings.isAutoplay !== undefined ? { isAutoplay: args.settings.isAutoplay } : {}),
      ...(args.settings.isCountdownEnabled !== undefined ? { isCountdownEnabled: args.settings.isCountdownEnabled } : {}),
    });
  },
});

/**
 * Ends room session and cleans up all related records.
 */
export const endRoom = mutation({
  args: {
    roomId: v.id("rooms"),
    callerUid: v.string(),
  },
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.roomId);
    if (!room) return;
    if (!(await isAuthorized(ctx, room, args.callerUid))) {
      throw new Error("Unauthorized to end room");
    }

    // Cascade delete queue
    const queueItems = await ctx.db
      .query("queue")
      .withIndex("by_room_order", (q) => q.eq("roomId", args.roomId))
      .collect();
    for (const item of queueItems) {
      await ctx.db.delete(item._id);
    }

    // Cascade delete radioQueue
    const radio = await ctx.db
      .query("radioQueue")
      .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
      .first();
    if (radio) {
      await ctx.db.delete(radio._id);
    }

    // Cascade delete roomSecrets
    const secrets = await ctx.db
      .query("roomSecrets")
      .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
      .collect();
    for (const s of secrets) {
      await ctx.db.delete(s._id);
    }

    await ctx.db.delete(args.roomId);
  },
});

/**
 * Toggles fullscreen display mode on the TV.
 */
export const toggleFullscreen = mutation({
  args: {
    roomId: v.id("rooms"),
  },
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.roomId);
    if (!room) throw new Error("Room not found");
    await ctx.db.patch(args.roomId, {
      isFullscreen: !room.isFullscreen,
    });
  },
});

/**
 * Joins a room as a client.
 */
export const joinRoom = mutation({
  args: {
    roomId: v.id("rooms"),
    callerUid: v.string(),
  },
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.roomId);
    if (!room) throw new Error("Room not found");

    if (room.hostUid === room.tvUid && args.callerUid !== room.tvUid) {
      await ctx.db.patch(args.roomId, { hostUid: args.callerUid });
      return { isHost: true };
    }

    try {
      const activePresence = await presence.listRoom(ctx, room.code, true);
      const isCurrentHostOnline = activePresence.some((p) => p.userId === room.hostUid);
      if (!isCurrentHostOnline && args.callerUid !== room.tvUid) {
        await ctx.db.patch(args.roomId, { hostUid: args.callerUid });
        return { isHost: true };
      }
    } catch {
      // Ignore
    }

    return { isHost: room.hostUid === args.callerUid };
  },
});

/**
 * Claims host privileges for a room if current host is offline.
 */
export const claimHost = mutation({
  args: {
    roomId: v.id("rooms"),
    callerUid: v.string(),
  },
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.roomId);
    if (!room) throw new Error("Room not found");

    if (room.hostUid === room.tvUid || room.hostUid === args.callerUid) {
      await ctx.db.patch(args.roomId, { hostUid: args.callerUid });
      return { isHost: true };
    }

    try {
      const activePresence = await presence.listRoom(ctx, room.code, true);
      const isCurrentHostOnline = activePresence.some((p) => p.userId === room.hostUid);
      if (!isCurrentHostOnline) {
        await ctx.db.patch(args.roomId, { hostUid: args.callerUid });
        return { isHost: true };
      }
    } catch {
      // Ignore
    }

    return { isHost: room.hostUid === args.callerUid };
  },
});

/**
 * Beams an API token from the Host to the TV screen.
 */
export const beamTokenToTv = mutation({
  args: {
    roomId: v.id("rooms"),
    callerUid: v.string(),
    token: v.string(),
  },
  handler: async (ctx, args) => {
    await handleBeamTokenToTv(ctx, args.roomId, args.callerUid, args.token);
  },
});

/**
 * TV queries incoming beamed API tokens.
 */
export const getPendingTvToken = query({
  args: {
    roomId: v.id("rooms"),
    tvUuid: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await handleGetPendingTvToken(ctx, args.roomId, args.tvUuid);
  },
});

/**
 * TV acknowledges and wipes pending token.
 */
export const acknowledgeTvToken = mutation({
  args: {
    roomId: v.id("rooms"),
  },
  handler: async (ctx, args) => {
    await handleAcknowledgeTvToken(ctx, args.roomId);
  },
});
