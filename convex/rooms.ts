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
    tvUuid: v.string(),
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
      approvedMembers: [],
      approvalRequests: [],
      lockPlaybackControls: false,
      isHostPinned: false,
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
      tvOnline = activePresence.some((p) => p.userId === room.tvUuid);
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
      tvOnline = activePresence.some((p) => p.userId === room.tvUuid);
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
      lockPlaybackControls: v.optional(v.boolean()),
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
      ...(args.settings.lockPlaybackControls !== undefined ? { lockPlaybackControls: args.settings.lockPlaybackControls } : {}),
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
 * Toggles fullscreen join QR code display mode on the TV (Host/Admin only).
 */
export const toggleFullscreenQr = mutation({
  args: {
    roomId: v.id("rooms"),
    callerUid: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.roomId);
    if (!room) throw new Error("Room not found");
    if (args.callerUid && !(await isAuthorized(ctx, room, args.callerUid))) {
      throw new Error("Unauthorized to toggle TV QR code");
    }
    await ctx.db.patch(args.roomId, {
      showFullscreenQr: !room.showFullscreenQr,
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

    // If host privileges are pinned by admin, never transfer host automatically
    if (room.isHostPinned) {
      return { isHost: room.hostUid === args.callerUid };
    }

    if (room.hostUid === room.tvUuid && args.callerUid !== room.tvUuid) {
      await ctx.db.patch(args.roomId, { hostUid: args.callerUid });
      return { isHost: true };
    }

    try {
      const activePresence = await presence.listRoom(ctx, room.code, true);
      const isCurrentHostOnline = activePresence.some((p) => p.userId === room.hostUid);
      if (!isCurrentHostOnline && args.callerUid !== room.tvUuid) {
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

    if (room.isHostPinned && room.hostUid !== args.callerUid) {
      throw new Error("Host privileges are pinned by an admin. Host transfer is disabled for this room.");
    }

    if (room.hostUid === room.tvUuid || room.hostUid === args.callerUid) {
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
 * Toggles pinned host privileges for a room (Admin only).
 * When pinned, host privileges will never transfer automatically or be claimed.
 */
export const toggleHostPin = mutation({
  args: {
    roomId: v.id("rooms"),
    callerUid: v.string(),
  },
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.roomId);
    if (!room) throw new Error("Room not found");

    const admin = await ctx.db
      .query("admins")
      .withIndex("by_uid", (q) => q.eq("uid", args.callerUid))
      .first();
    if (!admin) {
      throw new Error("Only an administrator can pin or unpin host privileges");
    }

    const nextPinned = !room.isHostPinned;
    await ctx.db.patch(args.roomId, {
      isHostPinned: nextPinned,
    });
    return { isHostPinned: nextPinned };
  },
});

/**
 * Directly reassigns host privileges to a specific member (Admin only).
 */
export const adminTransferHost = mutation({
  args: {
    roomId: v.id("rooms"),
    callerUid: v.string(),
    newHostUid: v.string(),
  },
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.roomId);
    if (!room) throw new Error("Room not found");

    const admin = await ctx.db
      .query("admins")
      .withIndex("by_uid", (q) => q.eq("uid", args.callerUid))
      .first();
    if (!admin) {
      throw new Error("Only an administrator can reassign host privileges");
    }

    await ctx.db.patch(args.roomId, {
      hostUid: args.newHostUid,
    });
    return { success: true };
  },
});

/**
 * Toggles transport playback controls lock (Host/Admin only).
 * When locked, only host, admins, TV, and approved members can use transport controls.
 */
export const toggleLockPlaybackControls = mutation({
  args: {
    roomId: v.id("rooms"),
    callerUid: v.string(),
  },
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.roomId);
    if (!room) throw new Error("Room not found");
    if (!(await isAuthorized(ctx, room, args.callerUid))) {
      throw new Error("Unauthorized to lock playback controls");
    }

    const nextLock = !room.lockPlaybackControls;
    await ctx.db.patch(args.roomId, {
      lockPlaybackControls: nextLock,
    });
    return { lockPlaybackControls: nextLock };
  },
});

/**
 * Member requests playback control approval from the host.
 */
export const requestPlaybackApproval = mutation({
  args: {
    roomId: v.id("rooms"),
    callerUid: v.string(),
  },
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.roomId);
    if (!room) throw new Error("Room not found");

    if (
      room.hostUid === args.callerUid ||
      (room.tvUuid && room.tvUuid === args.callerUid) ||
      room.approvedMembers?.includes(args.callerUid)
    ) {
      return { status: "already_approved" };
    }

    const currentRequests = room.approvalRequests || [];
    if (!currentRequests.includes(args.callerUid)) {
      await ctx.db.patch(args.roomId, {
        approvalRequests: [...currentRequests, args.callerUid],
      });
    }
    return { status: "requested" };
  },
});

/**
 * Toggles approval status for a specific member (Host/Admin only).
 */
export const toggleApproveMember = mutation({
  args: {
    roomId: v.id("rooms"),
    callerUid: v.string(),
    targetUid: v.string(),
  },
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.roomId);
    if (!room) throw new Error("Room not found");
    if (!(await isAuthorized(ctx, room, args.callerUid))) {
      throw new Error("Unauthorized to approve members");
    }

    const approved = new Set(room.approvedMembers || []);
    const requests = new Set(room.approvalRequests || []);
    let isNowApproved = false;

    if (approved.has(args.targetUid)) {
      approved.delete(args.targetUid);
      isNowApproved = false;
    } else {
      approved.add(args.targetUid);
      requests.delete(args.targetUid);
      isNowApproved = true;
    }

    await ctx.db.patch(args.roomId, {
      approvedMembers: Array.from(approved),
      approvalRequests: Array.from(requests),
    });

    return { targetUid: args.targetUid, isApproved: isNowApproved };
  },
});

/**
 * Bulk approves all provided member UIDs (Host/Admin only).
 */
export const approveAllMembers = mutation({
  args: {
    roomId: v.id("rooms"),
    callerUid: v.string(),
    memberUids: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.roomId);
    if (!room) throw new Error("Room not found");
    if (!(await isAuthorized(ctx, room, args.callerUid))) {
      throw new Error("Unauthorized to approve members");
    }

    const approved = new Set(room.approvedMembers || []);
    const requests = new Set(room.approvalRequests || []);

    for (const uid of args.memberUids) {
      if (uid && uid !== room.tvUuid) {
        approved.add(uid);
        requests.delete(uid);
      }
    }

    await ctx.db.patch(args.roomId, {
      approvedMembers: Array.from(approved),
      approvalRequests: Array.from(requests),
    });

    return { approvedCount: approved.size };
  },
});

/**
 * Revokes all member approvals for a room (Host/Admin only).
 */
export const revokeAllApprovedMembers = mutation({
  args: {
    roomId: v.id("rooms"),
    callerUid: v.string(),
  },
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.roomId);
    if (!room) throw new Error("Room not found");
    if (!(await isAuthorized(ctx, room, args.callerUid))) {
      throw new Error("Unauthorized to revoke member approvals");
    }

    await ctx.db.patch(args.roomId, {
      approvedMembers: [],
    });

    return { success: true };
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
