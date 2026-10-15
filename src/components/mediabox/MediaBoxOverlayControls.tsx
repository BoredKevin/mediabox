import React from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  Volume1,
  VolumeX,
  Maximize,
  Minimize,
} from 'lucide-react';
import { useTranslation } from '@/context/LanguageContext';

interface MediaBoxOverlayControlsProps {
  hasActiveMedia: boolean;
  isPlaying: boolean;
  isLocked: boolean;
  isFullscreen: boolean;
  isOverlayVisible: boolean;
  clockTime?: { hours: string; minutes: string; seconds: string };
  currentVideoMeta: { title: string; author: string };
  currentlyPlayingUrl?: string | null;
  currentlyPlayingTitle?: string | null;
  displayVolume: number;
  muted: boolean;
  setMuted: React.Dispatch<React.SetStateAction<boolean>>;
  onTogglePlayPause: () => void;
  onPreviousTrack?: () => void;
  onSkipNextTrack?: () => void;
  canGoPrevious?: boolean;
  onToggleFullscreen: () => void;
  onVolumeChange: (val: number[]) => void;
  onVolumeCommit: (val: number[]) => void;
}

export const MediaBoxOverlayControls: React.FC<MediaBoxOverlayControlsProps> = ({
  hasActiveMedia,
  isPlaying,
  isLocked,
  isFullscreen,
  isOverlayVisible,
  clockTime,
  currentVideoMeta,
  currentlyPlayingUrl,
  currentlyPlayingTitle,
  displayVolume,
  muted,
  setMuted,
  onTogglePlayPause,
  onPreviousTrack,
  onSkipNextTrack,
  canGoPrevious = false,
  onToggleFullscreen,
  onVolumeChange,
  onVolumeCommit,
}) => {
  const { t } = useTranslation();

  if (!hasActiveMedia) {
    return (
      <div className="absolute bottom-4 right-4 sm:bottom-6 sm:right-6 z-30 pointer-events-auto">
        <Button
          variant="ghost"
          size="icon"
          onClick={(e) => {
            e.stopPropagation();
            onToggleFullscreen();
          }}
          aria-label={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          className="h-11 w-11 sm:h-14 sm:w-14 text-muted-foreground hover:text-foreground hover:bg-secondary/60 rounded-md flex items-center justify-center transition-all shadow-md active:scale-95"
          title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
        >
          {isFullscreen ? (
            <Minimize className="w-5 h-5 sm:w-7 sm:h-7" />
          ) : (
            <Maximize className="w-5 h-5 sm:w-7 sm:h-7" />
          )}
        </Button>
      </div>
    );
  }

  return (
    <>
      {/* Top Overlay: Video Title & Author Name */}
      <div
        className={`absolute inset-x-0 top-0 z-30 ${
          isFullscreen ? 'pt-16 sm:pt-20 md:pt-24' : 'pt-4 sm:pt-6'
        } pb-12 sm:pb-16 px-5 sm:px-8 bg-gradient-to-b from-black/90 via-black/55 to-transparent flex items-start justify-between gap-4 pointer-events-none transition-opacity duration-300 select-none ${
          isOverlayVisible ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <div className="flex flex-col min-w-0 max-w-full">
          <a
            href={currentlyPlayingUrl || '#'}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-white text-base sm:text-2xl md:text-3xl font-bold truncate drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] hover:underline tracking-tight leading-snug pointer-events-auto transition-colors"
            title={currentVideoMeta.title || currentlyPlayingTitle || 'YouTube Video'}
          >
            {currentVideoMeta.title || currentlyPlayingTitle || 'YouTube Video'}
          </a>
          {currentVideoMeta.author && (
            <span
              className="text-white/85 text-xs sm:text-base md:text-lg font-medium truncate drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)] mt-0.5 sm:mt-1"
              title={currentVideoMeta.author}
            >
              {currentVideoMeta.author}
            </span>
          )}
        </div>
      </div>

      {/* Center Transport Cluster: Previous, Play/Pause, Skip */}
      <div
        className={`absolute inset-0 z-30 flex items-center justify-center gap-4 sm:gap-6 pointer-events-none transition-opacity duration-300 ${
          isOverlayVisible ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {/* Previous Track Button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={(e) => {
            e.stopPropagation();
            onPreviousTrack?.();
          }}
          disabled={isLocked || !canGoPrevious}
          aria-label={t('watchParty.previousBtn')}
          className="h-11 w-11 sm:h-14 sm:w-14 text-foreground bg-neutral-900/95 hover:bg-neutral-800 border border-border rounded-full flex items-center justify-center pointer-events-auto transition-transform active:scale-95 disabled:opacity-25 disabled:pointer-events-none cursor-pointer"
          title={t('watchParty.previousBtn')}
        >
          <SkipBack className="w-5 h-5 sm:w-7 sm:h-7 fill-current" />
        </Button>

        {/* Center Play/Pause Button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={(e) => {
            e.stopPropagation();
            onTogglePlayPause();
          }}
          disabled={isLocked}
          aria-label={isPlaying ? t('watchParty.pauseBtn') : t('watchParty.playBtn')}
          className="h-16 w-16 sm:h-20 sm:w-20 text-foreground bg-neutral-900/95 hover:bg-neutral-800 border border-border rounded-full flex items-center justify-center pointer-events-auto transition-transform active:scale-95 cursor-pointer"
          title={isPlaying ? t('watchParty.pauseBtn') : t('watchParty.playBtn')}
        >
          {isPlaying ? (
            <Pause className="w-8 h-8 sm:w-10 sm:h-10 fill-current" />
          ) : (
            <Play className="w-8 h-8 sm:w-10 sm:h-10 fill-current ml-1" />
          )}
        </Button>

        {/* Skip Track Button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={(e) => {
            e.stopPropagation();
            onSkipNextTrack?.();
          }}
          disabled={isLocked}
          aria-label={t('watchParty.skipNextBtn')}
          className="h-11 w-11 sm:h-14 sm:w-14 text-foreground bg-neutral-900/95 hover:bg-neutral-800 border border-border rounded-full flex items-center justify-center pointer-events-auto transition-transform active:scale-95 cursor-pointer"
          title={t('watchParty.skipNextBtn')}
        >
          <SkipForward className="w-5 h-5 sm:w-7 sm:h-7 fill-current" />
        </Button>
      </div>

      {/* Bottom Overlay: Tactical Volume Control & Fullscreen */}
      <div
        className={`absolute inset-x-0 bottom-0 z-30 p-4 sm:p-6 md:p-8 bg-gradient-to-t from-black/95 via-black/60 to-transparent flex items-center justify-between pointer-events-none transition-opacity duration-300 ${
          isOverlayVisible ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {/* Left: Volume HUD Control */}
        <div className="flex items-center gap-3 sm:gap-4">
          <div
            className="flex items-center gap-3 sm:gap-4 px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-md bg-neutral-950/95 border border-border/80 pointer-events-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMuted((prev) => !prev)}
              aria-label={muted ? 'Unmute' : 'Mute'}
              className="h-8 w-8 sm:h-10 sm:w-10 text-foreground hover:text-foreground transition-colors active:scale-95"
              title={muted ? 'Unmute' : 'Mute'}
            >
              {muted || displayVolume === 0 ? (
                <VolumeX className="w-5 h-5 sm:w-6 sm:h-6 text-destructive" />
              ) : displayVolume > 50 ? (
                <Volume2 className="w-5 h-5 sm:w-6 sm:h-6" />
              ) : (
                <Volume1 className="w-5 h-5 sm:w-6 sm:h-6" />
              )}
            </Button>

            <Slider
              value={[muted ? 0 : displayVolume]}
              min={0}
              max={100}
              step={1}
              disabled={isLocked}
              onValueChange={onVolumeChange}
              onValueCommit={onVolumeCommit}
              aria-label="Volume slider"
              className="w-28 sm:w-44 md:w-56 cursor-pointer py-2"
            />

            <span className="font-mono text-xs sm:text-sm md:text-base font-bold text-muted-foreground w-10 sm:w-12 text-right select-none">
              {muted ? 0 : displayVolume}%
            </span>
          </div>
        </div>

        {/* Right: Fullscreen */}
        <div className="flex items-center">
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              onToggleFullscreen();
            }}
            aria-label={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            className="h-11 w-11 sm:h-14 sm:w-14 text-foreground hover:text-foreground hover:bg-secondary/60 rounded-md flex items-center justify-center pointer-events-auto transition-all shadow-md active:scale-95"
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? (
              <Minimize className="w-5 h-5 sm:w-7 sm:h-7" />
            ) : (
              <Maximize className="w-5 h-5 sm:w-7 sm:h-7" />
            )}
          </Button>
        </div>
      </div>
    </>
  );
};
