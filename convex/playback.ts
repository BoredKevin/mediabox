import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { isAuthorized } from "./rooms/auth";
import {
  handleNextTrackTransition,
  handlePreviousTrackTransition,
} from "./playback/transitions";

/**
 * Transitions to the next song in the room:
 * 1. Checks futureHistory stack
 * 2. Checks active member user queue
 * 3. Checks algorithmic automix radioQueue
 * 4. Triggers radio fetch if autoplay is enabled and queue is empty
 */
export const nextTrack = mutation({
  args: {
    roomId: v.id("rooms"),
    expectedUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await handleNextTrackTransition(ctx, args.roomId, args.expectedUrl);
  },
});

/**
 * Transitions to previous track in history or restarts current track.
 */
export const previousTrack = mutation({
  args: {
    roomId: v.id("rooms"),
    forcePrevious: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    return await handlePreviousTrackTransition(ctx, args.roomId, args.forcePrevious);
  },
});

/**
 * High-frequency position checkpoint broadcast by the TV player.
 */
export const syncPositionCheckpoint = mutation({
  args: {
    roomId: v.id("rooms"),
    positionMs: v.number(),
    durationMs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.roomId);
    if (!room) return;

    await ctx.db.patch(args.roomId, {
      playback: {
        ...room.playback,
        positionMs: Math.max(0, args.positionMs),
        durationMs: typeof args.durationMs === "number" ? Math.max(0, args.durationMs) : room.playback.durationMs,
        updatedAt: Date.now(),
      },
    });
  },
});

/**
 * Toggles play/pause playback state.
 * Accurately freezes dead-reckoned position upon pause, and resets updatedAt upon resume.
 */
export const togglePlayPause = mutation({
  args: {
    roomId: v.id("rooms"),
    positionMs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.roomId);
    if (!room) throw new Error("Room not found");

    const now = Date.now();
    const newStatus = room.playback.status === "playing" ? "paused" : "playing";

    let nextPositionMs: number;
    if (typeof args.positionMs === "number" && args.positionMs >= 0) {
      nextPositionMs = args.positionMs;
    } else if (room.playback.status === "playing") {
      const elapsed = Math.max(0, now - (room.playback.updatedAt || now));
      const deadReckoned = room.playback.positionMs + elapsed;
      nextPositionMs =
        room.playback.durationMs > 0
          ? Math.min(deadReckoned, room.playback.durationMs)
          : deadReckoned;
    } else {
      nextPositionMs = room.playback.positionMs;
    }

    await ctx.db.patch(args.roomId, {
      playback: {
        ...room.playback,
        status: newStatus,
        positionMs: nextPositionMs,
        updatedAt: now,
      },
    });
  },
});

/**
 * Adjusts master playback volume (0-100).
 */
export const setVolume = mutation({
  args: {
    roomId: v.id("rooms"),
    volume: v.number(),
  },
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.roomId);
    if (!room) return;

    await ctx.db.patch(args.roomId, {
      playback: {
        ...room.playback,
        volume: Math.min(100, Math.max(0, args.volume)),
      },
    });
  },
});

/**
 * Seeks to a specific position in milliseconds.
 */
export const seek = mutation({
  args: {
    roomId: v.id("rooms"),
    positionMs: v.number(),
  },
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.roomId);
    if (!room) return;

    const currentSeq = room.playback.seekSeq ?? 0;
    await ctx.db.patch(args.roomId, {
      playback: {
        ...room.playback,
        positionMs: Math.max(0, args.positionMs),
        updatedAt: Date.now(),
        seekSeq: currentSeq + 1,
      },
    });
  },
});

/**
 * Returns automix recommendations in the radioQueue.
 */
export const getRadioQueue = query({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, args) => {
    const radio = await ctx.db
      .query("radioQueue")
      .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
      .first();
    return radio?.items || [];
  },
});

/**
 * Internal mutation: replaces radio queue.
 */
