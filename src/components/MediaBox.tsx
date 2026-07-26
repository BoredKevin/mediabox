import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useWatchParty } from '@/context/WatchPartyContext';
import { useTranslation } from '@/context/LanguageContext';
import { YouTubePlayer } from '@/components/YouTubePlayer';
import { Card } from '@/components/ui/card';
import { pad } from '@/lib/utils';
import { Tv, X, Copy, Check, ExternalLink, Smartphone, Clock, Minimize } from 'lucide-react';

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

  return (
    <Card
      className={`p-0 overflow-hidden rounded-none border border-slate-800 bg-slate-950 flex flex-col relative transition-all duration-300 ${isFullscreen
        ? 'fixed inset-0 z-[100] w-screen h-screen border-none bg-black'
        : 'aspect-video w-full'
        }`}
    >
      {isFullscreen && (
        <div className="absolute top-4 left-4 z-[110] bg-slate-950/80 border border-slate-800/80 backdrop-blur-md px-3.5 py-1.5 font-display text-base sm:text-5xl font-normal tracking-wider text-slate-100 opacity-80 hover:opacity-100 transition-opacity flex items-center gap-2 shadow-lg pointer-events-none select-none">
          <Clock className="w-4 h-4 text-[#00c8d4]" />
          <span>
            {clockTime.hours}
            <span className="text-[#00c8d4] opacity-80 animate-blink">:</span>
            {clockTime.minutes}
            <span className="text-[#00c8d4] opacity-80 animate-blink">:</span>
            {clockTime.seconds}
          </span>
        </div>
      )}

      {/* Main Video Player Area */}
      <div className="flex-1 w-full bg-black relative flex items-center justify-center overflow-hidden h-full">
        {roomState?.currentlyPlaying ? (
          <YouTubePlayer
            url={roomState.currentlyPlaying}
            isPlaying={isPlaying}
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

      {/* QR Code Overlay Modal inside MediaBox */}
      {showQrModal && (
        <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md z-30 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 p-6 max-w-sm w-full flex flex-col items-center gap-4 relative shadow-2xl overflow-hidden">
            {/* 30s Animated Timer Progress Line */}
            <div
              className="absolute top-0 left-0 h-1 bg-[#00c8d4] transition-all duration-1000 ease-linear"
              style={{ width: `${(secondsLeft / 30) * 100}%` }}
            />

            <button
              onClick={() => setShowQrModal(false)}
              className="absolute top-3 right-3 p-1 text-slate-400 hover:text-slate-100 transition-colors cursor-pointer"
              title="Close QR Modal"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex flex-col items-center gap-1">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-100">{t('mediaBox.scanToRemote')}</h3>
            </div>

            <div className="p-3 bg-white border-4 border-[#00c8d4]">
              <QRCodeSVG value={remoteUrl} size={160} level="M" />
            </div>

            <div className="text-center flex flex-col gap-1 w-full">
              <span className="text-xs text-slate-400">{t('mediaBox.enterPinCode')}</span>
              <span className="font-mono text-3xl font-bold tracking-[0.2em] text-[#00c8d4]">
                {roomCode || '------'}
              </span>
            </div>

            <div className="flex flex-col gap-2 w-full">
              <a
                href={remoteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-2 bg-[#00c8d4] hover:bg-[#00b0bd] text-slate-950 font-bold uppercase tracking-wider text-xs flex items-center justify-center gap-2 transition-colors"
              >
                <Smartphone className="w-4 h-4" />
                <span>{t('mediaBox.openRemoteNewTab')}</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>

              <button
                onClick={copyRemoteLink}
                className="w-full py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs text-slate-200 flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                {copiedLink ? (
                  <Check className="w-4 h-4 text-emerald-400" />
                ) : (
                  <Copy className="w-4 h-4 text-[#00c8d4]" />
                )}
                <span>{copiedLink ? t('mediaBox.linkCopied') : t('mediaBox.copyRemoteLink')}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
};
