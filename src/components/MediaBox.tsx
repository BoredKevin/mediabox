import React, { useState, useEffect, useRef, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useWatchParty } from '@/context/WatchPartyContext';
import { useTranslation } from '@/context/LanguageContext';
import { YouTubePlayer } from '@/components/YouTubePlayer';
import { Card, Button, Slider } from '@boredkevin/ui';
import { pad } from '@/lib/utils';
import {
  MonitorOff,
  MonitorPause,
  X,
  Clock,
  Play,
  Pause,
  Volume2,
  Volume1,
  VolumeX,
  Maximize,
  Minimize,
} from 'lucide-react';

export const MediaBox: React.FC = () => {
  const { t } = useTranslation();
  const {
    roomCode,
    roomState,
    muted,
    setMuted,
    showQrModal,
    setShowQrModal,
    remoteUrl,
    handlePlayNextInQueue,
    handleTogglePlayPause,
    handleToggleFullscreen,
    handleAdjustVolume,
  } = useWatchParty();

  const [secondsLeft, setSecondsLeft] = useState<number>(30);

  // Live time display for top-right clock overlay in fullscreen
  const [clockTime, setClockTime] = useState(() => {
    const now = new Date();
    return {
      hours: pad(now.getHours()),
      minutes: pad(now.getMinutes()),
      seconds: pad(now.getSeconds()),
    };
  });

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      setClockTime({
        hours: pad(now.getHours()),
        minutes: pad(now.getMinutes()),
        seconds: pad(now.getSeconds()),
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Countdown timer display for QR modal auto-disappear
  useEffect(() => {
    if (showQrModal) {
      setSecondsLeft(30);
      const interval = setInterval(() => {
        setSecondsLeft((prev) => Math.max(0, prev - 1));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [showQrModal]);

  const [localFullscreen, setLocalFullscreen] = useState<boolean>(false);
  const isPlaying = roomState?.playback?.status === 'playing';
  const isFullscreen = roomCode ? Boolean(roomState?.isFullscreen) : localFullscreen;
  const isLocked = Boolean(roomState?.isLocked);

  // Slider drag states for smooth volume control
  const [localVolume, setLocalVolume] = useState<number | null>(null);
  const [isDraggingVolume, setIsDraggingVolume] = useState<boolean>(false);

  const displayVolume = isDraggingVolume && localVolume !== null
    ? localVolume
    : (localVolume ?? roomState?.playback?.volume ?? 80);

  // Sync local volume with incoming room state when not dragging
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

  const handleMouseMove = () => {
    resetControlsTimeout();
  };

  const handleMouseEnter = () => {
    resetControlsTimeout();
  };

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

  const handleVideoAreaClick = () => {
    if (isLocked) return;
    resetControlsTimeout();
    if (roomState?.currentlyPlaying) {
      handleTogglePlayPause();
    }
  };

  return (
    <Card
      cornerLines={false}
      className={`p-0 overflow-hidden flex flex-col relative transition-all duration-300 ${isFullscreen
        ? 'fixed inset-0 z-[100] w-screen h-screen border-none bg-black rounded-none'
        : 'aspect-video w-full bg-background'
        }`}
    >
      {isFullscreen && (
        <div className="absolute top-4 left-4 z-[110] bg-background/80 border border-border backdrop-blur-md px-3.5 py-1.5 font-display text-base sm:text-5xl font-normal tracking-wider text-foreground opacity-80 transition-opacity flex items-center gap-2 shadow-lg pointer-events-none select-none">
          <span>
            {clockTime.hours}
            <span className="text-primary opacity-80 animate-blink">:</span>
            {clockTime.minutes}
          </span>
        </div>
      )}


      {/* Main Video Player Area */}
      <div
        className={`flex-1 w-full bg-black relative flex items-center justify-center overflow-hidden h-full group cursor-pointer ${isFullscreen && !isOverlayVisible ? 'cursor-none' : ''
          }`}
        onClick={handleVideoAreaClick}
        onMouseMove={handleMouseMove}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <div className={`w-full h-full flex items-center justify-center transition-all duration-500 ${isLocked ? 'blur-md opacity-40 scale-[1.02] pointer-events-none select-none' : ''
          }`}>
          {roomState?.currentlyPlaying ? (
            <YouTubePlayer
              url={roomState.currentlyPlaying}
              isPlaying={isPlaying && !isLocked}
              volume={displayVolume}
              muted={muted}
              onEnded={handlePlayNextInQueue}
            />
          ) : (
            <div className="text-center p-6 flex flex-col items-center gap-3">
              {!roomCode || isLocked ? (
                <MonitorOff className="w-12 h-12 text-muted-foreground opacity-50" />
              ) : (
                <MonitorPause className="w-12 h-12 text-muted-foreground opacity-50" />
              )}
              <p className="text-muted-foreground text-sm font-mono max-w-sm">
                {roomCode
                  ? t('mediaBox.noVideoPlaying')
                  : t('mediaBox.watchPartyIdle')}
              </p>
            </div>
          )}
        </div>

        {/* Room Locked Screen Overlay */}
        {isLocked && (
          <div className="absolute inset-0 z-20 bg-background/80 backdrop-blur-3xl flex flex-col items-center justify-center p-6 text-center select-none pointer-events-none">
            <div className="flex flex-col items-center gap-3">
              <MonitorOff className="w-12 h-12 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground text-sm font-mono max-w-sm">
                {t('mediaBox.roomLockedSubtitle')}
              </p>
            </div>
          </div>
        )}

        {/* Overlay Player Controls for Playing State */}
        {roomState?.currentlyPlaying && !isLocked && (
          <div
            className={`absolute inset-x-0 bottom-0 z-30 p-2.5 sm:p-3.5 bg-gradient-to-t from-background/90 via-background/50 to-transparent flex items-center justify-between pointer-events-none transition-opacity duration-300 ${isOverlayVisible ? 'opacity-100' : 'opacity-0'
              }`}
          >
            {/* Left Controls: Play/Pause and Tactical Volume Control */}
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  handleTogglePlayPause();
                }}
                aria-label={isPlaying ? t('watchParty.pauseBtn') : t('watchParty.playBtn')}
                className="h-8 w-8 sm:h-9 sm:w-9 text-foreground hover:text-primary hover:bg-secondary/50 rounded-[var(--radius)] flex items-center justify-center pointer-events-auto transition-colors"
                title={isPlaying ? t('watchParty.pauseBtn') : t('watchParty.playBtn')}
              >
                {isPlaying ? (
                  <Pause className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />
                ) : (
                  <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-current ml-0.5" />
                )}
              </Button>

              {/* Volume HUD Control */}
              <div
                className="flex items-center gap-2 px-2.5 py-1 rounded-[var(--radius)] bg-background/70 border border-border/50 backdrop-blur-md pointer-events-auto shadow-sm"
                onClick={(e) => e.stopPropagation()}
              >
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setMuted((prev) => !prev)}
                  aria-label={muted ? 'Unmute' : 'Mute'}
                  className="h-7 w-7 text-foreground hover:text-primary transition-colors"
                  title={muted ? 'Unmute' : 'Mute'}
                >
                  {muted || displayVolume === 0 ? (
                    <VolumeX className="w-4 h-4 text-destructive" />
                  ) : displayVolume > 50 ? (
                    <Volume2 className="w-4 h-4" />
                  ) : (
                    <Volume1 className="w-4 h-4" />
                  )}
                </Button>

                <Slider
                  value={[muted ? 0 : displayVolume]}
                  min={0}
                  max={100}
                  step={1}
                  disabled={isLocked}
                  onValueChange={handleVolumeValueChange}
                  onValueCommit={handleVolumeValueCommit}
                  aria-label="Volume slider"
                  className="w-16 sm:w-24 cursor-pointer py-1"
                />

                <span className="font-mono text-[11px] font-bold text-muted-foreground w-7 text-right select-none">
                  {muted ? 0 : displayVolume}%
                </span>
              </div>
            </div>

            {/* Right Controls: Fullscreen */}
            <div className="flex items-center">
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleFullscreen();
                }}
                aria-label={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                className="h-8 w-8 sm:h-9 sm:w-9 text-foreground hover:text-primary hover:bg-secondary/50 rounded-[var(--radius)] flex items-center justify-center pointer-events-auto transition-colors"
                title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
              >
                {isFullscreen ? (
                  <Minimize className="w-4 h-4 sm:w-5 sm:h-5" />
                ) : (
                  <Maximize className="w-4 h-4 sm:w-5 sm:h-5" />
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Overlay Fullscreen Button for Idle or Locked State */}
        {(!roomState?.currentlyPlaying || isLocked) && (
          <div className="absolute bottom-2.5 right-2.5 sm:bottom-3 sm:right-3 z-30 pointer-events-auto">
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                toggleFullscreen();
              }}
              aria-label={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
              className="h-8 w-8 sm:h-9 sm:w-9 text-muted-foreground hover:text-foreground hover:bg-secondary/50 rounded-[var(--radius)] flex items-center justify-center transition-colors"
              title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            >
              {isFullscreen ? (
                <Minimize className="w-4 h-4 sm:w-5 sm:h-5" />
              ) : (
                <Maximize className="w-4 h-4 sm:w-5 sm:h-5" />
              )}
            </Button>
          </div>
        )}
      </div>

      {/* QR Code Overlay Modal inside MediaBox */}
      {showQrModal && (
        <div className="absolute inset-0 bg-black/85 backdrop-blur-md z-30 flex items-center justify-center p-4 animate-in fade-in-0 duration-200">
          <Card
            cornerLines
            className="p-6 max-w-sm w-full flex flex-col items-center gap-4 relative shadow-2xl overflow-hidden bg-card border-border"
          >
            {/* 30s Animated Timer Progress Line */}
            <div
              className="absolute top-0 left-0 h-1 bg-primary/50 transition-all duration-1000 ease-linear"
              style={{ width: `${(secondsLeft / 30) * 100}%` }}
            />

            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowQrModal(false)}
              className="absolute top-3 right-3 h-8 w-8 text-muted-foreground hover:text-foreground"
              title="Close QR Modal"
            >
              <X className="w-5 h-5" />
            </Button>

            <div className="flex flex-col items-center gap-1">
              <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">{t('mediaBox.scanToRemote')}</h3>
            </div>

            <div className="p-3 bg-white border-4 border-primary">
              <QRCodeSVG value={remoteUrl} size={160} level="M" />
            </div>

            <div className="text-center flex flex-col gap-1 w-full">
              <span className="text-xs text-muted-foreground">{t('mediaBox.enterPinCode')}</span>
              <span className="font-mono text-3xl font-bold tracking-[0.2em] text-primary">
                {roomCode || '------'}
              </span>
            </div>
          </Card>
        </div>
      )}

    </Card>
  );
};

