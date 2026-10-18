import { QueryCtx, MutationCtx } from "../_generated/server";
import { Id } from "../_generated/dataModel";

/**
 * Beams an API token from the Host to the TV screen.
 * The token is stored temporarily in roomSecrets and NEVER returned in standard room subscriptions.
 */
export async function handleBeamTokenToTv(
  ctx: MutationCtx,
  roomId: Id<"rooms">,
  callerUid: string,
  token: string
): Promise<void> {
  const room = await ctx.db.get(roomId);
  if (!room) throw new Error("Room not found");

  if (room.hostUid !== callerUid) {
    const admin = await ctx.db
      .query("admins")
      .withIndex("by_uid", (q) => q.eq("uid", callerUid))
      .first();
    if (!admin) {
      throw new Error("Unauthorized to beam token to TV");
    }
  }

  const trimmed = token.trim();
  if (!trimmed) throw new Error("Token cannot be empty");

  // Validate token against env var or apiTokens table
  const envToken = process.env.APP_API_TOKEN || process.env.MEDIABOX_API_TOKEN;
  let isValid = Boolean(envToken && trimmed === envToken.trim());
  if (!isValid) {
    const dbToken = await ctx.db
      .query("apiTokens")
      .withIndex("by_token", (q) => q.eq("token", trimmed))
      .first();
    isValid = !!dbToken;
  }

  if (!isValid) {
    throw new Error("Invalid API token. Please ensure the token is configured on the backend.");
  }

  const existingSecret = await ctx.db
    .query("roomSecrets")
    .withIndex("by_room", (q) => q.eq("roomId", roomId))
    .first();

  const now = Date.now();
  if (existingSecret) {
    await ctx.db.patch(existingSecret._id, {
      pendingTvToken: trimmed,
      updatedAt: now,
    });
  } else {
    await ctx.db.insert("roomSecrets", {
      roomId,
      pendingTvToken: trimmed,
      updatedAt: now,
    });
  }
}

/**
 * Queries incoming beamed API tokens for TV display devices.
 */
export async function handleGetPendingTvToken(
  ctx: QueryCtx,
  roomId: Id<"rooms">,
  tvUuid?: string
): Promise<string | null> {
  const room = await ctx.db.get(roomId);
  if (!room) return null;

  if (room.tvUuid && tvUuid && room.tvUuid !== tvUuid) {
    return null;
  }

  const secret = await ctx.db
    .query("roomSecrets")
    .withIndex("by_room", (q) => q.eq("roomId", roomId))
    .first();

  return secret?.pendingTvToken || null;
}

/**
 * Wipes acknowledged beamed token from roomSecrets.
 */
export async function handleAcknowledgeTvToken(
  ctx: MutationCtx,
  roomId: Id<"rooms">
): Promise<void> {
  const secret = await ctx.db
    .query("roomSecrets")
    .withIndex("by_room", (q) => q.eq("roomId", roomId))
    .first();

  if (secret && secret.pendingTvToken) {
    await ctx.db.patch(secret._id, {
      pendingTvToken: undefined,
      updatedAt: Date.now(),
    });
  }
}
