import React, { useState, useEffect } from 'react';
import { useTranslation } from '@/context/LanguageContext';
import { useToast, ToastContainer } from '@/components/common/Toast';
import { DeviceUser } from '@/lib/deviceAuth';
import { useRemoteRoom } from './hooks/useRemoteRoom';
import { RoomHeader } from './RoomHeader';
import { NowPlayingBar } from './NowPlayingBar';
import { HostSettingsModal } from './HostSettingsModal';
import { SideDrawer } from './SideDrawer';
import { useRoomAdminActions } from './room/RoomAdminActions';
import { RoomTabContent } from './room/RoomTabContent';

interface RoomScreenProps {
  activeRoomCode: string;
  user: DeviceUser | null;
  onLeaveRoom: () => void;
  onLogout: () => Promise<void>;
}

export const RoomScreen: React.FC<RoomScreenProps> = ({
  activeRoomCode,
  user,
  onLeaveRoom,
  onLogout,
}) => {
  const { t } = useTranslation();
  const { toasts, showToast, removeToast } = useToast();

  const {
    roomId,
    effectiveUid,
    roomState,
    queue,
    radioQueue,
    memberCount,
    membersList,
    isTvOnline,
    tvUuid,
    isAdmin,
    adminsList,
    isHost,
    isHostOrAdmin,
    myNickname,
    actions,
    handleSaveNickname,
  } = useRemoteRoom({
    activeRoomCode,
    user,
    onLeaveRoom,
    showToast,
  });

  const [localVolume, setLocalVolume] = useState<number | null>(null);
  const [isDraggingVolume, setIsDraggingVolume] = useState<boolean>(false);
  const [fullscreenCooldown, setFullscreenCooldown] = useState<boolean>(false);
  const [showHostSettings, setShowHostSettings] = useState<boolean>(false);
  const [showSideDrawer, setShowSideDrawer] = useState<boolean>(false);
  const [isLyricsActive, setIsLyricsActive] = useState<boolean>(false);

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
    actions.setVolume(newVol);
    setIsDraggingVolume(false);
  };

  const handleToggleFullscreenClick = () => {
    if (fullscreenCooldown) {
      showToast(t('toasts.fullscreenCooldown'), 'info');
      return;
    }
    setFullscreenCooldown(true);
    actions.toggleFullscreen();
    setTimeout(() => setFullscreenCooldown(false), 2000);
  };

  const {
    handleKickMember,
    handleRemoveQueueItem,
    handleMoveQueueItem,
    handleClearQueueAdmin,
    handleToggleRoomLockAdmin,
    handleToggleFullscreenQrAdmin,
  } = useRoomAdminActions({
    isHostOrAdmin,
    effectiveUid,
    queue,
    actions,
    showToast,
  });

  const handleAddRadioTrackToQueue = async (trackId: string) => {
    try {
      await actions.addRadioTrackToQueue(trackId);
      showToast(t('toasts.videoAddedQueue'), 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to add radio track', 'error');
    }
  };

  const handleDeleteRadioTrack = async (trackId: string) => {
    try {
      await actions.deleteRadioTrack(trackId);
      showToast(t('toasts.radioTrackRemoved'), 'info');
    } catch (err: any) {
      showToast(err.message || 'Failed to remove radio track', 'error');
    }
  };

  return (
    <div className="relative z-10 flex flex-col h-screen overflow-hidden bg-background text-foreground">
      <ToastContainer toasts={toasts} onDismiss={removeToast} />

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
        onLogout={onLogout}
        onSaveNickname={handleSaveNickname}
        onOpenHostSettings={() => setShowHostSettings(true)}
        onToggleRoomLock={handleToggleRoomLockAdmin}
        onToggleFullscreenQr={handleToggleFullscreenQrAdmin}
        onOpenSideDrawer={() => setShowSideDrawer(true)}
      />

      <main className="flex-1 min-h-0 p-3 sm:p-5 md:p-6 pb-36 sm:pb-40 overflow-hidden">
        <RoomTabContent
          roomId={roomId}
          activeRoomCode={activeRoomCode}
          roomState={roomState}
          user={user}
          effectiveUid={effectiveUid}
          isHostOrAdmin={isHostOrAdmin}
          tvUuid={tvUuid}
          queue={queue}
          radioQueue={radioQueue}
          membersList={membersList}
          adminsList={adminsList}
          isLyricsActive={isLyricsActive}
          setIsLyricsActive={setIsLyricsActive}
          setShowHostSettings={setShowHostSettings}
          setShowSideDrawer={setShowSideDrawer}
          actions={actions}
          showToast={showToast}
          handleRemoveQueueItem={handleRemoveQueueItem}
          handleMoveQueueItem={handleMoveQueueItem}
          handleKickMember={handleKickMember}
          onAddRadioTrackToQueue={handleAddRadioTrackToQueue}
          onDeleteRadioTrack={handleDeleteRadioTrack}
        />
      </main>

      <NowPlayingBar
        roomState={roomState}
        isHostOrAdmin={isHostOrAdmin}
        onTogglePlayPause={actions.togglePlayPause}
        onNextTrack={actions.nextTrack}
        onPreviousTrack={actions.previousTrack}
        onStartRadio={actions.startRadio}
        onToggleAutoplay={actions.toggleAutoplay}
        displayVolume={displayVolume}
        handleVolumeValueChange={handleVolumeValueChange}
        handleVolumeValueCommit={handleVolumeValueCommit}
        fullscreenCooldown={fullscreenCooldown}
        handleToggleFullscreenClick={handleToggleFullscreenClick}
        isLyricsActive={isLyricsActive}
        onToggleLyrics={() => setIsLyricsActive(!isLyricsActive)}
      />

      <HostSettingsModal
        open={showHostSettings}
        onOpenChange={setShowHostSettings}
        roomCode={activeRoomCode}
        roomState={roomState}
        isAdmin={isHostOrAdmin}
        queueLength={queue.length}
        actions={actions}
        handleClearQueueAdmin={handleClearQueueAdmin}
        handleToggleRoomLockAdmin={handleToggleRoomLockAdmin}
        showToast={showToast}
      />

      <SideDrawer
        open={showSideDrawer}
        onClose={() => setShowSideDrawer(false)}
        queue={queue}
        radioQueue={radioQueue}
        membersList={membersList}
        adminsList={adminsList}
        hostUid={roomState?.hostUid}
        tvUuid={tvUuid}
        user={user}
        currentUid={effectiveUid}
        isHostOrAdmin={isHostOrAdmin}
        onRemoveQueueItem={handleRemoveQueueItem}
        onMoveQueueItem={handleMoveQueueItem}
        onKickMember={handleKickMember}
        onStartRadio={actions.startRadio}
        onAddRadioTrackToQueue={handleAddRadioTrackToQueue}
        onDeleteRadioTrack={handleDeleteRadioTrack}
      />
    </div>
  );
};
