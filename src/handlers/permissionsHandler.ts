/**
 * Permission checks for Watch Together room members, host, TV owner, and admins.
 */

export interface RoomPermissions {
  isHost: boolean;
  isTvOwner: boolean;
  isAdmin: boolean;
  isAuthorized: boolean;
}

export const getRoomPermissions = (
  memberUid: string,
  hostUid: string | null | undefined,
  tvOwnerUid: string | null | undefined,
  admins: string[] = []
): RoomPermissions => {
  const isHost = Boolean(hostUid && memberUid === hostUid);
  const isTvOwner = Boolean(tvOwnerUid && memberUid === tvOwnerUid);
  const isAdmin = Boolean(admins && admins.includes(memberUid));
  const isAuthorized = isHost || isTvOwner || isAdmin;

  return {
    isHost,
    isTvOwner,
    isAdmin,
    isAuthorized,
  };
};
