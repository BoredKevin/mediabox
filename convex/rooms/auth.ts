import { QueryCtx, MutationCtx } from "../_generated/server";

export async function isAuthorized(
  ctx: QueryCtx | MutationCtx,
  room: { hostUid: string; tvUuid?: string },
  callerUid: string
): Promise<boolean> {
  if (
    room.hostUid === callerUid ||
    (room.tvUuid && room.tvUuid === callerUid)
  ) {
    return true;
  }

  const admin = await ctx.db
    .query("admins")
    .withIndex("by_uid", (q) => q.eq("uid", callerUid))
    .first();
  return !!admin;
}

export async function isPlaybackAuthorized(
  ctx: QueryCtx | MutationCtx,
  room: {
    hostUid: string;
    tvUuid?: string;
    approvedMembers?: string[];
    lockPlaybackControls?: boolean;
    isLocked?: boolean;
  },
  callerUid: string
): Promise<boolean> {
  if (!room.lockPlaybackControls && !room.isLocked) {
    return true;
  }

  if (
    room.hostUid === callerUid ||
    (room.tvUuid && room.tvUuid === callerUid)
  ) {
    return true;
  }

  if (room.approvedMembers && room.approvedMembers.includes(callerUid)) {
    return true;
  }

  const admin = await ctx.db
    .query("admins")
    .withIndex("by_uid", (q) => q.eq("uid", callerUid))
    .first();
  return !!admin;
}

