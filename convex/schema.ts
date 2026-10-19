import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Watch party rooms (tvOnline is derived from real-time data instead of stored)
  rooms: defineTable({
    code: v.string(), // 6-digit room PIN, e.g. "481920"
    hostUid: v.string(),
    tvUuid: v.string(),
    tvOnline: v.optional(v.boolean()),
    isFullscreen: v.optional(v.boolean()),
    isLocked: v.boolean(),
    isAutoplay: v.boolean(),
    isCountdownEnabled: v.boolean(),
    currentlyPlaying: v.string(),
    currentlyPlayingTitle: v.optional(v.string()),
    playback: v.object({
      status: v.union(v.literal("playing"), v.literal("paused"), v.literal("loading")),
      positionMs: v.number(),
      durationMs: v.number(),
      volume: v.number(),
      updatedAt: v.number(),
    }),
    playedHistory: v.array(
      v.object({
        url: v.string(),
        title: v.string(),
        channelTitle: v.optional(v.string()),
      })
    ),
    futureHistory: v.array(
      v.object({
        url: v.string(),
        title: v.string(),
        channelTitle: v.optional(v.string()),
      })
    ),
    lyricsOffsetMs: v.optional(v.number()),
    lyricsWordSync: v.optional(v.boolean()),
    preferMusicVideos: v.optional(v.boolean()),
  }).index("by_code", ["code"]),

  // Queued items per room
  queue: defineTable({
    roomId: v.id("rooms"),
    url: v.string(),
    title: v.string(),
    addedBy: v.string(),
    addedByName: v.string(),
    order: v.number(),
    createdAt: v.number(),
  }).index("by_room_order", ["roomId", "order"]),

  // Algorithmic YouTube Music radio recommendations
  radioQueue: defineTable({
    roomId: v.id("rooms"),
    items: v.array(
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
  }).index("by_room", ["roomId"]),

  // Global lyrics cache indexed by YouTube videoId
  cachedLyrics: defineTable({
    videoId: v.string(),
    trackTitle: v.string(),
    artistName: v.string(),
    sourceLabel: v.string(), // "Octave", "LRC.red", "Better Lyrics", "QQ Music", "Kugou", "LRCLib", "none"
    data: v.string(), // Raw lyrics text, or "[]"
    format: v.optional(v.string()),
    syncType: v.optional(v.string()),
    isrc: v.optional(v.string()),
    status: v.union(v.literal("fetching"), v.literal("ready"), v.literal("error")),
    updatedAt: v.number(),
    logs: v.optional(v.array(v.string())),
  }).index("by_video", ["videoId"]),

  // Isolated room secrets (e.g. ephemeral beamed tokens) kept out of public room subscriptions
  roomSecrets: defineTable({
    roomId: v.id("rooms"),
    pendingTvToken: v.optional(v.string()),
    updatedAt: v.number(),
  }).index("by_room", ["roomId"]),

  // Master and delegated API tokens for bypassing Turnstile and scraping prevention
  apiTokens: defineTable({
    token: v.string(),
    label: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_token", ["token"]),

  // App administrators
  admins: defineTable({
    uid: v.string(),
    addedAt: v.number(),
    role: v.optional(v.string()),
    note: v.optional(v.string()),
  }).index("by_uid", ["uid"]),
});
