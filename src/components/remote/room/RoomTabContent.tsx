import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Layers } from 'lucide-react';
import { useTranslation } from '@/context/LanguageContext';
import { RoomState, QueueItem, SearchResultItem } from '@/lib/roomUtils';
import { DeviceUser } from '@/lib/deviceAuth';
import { MemberInfo } from '../panels/MembersPanel';
import { SearchPanel } from '../panels/SearchPanel';
import { QueuePanel } from '../panels/QueuePanel';
import { MembersPanel } from '../panels/MembersPanel';
import { RemoteLyricsView } from '../RemoteLyricsView';
import { RemoteActions } from '../hooks/useRemoteActions';
import { Id } from '../../../../convex/_generated/dataModel';

interface RoomTabContentProps {
  roomId: Id<'rooms'> | null;
  activeRoomCode: string;
  roomState: RoomState | null;
  user: DeviceUser | null;
  effectiveUid: string;
  isHostOrAdmin: boolean;
  tvUuid: string | null;
  queue: QueueItem[];
  radioQueue: SearchResultItem[];
  membersList: MemberInfo[];
  adminsList: string[];
  isLyricsActive: boolean;
  setIsLyricsActive: (active: boolean) => void;
  setShowHostSettings: (show: boolean) => void;
  setShowSideDrawer: (show: boolean) => void;
  actions: RemoteActions;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  handleRemoveQueueItem: (itemId: string, itemAddedBy?: string) => Promise<void>;
  handleMoveQueueItem: (index: number, direction: 'up' | 'down') => void;
  handleKickMember: (uid: string) => Promise<void>;
  onAddRadioTrackToQueue?: (trackId: string) => Promise<void>;
  onDeleteRadioTrack?: (trackId: string) => Promise<void>;
}

export const RoomTabContent: React.FC<RoomTabContentProps> = ({
  roomId,
  activeRoomCode,
  roomState,
  user,
  effectiveUid,
  isHostOrAdmin,
  tvUuid,
  queue,
  radioQueue,
  membersList,
  adminsList,
  isLyricsActive,
  setIsLyricsActive,
  setShowHostSettings,
  setShowSideDrawer,
  actions,
  showToast,
  handleRemoveQueueItem,
  handleMoveQueueItem,
  handleKickMember,
  onAddRadioTrackToQueue,
  onDeleteRadioTrack,
}) => {
  const { t } = useTranslation();

  return (
    <div className="max-w-[1800px] w-full mx-auto h-full flex flex-col">
      {/* Desktop Two-Column Layout (>= 1024px / lg) */}
      <div className="hidden lg:grid lg:grid-cols-[60fr_40fr] xl:grid-cols-[63fr_37fr] lg:gap-6 h-full min-h-0">
        {/* Left Column: Search & URL Queue Input OR Synced Lyrics */}
        <Card cornerLines className="h-full flex flex-col p-5 bg-card border-border overflow-hidden">
          {isLyricsActive ? (
            <div className="flex-1 min-h-0 h-full">
              <RemoteLyricsView
                roomId={roomId}
                roomState={roomState}
                isHostOrAdmin={isHostOrAdmin}
                onSeek={(pos) => actions.seek(pos)}
                onClose={() => setIsLyricsActive(false)}
              />
            </div>
          ) : (
            <div className="flex-1 min-h-0 overflow-y-auto pr-2">
              <SearchPanel
                roomCode={activeRoomCode}
                roomState={roomState}
                user={user}
                isHostOrAdmin={isHostOrAdmin}
                onAddToQueue={(url, title) => actions.addToQueue(url, title)}
                showToast={showToast}
                embedded
                onOpenHostSettings={() => setShowHostSettings(true)}
              />
            </div>
          )}
        </Card>

        {/* Right Column: Tabbed Queue & Members */}
        <Card cornerLines className="h-full flex flex-col p-5 bg-card border-border overflow-hidden">
          <Tabs defaultValue="queue" className="h-full flex flex-col min-h-0">
            <TabsList className="grid w-full grid-cols-2 mb-4 flex-shrink-0">
              <TabsTrigger value="queue" className="text-xs uppercase font-bold tracking-wider">
                {t('remote.activeQueueTab')} ({queue.length})
              </TabsTrigger>
              <TabsTrigger value="members" className="text-xs uppercase font-bold tracking-wider">
                {t('remote.activeMembersTab')} ({membersList.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent
              value="queue"
              className="flex-1 min-h-0 overflow-hidden flex flex-col mt-0 data-[state=inactive]:hidden"
            >
              <QueuePanel
                queue={queue}
                radioQueue={radioQueue}
                user={user}
                currentUid={effectiveUid}
                isHostOrAdmin={isHostOrAdmin}
                tvUuid={tvUuid}
                membersList={membersList}
                onRemoveItem={handleRemoveQueueItem}
                onMoveItem={handleMoveQueueItem}
                onStartRadio={actions.startRadio}
                onAddRadioTrackToQueue={onAddRadioTrackToQueue}
                onDeleteRadioTrack={onDeleteRadioTrack}
                embedded
              />
            </TabsContent>

            <TabsContent
              value="members"
              className="flex-1 min-h-0 overflow-hidden flex flex-col mt-0 data-[state=inactive]:hidden"
            >
              <MembersPanel
                membersList={membersList}
                adminsList={adminsList}
                hostUid={roomState?.hostUid}
                tvUuid={tvUuid}
                user={user}
                currentUid={effectiveUid}
                isHostOrAdmin={isHostOrAdmin}
                queue={queue}
                onKickMember={handleKickMember}
                onRemoveQueueItem={handleRemoveQueueItem}
                embedded
              />
            </TabsContent>
          </Tabs>
        </Card>
      </div>

      {/* Mobile / Tablet View (< 1024px / < lg) */}
      <div className="lg:hidden h-full flex flex-col min-h-0">
        {/* Quick Queue Summary Bar */}
        <div className="flex items-center justify-between p-2.5 px-3 mb-3 bg-card border border-border flex-shrink-0">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground uppercase font-mono">
              {t('remote.upcomingQueue')}:
            </span>
            <span className="font-mono text-primary font-bold">{queue.length} items</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            chamfer="top-right"
            onClick={() => setShowSideDrawer(true)}
            className="h-7 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5"
          >
            <Layers className="w-3.5 h-3.5 text-primary" />
            <span>{t('remote.queueDrawerTitle')}</span>
          </Button>
        </div>

        {/* Scrollable Search & Add Panel OR Synced Lyrics */}
        {isLyricsActive ? (
          <div className="flex-1 min-h-0 h-full mb-4">
            <RemoteLyricsView
              roomId={roomId}
              roomState={roomState}
              isHostOrAdmin={isHostOrAdmin}
              onSeek={(pos) => actions.seek(pos)}
              onClose={() => setIsLyricsActive(false)}
            />
          </div>
        ) : (
          <Card cornerLines className="flex-1 min-h-0 p-4 bg-card border-border overflow-y-auto mb-4">
            <SearchPanel
              roomCode={activeRoomCode}
              roomState={roomState}
              user={user}
              isHostOrAdmin={isHostOrAdmin}
              onAddToQueue={(url, title) => actions.addToQueue(url, title)}
              showToast={showToast}
              embedded
              onOpenHostSettings={() => setShowHostSettings(true)}
            />
          </Card>
        )}
      </div>
    </div>
  );
};
