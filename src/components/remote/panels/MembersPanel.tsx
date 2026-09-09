import React from 'react';
import { User as FirebaseUser } from 'firebase/auth';
import { useTranslation } from '@/context/LanguageContext';
import { Card, Badge, Button } from '@boredkevin/ui';
import { Users, User, Shield, Crown, UserX, Trash2 } from 'lucide-react';
import { QueueItem } from '@/lib/roomUtils';

export interface MemberInfo {
  uid: string;
  joinedAt: number;
  nickname?: string;
  online?: boolean;
  lastSeen?: number;
}

interface MembersPanelProps {
  membersList: MemberInfo[];
  adminsList: string[];
  hostUid?: string;
  user: FirebaseUser | null;
  isHostOrAdmin: boolean;
  queue: QueueItem[];
  onKickMember: (targetUid: string) => void;
  onRemoveQueueItem: (itemId: string, itemAddedBy?: string) => Promise<void>;
  embedded?: boolean;
}

export const MembersPanel: React.FC<MembersPanelProps> = ({
  membersList,
  adminsList,
  hostUid,
  user,
  isHostOrAdmin,
  queue,
  onKickMember,
  onRemoveQueueItem,
  embedded = false,
}) => {
  const { t } = useTranslation();

  const onlineCount = membersList.filter((m) => m.online !== false).length;

  const content = (
    <>
      <div className="text-xs font-bold text-foreground uppercase tracking-wider border-b border-border pb-2 flex items-center justify-between">
        <span className="flex items-center gap-2">
          <Users className="w-4 h-4 text-primary" />
          {t('remote.roomMembersAndRequests')}
        </span>
        <span className="text-muted-foreground font-mono text-[11px]">
          {onlineCount} {t('remote.onlineBadge').toLowerCase()} • {t('remote.membersCount', { count: membersList.length })}
        </span>
      </div>

      <div className={`flex flex-col gap-3 ${embedded ? 'flex-1 min-h-0 overflow-y-auto pr-1' : ''}`}>
        {membersList.map((member, mIdx) => {
          const isMemberAdmin = adminsList.includes(member.uid);
          const isHostUser = member.uid === hostUid;
          const isSelf = member.uid === user?.uid;
          const isOnline = member.online !== false;
          const memberRequests = queue.filter((item) => item.addedBy === member.uid);
          const displayName = member.nickname || `User #${mIdx + 1}`;

          return (
            <div
              key={member.uid}
              className="bg-muted/20 border border-border p-3 flex flex-col gap-2"
            >
              <div className="flex items-center justify-between text-xs">
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
                      className="px-1.5 py-0.5 text-[9px] font-bold uppercase rounded-none flex items-center gap-1"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      {t('remote.onlineBadge')}
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="px-1.5 py-0.5 text-[9px] text-muted-foreground border-border font-bold uppercase rounded-none flex items-center gap-1"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50" />
                      {t('remote.offlineBadge')}
                    </Badge>
                  )}

                  {isMemberAdmin && (
                    <Badge
                      variant="outline"
                      className="px-1.5 py-0.5 text-[9px] bg-purple-950 text-purple-300 border-purple-800 font-bold uppercase flex items-center gap-1 rounded-none"
                    >
                      <Shield className="w-2.5 h-2.5 text-purple-400" /> {t('remote.adminBadge')}
                    </Badge>
                  )}
                  {isHostUser && !isMemberAdmin && (
                    <Badge
                      variant="outline"
                      className="px-1.5 py-0.5 text-[9px] bg-amber-950 text-amber-300 border-amber-800 font-bold uppercase rounded-none"
                    >
                      {t('remote.hostBadge')}
                    </Badge>
                  )}
                  {isSelf && (
                    <Badge
                      variant="outline"
                      className="px-1.5 py-0.5 text-[9px] bg-primary/10 text-primary border-primary/30 font-bold uppercase rounded-none"
                    >
                      {t('remote.youBadge')}
                    </Badge>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {isHostOrAdmin && !isSelf && !isMemberAdmin && (
                    <Button
                      variant="destructive"
                      size="sm"
                      chamfer="top-right"
                      onClick={() => onKickMember(member.uid)}
                      className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 h-auto"
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
