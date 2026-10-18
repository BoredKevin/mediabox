import React, { useState } from 'react';
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
  Film,
  ExternalLink,
  Radio,
  Mic2,
} from 'lucide-react';
import { useTranslation } from '@/context/LanguageContext';
import { RoomState, parseYouTubeVideoId } from '@/lib/roomUtils';
import { cn } from '@/lib/utils';

interface NowPlayingBarProps {
  roomState: RoomState | null;
  isHostOrAdmin: boolean;
  onTogglePlayPause: () => Promise<void>;
  onNextTrack: () => Promise<void>;
  onPreviousTrack: () => Promise<void>;
  onStartRadio: () => Promise<void>;
  onToggleAutoplay: () => Promise<void>;
  displayVolume: number;
  handleVolumeValueChange: (val: number[]) => void;
  handleVolumeValueCommit: (val: number[]) => void;
  fullscreenCooldown: boolean;
  handleToggleFullscreenClick: () => void;
  isLyricsActive?: boolean;
  onToggleLyrics?: () => void;
}

export const NowPlayingBar: React.FC<NowPlayingBarProps> = ({
  roomState,
  isHostOrAdmin,
  onTogglePlayPause,
  onNextTrack,
  onPreviousTrack,
  onStartRadio,
  onToggleAutoplay,
  displayVolume,
  handleVolumeValueChange,
  handleVolumeValueCommit,
  fullscreenCooldown,
  handleToggleFullscreenClick,
  isLyricsActive = false,
  onToggleLyrics,
}) => {
  const { t } = useTranslation();
  const [volumeTooltipOpen, setVolumeTooltipOpen] = useState<boolean>(false);
  const isPlaying = roomState?.playback?.status === 'playing';
  const isLocked = Boolean(roomState?.isLocked) && !isHostOrAdmin;
  const currentVideo = roomState?.currentlyPlaying;
  const videoId = currentVideo ? parseYouTubeVideoId(currentVideo) : null;
  const videoTitle = roomState?.currentlyPlayingTitle || currentVideo;

  const videoUrl = videoId
    ? `https://www.youtube.com/watch?v=${videoId}`
    : currentVideo?.startsWith('http')
    ? currentVideo
    : null;

  return (
    <div className="fixed bottom-0 inset-x-0 z-40 bg-card/95 backdrop-blur-md border-t border-primary/20 shadow-[0_-4px_24px_rgba(0,200,212,0.12)] pb-[env(safe-area-inset-bottom)]">
      <div className="max-w-[1800px] mx-auto px-3 sm:px-6 py-2.5 sm:py-3 flex flex-col gap-2.5">
        {/* Line 1: Dedicated Current Video Info Line (Thumbnail, Title, and Link) */}
        <div className="flex items-center justify-between gap-3 min-w-0 border-b border-border/40 pb-2.5">
          <div
            className={`flex items-center gap-3 min-w-0 flex-1 ${
              onToggleLyrics ? 'cursor-pointer group select-none' : ''
            }`}
            onClick={onToggleLyrics}
            title={onToggleLyrics ? (isLyricsActive ? 'Back to Search' : 'View Synced Lyrics') : undefined}
          >
            {videoId ? (
              <div className="relative flex-shrink-0 w-14 h-10 sm:w-16 sm:h-11 overflow-hidden border border-primary/30 bg-black">
                <img
                  src={`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`}
                  alt="Thumbnail"
                  className="w-full h-full object-cover"
                />
              </div>
            ) : (
              <div className="w-14 h-10 sm:w-16 sm:h-11 flex-shrink-0 flex items-center justify-center bg-muted/30 border border-border text-muted-foreground">
                <Film className="w-5 h-5" />
              </div>
            )}

            <div className="min-w-0 flex-1 flex flex-col justify-center">
              <p className="text-xs sm:text-sm font-bold text-foreground truncate font-sans">
                {videoTitle || t('remote.noVideoSelected')}
              </p>
              {videoUrl ? (
                <a
                  href={videoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="text-xs font-mono text-primary/80 hover:text-primary hover:underline flex items-center gap-1.5 truncate mt-0.5"
                  title="Open video on YouTube"
                >
                  <span className="truncate">{videoUrl}</span>
                  <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" />
                </a>
              ) : currentVideo ? (
                <span className="text-xs font-mono text-primary/80 truncate mt-0.5">
                  {currentVideo}
                </span>
              ) : null}
            </div>
          </div>

          {/* Right: Start Radio Button from currently playing track */}
          {videoId && (
            <div className="flex items-center gap-2 flex-shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={onStartRadio}
                disabled={isLocked}
                className="h-8 sm:h-9 px-2 sm:px-3 text-[11px] sm:text-xs font-mono font-bold uppercase tracking-wider flex items-center gap-1.5 border-primary/30 hover:border-primary hover:bg-primary/10 transition-colors cursor-pointer"
                title={t('remote.startRadio')}
              >
                <Radio className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                <span className="hidden min-[480px]:inline">{t('remote.startRadio')}</span>
              </Button>
            </div>
          )}
        </div>

        {/* Line 2: Playback & TV Controls Line */}
        <div className="w-full">
          {/* ======================================================== */}
          {/* MOBILE VIEW (< lg): Tooltip Slider on press + Clean Buttons */}
          {/* ======================================================== */}
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
                  roomState?.isAutoplay
                    ? "border-purple-500/70 bg-purple-500/15 text-purple-300 hover:bg-purple-500/25 shadow-[0_0_12px_rgba(168,85,247,0.2)]"
                    : "text-muted-foreground hover:text-foreground"
                )}
                title={`${t('remote.autoplayMode')}: ${
                  roomState?.isAutoplay ? t('remote.autoplayOn') : t('remote.autoplayOff')
                }`}
              >
                <Sparkles
                  className={cn(
                    "w-4 h-4",
                    roomState?.isAutoplay ? "text-purple-300" : "text-muted-foreground"
                  )}
                />
              </Button>

              <Button
                variant="outline"
                chamfer="top-right"
                onClick={handleToggleFullscreenClick}
                disabled={fullscreenCooldown}
                className={cn(
                  "h-11 w-10 min-[380px]:w-11 p-0 flex items-center justify-center flex-shrink-0 transition-colors",
                  roomState?.isFullscreen
                    ? "border-primary bg-primary/15 text-primary hover:bg-primary/20 shadow-[0_0_10px_rgba(255,255,255,0.08)]"
                    : "text-muted-foreground hover:text-foreground"
                )}
                title={roomState?.isFullscreen ? t('remote.exitFullscreen') : t('remote.fullscreenTv')}
              >
                {roomState?.isFullscreen ? (
                  <Minimize className="w-4 h-4 text-primary" />
                ) : (
                  <Maximize className="w-4 h-4 text-foreground/80" />
                )}
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
                  <Mic2
                    className={cn(
                      "w-4 h-4",
                      isLyricsActive ? "text-primary" : "text-muted-foreground"
                    )}
                  />
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
                  className="h-11 w-10 min-[380px]:w-11 p-0 flex items-center justify-center flex-shrink-0"
                  title={t('watchParty.previousBtn')}
                  aria-label={t('watchParty.previousBtn')}
                >
                  <SkipBack className="w-4 h-4 fill-current" />
                </Button>
              )}

              {isPlaying ? (
                <Button
                  variant="outline"
                  chamfer="dual"
                  onClick={onTogglePlayPause}
                  disabled={isLocked}
                  className="h-11 w-11 min-[380px]:w-12 p-0 flex items-center justify-center flex-shrink-0 hover:bg-muted transition-colors"
                  title={t('watchParty.pauseBtn')}
                  aria-label={t('watchParty.pauseBtn')}
                >
                  <Pause className="w-4 h-4 fill-current" />
                </Button>
              ) : (
                <Button
                  variant="outline"
                  chamfer="dual"
                  onClick={onTogglePlayPause}
                  disabled={isLocked}
                  className="h-11 w-11 min-[380px]:w-12 p-0 flex items-center justify-center flex-shrink-0 border-primary/60 bg-primary/10 text-primary hover:bg-primary/20 hover:border-primary transition-colors shadow-[0_0_10px_rgba(255,255,255,0.08)]"
                  title={t('watchParty.playBtn')}
                  aria-label={t('watchParty.playBtn')}
                >
                  <Play className="w-4 h-4 fill-current ml-0.5 text-primary" />
                </Button>
              )}

              {isHostOrAdmin && (
                <Button
                  variant="outline"
                  chamfer="top-right"
                  onClick={onNextTrack}
                  className="h-11 w-10 min-[380px]:w-11 p-0 flex items-center justify-center flex-shrink-0"
                  title={t('watchParty.skipNextBtn')}
                  aria-label={t('watchParty.skipNextBtn')}
                >
                  <SkipForward className="w-4 h-4 fill-current" />
                </Button>
              )}
            </div>
          </div>

          {/* ======================================================== */}
          {/* DESKTOP VIEW (>= lg): Standard Layout (Play Left, TV Right, Capped Volume) */}
          {/* ======================================================== */}
          <div className="hidden lg:flex items-center justify-between w-full">
            {/* Desktop Left: Previous, Play/Pause, Skip & Volume Slider */}
            <div className="flex items-center gap-2.5">
              {/* Previous Button (Host/Admin) - Icon only */}
              {isHostOrAdmin && (
                <Button
                  variant="outline"
                  chamfer="top-left"
                  onClick={onPreviousTrack}
                  className="h-10 w-10 p-0 flex items-center justify-center flex-shrink-0"
                  title={t('watchParty.previousBtn')}
                  aria-label={t('watchParty.previousBtn')}
                >
                  <SkipBack className="w-4 h-4 fill-current" />
                </Button>
              )}

              {/* Play/Pause Button - Icon only */}
              {isPlaying ? (
                <Button
                  variant="outline"
                  chamfer="dual"
                  onClick={onTogglePlayPause}
                  disabled={isLocked}
                  className="h-10 w-12 p-0 flex items-center justify-center flex-shrink-0 hover:bg-muted transition-colors"
                  title={t('watchParty.pauseBtn')}
                  aria-label={t('watchParty.pauseBtn')}
                >
                  <Pause className="w-4 h-4 fill-current" />
                </Button>
              ) : (
                <Button
                  variant="outline"
                  chamfer="dual"
                  onClick={onTogglePlayPause}
                  disabled={isLocked}
                  className="h-10 w-12 p-0 flex items-center justify-center flex-shrink-0 border-primary/60 bg-primary/10 text-primary hover:bg-primary/20 hover:border-primary transition-colors shadow-[0_0_10px_rgba(255,255,255,0.08)]"
                  title={t('watchParty.playBtn')}
                  aria-label={t('watchParty.playBtn')}
                >
                  <Play className="w-4 h-4 fill-current ml-0.5 text-primary" />
                </Button>
              )}

              {/* Skip Button (Host/Admin) */}
              {isHostOrAdmin && (
                <Button
                  variant="outline"
                  chamfer="top-right"
                  onClick={onNextTrack}
                  className="h-10 px-3.5 text-xs font-mono font-bold uppercase tracking-wider flex items-center gap-1.5"
                  title={t('watchParty.skipNextBtn')}
                >
                  <SkipForward className="w-4 h-4 fill-current" />
                  <span>{t('watchParty.skipNextBtn')}</span>
                </Button>
              )}

              {/* TV Volume Slider (Capped width, not filled across) */}
              <div className="flex items-center gap-2.5 w-48 pl-3 border-l border-border/50">
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
                  className="w-full cursor-pointer py-1.5 touch-none select-none"
                  aria-label="Volume slider"
                />
                <span className="text-xs font-mono font-bold text-muted-foreground w-8 text-right flex-shrink-0 select-none">
                  {displayVolume}%
                </span>
              </div>
            </div>

            {/* Desktop Right: Lyrics Toggle, Lyrics Sync, Autoplay & TV Fullscreen */}
            <div className="flex items-center gap-2.5">
              {onToggleLyrics && (
                <Button
                  variant="outline"
                  chamfer="top-right"
                  onClick={onToggleLyrics}
                  className={cn(
                    "h-10 px-3.5 text-xs font-mono font-semibold flex items-center gap-2 cursor-pointer transition-colors",
                    isLyricsActive
                      ? "border-primary bg-primary/15 text-primary hover:bg-primary/20 shadow-[0_0_12px_rgba(255,255,255,0.1)]"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  title={isLyricsActive ? 'Hide Lyrics (Show Search)' : 'Show Synced Lyrics'}
                >
                  <Mic2
                    className={cn(
                      "w-4 h-4",
                      isLyricsActive ? "text-primary" : "text-muted-foreground"
                    )}
                  />
                  <span className="text-xs font-mono uppercase tracking-wider">
                    Lyrics
                  </span>
                </Button>
              )}

              <Button
                variant="outline"
                chamfer="top-right"
                onClick={onToggleAutoplay}
                disabled={isLocked}
                className={cn(
                  "h-10 px-3.5 text-xs font-mono font-semibold flex items-center gap-2 transition-colors",
                  roomState?.isAutoplay
                    ? "border-purple-500/70 bg-purple-500/15 text-purple-300 hover:bg-purple-500/25 shadow-[0_0_12px_rgba(168,85,247,0.2)]"
                    : "text-muted-foreground hover:text-foreground"
                )}
                title={`${t('remote.autoplayMode')}: ${
                  roomState?.isAutoplay ? t('remote.autoplayOn') : t('remote.autoplayOff')
                }`}
              >
                <Sparkles
                  className={cn(
                    "w-4 h-4",
                    roomState?.isAutoplay ? "text-purple-300" : "text-muted-foreground"
                  )}
                />
                <span className="text-xs font-mono uppercase tracking-wider">
                  {t('remote.autoplayMode')}
                </span>
              </Button>

              <Button
                variant="outline"
                chamfer="top-right"
                onClick={handleToggleFullscreenClick}
                disabled={fullscreenCooldown}
                className={cn(
                  "h-10 px-3.5 text-xs font-mono font-semibold flex items-center gap-2 transition-colors",
                  roomState?.isFullscreen
                    ? "border-primary bg-primary/15 text-primary hover:bg-primary/20 shadow-[0_0_10px_rgba(255,255,255,0.08)]"
                    : "text-muted-foreground hover:text-foreground"
                )}
                title={roomState?.isFullscreen ? t('remote.exitFullscreen') : t('remote.fullscreenTv')}
              >
                {roomState?.isFullscreen ? (
                  <Minimize className="w-4 h-4 text-primary" />
                ) : (
                  <Maximize className="w-4 h-4 text-foreground/80" />
                )}
                <span className="text-xs font-mono uppercase tracking-wider">
                  {roomState?.isFullscreen ? t('remote.exitFullscreen') : t('remote.fullscreenTv')}
                </span>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NowPlayingBar;
