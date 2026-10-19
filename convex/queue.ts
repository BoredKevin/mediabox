import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { isAuthorized } from "./rooms/auth";

/**
 * Returns all queued songs for a room, ordered by queue sequence.
 */
export const getQueue = query({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("queue")
      .withIndex("by_room_order", (q) => q.eq("roomId", args.roomId))
      .collect();
  },
});

/**
 * Adds a song to the queue. If playback is currently idle/empty, starts playing immediately.
 */
export const add = mutation({
  args: {
    roomId: v.id("rooms"),
    url: v.string(),
    title: v.string(),
    addedBy: v.string(),
    addedByName: v.string(),
  },
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.roomId);
    if (!room) throw new Error("Room not found");

    if (room.isLocked && !(await isAuthorized(ctx, room, args.addedBy))) {
      throw new Error("Room is locked by host");
    }

    const now = Date.now();

    // If room is completely idle, start playing immediately
    if (!room.currentlyPlaying && room.playback.status !== "playing") {
      await ctx.db.patch(args.roomId, {
        currentlyPlaying: args.url,
        currentlyPlayingTitle: args.title,
        playback: {
          ...room.playback,
          status: "loading",
          positionMs: 0,
          updatedAt: now,
        },
      });
      return { instantPlay: true };
    }

    // Otherwise append to queue
    const currentQueue = await ctx.db
      .query("queue")
      .withIndex("by_room_order", (q) => q.eq("roomId", args.roomId))
      .collect();

    const maxOrder = currentQueue.reduce((max, item) => Math.max(max, item.order), 0);
    const queueId = await ctx.db.insert("queue", {
      roomId: args.roomId,
      url: args.url,
      title: args.title,
      addedBy: args.addedBy,
      addedByName: args.addedByName,
      order: maxOrder + 1,
      createdAt: now,
    });

    return { queueId, instantPlay: false };
  },
});

/**
 * Removes a song from the queue.
 * Allowed if caller added the item, or caller is the room host/tv.
 */
export const remove = mutation({
  args: {
    queueId: v.id("queue"),
    callerUid: v.string(),
  },
  handler: async (ctx, args) => {
    const item = await ctx.db.get(args.queueId);
    if (!item) return;

    const room = await ctx.db.get(item.roomId);
    if (!room) return;

    const isOwner = item.addedBy === args.callerUid;
    const authorized = isOwner || (await isAuthorized(ctx, room, args.callerUid));

    if (!authorized) {
      throw new Error("Unauthorized to remove this track");
    }

    await ctx.db.delete(args.queueId);
  },
});

/**
 * Reorders the queue.
 */
export const reorder = mutation({
  args: {
    roomId: v.id("rooms"),
    orderedIds: v.array(v.id("queue")),
    callerUid: v.string(),
  },
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.roomId);
    if (!room) throw new Error("Room not found");

    if (!(await isAuthorized(ctx, room, args.callerUid))) {
      throw new Error("Only host or admin can reorder the queue");
    }

    for (let i = 0; i < args.orderedIds.length; i++) {
      await ctx.db.patch(args.orderedIds[i], {
        order: i + 1,
      });
    }
  },
});

/**
 * Clears the entire queue.
 */
export const clear = mutation({
  args: {
    roomId: v.id("rooms"),
    callerUid: v.string(),
  },
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.roomId);
    if (!room) throw new Error("Room not found");

    if (!(await isAuthorized(ctx, room, args.callerUid))) {
      throw new Error("Only host or admin can clear the queue");
    }

    const items = await ctx.db
      .query("queue")
      .withIndex("by_room_order", (q) => q.eq("roomId", args.roomId))
      .collect();

    for (const item of items) {
      await ctx.db.delete(item._id);
    }
  },
});

/**
 * Purges tracks added by a specific member (e.g. when kicked).
 */
export const purgeMemberTracks = mutation({
  args: {
    roomId: v.id("rooms"),
    targetUid: v.string(),
    callerUid: v.string(),
  },
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.roomId);
    if (!room) throw new Error("Room not found");

    if (!(await isAuthorized(ctx, room, args.callerUid))) {
      throw new Error("Unauthorized: Only host or admin can purge tracks");
    }

    const items = await ctx.db
      .query("queue")
      .withIndex("by_room_order", (q) => q.eq("roomId", args.roomId))
      .collect();

    for (const item of items) {
      if (item.addedBy === args.targetUid) {
        await ctx.db.delete(item._id);
      }
    }
  },
});
