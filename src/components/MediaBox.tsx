import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useWatchParty } from '@/context/WatchPartyContext';
import { YouTubePlayer } from '@/components/YouTubePlayer';
import { IdleScheduleTimeline } from '@/components/IdleScheduleTimeline';
import { Card } from '@/components/ui/card';

import { useClockTime } from '@/hooks/useClockTime';
import { useCurrentMediaMeta } from '@/hooks/useCurrentMediaMeta';
import { MediaBoxOverlayControls } from './mediabox/MediaBoxOverlayControls';
import { MediaBoxQrModal } from './mediabox/MediaBoxQrModal';

export const MediaBox: React.FC = React.memo(() => {
  const {
    roomCode,
    roomState,
    muted,
    setMuted,
    showQrModal,
    setShowQrModal,
    remoteUrl,
    handlePlayNextInQueue,
    handlePlayPreviousTrack,
    canGoPrevious,
    handleTogglePlayPause,
    handleToggleFullscreen,
    handleAdjustVolume,
  } = useWatchParty();

  const clockTime = useClockTime();
  const currentVideoMeta = useCurrentMediaMeta(
    roomState?.currentlyPlaying,
    roomState?.currentlyPlayingTitle
  );

  const [localFullscreen, setLocalFullscreen] = useState<boolean>(false);
  const isPlaying = roomState?.playback?.status === 'playing';
  const isFullscreen = roomCode ? Boolean(roomState?.isFullscreen) : localFullscreen;
  const isLocked = Boolean(roomState?.isLocked);

  // Slider drag states for smooth volume control
  const [localVolume, setLocalVolume] = useState<number | null>(null);
  const [isDraggingVolume, setIsDraggingVolume] = useState<boolean>(false);

  const displayVolume =
    isDraggingVolume && localVolume !== null
      ? localVolume
      : localVolume ?? roomState?.playback?.volume ?? 80;

  useEffect(() => {
    if (!isDraggingVolume && roomState?.playback?.volume !== undefined) {
      setLocalVolume(roomState.playback.volume);
    }
  }, [roomState?.playback?.volume, isDraggingVolume]);

  // Hover inactivity timeout to hide overlay controls after 5 seconds
  const [isControlsVisible, setIsControlsVisible] = useState<boolean>(false);
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetControlsTimeout = useCallback(() => {
    setIsControlsVisible(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      setIsControlsVisible(false);
    }, 5000);
  }, []);

  const handleMouseMove = () => resetControlsTimeout();
  const handleMouseEnter = () => resetControlsTimeout();
  const handleMouseLeave = () => {
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    if (!isDraggingVolume) {
      setIsControlsVisible(false);
    }
  };

  useEffect(() => {
    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, []);

  const handleVolumeValueChange = (val: number[]) => {
    if (muted) setMuted(false);
    setLocalVolume(val[0]);
    setIsDraggingVolume(true);
    setIsControlsVisible(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
  };

  const handleVolumeValueCommit = (val: number[]) => {
    const newVol = val[0];
    setLocalVolume(newVol);
    handleAdjustVolume(newVol);
    setIsDraggingVolume(false);
    resetControlsTimeout();
  };

  const isOverlayVisible = isControlsVisible || isDraggingVolume;

  const toggleFullscreen = () => {
    if (roomCode) {
      handleToggleFullscreen();
    } else {
      setLocalFullscreen((prev) => !prev);
    }
  };

  // Exit fullscreen on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        toggleFullscreen();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen, roomCode]);

  const hasActiveMedia = Boolean(roomState?.currentlyPlaying) && !isLocked;

  const handleVideoAreaClick = () => {
    if (isLocked) return;
    resetControlsTimeout();
    if (hasActiveMedia) {
      handleTogglePlayPause();
    }
  };

  return (
    <Card
      cornerLines={false}
      className={`p-0 overflow-hidden flex flex-col relative transition-all duration-300 ${
        isFullscreen
          ? 'fixed inset-0 z-[100] w-screen h-screen border-none bg-black rounded-none'
          : 'aspect-video min-h-[220px] sm:min-h-0 w-full bg-card'
      }`}
    >
      {/* Fullscreen Idle Clock */}
      {isFullscreen && !hasActiveMedia && (
        <div className="absolute top-4 left-5 sm:left-8 z-[110] bg-background/90 border border-border px-3.5 py-1.5 font-display text-base sm:text-3xl font-normal tracking-wider text-foreground opacity-90 flex items-center gap-2 pointer-events-none select-none rounded-md">
          <span>
            {clockTime.hours}
            <span className="text-muted-foreground opacity-70 animate-blink">:</span>
            {clockTime.minutes}
          </span>
        </div>
      )}

      {/* Main Video Player Area */}
      <div
        className={`flex-1 w-full ${hasActiveMedia ? 'bg-black' : 'bg-card'} relative flex items-center justify-center overflow-hidden h-full group ${
          hasActiveMedia ? 'cursor-pointer' : ''
        } ${isFullscreen && !isOverlayVisible ? 'cursor-none' : ''}`}
        onClick={handleVideoAreaClick}
        onMouseMove={handleMouseMove}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <div className="w-full h-full flex items-center justify-center">
          {hasActiveMedia ? (
            <YouTubePlayer
              url={roomState!.currentlyPlaying!}
              isPlaying={isPlaying && !isLocked}
              volume={displayVolume}
              muted={muted}
              onEnded={handlePlayNextInQueue}
            />
          ) : (
            <IdleScheduleTimeline isLocked={isLocked} />
          )}
        </div>

        {/* Player Overlay Controls */}
        <MediaBoxOverlayControls
          hasActiveMedia={hasActiveMedia}
          isPlaying={isPlaying}
          isLocked={isLocked}
          isFullscreen={isFullscreen}
          isOverlayVisible={isOverlayVisible}
          clockTime={clockTime}
          currentVideoMeta={currentVideoMeta}
          currentlyPlayingUrl={roomState?.currentlyPlaying}
          currentlyPlayingTitle={roomState?.currentlyPlayingTitle}
          displayVolume={displayVolume}
          muted={muted}
          setMuted={setMuted}
          onTogglePlayPause={handleTogglePlayPause}
          onPreviousTrack={handlePlayPreviousTrack}
          onSkipNextTrack={handlePlayNextInQueue}
          canGoPrevious={canGoPrevious}
          onToggleFullscreen={toggleFullscreen}
          onVolumeChange={handleVolumeValueChange}
          onVolumeCommit={handleVolumeValueCommit}
        />
      </div>

      {/* QR Code Overlay Modal */}
      <MediaBoxQrModal
        show={showQrModal}
        onClose={() => setShowQrModal(false)}
        remoteUrl={remoteUrl}
        roomCode={roomCode}
      />
    </Card>
  );
});

export default MediaBox;
