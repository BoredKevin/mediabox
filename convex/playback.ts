import { query, mutation, internalMutation } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { v } from "convex/values";

/**
 * Transitions to the next song in the room:
 * 1. Checks futureHistory stack (if user navigated backwards previously)
 * 2. Checks active member user queue
 * 3. Checks algorithmic automix radioQueue (and triggers background prefetch if remaining <= 3)
 * 4. Triggers radio fetch if autoplay is enabled and queue is empty
 */
export const nextTrack = mutation({
  args: {
    roomId: v.id("rooms"),
  },
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.roomId);
    if (!room) throw new Error("Room not found");

    const now = Date.now();
    const currentTrack = room.currentlyPlaying
      ? {
          url: room.currentlyPlaying,
          title: room.currentlyPlayingTitle || "",
        }
      : null;

    // 1. Future History (Forward navigation)
    if (room.futureHistory && room.futureHistory.length > 0) {
      const nextSong = room.futureHistory[0];
      const remainingFuture = room.futureHistory.slice(1);
      const newPlayedHistory = currentTrack
        ? [currentTrack, ...room.playedHistory].slice(0, 25)
        : room.playedHistory;

      await ctx.db.patch(args.roomId, {
        currentlyPlaying: nextSong.url,
        currentlyPlayingTitle: nextSong.title,
        futureHistory: remainingFuture,
        playedHistory: newPlayedHistory,
        playback: {
          ...room.playback,
          status: "playing",
          positionMs: 0,
          updatedAt: now,
        },
      });
      return { source: "future", url: nextSong.url };
    }

    // 2. Active User Queue
    const userQueue = await ctx.db
      .query("queue")
      .withIndex("by_room_order", (q) => q.eq("roomId", args.roomId))
      .collect();

    if (userQueue.length > 0) {
      const nextItem = userQueue[0];
      await ctx.db.delete(nextItem._id);

      const newPlayedHistory = currentTrack
        ? [currentTrack, ...room.playedHistory].slice(0, 25)
        : room.playedHistory;

      await ctx.db.patch(args.roomId, {
        currentlyPlaying: nextItem.url,
        currentlyPlayingTitle: nextItem.title,
        playedHistory: newPlayedHistory,
        playback: {
          ...room.playback,
          status: "playing",
          positionMs: 0,
          updatedAt: now,
        },
      });
      return { source: "userQueue", url: nextItem.url };
    }

    // 3. Algorithmic Radio Queue
    const radioDoc = await ctx.db
      .query("radioQueue")
      .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
      .first();

    if (radioDoc && radioDoc.items.length > 0) {
      const nextRadio = radioDoc.items[0];
      const remainingRadio = radioDoc.items.slice(1);

      await ctx.db.patch(radioDoc._id, {
        items: remainingRadio,
      });

      const newPlayedHistory = currentTrack
        ? [currentTrack, ...room.playedHistory].slice(0, 25)
        : room.playedHistory;

      await ctx.db.patch(args.roomId, {
        currentlyPlaying: nextRadio.url,
        currentlyPlayingTitle: nextRadio.title,
        playedHistory: newPlayedHistory,
        playback: {
          ...room.playback,
          status: "playing",
          positionMs: 0,
          updatedAt: now,
        },
      });

      // Background prefetch when automix buffer is running low
      if (remainingRadio.length <= 3 && room.isAutoplay) {
        await ctx.scheduler.runAfter(0, internal.youtube.prefetchRadio, {
          roomId: args.roomId,
          seedVideoUrl: nextRadio.url,
        });
      }

      return { source: "radioQueue", url: nextRadio.url };
    }

    // 4. Autoplay Fallback
    if (room.isAutoplay && room.currentlyPlaying) {
      await ctx.db.patch(args.roomId, {
        playback: {
          ...room.playback,
          status: "loading",
          updatedAt: now,
        },
      });

      await ctx.scheduler.runAfter(0, api.youtube.fetchAndPlayNextRadio, {
        roomId: args.roomId,
        seedVideoUrl: room.currentlyPlaying,
      });

      return { source: "autoplayPending" };
    }

    // Nothing left to play
    const newPlayedHistory = currentTrack
      ? [currentTrack, ...(room.playedHistory || [])].slice(0, 50)
      : (room.playedHistory || []);

    await ctx.db.patch(args.roomId, {
      currentlyPlaying: "",
      currentlyPlayingTitle: "",
      playedHistory: newPlayedHistory,
      playback: {
        ...room.playback,
        status: "paused",
        positionMs: 0,
        updatedAt: now,
      },
    });

    return { source: "none" };
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
    const room = await ctx.db.get(args.roomId);
    if (!room) throw new Error("Room not found");

    const now = Date.now();
    const elapsed = room.playback.status === "playing" ? Math.max(0, now - (room.playback.updatedAt || now)) : 0;
    const currentPositionMs = (room.playback.positionMs || 0) + elapsed;

    // If currently past 3s and not forcing previous track, restart current track from 0:00
    if (!args.forcePrevious && currentPositionMs > 3000) {
      await ctx.db.patch(args.roomId, {
        playback: {
          ...room.playback,
          positionMs: 0,
          updatedAt: now,
        },
      });
      return { action: "restarted" };
    }

    if (room.playedHistory && room.playedHistory.length > 0) {
      const prevTrack = room.playedHistory[0];
      const remainingPlayed = room.playedHistory.slice(1);

      const currentTrack = room.currentlyPlaying
        ? {
            url: room.currentlyPlaying,
            title: room.currentlyPlayingTitle || "",
          }
        : null;

      const newFutureHistory = currentTrack
        ? [currentTrack, ...(room.futureHistory || [])].slice(0, 25)
        : room.futureHistory || [];

      await ctx.db.patch(args.roomId, {
        currentlyPlaying: prevTrack.url,
        currentlyPlayingTitle: prevTrack.title,
        playedHistory: remainingPlayed,
        futureHistory: newFutureHistory,
        playback: {
          ...room.playback,
          status: "playing",
          positionMs: 0,
          updatedAt: now,
        },
      });

      return { action: "navigatedBack", url: prevTrack.url };
    }

    // Fallback: restart track from 0
    await ctx.db.patch(args.roomId, {
      playback: {
        ...room.playback,
        positionMs: 0,
        updatedAt: now,
      },
    });
    return { action: "restarted" };
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
      // Transitioning to paused: freeze current position at now
      const elapsed = Math.max(0, now - (room.playback.updatedAt || now));
      const deadReckoned = room.playback.positionMs + elapsed;
      nextPositionMs =
        room.playback.durationMs > 0
          ? Math.min(deadReckoned, room.playback.durationMs)
          : deadReckoned;
    } else {
      // Transitioning to playing: resume from current frozen positionMs
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

    await ctx.db.patch(args.roomId, {
      playback: {
        ...room.playback,
        positionMs: Math.max(0, args.positionMs),
        updatedAt: Date.now(),
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

    // If room was in loading status and we got tracks, start playing the first track
    const room = await ctx.db.get(args.roomId);
    if (room && room.playback.status === "loading") {
      const currentTrack = room.currentlyPlaying
        ? [
            {
              url: room.currentlyPlaying,
              title: room.currentlyPlayingTitle || "Untitled Track",
            },
          ]
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
            status: "playing",
            positionMs: 0,
            updatedAt: Date.now(),
          },
        });
      } else {
        // No radio tracks returned: recover from "loading" state to "paused"
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
