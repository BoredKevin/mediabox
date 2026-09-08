import React from 'react';
import { User as FirebaseUser } from 'firebase/auth';
import { Tabs, TabsList, TabsTrigger, TabsContent, Button } from '@boredkevin/ui';
import { X, Layers } from 'lucide-react';
import { useTranslation } from '@/context/LanguageContext';
import { QueueItem } from '@/lib/roomUtils';
import { QueuePanel } from '@/components/remote/panels/QueuePanel';
import { MembersPanel } from '@/components/remote/panels/MembersPanel';

interface SideDrawerProps {
  open: boolean;
  onClose: () => void;
  defaultTab?: 'queue' | 'members';
  queue: QueueItem[];
  user: FirebaseUser | null;
  isHostOrAdmin: boolean;
  membersList: { uid: string; joinedAt: number; nickname?: string }[];
  adminsList: string[];
  hostUid?: string;
  onRemoveQueueItem: (itemId: string, itemAddedBy?: string) => Promise<void>;
  onMoveQueueItem: (index: number, direction: 'up' | 'down') => void;
  onKickMember: (targetUid: string) => void;
}

export const SideDrawer: React.FC<SideDrawerProps> = ({
  open,
  onClose,
  defaultTab = 'queue',
  queue,
  user,
  isHostOrAdmin,
  membersList,
  adminsList,
  hostUid,
  onRemoveQueueItem,
  onMoveQueueItem,
  onKickMember,
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
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-primary" />
            <span className="text-sm font-bold uppercase tracking-wider font-mono text-foreground">
              {t('remote.queueDrawerTitle')}
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        <Tabs defaultValue={defaultTab} className="flex-1 flex flex-col min-h-0 p-4">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="queue" className="text-xs uppercase font-bold tracking-wider">
              {t('remote.activeQueueTab')} ({queue.length})
            </TabsTrigger>
            <TabsTrigger value="members" className="text-xs uppercase font-bold tracking-wider">
              {t('remote.activeMembersTab')} ({membersList.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent
            value="queue"
            className="flex-1 min-h-0 overflow-hidden mt-0 data-[state=inactive]:hidden flex flex-col"
          >
            <QueuePanel
              queue={queue}
              user={user}
              isHostOrAdmin={isHostOrAdmin}
              membersList={membersList}
              onRemoveItem={onRemoveQueueItem}
              onMoveItem={onMoveQueueItem}
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
              user={user}
              isHostOrAdmin={isHostOrAdmin}
              queue={queue}
              onKickMember={onKickMember}
              onRemoveQueueItem={onRemoveQueueItem}
              embedded
            />
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
};

export default SideDrawer;
