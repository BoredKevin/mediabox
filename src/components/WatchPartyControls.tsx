import React, { useState } from 'react';
import { useWatchParty } from '@/context/WatchPartyContext';
import { useTranslation } from '@/context/LanguageContext';
import {
  Tv,
  QrCode,
  Users,
  Play,
  Pause,
  SkipForward,
  Volume2,
  VolumeX,
  Plus,
  Trash2,
  Loader2,
  ExternalLink,
  Smartphone,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

export const WatchPartyControls: React.FC = () => {
  const { t } = useTranslation();
  const {
    roomCode,
    roomState,
    queue,
    memberCount,
    creating,
    showQrModal,
    setShowQrModal,
    muted,
    setMuted,
    remoteUrl,
    handleCreateRoom,
    handleEndRoom,
    handleTogglePlayPause,
    handlePlayNextInQueue,
    handleRemoveQueueItem,
    handleAddUrlHost,
  } = useWatchParty();

  const [manualUrlInput, setManualUrlInput] = useState<string>('');
  const [showQueueDrawer, setShowQueueDrawer] = useState<boolean>(false);

  const isPlaying = roomState?.playback?.status === 'playing';

  const onSubmitUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await handleAddUrlHost(manualUrlInput);
    if (success) {
      setManualUrlInput('');
    }
  };

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
    <div className="flex flex-col justify-between h-full gap-3 p-1">
      {/* Top Controls Row */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-2">
          {/* Room Code Badge */}
          <span className="px-3 py-1.5 bg-slate-900/90 border border-slate-800 font-mono text-[#00c8d4] font-bold tracking-wider text-xs sm:text-sm flex items-center gap-2 shadow-sm">
            <span className="w-2.5 h-2.5 rounded-full bg-[#00c8d4] animate-ping" />
            {t('watchParty.roomBadge')}: {roomCode}
          </span>

          {/* QR Code Toggle Button */}
          <button
            onClick={() => setShowQrModal(!showQrModal)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-none border text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
              showQrModal
                ? 'bg-[#00c8d4] text-slate-950 border-[#00c8d4] shadow-[0_0_15px_rgba(0,200,212,0.4)]'
                : 'bg-slate-900 hover:bg-slate-800 text-slate-200 border-slate-800'
            }`}
            title={t('watchParty.qrCodeBtn')}
          >
            <QrCode className={`w-4 h-4 ${showQrModal ? 'text-slate-950' : 'text-[#00c8d4]'}`} />
            <span>{t('watchParty.qrCodeBtn')}</span>
          </button>

          {/* Open Remote Button */}
          <a
            href={remoteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 text-xs sm:text-sm font-semibold transition-colors"
            title={t('watchParty.openRemoteBtn')}
          >
            <Smartphone className="w-4 h-4 text-[#00c8d4]" />
            <span>{t('watchParty.openRemoteBtn')}</span>
            <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
          </a>
        </div>

        <div className="flex items-center gap-2">
          {/* Member Counter */}
          <span className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 border border-slate-800 text-slate-300 text-xs sm:text-sm font-semibold">
            <Users className="w-4 h-4 text-[#00c8d4]" />
            <span className="font-mono">{memberCount}</span>
          </span>

          {/* End Room Button */}
          <button
            onClick={handleEndRoom}
            className="px-3 py-1.5 bg-red-950/80 hover:bg-red-900 border border-red-800/80 text-red-200 text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
          >
            {t('watchParty.endRoomBtn')}
          </button>
        </div>
      </div>

      {/* Bottom Player Controls & Quick Add Row */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-slate-800">
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Play/Pause */}
          <button
            onClick={handleTogglePlayPause}
            className="p-2.5 sm:p-3 bg-[#00c8d4] hover:bg-[#00b0bd] text-slate-950 transition-all shadow-[0_0_12px_rgba(0,200,212,0.25)] cursor-pointer"
            title={isPlaying ? t('watchParty.pauseBtn') : t('watchParty.playBtn')}
          >
            {isPlaying ? (
              <Pause className="w-4 h-4 sm:w-5 sm:h-5 fill-slate-950" />
            ) : (
              <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-slate-950" />
            )}
          </button>

          {/* Skip Next */}
          <button
            onClick={handlePlayNextInQueue}
            className="p-2.5 sm:p-3 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 transition-colors cursor-pointer"
            title={t('watchParty.skipNextBtn')}
          >
            <SkipForward className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>

          {/* Mute Toggle */}
          <button
            onClick={() => setMuted(!muted)}
            className="p-2.5 sm:p-3 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 transition-colors cursor-pointer"
            title={muted ? t('watchParty.unmuteBtn') : t('watchParty.muteBtn')}
          >
            {muted ? (
              <VolumeX className="w-4 h-4 sm:w-5 sm:h-5 text-red-400" />
            ) : (
              <Volume2 className="w-4 h-4 sm:w-5 sm:h-5 text-[#00c8d4]" />
            )}
          </button>
        </div>

        {/* Quick Add YT URL Form */}
        <form onSubmit={onSubmitUrl} className="flex-1 flex gap-1.5 min-w-[200px]">
          <input
            type="url"
            value={manualUrlInput}
            onChange={(e) => setManualUrlInput(e.target.value)}
            placeholder={t('watchParty.addYtPlaceholder')}
            className="flex-1 px-3 py-2 bg-slate-900 border border-slate-800 text-slate-200 text-xs sm:text-sm focus:outline-none focus:border-[#00c8d4]"
          />
          <button
            type="submit"
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center justify-center cursor-pointer transition-colors"
            title={t('watchParty.addYtSubmitTitle')}
          >
            <Plus className="w-4 h-4" />
          </button>
        </form>

        {/* Queue Toggle Button */}
        <button
          onClick={() => setShowQueueDrawer(!showQueueDrawer)}
          className={`flex items-center gap-1.5 px-3 py-2 border transition-colors text-xs sm:text-sm font-mono cursor-pointer ${
            queue.length > 0
              ? 'bg-slate-900 border-[#00c8d4]/50 text-[#00c8d4]'
              : 'bg-slate-900 border-slate-800 text-slate-400'
          }`}
        >
          <span>{t('watchParty.queueBtn')} ({queue.length})</span>
          {showQueueDrawer ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {/* Queue Drawer list if toggled */}
      {showQueueDrawer && (
        <div className="bg-slate-950 border border-slate-800 p-2 max-h-36 overflow-y-auto flex flex-col gap-1.5 z-30 rounded-none shadow-xl mt-1">
          {queue.length === 0 ? (
            <span className="text-xs text-slate-500 font-mono text-center py-2">{t('watchParty.queueEmpty')}</span>
          ) : (
            queue.map((item, idx) => (
              <div
                key={item.id}
                className="flex items-center justify-between text-xs font-mono text-slate-300 px-2.5 py-1 bg-slate-900 border border-slate-800"
              >
                <span className="truncate flex-1">
                  <strong className="text-[#00c8d4]">#{idx + 1}</strong> {item.url}
                </span>
                <button
                  onClick={() => handleRemoveQueueItem(item.id)}
                  className="text-slate-500 hover:text-red-400 ml-2 p-1 cursor-pointer"
                  title={t('watchParty.removeFromQueue')}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
