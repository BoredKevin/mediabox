import React from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from '@/components/ui/popover';
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
} from 'lucide-react';
import { useTranslation } from '@/context/LanguageContext';
import { cn } from '@/lib/utils';

interface NowPlayingMobileControlsProps {
  isPlaying: boolean;
  isLoading?: boolean;
  isLocked: boolean;
  isHostOrAdmin: boolean;
  isAutoplay?: boolean;
  isFullscreen?: boolean;
  fullscreenCooldown: boolean;
  displayVolume: number;
  volumeTooltipOpen: boolean;
  setVolumeTooltipOpen: (open: boolean) => void;
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

export const NowPlayingMobileControls: React.FC<NowPlayingMobileControlsProps> = ({
  isPlaying,
  isLoading = false,
  isLocked,
  isHostOrAdmin,
  isAutoplay,
  isFullscreen,
  fullscreenCooldown,
  displayVolume,
  volumeTooltipOpen,
  setVolumeTooltipOpen,
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

  return (
    <div className="flex lg:hidden items-center justify-between gap-2 sm:gap-2.5 w-full">
      {/* Mobile Left: Autoplay, TV Fullscreen & Volume Tooltip */}
      <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
        <Button
          variant="outline"
          chamfer="top-right"
          onClick={onToggleAutoplay}
          disabled={isLocked}
          className={cn(
            "h-11 w-10 min-[380px]:w-11 p-0 flex items-center justify-center flex-shrink-0 transition-colors",
            isAutoplay
              ? "border-purple-500/70 bg-purple-500/15 text-purple-300 hover:bg-purple-500/25 shadow-[0_0_12px_rgba(168,85,247,0.2)]"
              : "text-muted-foreground hover:text-foreground"
          )}
          title={`${t('remote.autoplayMode')}: ${isAutoplay ? t('remote.autoplayOn') : t('remote.autoplayOff')}`}
        >
          <Sparkles className={cn("w-4 h-4", isAutoplay ? "text-purple-300" : "text-muted-foreground")} />
        </Button>

        <Button
          variant="outline"
          chamfer="top-right"
          onClick={onToggleFullscreenClick}
          disabled={fullscreenCooldown}
          className={cn(
            "h-11 w-10 min-[380px]:w-11 p-0 flex items-center justify-center flex-shrink-0 transition-colors",
            isFullscreen
              ? "border-primary bg-primary/15 text-primary hover:bg-primary/20 shadow-[0_0_10px_rgba(255,255,255,0.08)]"
              : "text-muted-foreground hover:text-foreground"
          )}
          title={isFullscreen ? t('remote.exitFullscreen') : t('remote.fullscreenTv')}
        >
          {isFullscreen ? <Minimize className="w-4 h-4 text-primary" /> : <Maximize className="w-4 h-4 text-foreground/80" />}
        </Button>

        {/* Volume Popover Button */}
        <Popover open={volumeTooltipOpen} onOpenChange={setVolumeTooltipOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              chamfer="top-right"
              disabled={isLocked}
              className={cn(
                "h-11 w-10 min-[380px]:w-11 p-0 flex items-center justify-center flex-shrink-0 transition-colors",
                volumeTooltipOpen
                  ? "border-primary bg-primary/15 text-primary hover:bg-primary/20 shadow-[0_0_10px_rgba(255,255,255,0.08)]"
                  : "text-muted-foreground hover:text-foreground"
              )}
              title="Volume"
              aria-label="Volume"
            >
              {displayVolume === 0 ? (
                <VolumeX className="w-4 h-4 text-muted-foreground" />
              ) : displayVolume <= 50 ? (
                <Volume1 className="w-4 h-4 text-primary" />
              ) : (
                <Volume2 className="w-4 h-4 text-primary" />
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent
            side="top"
            sideOffset={12}
            align="start"
            onOpenAutoFocus={(e) => e.preventDefault()}
            className="p-3 bg-card/95 border border-border backdrop-blur-md shadow-2xl flex items-center gap-3 w-56 sm:w-64 z-50 pointer-events-auto"
          >
            <button
              type="button"
              onClick={() => {
                if (isLocked) return;
                const next = displayVolume === 0 ? 80 : 0;
                handleVolumeValueChange([next]);
                handleVolumeValueCommit([next]);
              }}
              disabled={isLocked}
              className="p-1 -m-1 text-primary hover:opacity-80 transition-opacity disabled:opacity-50 flex items-center justify-center cursor-pointer"
              title={displayVolume === 0 ? 'Unmute' : 'Mute'}
              aria-label={displayVolume === 0 ? 'Unmute' : 'Mute'}
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
              className="flex-1 cursor-pointer py-2 touch-none select-none"
              aria-label="Volume slider"
            />
            <span className="text-xs font-mono font-bold text-muted-foreground w-8 text-right flex-shrink-0 select-none">
              {displayVolume}%
            </span>
          </PopoverContent>
        </Popover>

        {/* Lyrics Toggle Button */}
        {onToggleLyrics && (
          <Button
            variant="outline"
            chamfer="top-right"
            onClick={onToggleLyrics}
            className={cn(
              "h-11 w-10 min-[380px]:w-11 p-0 flex items-center justify-center flex-shrink-0 cursor-pointer transition-colors",
              isLyricsActive
                ? "border-primary bg-primary/15 text-primary hover:bg-primary/20 shadow-[0_0_12px_rgba(255,255,255,0.1)]"
                : "text-muted-foreground hover:text-foreground"
            )}
            title={isLyricsActive ? 'Hide Lyrics (Show Search)' : 'Show Synced Lyrics'}
            aria-label={isLyricsActive ? 'Hide Lyrics (Show Search)' : 'Show Synced Lyrics'}
          >
            <Mic2 className={cn("w-4 h-4", isLyricsActive ? "text-primary" : "text-muted-foreground")} />
          </Button>
        )}
      </div>

      {/* Mobile Right: Previous, Play/Pause, Skip */}
      <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
        {isHostOrAdmin && (
          <Button
            variant="outline"
            chamfer="top-left"
            onClick={onPreviousTrack}
            disabled={isLocked || isLoading}
            className="h-11 w-10 min-[380px]:w-11 p-0 flex items-center justify-center flex-shrink-0"
            title={t('watchParty.previousBtn')}
            aria-label={t('watchParty.previousBtn')}
          >
            <SkipBack className="w-4 h-4" />
          </Button>
        )}

        <Button
          variant="cyber"
          chamfer="dual"
          onClick={onTogglePlayPause}
          disabled={isLocked || isLoading}
          className="h-11 px-3 sm:px-4 font-bold text-xs uppercase flex items-center gap-1.5 flex-shrink-0"
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
          <span className="hidden min-[420px]:inline">
            {isLoading ? t('watchParty.loadingBtn') : isPlaying ? t('watchParty.pauseBtn') : t('watchParty.playBtn')}
          </span>
        </Button>

        <Button
          variant="outline"
          chamfer="top-right"
          onClick={onNextTrack}
          disabled={isLocked || isLoading}
          className="h-11 w-10 min-[380px]:w-11 p-0 flex items-center justify-center flex-shrink-0"
          title={t('watchParty.skipNextBtn')}
          aria-label={t('watchParty.skipNextBtn')}
        >
          <SkipForward className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};
