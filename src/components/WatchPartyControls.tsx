import React from 'react';
import { useWatchParty } from '@/context/WatchPartyContext';
import { useTranslation } from '@/context/LanguageContext';
import {
  Tv,
  QrCode,
  Users,
  Play,
  Pause,
  SkipForward,
  Loader2,
  ExternalLink,
  Smartphone,
  Lock,
  Unlock,
  Sparkles,
} from 'lucide-react';

export const WatchPartyControls: React.FC = () => {
  const { t } = useTranslation();
  const {
    roomCode,
    memberCount,
    creating,
    showQrModal,
    setShowQrModal,
    remoteUrl,
    handleCreateRoom,
    handleEndRoom,
    handleTogglePlayPause,
    handlePlayNextInQueue,
    handleToggleRoomLock,
    handleToggleAutoplay,
    roomState,
  } = useWatchParty();

  const isPlaying = roomState?.playback?.status === 'playing';
  const isLocked = Boolean(roomState?.isLocked);

  // If no active room, render initial "Create Room" prompt
  if (!roomCode) {
    return (
      <div className="flex flex-col items-center justify-center text-center h-full gap-3 py-2">
        <div className="flex items-center gap-2 text-slate-200">
          <Tv className="w-6 h-6 text-[#00c8d4]" />
          <h3 className="text-base font-bold tracking-wider uppercase">{t('watchParty.title')}</h3>
        </div>
        <p className="text-xs text-slate-400 max-w-sm">
          {t('watchParty.desc')}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3 mt-1">
          <button
            onClick={handleCreateRoom}
            disabled={creating}
            className="px-5 py-2.5 bg-[#00c8d4] hover:bg-[#00b0bd] text-slate-950 font-bold uppercase tracking-wider text-xs sm:text-sm transition-all disabled:opacity-50 flex items-center gap-2 shadow-[0_0_20px_rgba(0,200,212,0.3)] cursor-pointer"
          >
            {creating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{t('watchParty.creatingRoom')}</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-slate-950" />
                <span>{t('watchParty.createRoom')}</span>
              </>
            )}
          </button>

          <a
            href={remoteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs sm:text-sm font-semibold uppercase tracking-wider flex items-center gap-2 transition-colors"
          >
            <Smartphone className="w-4 h-4 text-[#00c8d4]" />
            <span>{t('watchParty.openRemoteUI')}</span>
            <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col justify-center h-full w-full gap-2 overflow-hidden">
      {/* Active Room Controls Bar - All items fill full container height in a single inline row */}
      <div className="flex items-stretch justify-between gap-1 sm:gap-1.5 md:gap-2.5 min-h-[48px] sm:min-h-[56px] w-full flex-nowrap">
        {/* Left Section: Big Room Code, QR Code, Pause, Skip, Lock, Sparkles */}
        <div className="flex items-stretch gap-1 sm:gap-1.5 md:gap-2 flex-nowrap min-w-0">
          {/* Big Room Code Badge */}
          <div className="px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 bg-slate-900/90 border border-slate-800 font-mono text-[#00c8d4] font-bold tracking-wider flex items-center gap-1.5 sm:gap-2.5 shadow-sm justify-center select-none flex-shrink-0">
            <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-[#00c8d4] animate-ping flex-shrink-0" />
            <div className="flex flex-col justify-center leading-tight">
              <span className="text-[9px] sm:text-[10px] uppercase text-slate-400 font-sans tracking-widest font-semibold hidden min-[400px]:block">{t('watchParty.roomBadge')}</span>
              <span className="text-xs sm:text-base md:text-xl tracking-wider sm:tracking-widest font-black text-[#00c8d4]">{roomCode}</span>
            </div>
          </div>

          {/* QR Code Toggle Button */}
          <button
            onClick={() => setShowQrModal(!showQrModal)}
            className={`flex items-center justify-center gap-1.5 px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 border text-xs sm:text-sm font-semibold transition-all cursor-pointer flex-shrink-0 ${showQrModal
              ? 'bg-[#00c8d4] text-slate-950 border-[#00c8d4] shadow-[0_0_15px_rgba(0,200,212,0.4)]'
              : 'bg-slate-900 hover:bg-slate-800 text-slate-200 border-slate-800'
              }`}
            title={t('watchParty.qrCodeBtn')}
          >
            <QrCode className={`w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0 ${showQrModal ? 'text-slate-950' : 'text-[#00c8d4]'}`} />
            <span className="hidden min-[1350px]:inline truncate">{t('watchParty.qrCodeBtn')}</span>
          </button>

          {/* Play/Pause Button */}
          <button
            onClick={handleTogglePlayPause}
            disabled={isLocked}
            className="px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 bg-[#00c8d4] hover:bg-[#00b0bd] text-slate-950 transition-all shadow-[0_0_12px_rgba(0,200,212,0.25)] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center flex-shrink-0"
            title={isPlaying ? t('watchParty.pauseBtn') : t('watchParty.playBtn')}
          >
            {isPlaying ? (
              <Pause className="w-4 h-4 sm:w-5 sm:h-5 fill-slate-950" />
            ) : (
              <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-slate-950" />
            )}
          </button>

          {/* Skip Next Button */}
          <button
            onClick={handlePlayNextInQueue}
            disabled={isLocked}
            className="px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center flex-shrink-0"
            title={t('watchParty.skipNextBtn')}
          >
            <SkipForward className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>

          {/* Lock Room Toggle Button */}
          <button
            onClick={handleToggleRoomLock}
            className={`flex items-center justify-center gap-1.5 px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 border text-xs sm:text-sm font-semibold transition-all cursor-pointer flex-shrink-0 ${isLocked
              ? 'bg-amber-950/90 border-amber-500 text-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.4)]'
              : 'bg-slate-900 hover:bg-slate-800 text-slate-200 border-slate-800'
              }`}
            title={isLocked ? t('watchParty.unlockBtn') : t('watchParty.lockBtn')}
          >
            {isLocked ? (
              <Lock className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" />
            ) : (
              <Unlock className="w-4 h-4 sm:w-5 sm:h-5 text-slate-400" />
            )}
          </button>

          {/* Autoplay Toggle Button */}
          <button
            onClick={handleToggleAutoplay}
            className={`flex items-center justify-center gap-1.5 px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 border text-xs sm:text-sm font-semibold transition-all cursor-pointer flex-shrink-0 ${roomState?.isAutoplay
              ? 'bg-purple-950/90 border-purple-500 text-purple-300 shadow-[0_0_15px_rgba(168,85,247,0.4)]'
              : 'bg-slate-900 hover:bg-slate-800 text-slate-200 border-slate-800'
              }`}
            title="Toggle Autoplay (Last.fm recommendation)"
          >
            <Sparkles className={`w-4 h-4 sm:w-5 sm:h-5 ${roomState?.isAutoplay ? 'text-purple-300 animate-pulse' : 'text-slate-400'}`} />
          </button>
        </div>

        {/* Right Section: Participant Number, End Room */}
        <div className="flex items-stretch gap-1 sm:gap-1.5 md:gap-2 flex-shrink-0">
          {/* Member Counter */}
          <span className="flex items-center justify-center gap-1 sm:gap-1.5 px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 bg-slate-900 border border-slate-800 text-slate-300 text-xs sm:text-sm font-semibold flex-shrink-0">
            <Users className="w-4 h-4 text-[#00c8d4]" />
            <span className="font-mono">{memberCount}</span>
          </span>

          {/* End Room Button */}
          <button
            onClick={handleEndRoom}
            className="px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 bg-red-950/80 hover:bg-red-900 border border-red-800/80 text-red-200 text-[10px] sm:text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer flex items-center justify-center flex-shrink-0 whitespace-nowrap"
          >
            {t('watchParty.endRoomBtn')}
          </button>
        </div>
      </div>
    </div>
  );
};
