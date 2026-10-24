import React from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume1,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Sparkles,
  Mic2,
  Loader2,
  Hourglass,
} from 'lucide-react';
import { useTranslation } from '@/context/LanguageContext';
import { cn } from '@/lib/utils';

interface NowPlayingDesktopControlsProps {
  isPlaying: boolean;
  isLoading?: boolean;
  isLocked: boolean;
  isHostOrAdmin: boolean;
  hasRequestedApproval?: boolean;
  onRequestApproval?: () => Promise<void>;
  isAutoplay?: boolean;
  isFullscreen?: boolean;
  fullscreenCooldown: boolean;
  displayVolume: number;
  isLyricsActive?: boolean;
  onToggleAutoplay: () => Promise<void>;
  onToggleFullscreenClick: () => void;
  onToggleLyrics?: () => void;
  onPreviousTrack: () => Promise<void>;
  onTogglePlayPause: () => Promise<void>;
  onNextTrack: () => Promise<void>;
  handleVolumeValueChange: (val: number[]) => void;
  handleVolumeValueCommit: (val: number[]) => void;
}

export const NowPlayingDesktopControls: React.FC<NowPlayingDesktopControlsProps> = ({
  isPlaying,
  isLoading = false,
  isLocked,
  isHostOrAdmin,
  hasRequestedApproval = false,
  onRequestApproval,
  isAutoplay,
  isFullscreen,
  fullscreenCooldown,
  displayVolume,
  isLyricsActive = false,
  onToggleAutoplay,
  onToggleFullscreenClick,
  onToggleLyrics,
  onPreviousTrack,
  onTogglePlayPause,
  onNextTrack,
  handleVolumeValueChange,
  handleVolumeValueCommit,
}) => {
  const { t } = useTranslation();

  // Clean member controls when playback is locked
  if (isLocked) {
    return (
      <div className="hidden lg:flex items-center justify-between gap-4 w-full">
        {/* Left: Small Fullscreen & Lyrics Buttons */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            chamfer="top-right"
            onClick={onToggleFullscreenClick}
            disabled={fullscreenCooldown}
            className={cn(
              "h-9 px-2.5 text-xs font-mono uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer",
              isFullscreen
                ? "border-primary bg-primary/15 text-primary hover:bg-primary/20 shadow-[0_0_10px_rgba(255,255,255,0.08)]"
                : "text-muted-foreground hover:text-foreground"
            )}
            title={isFullscreen ? t('remote.exitFullscreen') : t('remote.fullscreenTv')}
          >
            {isFullscreen ? <Minimize className="w-3.5 h-3.5 text-primary" /> : <Maximize className="w-3.5 h-3.5 text-foreground/80" />}
            <span>{isFullscreen ? t('remote.exitFullscreen') : t('remote.fullscreenTv')}</span>
          </Button>

          {onToggleLyrics && (
            <Button
              variant="outline"
              size="sm"
              chamfer="top-right"
              onClick={onToggleLyrics}
              className={cn(
                "h-9 px-3 text-xs font-mono uppercase tracking-wider flex items-center gap-1.5 cursor-pointer transition-colors",
                isLyricsActive
                  ? "border-primary bg-primary/15 text-primary hover:bg-primary/20 shadow-[0_0_12px_rgba(255,255,255,0.1)]"
                  : "text-muted-foreground hover:text-foreground"
              )}
              title={isLyricsActive ? (t('remote.hideLyricsBtn') || 'Hide Lyrics') : (t('remote.lyricsBtn') || 'Lyrics')}
              aria-label={isLyricsActive ? (t('remote.hideLyricsBtn') || 'Hide Lyrics') : (t('remote.lyricsBtn') || 'Lyrics')}
            >
              <Mic2 className={cn("w-3.5 h-3.5", isLyricsActive ? "text-primary" : "text-muted-foreground")} />
              <span>{isLyricsActive ? (t('remote.hideLyricsBtn') || 'Hide Lyrics') : (t('remote.lyricsBtn') || 'Lyrics')}</span>
            </Button>
          )}
        </div>

        {/* Center / Right: Big 'Ask for Control' button */}
        {onRequestApproval && (
          <Button
            variant={hasRequestedApproval ? "outline" : "cyber"}
            chamfer="dual"
            onClick={onRequestApproval}
            disabled={hasRequestedApproval}
            className={cn(
              "h-10 px-6 font-bold text-xs flex items-center gap-2 cursor-pointer min-w-[200px]",
              hasRequestedApproval ? "text-amber-400/90 border-amber-500/40 bg-amber-500/10 cursor-default" : ""
            )}
            title={hasRequestedApproval ? t('remote.requestSentToast') : t('remote.askForControlBtn')}
          >
            {hasRequestedApproval ? (
              <>
                <Hourglass className="w-4 h-4 text-amber-400 animate-pulse flex-shrink-0" />
                <span className="font-mono font-bold text-xs">{t('remote.requestSentBtn')}</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-amber-400 flex-shrink-0" />
                <span className="font-mono font-bold text-xs">{t('remote.askForControlBtn')}</span>
              </>
            )}
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="hidden lg:grid grid-cols-[1fr_auto_1fr] items-center gap-4 w-full">
      {/* Desktop Left: Autoplay, Lyrics Toggle */}
      <div className="flex items-center gap-2 justify-start min-w-0">
        <Button
          variant="outline"
          size="sm"
          chamfer="top-right"
          onClick={onToggleAutoplay}
          disabled={isLocked}
          className={cn(
            "h-9 px-3 text-xs font-mono uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer",
            isAutoplay
              ? "border-purple-500/70 bg-purple-500/15 text-purple-300 hover:bg-purple-500/25 shadow-[0_0_12px_rgba(168,85,247,0.2)]"
              : "text-muted-foreground hover:text-foreground"
          )}
          title={`${t('remote.autoplayMode')}: ${isAutoplay ? t('remote.autoplayOn') : t('remote.autoplayOff')}`}
        >
          <Sparkles className={cn("w-3.5 h-3.5", isAutoplay ? "text-purple-300" : "text-muted-foreground")} />
          <span>{isAutoplay ? t('remote.autoplayOn') : t('remote.autoplayOff')}</span>
        </Button>

        {onToggleLyrics && (
          <Button
            variant="outline"
            size="sm"
            chamfer="top-right"
            onClick={onToggleLyrics}
            className={cn(
              "h-9 px-3 text-xs font-mono uppercase tracking-wider flex items-center gap-1.5 cursor-pointer transition-colors",
              isLyricsActive
                ? "border-primary bg-primary/15 text-primary hover:bg-primary/20 shadow-[0_0_12px_rgba(255,255,255,0.1)]"
                : "text-muted-foreground hover:text-foreground"
            )}
            title={isLyricsActive ? 'Hide Lyrics' : 'Show Synced Lyrics'}
          >
            <Mic2 className={cn("w-3.5 h-3.5", isLyricsActive ? "text-primary" : "text-muted-foreground")} />
            <span>{isLyricsActive ? 'Hide Lyrics' : 'Lyrics'}</span>
          </Button>
        )}
      </div>

      {/* Desktop Center: Previous, Play/Pause, Skip */}
      <div className="flex items-center gap-3 justify-center">
        {isHostOrAdmin && (
          <Button
            variant="outline"
            size="sm"
            chamfer="top-left"
            onClick={onPreviousTrack}
            disabled={isLocked || isLoading}
            className="h-10 w-10 p-0 flex items-center justify-center cursor-pointer"
            title={t('watchParty.previousBtn')}
          >
            <SkipBack className="w-4 h-4" />
          </Button>
        )}

        <Button
          variant="cyber"
          chamfer="dual"
          onClick={onTogglePlayPause}
          disabled={isLocked || isLoading}
          className="h-10 px-6 font-bold text-xs uppercase flex items-center gap-2 cursor-pointer min-w-[120px]"
          title={isLoading ? t('watchParty.loadingBtn') : isPlaying ? t('watchParty.pauseBtn') : t('watchParty.playBtn')}
          aria-label={isLoading ? t('watchParty.loadingBtn') : isPlaying ? t('watchParty.pauseBtn') : t('watchParty.playBtn')}
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin text-current" />
          ) : isPlaying ? (
            <Pause className="w-4 h-4 fill-current" />
          ) : (
            <Play className="w-4 h-4 fill-current ml-0.5" />
          )}
          <span>{isLoading ? t('watchParty.loadingBtn') : isPlaying ? t('watchParty.pauseBtn') : t('watchParty.playBtn')}</span>
        </Button>

        <Button
          variant="outline"
          size="sm"
          chamfer="top-right"
          onClick={onNextTrack}
          disabled={isLocked || isLoading}
          className="h-10 w-10 p-0 flex items-center justify-center cursor-pointer"
          title={t('watchParty.skipNextBtn')}
        >
          <SkipForward className="w-4 h-4" />
        </Button>
      </div>

      {/* Desktop Right: Volume Slider & Fullscreen */}
      <div className="flex items-center gap-3 justify-end min-w-0">
        <div className="flex items-center gap-2 w-40">
          <button
            type="button"
            onClick={() => {
              if (isLocked) return;
              const next = displayVolume === 0 ? 80 : 0;
              handleVolumeValueChange([next]);
              handleVolumeValueCommit([next]);
            }}
            disabled={isLocked}
            className="p-1 text-primary hover:opacity-80 transition-opacity disabled:opacity-50 flex items-center justify-center cursor-pointer"
            title={displayVolume === 0 ? 'Unmute' : 'Mute'}
          >
            {displayVolume === 0 ? (
              <VolumeX className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            ) : displayVolume <= 50 ? (
              <Volume1 className="w-4 h-4 text-primary flex-shrink-0" />
            ) : (
              <Volume2 className="w-4 h-4 text-primary flex-shrink-0" />
            )}
          </button>
          <Slider
            value={[displayVolume]}
            min={0}
            max={100}
            step={1}
            onValueChange={handleVolumeValueChange}
            onValueCommit={handleVolumeValueCommit}
            disabled={isLocked}
            className="flex-1 cursor-pointer py-2"
          />
          <span className="text-xs font-mono font-bold text-muted-foreground w-8 text-right select-none">
            {displayVolume}%
          </span>
        </div>

        <Button
          variant="outline"
          size="sm"
          chamfer="top-right"
          onClick={onToggleFullscreenClick}
          disabled={fullscreenCooldown}
          className={cn(
            "h-9 px-3 text-xs font-mono uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer",
            isFullscreen
              ? "border-primary bg-primary/15 text-primary hover:bg-primary/20 shadow-[0_0_10px_rgba(255,255,255,0.08)]"
              : "text-muted-foreground hover:text-foreground"
          )}
          title={isFullscreen ? t('remote.exitFullscreen') : t('remote.fullscreenTv')}
        >
          {isFullscreen ? <Minimize className="w-3.5 h-3.5 text-primary" /> : <Maximize className="w-3.5 h-3.5 text-foreground/80" />}
          <span>{isFullscreen ? t('remote.exitFullscreen') : t('remote.fullscreenTv')}</span>
        </Button>
      </div>
    </div>
  );
};
