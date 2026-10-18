import { QueryCtx, MutationCtx } from "../_generated/server";

export async function isAuthorized(
  ctx: QueryCtx | MutationCtx,
  room: { hostUid: string; tvUid: string; tvUuid?: string },
  callerUid: string
): Promise<boolean> {
  if (
    room.hostUid === callerUid ||
    room.tvUid === callerUid ||
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
