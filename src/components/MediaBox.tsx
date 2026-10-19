import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useWatchParty } from '@/context/WatchPartyContext';
import { YouTubePlayer } from '@/components/YouTubePlayer';
import { IdleScheduleTimeline } from '@/components/IdleScheduleTimeline';
import { Card } from '@/components/ui/card';
import { saveApiToken } from '@/lib/apiTokenStore';

import { useClockTime } from '@/hooks/useClockTime';
import { useCurrentMediaMeta } from '@/hooks/useCurrentMediaMeta';
import { useLyrics } from '@/hooks/useLyrics';
import { FullscreenLyricsView } from './lyrics/FullscreenLyricsView';
import { MediaBoxLyricsView } from './lyrics/MediaBoxLyricsView';
import { MediaBoxOverlayControls } from './mediabox/MediaBoxOverlayControls';
import { MediaBoxQrModal } from './mediabox/MediaBoxQrModal';
import { getSavedLyricsOffset, getSavedLyricsWordSync } from '@/lib/lyricsOffsetStore';
import { useTvNavigation } from '@/hooks/useTvNavigation';
import { useTvPlaybackSync } from '@/hooks/useTvPlaybackSync';
import { calculatePlaybackCurrentTimeSec } from '@/lib/roomUtils';

export const MediaBox: React.FC = React.memo(() => {
  const {
    roomCode,
    roomId,
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
    registerPlayerInstance,
    handleSyncPlaybackCheckpoint,
  } = useWatchParty();

  const clockTime = useClockTime();
  const currentVideoMeta = useCurrentMediaMeta(
    roomState?.currentlyPlaying,
    roomState?.currentlyPlayingTitle
  );

  const [playerInstance, setPlayerInstance] = useState<any>(null);

  const handlePlayerInstance = useCallback(
    (instance: any) => {
      setPlayerInstance(instance);
      if (registerPlayerInstance) {
        registerPlayerInstance(instance);
      }
    },
    [registerPlayerInstance]
  );

  // Background TV listener for ephemeral beamed API tokens from Host
  const pendingTvToken = useQuery(
    api.rooms.getPendingTvToken,
    roomId ? { roomId } : 'skip'
  );
  const acknowledgeTvToken = useMutation(api.rooms.acknowledgeTvToken);
  const reportPlaybackStatusMutation = useMutation(api.playback.reportPlaybackStatus);

  useEffect(() => {
    if (pendingTvToken && roomId) {
      saveApiToken(pendingTvToken);
      acknowledgeTvToken({ roomId }).catch((err) => {
        console.warn('[MediaBox] Failed to acknowledge beamed TV token:', err);
      });
    }
  }, [pendingTvToken, roomId, acknowledgeTvToken]);

  const isPlaying = roomState?.playback?.status === 'playing';
  const isLoadingState = roomState?.playback?.status === 'loading';
  const isLocked = Boolean(roomState?.isLocked);

  // Synchronize playback position and wall-clock timestamp to Convex ONLY when seeked or changed
  useTvPlaybackSync({
    roomCode,
    playerInstance,
    isPlaying: isPlaying && !isLocked,
    currentlyPlaying: roomState?.currentlyPlaying,
    playbackPositionMs: roomState?.playback?.positionMs,
    playbackUpdatedAt: roomState?.playback?.updatedAt,
    onSyncCheckpoint: handleSyncPlaybackCheckpoint,
    onTrackEnded: handlePlayNextInQueue,
  });

  // Catch remote seek operations & ensure tight pause/resume alignment
  const lastSyncTimestampRef = useRef<number>(0);
  const playbackStartGracePeriodUntilRef = useRef<number>(0);
  useEffect(() => {
    if (!playerInstance || typeof playerInstance.getCurrentTime !== 'function') return;
    if (isLoadingState) return;

    const updatedAt = roomState?.playback?.updatedAt || 0;
    if (updatedAt && updatedAt !== lastSyncTimestampRef.current) {
      lastSyncTimestampRef.current = updatedAt;

      // Suppress echo-seeking during the first 3s of starting a new track unless user seeked forward (> 3s)
      if (Date.now() < playbackStartGracePeriodUntilRef.current) {
        const targetSec = calculatePlaybackCurrentTimeSec(roomState?.playback);
        if (targetSec < 3) {
          return;
        }
      }

      const targetSec = calculatePlaybackCurrentTimeSec(roomState?.playback);
      const currentSec = playerInstance.getCurrentTime() || 0;
      const threshold = isPlaying ? 0.6 : 0.4;
      if (Math.abs(currentSec - targetSec) > threshold) {
        try {
          playerInstance.seekTo(targetSec, true);
        } catch (e) {
          console.warn('[MediaBox] seekTo error:', e);
        }
      }
    }
  }, [playerInstance, isPlaying, isLoadingState, roomState?.playback?.positionMs, roomState?.playback?.updatedAt, roomState?.playback?.status]);

  const lyricsData = useLyrics(
    roomState?.currentlyPlaying,
    roomState?.currentlyPlayingTitle,
    playerInstance,
    undefined,
    undefined,
    roomId,
    true,
    currentVideoMeta.author
  );

  const [isVideoReady, setIsVideoReady] = useState<boolean>(false);
  const hasTriggeredPlayRef = useRef<string | null>(null);

  // Reset video ready state when currentlyPlaying changes
  useEffect(() => {
    setIsVideoReady(false);
    hasTriggeredPlayRef.current = null;
  }, [roomState?.currentlyPlaying]);

  // Readiness coordinator: wait for both video player cued/ready AND lyrics resolved
  useEffect(() => {
    if (!isLoadingState || !roomState?.currentlyPlaying || !roomId) return;
    if (hasTriggeredPlayRef.current === roomState.currentlyPlaying) return;

    const isLyricsResolved =
      !lyricsData.isLoading || lyricsData.status === 'ready' || lyricsData.status === 'error';

    let safetyTimer: ReturnType<typeof setTimeout> | null = null;
    let maxWaitTimer: ReturnType<typeof setTimeout> | null = null;

    const triggerPlayback = () => {
      if (hasTriggeredPlayRef.current === roomState.currentlyPlaying) return;
      hasTriggeredPlayRef.current = roomState.currentlyPlaying;
      playbackStartGracePeriodUntilRef.current = Date.now() + 3000;

      if (playerInstance && typeof playerInstance.playVideo === 'function') {
        try {
          playerInstance.playVideo();
        } catch (e) {
          console.warn('[MediaBox] Failed to play video on readiness:', e);
        }
      }
      const dur =
        playerInstance && typeof playerInstance.getDuration === 'function'
          ? Math.max(0, Math.round(playerInstance.getDuration() * 1000))
          : undefined;

      reportPlaybackStatusMutation({
        roomId,
        status: 'playing',
        positionMs: 0,
        durationMs: dur,
      }).catch((e) => console.warn('[MediaBox] reportPlaybackStatus error:', e));
    };

    if (isVideoReady && isLyricsResolved) {
      triggerPlayback();
    } else if (isVideoReady) {
      // Safety timeout: wait at most 3.5s for lyrics before proceeding with video playback
      safetyTimer = setTimeout(() => {
        triggerPlayback();
      }, 3500);
    } else {
      // Overall fallback: if video player takes too long to report ready, force start after 4s
      maxWaitTimer = setTimeout(() => {
        triggerPlayback();
      }, 4000);
    }

    return () => {
      if (safetyTimer) clearTimeout(safetyTimer);
      if (maxWaitTimer) clearTimeout(maxWaitTimer);
    };
  }, [
    isLoadingState,
    isVideoReady,
    lyricsData.isLoading,
    lyricsData.status,
    roomState?.currentlyPlaying,
    roomId,
    playerInstance,
    reportPlaybackStatusMutation,
  ]);

  const [localFullscreen, setLocalFullscreen] = useState<boolean>(false);
  const isFullscreen = roomCode ? Boolean(roomState?.isFullscreen) : localFullscreen;

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

  const hasActiveMedia = Boolean(roomState?.currentlyPlaying) && !isLocked;

  // Smart TV Remote & Hardware Key Navigation
  useTvNavigation({
    isFullscreen,
    onToggleFullscreen: toggleFullscreen,
    onTogglePlayPause: hasActiveMedia ? handleTogglePlayPause : undefined,
    onNextTrack: handlePlayNextInQueue,
    onPreviousTrack: canGoPrevious ? handlePlayPreviousTrack : undefined,
    isModalOpen: showQrModal,
    onCloseModal: () => setShowQrModal(false),
  });

  const handleVideoAreaClick = (e: React.MouseEvent) => {
    if (isLocked) return;
    // Don't toggle play/pause if user clicked on a lyric line or word
    const target = e.target as HTMLElement | null;
    if (target?.closest?.('.blyrics--line') || target?.closest?.('.blyrics--word')) {
      return;
    }
    resetControlsTimeout();
    if (hasActiveMedia) {
      handleTogglePlayPause();
    }
  };

  return (
    <Card
      cornerLines={false}
      className={`p-0 overflow-hidden flex flex-col relative transition-all duration-300 ${isFullscreen
        ? 'fixed inset-0 z-[100] w-screen h-screen border-none bg-black rounded-none'
        : 'aspect-video min-h-[220px] sm:min-h-0 w-full bg-card'
        }`}
    >
      {/* Fullscreen Persistent Clock & Room Code HUD (Single semi-transparent box) */}
      {isFullscreen && !lyricsData.shouldShowLyrics && (
        <div className="absolute top-4 left-5 sm:top-6 sm:left-8 z-[110] pointer-events-none select-none">
          <div className="bg-black/90 border border-white/20 px-3 py-1.5 sm:px-4 sm:py-2 flex items-center gap-2.5 sm:gap-3 rounded-md">
            {/* Clock on the left */}
            <span className="font-display text-base sm:text-xl md:text-2xl font-semibold tracking-wider text-white/90 flex items-center">
              {clockTime.hours}
              <span className="text-white/40 animate-blink mx-0.5">:</span>
              {clockTime.minutes}
            </span>

            {/* Small divider and room code to the right */}
            {roomCode && (
              <>
                <div className="h-4.5 sm:h-6.5 w-[1px] bg-white/20 flex-shrink-0" />
                <div className="flex items-center gap-1.5 font-mono">
                  <span className="text-sm sm:text-lg md:text-xl font-bold tracking-widest text-primary leading-none">
                    {roomCode}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Main Video / Lyrics Player Area */}
      <div
        className={`flex-1 w-full ${hasActiveMedia ? 'bg-black' : 'bg-card'} relative flex items-center justify-center overflow-hidden h-full group ${hasActiveMedia ? 'cursor-pointer' : ''
          } ${isFullscreen && !isOverlayVisible ? 'cursor-none' : ''}`}
        onClick={handleVideoAreaClick}
        onMouseMove={handleMouseMove}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <div className="w-full h-full flex items-center justify-center relative">
          {hasActiveMedia ? (
            <>
              {/* YouTube player instance keeps audio playing continuously */}
              <YouTubePlayer
                url={roomState!.currentlyPlaying!}
                isPlaying={isPlaying && !isLocked}
                volume={displayVolume}
                muted={muted}
                isLoadingState={isLoadingState}
                onEnded={handlePlayNextInQueue}
                onPlayerInstance={handlePlayerInstance}
                onVideoReady={() => setIsVideoReady(true)}
                hidden={lyricsData.shouldShowLyrics}
              />

              {/* Syllable-synced Lyrics Views */}
              {lyricsData.shouldShowLyrics && (
                isFullscreen ? (
                  <FullscreenLyricsView
                    key={lyricsData.currentVideoId || 'lyrics-fs'}
                    lyrics={lyricsData.lyrics}
                    isLoading={lyricsData.isLoading}
                    status={lyricsData.status}
                    albumArt={lyricsData.albumArt}
                    trackTitle={lyricsData.trackTitle}
                    artistName={lyricsData.artistName}
                    dominantGradient={lyricsData.dominantColor.gradient}
                    sourceLabel={lyricsData.sourceLabel}
                    getCurrentTime={lyricsData.getCurrentTime}
                    isPlaying={isPlaying && !isLocked}
                    onSeek={lyricsData.seekTo}
                    clockTime={clockTime}
                    roomCode={roomCode}
                    lyricsOffsetMs={roomState?.lyricsOffsetMs ?? getSavedLyricsOffset()}
                    isWordSync={roomState?.lyricsWordSync ?? getSavedLyricsWordSync()}
                  />
                ) : (
                  <MediaBoxLyricsView
                    key={lyricsData.currentVideoId || 'lyrics-box'}
                    lyrics={lyricsData.lyrics}
                    isLoading={lyricsData.isLoading}
                    status={lyricsData.status}
                    albumArt={lyricsData.albumArt}
                    trackTitle={lyricsData.trackTitle}
                    artistName={lyricsData.artistName}
                    dominantGradient={lyricsData.dominantColor.gradient}
                    sourceLabel={lyricsData.sourceLabel}
                    getCurrentTime={lyricsData.getCurrentTime}
                    isPlaying={isPlaying && !isLocked}
                    onSeek={lyricsData.seekTo}
                    lyricsOffsetMs={roomState?.lyricsOffsetMs ?? getSavedLyricsOffset()}
                    isWordSync={roomState?.lyricsWordSync ?? getSavedLyricsWordSync()}
                  />
                )
              )}
            </>
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
