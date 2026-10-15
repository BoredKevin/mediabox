import React, { useState, useEffect } from 'react';
import { User as FirebaseUser } from 'firebase/auth';
import { useTranslation } from '@/context/LanguageContext';
import { Card, Button, Tabs, TabsList, TabsTrigger, TabsContent } from '@boredkevin/ui';
import { Layers } from 'lucide-react';

import { useToast, ToastContainer } from '@/components/common/Toast';
import { useRemoteRoom } from './hooks/useRemoteRoom';
import { RoomHeader } from './RoomHeader';
import { SearchPanel } from './panels/SearchPanel';
import { QueuePanel } from './panels/QueuePanel';
import { MembersPanel } from './panels/MembersPanel';
import { NowPlayingBar } from './NowPlayingBar';
import { HostSettingsModal } from './HostSettingsModal';
import { SideDrawer } from './SideDrawer';

interface RoomScreenProps {
  activeRoomCode: string;
  user: FirebaseUser | null;
  onLeaveRoom: () => void;
  onGoogleSignIn: () => Promise<void>;
  onLogout: () => Promise<void>;
}

export const RoomScreen: React.FC<RoomScreenProps> = ({
  activeRoomCode,
  user,
  onLeaveRoom,
  onGoogleSignIn,
  onLogout,
}) => {
  const { t } = useTranslation();
  const { toasts, showToast, removeToast } = useToast();

  const {
    roomState,
    queue,
    memberCount,
    membersList,
    isTvOnline,
    isAdmin,
    adminsList,
    isHost,
    isHostOrAdmin,
    myNickname,
    sendCommand,
    handleSaveNickname,
  } = useRemoteRoom({
    activeRoomCode,
    user,
    onLeaveRoom,
    showToast,
  });

  // Volume slider state
  const [localVolume, setLocalVolume] = useState<number | null>(null);
  const [isDraggingVolume, setIsDraggingVolume] = useState<boolean>(false);

  // Fullscreen cooldown
  const [fullscreenCooldown, setFullscreenCooldown] = useState<boolean>(false);

  // Modal / Drawer state
  const [showHostSettings, setShowHostSettings] = useState<boolean>(false);
  const [showSideDrawer, setShowSideDrawer] = useState<boolean>(false);

  const displayVolume =
    isDraggingVolume && localVolume !== null
      ? localVolume
      : localVolume ?? roomState?.playback?.volume ?? 80;

  useEffect(() => {
    if (!isDraggingVolume && roomState?.playback?.volume !== undefined) {
      setLocalVolume(roomState.playback.volume);
    }
  }, [roomState?.playback?.volume, isDraggingVolume]);

  const handleVolumeValueChange = (val: number[]) => {
    setLocalVolume(val[0]);
    setIsDraggingVolume(true);
  };

  const handleVolumeValueCommit = (val: number[]) => {
    const newVol = val[0];
    setLocalVolume(newVol);
    sendCommand('adjustVolume', { volume: newVol });
    setIsDraggingVolume(false);
  };

  const handleToggleFullscreenClick = () => {
    if (fullscreenCooldown) {
      showToast(t('toasts.fullscreenCooldown'), 'info');
      return;
    }
    sendCommand('toggleFullscreen');
    setFullscreenCooldown(true);
    setTimeout(() => {
      setFullscreenCooldown(false);
    }, 5000);
  };

  const handleRemoveQueueItem = async (itemId: string, itemAddedBy?: string) => {
    const isMyEntry = Boolean(user && itemAddedBy === user.uid);
    if (!isMyEntry && !isHostOrAdmin) {
      showToast(t('toasts.controlsLockedByAdmin'), 'error');
      return;
    }

    try {
      if (isHostOrAdmin && !isMyEntry) {
        await sendCommand('forceRemoveFromQueue', { itemId });
      } else {
        await sendCommand('removeFromQueue', { itemId });
      }
    } catch (err: any) {
      console.error('Failed to remove item from queue:', err);
      showToast(t('toasts.commandFailed'), 'error');
    }
  };

  const handleKickMember = async (targetUid: string) => {
    if (!isHostOrAdmin || targetUid === user?.uid) return;
    if (confirm(t('remote.kickMemberConfirm'))) {
      try {
        await sendCommand('kickMember', { targetUid, purgeQueue: true });
      } catch (err: any) {
        console.error('Failed to kick member:', err);
        showToast(t('toasts.commandFailed'), 'error');
      }
    }
  };

  const handleMoveQueueItem = (index: number, direction: 'up' | 'down') => {
    if (!isHostOrAdmin) return;
    const newQueue = [...queue];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newQueue.length) return;

    const temp = newQueue[index];
    newQueue[index] = newQueue[targetIndex];
    newQueue[targetIndex] = temp;

    const newOrderIds = newQueue.map((item) => item.id);
    sendCommand('reorderQueue', { queueOrder: newOrderIds });
  };

  const handleClearQueueAdmin = () => {
    if (!isHostOrAdmin) return;
    if (confirm(t('remote.clearQueueConfirm'))) {
      sendCommand('clearQueue');
    }
  };

  const handleToggleRoomLockAdmin = () => {
    if (!isHostOrAdmin) return;
    sendCommand('toggleRoomLock');
  };

  return (
    <div className="relative z-10 flex flex-col h-screen overflow-hidden bg-background text-foreground">
      {/* Floating Toasts */}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />

      {/* Header Bar */}
      <RoomHeader
        activeRoomCode={activeRoomCode}
        user={user}
        roomState={roomState}
        isAdmin={isAdmin}
        isHost={isHost}
        isHostOrAdmin={isHostOrAdmin}
        isTvOnline={isTvOnline}
        memberCount={memberCount}
        myNickname={myNickname}
        onLeaveRoom={onLeaveRoom}
        onGoogleSignIn={onGoogleSignIn}
        onLogout={onLogout}
        onSaveNickname={handleSaveNickname}
        onOpenHostSettings={() => setShowHostSettings(true)}
        onToggleRoomLock={handleToggleRoomLockAdmin}
        onOpenSideDrawer={() => setShowSideDrawer(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 min-h-0 p-3 sm:p-5 md:p-6 pb-36 sm:pb-40 overflow-hidden">
        <div className="max-w-[1800px] w-full mx-auto h-full flex flex-col">
          {/* Desktop Two-Column Layout (>= 1024px / lg) */}
          <div className="hidden lg:grid lg:grid-cols-[60fr_40fr] xl:grid-cols-[63fr_37fr] lg:gap-6 h-full min-h-0">
            {/* Left Column: Search & URL Queue Input */}
            <Card cornerLines className="h-full flex flex-col p-5 bg-card border-border overflow-hidden">
              <div className="flex-1 min-h-0 overflow-y-auto pr-2">
                <SearchPanel
                  roomCode={activeRoomCode}
                  roomState={roomState}
                  user={user}
                  isHostOrAdmin={isHostOrAdmin}
                  sendCommand={sendCommand}
                  showToast={showToast}
                  embedded
                  onOpenHostSettings={() => setShowHostSettings(true)}
                />
              </div>
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
                    user={user}
                    isHostOrAdmin={isHostOrAdmin}
                    membersList={membersList}
                    onRemoveItem={handleRemoveQueueItem}
                    onMoveItem={handleMoveQueueItem}
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
                    user={user}
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

            {/* Scrollable Search & Add Panel */}
            <div className="flex-1 min-h-0 overflow-y-auto pr-1">
              <Card cornerLines className="p-4 bg-card border-border flex flex-col mb-4">
                <SearchPanel
                  roomCode={activeRoomCode}
                  roomState={roomState}
                  user={user}
                  isHostOrAdmin={isHostOrAdmin}
                  sendCommand={sendCommand}
                  showToast={showToast}
                  embedded
                  onOpenHostSettings={() => setShowHostSettings(true)}
                />
              </Card>
            </div>
          </div>
        </div>
      </main>

      {/* Sticky Bottom Now Playing Bar */}
      <NowPlayingBar
        roomState={roomState}
        isHostOrAdmin={isHostOrAdmin}
        sendCommand={sendCommand}
        displayVolume={displayVolume}
        handleVolumeValueChange={handleVolumeValueChange}
        handleVolumeValueCommit={handleVolumeValueCommit}
        fullscreenCooldown={fullscreenCooldown}
        handleToggleFullscreenClick={handleToggleFullscreenClick}
      />

      {/* Host / Admin Settings Dialog */}
      <HostSettingsModal
        open={showHostSettings}
        onOpenChange={setShowHostSettings}
        roomCode={activeRoomCode}
        roomState={roomState}
        isAdmin={isAdmin}
        queueLength={queue.length}
        sendCommand={sendCommand}
        handleClearQueueAdmin={handleClearQueueAdmin}
        handleToggleRoomLockAdmin={handleToggleRoomLockAdmin}
        showToast={showToast}
      />

      {/* Mobile Queue & Members Side Drawer */}
      <SideDrawer
        open={showSideDrawer}
        onClose={() => setShowSideDrawer(false)}
        queue={queue}
        user={user}
        isHostOrAdmin={isHostOrAdmin}
        membersList={membersList}
        adminsList={adminsList}
        hostUid={roomState?.hostUid}
        onRemoveQueueItem={handleRemoveQueueItem}
        onMoveQueueItem={handleMoveQueueItem}
        onKickMember={handleKickMember}
      />
    </div>
  );
};

export default RoomScreen;