export const applyRadioBatch = internalMutation({
  args: {
    roomId: v.id("rooms"),
    tracks: v.array(
      v.object({
        id: v.string(),
        url: v.string(),
        title: v.string(),
        channelTitle: v.string(),
        durationSeconds: v.optional(v.number()),
        thumbnailUrl: v.optional(v.string()),
        thumbnail: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const radio = await ctx.db
      .query("radioQueue")
      .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
      .first();

    if (radio) {
      await ctx.db.patch(radio._id, { items: args.tracks });
    } else {
      await ctx.db.insert("radioQueue", {
        roomId: args.roomId,
        items: args.tracks,
      });
    }

    const room = await ctx.db.get(args.roomId);
    if (room && room.playback.status === "loading") {
      const currentTrack = room.currentlyPlaying
        ? [{ url: room.currentlyPlaying, title: room.currentlyPlayingTitle || "Untitled Track" }]
        : [];
      const newPlayedHistory = [...currentTrack, ...(room.playedHistory || [])].slice(0, 50);

      if (args.tracks.length > 0) {
        const first = args.tracks[0];
        const remaining = args.tracks.slice(1);

        const currentRadio = await ctx.db
          .query("radioQueue")
          .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
          .first();
        if (currentRadio) {
          await ctx.db.patch(currentRadio._id, { items: remaining });
        }

        await ctx.db.patch(args.roomId, {
          currentlyPlaying: first.url,
          currentlyPlayingTitle: first.title,
          playedHistory: newPlayedHistory,
          playback: {
            ...room.playback,
            status: "loading",
            positionMs: 0,
            updatedAt: Date.now(),
          },
        });
      } else {
        await ctx.db.patch(args.roomId, {
          currentlyPlaying: "",
          currentlyPlayingTitle: "",
          playedHistory: newPlayedHistory,
          playback: {
            ...room.playback,
            status: "paused",
            positionMs: 0,
            updatedAt: Date.now(),
          },
        });
      }
    }
  },
});

/**
 * Internal mutation: appends tracks to radio queue without duplicates.
 */
export const appendRadioBatch = internalMutation({
  args: {
    roomId: v.id("rooms"),
    freshTracks: v.array(
      v.object({
        id: v.string(),
        url: v.string(),
        title: v.string(),
        channelTitle: v.string(),
        durationSeconds: v.optional(v.number()),
        thumbnailUrl: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const radio = await ctx.db
      .query("radioQueue")
      .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
      .first();

    if (!radio) return;

    const existingIds = new Set(radio.items.map((i) => i.id));
    const merged = [...radio.items];

    for (const track of args.freshTracks) {
      if (!existingIds.has(track.id)) {
        existingIds.add(track.id);
        merged.push(track);
      }
    }

    await ctx.db.patch(radio._id, { items: merged });
  },
});

/**
 * TV report playback status mutation.
 * Enables TV host to anchor true playback start ("playing") when YouTube player begins rendering frames.
 */
export const reportPlaybackStatus = mutation({
  args: {
    roomId: v.id("rooms"),
    status: v.union(v.literal("playing"), v.literal("loading"), v.literal("paused")),
    positionMs: v.optional(v.number()),
    durationMs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.roomId);
    if (!room) return;
    await ctx.db.patch(args.roomId, {
      playback: {
        ...room.playback,
        status: args.status,
        positionMs: typeof args.positionMs === "number" ? Math.max(0, args.positionMs) : room.playback.positionMs,
        durationMs: typeof args.durationMs === "number" ? Math.max(0, args.durationMs) : room.playback.durationMs,
        updatedAt: Date.now(),
      },
    });
  },
});

/**
 * Plays a specific item from the queue immediately.
 */
export const playQueueItem = mutation({
  args: {
    roomId: v.id("rooms"),
    queueId: v.id("queue"),
  },
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.roomId);
    if (!room) throw new Error("Room not found");
    const item = await ctx.db.get(args.queueId);
    if (!item) return;

    const now = Date.now();
    const currentTrack = room.currentlyPlaying
      ? { url: room.currentlyPlaying, title: room.currentlyPlayingTitle || "" }
      : null;
    const newPlayedHistory = currentTrack
      ? [currentTrack, ...(room.playedHistory || [])].slice(0, 50)
      : (room.playedHistory || []);

    await ctx.db.delete(args.queueId);
    await ctx.db.patch(args.roomId, {
      currentlyPlaying: item.url,
      currentlyPlayingTitle: item.title,
      playedHistory: newPlayedHistory,
      futureHistory: [],
      playback: {
        ...room.playback,
        status: "loading",
        positionMs: 0,
        updatedAt: now,
      },
    });
  },
});

/**
 * Promotes a track from the algorithmic radioQueue into the prioritized user queue.
 * Removes it from radio recommendations and starts playback if idle.
 */
export const addRadioTrackToQueue = mutation({
  args: {
    roomId: v.id("rooms"),
    trackId: v.string(),
    callerUid: v.string(),
    callerName: v.string(),
  },
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.roomId);
    if (!room) throw new Error("Room not found");

    if (room.isLocked && !(await isAuthorized(ctx, room, args.callerUid))) {
      throw new Error("Room is locked by host");
    }

    const radioDoc = await ctx.db
      .query("radioQueue")
      .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
      .first();

    if (!radioDoc) throw new Error("Radio queue not found");

    const trackIndex = radioDoc.items.findIndex(
      (item) => item.id === args.trackId || item.url.includes(args.trackId)
    );
    if (trackIndex === -1) {
      throw new Error("Track not found in radio queue");
    }

    const track = radioDoc.items[trackIndex];
    const remaining = [
      ...radioDoc.items.slice(0, trackIndex),
      ...radioDoc.items.slice(trackIndex + 1),
    ];
    await ctx.db.patch(radioDoc._id, { items: remaining });

    const now = Date.now();

    // If room is completely idle, start playing immediately
    if (!room.currentlyPlaying && room.playback.status !== "playing") {
      await ctx.db.patch(args.roomId, {
        currentlyPlaying: track.url,
        currentlyPlayingTitle: track.title,
        playback: {
          ...room.playback,
          status: "loading",
          positionMs: 0,
          updatedAt: now,
        },
      });
      return { instantPlay: true };
    }

    // Otherwise append to active user queue
    const currentQueue = await ctx.db
      .query("queue")
      .withIndex("by_room_order", (q) => q.eq("roomId", args.roomId))
      .collect();

    const maxOrder = currentQueue.reduce((max, item) => Math.max(max, item.order), 0);
    const queueId = await ctx.db.insert("queue", {
      roomId: args.roomId,
      url: track.url,
      title: track.title,
      addedBy: args.callerUid,
      addedByName: args.callerName,
      order: maxOrder + 1,
      createdAt: now,
    });

    // Check prefetch trigger if automix buffer is running low
    if (remaining.length <= 3 && room.isAutoplay && room.currentlyPlaying) {
      await ctx.scheduler.runAfter(0, internal.youtube.prefetchRadio, {
        roomId: args.roomId,
        seedVideoUrl: room.currentlyPlaying,
      });
    }

    return { queueId, instantPlay: false };
  },
});

/**
 * Removes a track from the algorithmic radio queue.
 */
export const deleteRadioTrack = mutation({
  args: {
    roomId: v.id("rooms"),
    trackId: v.string(),
    callerUid: v.string(),
  },
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.roomId);
    if (!room) throw new Error("Room not found");

    if (room.isLocked && !(await isAuthorized(ctx, room, args.callerUid))) {
      throw new Error("Room is locked by host");
    }

    const radioDoc = await ctx.db
      .query("radioQueue")
      .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
      .first();

    if (!radioDoc) return { success: false };

    const remaining = radioDoc.items.filter(
      (item) => item.id !== args.trackId && !item.url.includes(args.trackId)
    );
    await ctx.db.patch(radioDoc._id, { items: remaining });

    // Check prefetch trigger if automix buffer is running low
    if (remaining.length <= 3 && room.isAutoplay && room.currentlyPlaying) {
      await ctx.scheduler.runAfter(0, internal.youtube.prefetchRadio, {
        roomId: args.roomId,
        seedVideoUrl: room.currentlyPlaying,
      });
    }

    return { success: true };
  },
});

/**
 * Manually appends a track to the algorithmic radio queue.
 */
export const addToRadioQueue = mutation({
  args: {
    roomId: v.id("rooms"),
    track: v.object({
      id: v.string(),
      url: v.string(),
      title: v.string(),
      channelTitle: v.string(),
      durationSeconds: v.optional(v.number()),
      thumbnailUrl: v.optional(v.string()),
      thumbnail: v.optional(v.string()),
    }),
  },
  handler: async (ctx, args) => {
    const radioDoc = await ctx.db
      .query("radioQueue")
      .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
      .first();

    if (radioDoc) {
      if (!radioDoc.items.some((i) => i.id === args.track.id)) {
        await ctx.db.patch(radioDoc._id, {
          items: [...radioDoc.items, args.track],
        });
      }
    } else {
      await ctx.db.insert("radioQueue", {
        roomId: args.roomId,
        items: [args.track],
      });
    }

    return { success: true };
  },
});
