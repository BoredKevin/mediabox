import { mutation, query } from "./_generated/server";
import { components } from "./_generated/api";
import { v } from "convex/values";
import { Presence } from "@convex-dev/presence";

export const presence = new Presence(components.presence);

export const heartbeat = mutation({
  args: {
    roomId: v.string(),
    userId: v.string(),
    sessionId: v.string(),
    interval: v.number(),
  },
  handler: async (ctx, { roomId, userId, sessionId, interval }) => {
    return await presence.heartbeat(ctx, roomId, userId, sessionId, interval);
  },
});

export const list = query({
  args: { roomToken: v.string() },
  handler: async (ctx, { roomToken }) => {
    return await presence.list(ctx, roomToken);
  },
});

export const listRoom = query({
  args: {
    roomId: v.string(),
    onlineOnly: v.optional(v.boolean()),
  },
  handler: async (ctx, { roomId, onlineOnly }) => {
    return await presence.listRoom(ctx, roomId, onlineOnly);
  },
});

export const updateRoomUser = mutation({
  args: {
    roomId: v.string(),
    userId: v.string(),
    data: v.optional(v.any()),
  },
  handler: async (ctx, { roomId, userId, data }) => {
    return await presence.updateRoomUser(ctx, roomId, userId, data);
  },
});

export const disconnect = mutation({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }) => {
    return await presence.disconnect(ctx, sessionToken);
  },
});
