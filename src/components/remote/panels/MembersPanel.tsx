import { DeviceUser } from '@/lib/deviceAuth';
import { useTranslation } from '@/context/LanguageContext';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Users,
  User,
  Shield,
  Crown,
  UserX,
  Trash2,
  Tv,
  Pin,
  Check,
  CheckCircle,
  X,
  XCircle,
  Lock,
  Unlock,
  Sparkles,
} from 'lucide-react';
import { QueueItem } from '@/lib/roomUtils';

export interface MemberInfo {
  uid: string;
  joinedAt: number;
  nickname?: string;
  online?: boolean;
  lastSeen?: number;
  isTv?: boolean;
}

interface MembersPanelProps {
  membersList: MemberInfo[];
  adminsList: string[];
  hostUid?: string;
  tvUuid?: string | null;
  user: DeviceUser | null;
  currentUid?: string;
  isHostOrAdmin: boolean;
  isAdmin?: boolean;
  isHostPinned?: boolean;
  lockPlaybackControls?: boolean;
  approvedMembers?: string[];
  approvalRequests?: string[];
  queue: QueueItem[];
  onKickMember: (targetUid: string) => void;
  onRemoveQueueItem: (itemId: string, itemAddedBy?: string) => Promise<void>;
  onToggleApproveMember?: (targetUid: string) => void;
  onApproveAllMembers?: (memberUids: string[]) => void;
  onRevokeAllApprovedMembers?: () => void;
  onToggleHostPin?: () => void;
  onAdminTransferHost?: (newHostUid: string) => void;
  onToggleLockPlaybackControls?: () => void;
  embedded?: boolean;
}

