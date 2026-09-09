import React, { useState } from 'react';
import { useWatchParty } from '@/context/WatchPartyContext';
import { useTranslation } from '@/context/LanguageContext';
import { Button, Badge } from '@boredkevin/ui';
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
  Search,
  LogOut,
} from 'lucide-react';
import { TvSearchModal } from '@/components/TvSearchModal';

export const WatchPartyControls: React.FC = () => {
  const { t } = useTranslation();
  const [showSearchModal, setShowSearchModal] = useState<boolean>(false);
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
        <div className="flex items-center gap-2 text-foreground">
          <Tv className="w-6 h-6 text-primary" />
          <h3 className="text-base font-bold tracking-wider uppercase">{t('watchParty.title')}</h3>
        </div>
        <p className="text-xs text-muted-foreground max-w-none text-center whitespace-normal sm:whitespace-nowrap px-2">
          {t('watchParty.desc')}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3 mt-1">
          <Button
            variant="cyber"
            chamfer="dual"
            onClick={handleCreateRoom}
            disabled={creating}
            className="px-5 py-2.5 font-bold uppercase tracking-wider text-xs sm:text-sm flex items-center gap-2 shadow-[0_0_20px_rgba(0,200,212,0.3)] cursor-pointer"
          >
            {creating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{t('watchParty.creatingRoom')}</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current" />
                <span>{t('watchParty.createRoom')}</span>
              </>
            )}
          </Button>

          <a
            href={remoteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2.5 bg-card hover:bg-muted/40 border border-border text-foreground text-xs sm:text-sm font-semibold uppercase tracking-wider flex items-center gap-2 transition-colors"
          >
            <Smartphone className="w-4 h-4 text-primary" />
            <span>{t('watchParty.openRemoteUI')}</span>
            <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col justify-center h-full w-full gap-2 overflow-hidden">
      {/* Active Room Controls Bar - All items fill full container height in a single inline row */}
      <div className="flex items-stretch justify-between gap-1 sm:gap-1.5 md:gap-2 min-h-[44px] sm:min-h-[50px] w-full flex-nowrap">
        {/* Left Section: Room Code Badge, QR Code, Play/Pause, Skip, Lock, Sparkles, Search */}
        <div className="flex items-stretch gap-1 sm:gap-1.5 flex-1 min-w-0">
          {/* Room Code Badge */}
          <div className="px-2 sm:px-2.5 md:px-3 py-1 sm:py-1.5 bg-card border border-border font-mono text-primary font-bold tracking-wider flex items-center gap-1 shadow-sm justify-center select-none flex-shrink-0">
            <div className="flex flex-col justify-center leading-tight">
              <span className="text-[8px] sm:text-[9px] uppercase text-muted-foreground font-sans tracking-widest font-semibold hidden min-[480px]:block">{t('watchParty.roomBadge')}</span>
              <span className="text-xs sm:text-sm md:text-base lg:text-lg tracking-wider font-black text-primary">{roomCode}</span>
            </div>
          </div>

          {/* QR Code Toggle Button */}
          <Button
            variant={showQrModal ? 'cyber' : 'outline'}
            chamfer="top-right"
            onClick={() => setShowQrModal(!showQrModal)}
            className="flex-1 min-w-[32px] sm:min-w-[36px] max-w-[48px] px-1 sm:px-2 py-1 sm:py-1.5 flex items-center justify-center h-auto"
            title={t('watchParty.qrCodeBtn')}
          >
            <QrCode className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0 text-primary" />
          </Button>

          {/* Play/Pause Button */}
          <Button
            variant="cyber"
            chamfer="dual"
            onClick={handleTogglePlayPause}
            disabled={isLocked}
            className="flex-1 min-w-[32px] sm:min-w-[36px] max-w-[48px] px-1 sm:px-2 py-1 sm:py-1.5 flex items-center justify-center h-auto"
            title={isPlaying ? t('watchParty.pauseBtn') : t('watchParty.playBtn')}
          >
            {isPlaying ? (
              <Pause className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />
            ) : (
              <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />
            )}
          </Button>

          {/* Skip Next Button */}
          <Button
            variant="outline"
            chamfer="dual"
            onClick={handlePlayNextInQueue}
            disabled={isLocked}
            className="flex-1 min-w-[32px] sm:min-w-[36px] max-w-[48px] px-1 sm:px-2 py-1 sm:py-1.5 flex items-center justify-center h-auto"
            title={t('watchParty.skipNextBtn')}
          >
            <SkipForward className="w-4 h-4 sm:w-5 sm:h-5" />
          </Button>

          {/* Lock Room Toggle Button */}
          <Button
            variant={isLocked ? 'destructive' : 'outline'}
            chamfer="top-right"
            onClick={handleToggleRoomLock}
            className={`flex-1 min-w-[32px] sm:min-w-[36px] max-w-[48px] px-1 sm:px-2 py-1 sm:py-1.5 flex items-center justify-center h-auto ${isLocked ? 'border-amber-500 text-amber-500 bg-amber-500/10' : ''
              }`}
            title={isLocked ? t('watchParty.unlockBtn') : t('watchParty.lockBtn')}
          >
            {isLocked ? (
              <Lock className="w-4 h-4 sm:w-5 sm:h-5 text-amber-500" />
            ) : (
              <Unlock className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
            )}
          </Button>

          {/* Autoplay Toggle Button */}
          <Button
            variant={roomState?.isAutoplay ? 'cyber' : 'outline'}
            chamfer="top-right"
            onClick={handleToggleAutoplay}
            className={`flex-1 min-w-[32px] sm:min-w-[36px] max-w-[48px] px-1 sm:px-2 py-1 sm:py-1.5 flex items-center justify-center h-auto ${roomState?.isAutoplay ? 'border-purple-500 text-purple-400 bg-purple-500/10' : ''
              }`}
            title="Toggle Autoplay (Last.fm recommendation)"
          >
            <Sparkles className={`w-4 h-4 sm:w-5 sm:h-5 ${roomState?.isAutoplay ? 'text-purple-400' : 'text-muted-foreground'}`} />
          </Button>

          {/* Search / Add to Queue Button */}
          <Button
            variant="outline"
            chamfer="top-right"
            onClick={() => setShowSearchModal(true)}
            className="flex-1 min-w-[32px] sm:min-w-[36px] max-w-[48px] px-1 sm:px-2 py-1 sm:py-1.5 flex items-center justify-center h-auto"
            title={t('watchParty.searchBtn')}
          >
            <Search className="w-4 h-4 sm:w-5 sm:h-5 text-primary flex-shrink-0" />
          </Button>
        </div>

        {/* Right Section: Participant Number, End Room */}
        <div className="flex items-stretch gap-1 sm:gap-1.5 flex-shrink-0">
          {/* Member Counter */}
          <Badge variant="outline" className="flex items-center justify-center gap-1 px-2 sm:px-2.5 py-1 sm:py-1.5 bg-card text-foreground text-xs font-semibold flex-shrink-0 rounded-none">
            <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary flex-shrink-0" />
            <span className="font-mono">{memberCount}</span>
          </Badge>

          {/* Leave Room Button */}
          <Button
            variant="destructive"
            chamfer="dual"
            onClick={handleEndRoom}
            className="min-w-[32px] sm:min-w-[36px] max-w-[48px] px-1.5 sm:px-2 py-1 sm:py-1.5 flex items-center justify-center flex-shrink-0 h-auto"
            title="Leave Room"
          >
            <LogOut className="w-4 h-4 sm:w-5 sm:h-5" />
          </Button>
        </div>
      </div>

      {/* TV Search & Add Video Modal */}
      <TvSearchModal
        open={showSearchModal}
        onOpenChange={setShowSearchModal}
      />
    </div>
  );
};

