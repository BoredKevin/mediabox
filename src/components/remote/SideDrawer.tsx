import React from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { useTranslation } from '@/context/LanguageContext';
import { QueueItem, SearchResultItem } from '@/lib/roomUtils';
import { QueuePanel } from '@/components/remote/panels/QueuePanel';
import { MembersPanel } from '@/components/remote/panels/MembersPanel';
import type { DeviceUser } from '@/lib/deviceAuth';

interface SideDrawerProps {
  open: boolean;
  onClose: () => void;
  defaultTab?: 'queue' | 'members';
  queue: QueueItem[];
  radioQueue?: SearchResultItem[];
  user: DeviceUser | null;
  currentUid?: string;
  isHostOrAdmin: boolean;
  isAdmin?: boolean;
  isHostPinned?: boolean;
  lockPlaybackControls?: boolean;
  approvedMembers?: string[];
  approvalRequests?: string[];
  tvUuid?: string | null;
  membersList: { uid: string; joinedAt: number; nickname?: string; isTv?: boolean }[];
  adminsList: string[];
  hostUid?: string;
  onRemoveQueueItem: (itemId: string, itemAddedBy?: string) => Promise<void>;
  onMoveQueueItem: (index: number, direction: 'up' | 'down') => void;
  onKickMember: (targetUid: string) => void;
  onToggleApproveMember?: (targetUid: string) => void;
  onApproveAllMembers?: (memberUids: string[]) => void;
  onRevokeAllApprovedMembers?: () => void;
  onToggleHostPin?: () => void;
  onAdminTransferHost?: (newHostUid: string) => void;
  onToggleLockPlaybackControls?: () => void;
  onStartRadio?: () => void;
  onAddRadioTrackToQueue?: (trackId: string) => Promise<void>;
  onDeleteRadioTrack?: (trackId: string) => Promise<void>;
  onReorderQueue?: (orderedIds: string[]) => void;
  playback?: any;
}

export const SideDrawer: React.FC<SideDrawerProps> = ({
  open,
  onClose,
  defaultTab = 'queue',
  queue,
  radioQueue = [],
  user,
  currentUid,
  isHostOrAdmin,
  isAdmin = false,
  isHostPinned = false,
  lockPlaybackControls = false,
  approvedMembers = [],
  approvalRequests = [],
  tvUuid,
  membersList,
  adminsList,
  hostUid,
  onRemoveQueueItem,
  onMoveQueueItem,
  onKickMember,
  onToggleApproveMember,
  onApproveAllMembers,
  onRevokeAllApprovedMembers,
  onToggleHostPin,
  onAdminTransferHost,
  onToggleLockPlaybackControls,
  onStartRadio,
  onAddRadioTrackToQueue,
  onDeleteRadioTrack,
  onReorderQueue,
  playback,
}) => {
  const { t } = useTranslation();

  if (!open) return null;

  return (
    <>
      {/* Backdrop overlay */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 animate-in fade-in-0 duration-200"
        onClick={onClose}
      />

      {/* Slide-over sheet */}
      <div className="fixed top-0 right-0 bottom-0 w-full sm:w-[420px] bg-card border-l border-border z-50 flex flex-col shadow-2xl transition-transform animate-in slide-in-from-right duration-200 pb-28 sm:pb-32">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
            {t('remote.sessionTitle')}
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label={t('remote.closeBtn')}
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        <Tabs defaultValue={defaultTab} className="flex-1 flex flex-col min-h-0 px-4 pt-3 pb-4">
          <TabsList className="grid h-9 w-full grid-cols-2 rounded-lg bg-zinc-900/90 p-1 mb-4 flex-shrink-0">
            <TabsTrigger
              value="queue"
              className="rounded-md text-xs font-medium text-zinc-400 shadow-sm data-[state=active]:bg-zinc-800 data-[state=active]:text-white"
            >
              {t('remote.activeQueueTab')} ({queue.length})
            </TabsTrigger>
            <TabsTrigger
              value="members"
              className="rounded-md text-xs font-medium text-zinc-400 shadow-sm data-[state=active]:bg-zinc-800 data-[state=active]:text-white"
            >
              {t('remote.activeMembersTab')} ({membersList.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent
            value="queue"
            className="flex-1 min-h-0 overflow-hidden mt-0 data-[state=inactive]:hidden flex flex-col"
          >
            <QueuePanel
              queue={queue}
              radioQueue={radioQueue}
              user={user}
              currentUid={currentUid}
              isHostOrAdmin={isHostOrAdmin}
              tvUuid={tvUuid}
              membersList={membersList}
              onRemoveItem={onRemoveQueueItem}
              onMoveItem={onMoveQueueItem}
              onReorderQueue={onReorderQueue}
              onStartRadio={onStartRadio}
              onAddRadioTrackToQueue={onAddRadioTrackToQueue}
              onDeleteRadioTrack={onDeleteRadioTrack}
              playback={playback}
              embedded
            />
          </TabsContent>

          <TabsContent
            value="members"
            className="flex-1 min-h-0 overflow-hidden mt-0 data-[state=inactive]:hidden flex flex-col"
          >
            <MembersPanel
              membersList={membersList}
              adminsList={adminsList}
              hostUid={hostUid}
              tvUuid={tvUuid}
              user={user}
              currentUid={currentUid}
              isHostOrAdmin={isHostOrAdmin}
              isAdmin={isAdmin}
              isHostPinned={isHostPinned}
              lockPlaybackControls={lockPlaybackControls}
              approvedMembers={approvedMembers}
              approvalRequests={approvalRequests}
              queue={queue}
              onKickMember={onKickMember}
              onRemoveQueueItem={onRemoveQueueItem}
              onToggleApproveMember={onToggleApproveMember}
              onApproveAllMembers={onApproveAllMembers}
              onRevokeAllApprovedMembers={onRevokeAllApprovedMembers}
              onToggleHostPin={onToggleHostPin}
              onAdminTransferHost={onAdminTransferHost}
              onToggleLockPlaybackControls={onToggleLockPlaybackControls}
              embedded
            />
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
};

export default SideDrawer;
