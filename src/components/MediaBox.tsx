import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useWatchParty } from '@/context/WatchPartyContext';
import { useTranslation } from '@/context/LanguageContext';
import { YouTubePlayer } from '@/components/YouTubePlayer';
import { Card } from '@/components/ui/card';
import { pad } from '@/lib/utils';
import { Tv, X, Copy, Check, ExternalLink, Smartphone, Clock, Minimize, Lock } from 'lucide-react';

export const MediaBox: React.FC = () => {
  const { t } = useTranslation();
  const {
    roomCode,
    roomState,
    muted,
    showQrModal,
    setShowQrModal,
    copiedLink,
    copyRemoteLink,
    remoteUrl,
    handlePlayNextInQueue,
    handleToggleFullscreen,
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

  const isPlaying = roomState?.playback?.status === 'playing';
  const volume = roomState?.playback?.volume ?? 80;
  const isFullscreen = Boolean(roomState?.isFullscreen);
  const isLocked = Boolean(roomState?.isLocked);

  return (
    <Card
      className={`p-0 overflow-hidden rounded-none border border-border bg-slate-950 flex flex-col relative transition-all duration-300 ${isFullscreen
        ? 'fixed inset-0 z-[100] w-screen h-screen border-none bg-black'
        : 'aspect-video w-full'
        }`}
    >
      {isFullscreen && (
        <div className="absolute top-4 left-4 z-[110] bg-black/80 border border-slate-800/80 backdrop-blur-md px-3.5 py-1.5 font-display text-base sm:text-5xl font-normal tracking-wider text-slate-100 opacity-80 hover:opacity-100 transition-opacity flex items-center gap-2 shadow-lg pointer-events-none select-none">
          <Clock className="w-4 h-4 text-primary" />
          <span>
            {clockTime.hours}
            <span className="text-primary opacity-80 animate-blink">:</span>
            {clockTime.minutes}
            <span className="text-primary opacity-80 animate-blink">:</span>
            {clockTime.seconds}
          </span>
        </div>
      )}

      {/* Main Video Player Area */}
      <div className="flex-1 w-full bg-black relative flex items-center justify-center overflow-hidden h-full">
        <div className={`w-full h-full flex items-center justify-center transition-all duration-500 ${isLocked ? 'blur-md opacity-40 scale-[1.02] pointer-events-none select-none' : ''
          }`}>
          {roomState?.currentlyPlaying ? (
            <YouTubePlayer
              url={roomState.currentlyPlaying}
              isPlaying={isPlaying && !isLocked}
              volume={volume}
              muted={muted}
              onEnded={handlePlayNextInQueue}
            />
          ) : (
            <div className="text-center p-6 flex flex-col items-center gap-3">
              <Tv className="w-12 h-12 text-slate-700 animate-pulse" />
              <p className="text-slate-400 text-sm font-mono max-w-sm">
                {roomCode
                  ? t('mediaBox.noVideoPlaying')
                  : t('mediaBox.watchPartyIdle')}
              </p>
            </div>
          )}
        </div>

        {/* Room Locked Screen Overlay */}
        {isLocked && (
          <div className="absolute inset-0 z-20 bg-slate-950/80 backdrop-blur-3xl flex flex-col items-center justify-center p-6 text-center select-none">
            <div className="flex flex-col items-center gap-3">
              <Lock className="w-12 h-12 text-slate-700 animate-pulse" />
              <p className="text-slate-400 text-sm font-mono max-w-sm">
                {t('mediaBox.roomLockedSubtitle')}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* QR Code Overlay Modal inside MediaBox */}
      {showQrModal && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-md z-30 flex items-center justify-center p-4">
          <div className="bg-surface border border-border p-6 max-w-sm w-full flex flex-col items-center gap-4 relative shadow-2xl overflow-hidden">
            {/* 30s Animated Timer Progress Line */}
            <div
              className="absolute top-0 left-0 h-1 bg-primary transition-all duration-1000 ease-linear"
              style={{ width: `${(secondsLeft / 30) * 100}%` }}
            />

            <button
              onClick={() => setShowQrModal(false)}
              className="absolute top-3 right-3 p-1 text-text-faint hover:text-text transition-colors cursor-pointer"
              title="Close QR Modal"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex flex-col items-center gap-1">
              <h3 className="text-sm font-bold uppercase tracking-wider text-text">{t('mediaBox.scanToRemote')}</h3>
            </div>

            <div className="p-3 bg-white border-4 border-primary">
              <QRCodeSVG value={remoteUrl} size={160} level="M" />
            </div>

            <div className="text-center flex flex-col gap-1 w-full">
              <span className="text-xs text-text-muted">{t('mediaBox.enterPinCode')}</span>
              <span className="font-mono text-3xl font-bold tracking-[0.2em] text-primary">
                {roomCode || '------'}
              </span>
            </div>

          </div>
        </div>
      )}
    </Card>
  );
};