export const MembersPanel: React.FC<MembersPanelProps> = ({
  membersList,
  adminsList,
  hostUid,
  tvUuid,
  user,
  currentUid,
  isHostOrAdmin,
  isAdmin = false,
  isHostPinned = false,
  lockPlaybackControls = false,
  approvedMembers = [],
  approvalRequests = [],
  queue,
  onKickMember,
  onRemoveQueueItem,
  onToggleApproveMember,
  onApproveAllMembers,
  onRevokeAllApprovedMembers,
  onToggleHostPin,
  onAdminTransferHost,
  onToggleLockPlaybackControls,
  embedded = false,
}) => {
  const { t } = useTranslation();

  const effectiveCurrentUid = currentUid || user?.uid;
  const onlineCount = membersList.filter((m) => m.online !== false).length;
  const guestMembers = membersList.filter((m) => !m.isTv && m.uid !== hostUid && !adminsList.includes(m.uid));
  const guestUids = guestMembers.map((m) => m.uid);

  const content = (
    <>
      <div className="text-xs font-bold text-foreground uppercase tracking-wider border-b border-border pb-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-primary" />
          <span>{t('remote.roomMembersAndRequests')}</span>
          <span className="text-muted-foreground font-mono text-[11px] ml-1">
            {onlineCount} {t('remote.onlineBadge').toLowerCase()} • {t('remote.membersCount', { count: membersList.length })}
          </span>
        </div>

        {/* Header Controls for Host / Admin */}
        {isHostOrAdmin && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {onToggleLockPlaybackControls && (
              <Button
                variant={lockPlaybackControls ? 'destructive' : 'outline'}
                size="sm"
                onClick={onToggleLockPlaybackControls}
                className="h-6 px-2 text-[10px] font-mono font-bold uppercase flex items-center gap-1 cursor-pointer"
                title={t('remote.lockPlaybackDesc')}
              >
                {lockPlaybackControls ? (
                  <Lock className="w-3 h-3 text-amber-300" />
                ) : (
                  <Unlock className="w-3 h-3 text-muted-foreground" />
                )}
                <span>
                  {lockPlaybackControls
                    ? t('remote.playbackControlsLocked')
                    : t('remote.lockPlaybackTitle')}
                </span>
              </Button>
            )}

            {onApproveAllMembers && guestUids.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onApproveAllMembers(guestUids)}
                className="h-6 px-2 text-[10px] font-mono font-bold uppercase flex items-center gap-1 cursor-pointer text-emerald-400 border-emerald-800/60 hover:bg-emerald-950/40"
              >
                <CheckCircle className="w-3 h-3" />
                <span>{t('remote.approveAllBtn')}</span>
              </Button>
            )}

            {onRevokeAllApprovedMembers && approvedMembers.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={onRevokeAllApprovedMembers}
                className="h-6 px-2 text-[10px] font-mono font-bold uppercase flex items-center gap-1 cursor-pointer text-muted-foreground hover:text-destructive"
              >
                <XCircle className="w-3 h-3" />
                <span>{t('remote.revokeAllBtn')}</span>
              </Button>
            )}
          </div>
        )}
      </div>

      <div className={`flex flex-col gap-3 ${embedded ? 'flex-1 min-h-0 overflow-y-auto pr-1' : ''}`}>
        {membersList.map((member, mIdx) => {
          const isMemberAdmin = adminsList.includes(member.uid);
          const isHostUser = member.uid === hostUid;
          const isSelf = Boolean(effectiveCurrentUid && member.uid === effectiveCurrentUid);
          const isTvUser = Boolean(member.isTv || (tvUuid && member.uid === tvUuid));
          const isOnline = member.online !== false;
          const hasRequested = Boolean(approvalRequests.includes(member.uid));
          const isApproved = Boolean(approvedMembers.includes(member.uid));
          const memberRequests = queue.filter((item) => item.addedBy === member.uid);
          const displayName = isTvUser
            ? (member.nickname || 'MediaBox TV')
            : (member.nickname || `User #${mIdx + 1}`);

          return (
            <div
              key={member.uid}
              className={`p-3 flex flex-col gap-2 rounded-md transition-all ${
                hasRequested
                  ? 'bg-amber-500/10 border-2 border-amber-500/70 shadow-[0_0_12px_rgba(245,158,11,0.2)]'
                  : 'bg-muted/20 border border-border'
              }`}
            >
              <div className="flex items-center justify-between text-xs flex-wrap gap-2">
                <div className="flex items-center gap-2 font-mono flex-wrap">
                  <User className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                  <span className="font-bold text-foreground">{displayName}</span>
                  <span className="text-[10px] text-muted-foreground">
                    ({member.uid.substring(0, 6)})
                  </span>

                  {/* Online / Offline status badge */}
                  {isOnline ? (
                    <Badge
                      variant="success"
                      className="px-1.5 py-0.5 text-[9px] font-bold uppercase rounded-md flex items-center gap-1"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      {t('remote.onlineBadge')}
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="px-1.5 py-0.5 text-[9px] text-muted-foreground border-border font-bold uppercase rounded-md flex items-center gap-1"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50" />
                      {t('remote.offlineBadge')}
                    </Badge>
                  )}

                  {/* Approval requested badge (pulsing amber) */}
                  {hasRequested && !isApproved && (
                    <Badge
                      variant="outline"
                      className="px-1.5 py-0.5 text-[9px] bg-amber-500/20 text-amber-300 border-amber-500 font-bold uppercase flex items-center gap-1 rounded-md animate-pulse"
                    >
                      <Sparkles className="w-2.5 h-2.5 text-amber-400" />
                      <span>{t('remote.requestedBadge')}</span>
                    </Badge>
                  )}

                  {/* Approved controller badge */}
                  {isApproved && (
                    <Badge
                      variant="outline"
                      className="px-1.5 py-0.5 text-[9px] bg-emerald-950 text-emerald-300 border-emerald-700 font-bold uppercase flex items-center gap-1 rounded-md"
                    >
                      <Check className="w-2.5 h-2.5 text-emerald-400" />
                      <span>{t('remote.approvedBadge')}</span>
                    </Badge>
                  )}

                  {isMemberAdmin && (
                    <Badge
                      variant="outline"
                      className="px-1.5 py-0.5 text-[9px] bg-purple-950 text-purple-300 border-purple-800 font-bold uppercase flex items-center gap-1 rounded-md"
                    >
                      <Shield className="w-2.5 h-2.5 text-purple-400" /> {t('remote.adminBadge')}
                    </Badge>
                  )}
                  {isTvUser && (
                    <Badge
                      variant="outline"
                      className="px-1.5 py-0.5 text-[9px] bg-primary/20 text-primary border-primary/50 font-bold uppercase flex items-center gap-1 rounded-md"
                    >
                      <Tv className="w-2.5 h-2.5 text-primary" />
                      <span>{t('remote.tvHostBadge')}</span>
                    </Badge>
                  )}
                  {isHostUser && !isMemberAdmin && !isTvUser && (
                    <Badge
                      variant="outline"
                      className="px-1.5 py-0.5 text-[9px] bg-amber-950 text-amber-300 border-amber-800 font-bold uppercase rounded-md flex items-center gap-1"
                    >
                      {t('remote.hostBadge')}
                    </Badge>
                  )}

                  {/* Pinned Host Badge */}
                  {isHostUser && isHostPinned && (
                    <Badge
                      variant="outline"
                      className="px-1.5 py-0.5 text-[9px] bg-purple-950 text-purple-300 border-purple-700 font-bold uppercase rounded-md flex items-center gap-1"
                      title={t('remote.hostPinnedBadge')}
                    >
                      <Pin className="w-2.5 h-2.5 text-purple-400 fill-purple-400" />
                      <span>{t('remote.hostPinnedBadge')}</span>
                    </Badge>
                  )}

                  {isSelf && (
                    <Badge
                      variant="outline"
                      className="px-1.5 py-0.5 text-[9px] bg-muted text-foreground border-border font-bold uppercase rounded-md"
                    >
                      {t('remote.youBadge')}
                    </Badge>
                  )}
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  {/* Pin / Unpin Host Action (Admin Only) */}
                  {isAdmin && isHostUser && onToggleHostPin && (
                    <Button
                      variant={isHostPinned ? 'secondary' : 'outline'}
                      size="sm"
                      chamfer="top-right"
                      onClick={onToggleHostPin}
                      className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 h-auto cursor-pointer"
                      title={isHostPinned ? t('remote.unpinHostBtn') : t('remote.pinHostBtn')}
                    >
                      <Pin className={`w-3 h-3 ${isHostPinned ? 'text-purple-400 fill-purple-400' : ''}`} />
                      <span>{isHostPinned ? t('remote.unpinHostBtn') : t('remote.pinHostBtn')}</span>
                    </Button>
                  )}

                  {/* Transfer Host Action (Admin Only) */}
                  {isAdmin && !isHostUser && !isTvUser && onAdminTransferHost && (
                    <Button
                      variant="outline"
                      size="sm"
                      chamfer="top-right"
                      onClick={() => onAdminTransferHost(member.uid)}
                      className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 h-auto cursor-pointer text-muted-foreground hover:text-amber-400 hover:border-amber-500/50"
                      title={t('remote.makeHostBtn')}
                    >
                      <Crown className="w-3 h-3 text-amber-400" />
                      <span>{t('remote.makeHostBtn')}</span>
                    </Button>
                  )}

                  {/* Approve / Revoke Member Action (Host or Admin) */}
                  {isHostOrAdmin && !isSelf && !isMemberAdmin && !isTvUser && onToggleApproveMember && (
                    <>
                      {hasRequested && !isApproved ? (
                        <Button
                          variant="cyber"
                          size="sm"
                          chamfer="top-right"
                          onClick={() => onToggleApproveMember(member.uid)}
                          className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 h-auto cursor-pointer bg-amber-500 hover:bg-amber-400 text-black border-amber-400 font-mono"
                        >
                          <Check className="w-3 h-3" />
                          <span>{t('remote.approveMemberBtn')}</span>
                        </Button>
                      ) : isApproved ? (
                        <Button
                          variant="outline"
                          size="sm"
                          chamfer="top-right"
                          onClick={() => onToggleApproveMember(member.uid)}
                          className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 h-auto cursor-pointer text-muted-foreground hover:text-destructive"
                          title={t('remote.revokeApprovalBtn')}
                        >
                          <X className="w-3 h-3" />
                          <span>{t('remote.revokeApprovalBtn')}</span>
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          chamfer="top-right"
                          onClick={() => onToggleApproveMember(member.uid)}
                          className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 h-auto cursor-pointer text-emerald-400 hover:text-emerald-300 border-emerald-800/60 hover:bg-emerald-950/40"
                        >
                          <Check className="w-3 h-3" />
                          <span>{t('remote.approveMemberBtn')}</span>
                        </Button>
                      )}
                    </>
                  )}

                  {/* Kick Member Action */}
                  {isHostOrAdmin && !isSelf && !isMemberAdmin && !isTvUser && (
                    <Button
                      variant="destructive"
                      size="sm"
                      chamfer="top-right"
                      onClick={() => onKickMember(member.uid)}
                      className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 h-auto cursor-pointer"
                      title="Kick member and remove their requested videos"
                    >
                      <UserX className="w-3 h-3" />
                      <span>{t('remote.kickMemberBtn')}</span>
                    </Button>
                  )}
                </div>
              </div>

              {/* Member's Requested Videos List */}
              <div className="pl-3 border-l-2 border-border flex flex-col gap-1.5 mt-1">
                {memberRequests.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground italic">
                    {t('remote.noVideoRequestsInQueue')}
                  </p>
                ) : (
                  memberRequests.map((req) => {
                    const overallIndex = queue.findIndex((q) => q.id === req.id) + 1;
                    return (
                      <div
                        key={req.id}
                        className="flex items-center justify-between text-[11px] font-mono text-foreground gap-2 bg-muted/40 p-1.5 border border-border/80"
                      >
                        <div className="truncate flex items-center gap-1.5 min-w-0 flex-1">
                          <span className="text-primary font-bold flex-shrink-0 font-mono">
                            #{overallIndex}
                          </span>
                          <span className="truncate font-sans font-medium text-foreground">
                            {req.title || req.url}
                          </span>
                        </div>
                        {isHostOrAdmin && (
                          <button
                            onClick={() => onRemoveQueueItem(req.id, req.addedBy)}
                            className="text-muted-foreground hover:text-destructive p-1 cursor-pointer flex-shrink-0"
                            title="Delete video request"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );

  if (embedded) {
    return <div className="flex-1 flex flex-col min-h-0 overflow-hidden">{content}</div>;
  }

  return (
    <Card cornerLines className="p-4 bg-card border-border mb-5 flex flex-col gap-4">
      {content}
    </Card>
  );
};

export default MembersPanel;
