import { MutationCtx } from "../_generated/server";
import { Id } from "../_generated/dataModel";
import { api, internal } from "../_generated/api";

/**
 * Transitions to the next song in the room:
 * 1. Future History (if previously navigated backwards)
 * 2. Active User Queue
 * 3. Algorithmic Radio Queue (with background prefetch)
 * 4. Autoplay Fallback (triggers radio recommendation fetch)
 */
export async function handleNextTrackTransition(
  ctx: MutationCtx,
  roomId: Id<"rooms">
): Promise<{ source: string; url?: string }> {
  const room = await ctx.db.get(roomId);
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

    await ctx.db.patch(roomId, {
      currentlyPlaying: nextSong.url,
      currentlyPlayingTitle: nextSong.title,
      futureHistory: remainingFuture,
      playedHistory: newPlayedHistory,
      playback: {
        ...room.playback,
        status: "loading",
        positionMs: 0,
        updatedAt: now,
      },
    });
    return { source: "future", url: nextSong.url };
  }

  // 2. Active User Queue
  const userQueue = await ctx.db
    .query("queue")
    .withIndex("by_room_order", (q) => q.eq("roomId", roomId))
    .collect();

  if (userQueue.length > 0) {
    const nextItem = userQueue[0];
    await ctx.db.delete(nextItem._id);

    const newPlayedHistory = currentTrack
      ? [currentTrack, ...room.playedHistory].slice(0, 25)
      : room.playedHistory;

    await ctx.db.patch(roomId, {
      currentlyPlaying: nextItem.url,
      currentlyPlayingTitle: nextItem.title,
      playedHistory: newPlayedHistory,
      playback: {
        ...room.playback,
        status: "loading",
        positionMs: 0,
        updatedAt: now,
      },
    });
    return { source: "userQueue", url: nextItem.url };
  }

  // 3. Algorithmic Radio Queue
  const radioDoc = await ctx.db
    .query("radioQueue")
    .withIndex("by_room", (q) => q.eq("roomId", roomId))
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

    await ctx.db.patch(roomId, {
      currentlyPlaying: nextRadio.url,
      currentlyPlayingTitle: nextRadio.title,
      playedHistory: newPlayedHistory,
      playback: {
        ...room.playback,
        status: "loading",
        positionMs: 0,
        updatedAt: now,
      },
    });

    // Background prefetch when automix buffer is running low
    if (remainingRadio.length <= 3 && room.isAutoplay) {
      await ctx.scheduler.runAfter(0, internal.youtube.prefetchRadio, {
        roomId,
        seedVideoUrl: nextRadio.url,
      });
    }

    return { source: "radioQueue", url: nextRadio.url };
  }

  // 4. Autoplay Fallback
  if (room.isAutoplay && room.currentlyPlaying) {
    await ctx.db.patch(roomId, {
      playback: {
        ...room.playback,
        status: "loading",
        updatedAt: now,
      },
    });

    await ctx.scheduler.runAfter(0, api.youtube.fetchAndPlayNextRadio, {
      roomId,
      seedVideoUrl: room.currentlyPlaying,
    });

    return { source: "autoplayPending" };
  }

  // Nothing left to play
  const newPlayedHistory = currentTrack
    ? [currentTrack, ...(room.playedHistory || [])].slice(0, 50)
    : (room.playedHistory || []);

  await ctx.db.patch(roomId, {
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
}

/**
 * Transitions to previous track in history or restarts current track from 0:00.
 */
export async function handlePreviousTrackTransition(
  ctx: MutationCtx,
  roomId: Id<"rooms">,
  forcePrevious?: boolean
): Promise<{ action: string; url?: string }> {
  const room = await ctx.db.get(roomId);
  if (!room) throw new Error("Room not found");

  const now = Date.now();
  const elapsed = room.playback.status === "playing" ? Math.max(0, now - (room.playback.updatedAt || now)) : 0;
  const currentPositionMs = (room.playback.positionMs || 0) + elapsed;

  // If currently past 3s and not forcing previous track, restart current track from 0:00
  if (!forcePrevious && currentPositionMs > 3000) {
    await ctx.db.patch(roomId, {
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

    await ctx.db.patch(roomId, {
      currentlyPlaying: prevTrack.url,
      currentlyPlayingTitle: prevTrack.title,
      playedHistory: remainingPlayed,
      futureHistory: newFutureHistory,
      playback: {
        ...room.playback,
        status: "loading",
        positionMs: 0,
        updatedAt: now,
      },
    });

    return { action: "navigatedBack", url: prevTrack.url };
  }

  // Fallback: restart track from 0
  await ctx.db.patch(roomId, {
    playback: {
      ...room.playback,
      positionMs: 0,
      updatedAt: now,
    },
  });
  return { action: "restarted" };
}
