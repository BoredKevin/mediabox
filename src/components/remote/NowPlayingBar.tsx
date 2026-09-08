import React from 'react';
import { Button, Slider } from '@boredkevin/ui';
import {
  Play,
  Pause,
  SkipForward,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Sparkles,
  Film,
  ExternalLink,
} from 'lucide-react';
import { useTranslation } from '@/context/LanguageContext';
import { RoomState, parseYouTubeVideoId } from '@/lib/roomUtils';

interface NowPlayingBarProps {
  roomState: RoomState | null;
  isHostOrAdmin: boolean;
  sendCommand: (type: any, payload?: any) => Promise<void>;
  displayVolume: number;
  handleVolumeValueChange: (val: number[]) => void;
  handleVolumeValueCommit: (val: number[]) => void;
  fullscreenCooldown: boolean;
  handleToggleFullscreenClick: () => void;
}

export const NowPlayingBar: React.FC<NowPlayingBarProps> = ({
  roomState,
  isHostOrAdmin,
  sendCommand,
  displayVolume,
  handleVolumeValueChange,
  handleVolumeValueCommit,
  fullscreenCooldown,
  handleToggleFullscreenClick,
}) => {
  const { t } = useTranslation();
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
    <div className="fixed bottom-0 inset-x-0 z-40 bg-card/95 backdrop-blur-md border-t border-primary/20 shadow-[0_-4px_24px_rgba(0,200,212,0.12)]">
      <div className="max-w-[1800px] mx-auto px-3 sm:px-6 py-2.5 flex flex-col gap-2">
        {/* Line 1: Dedicated Current Video Info Line (Thumbnail, Title, and Link) */}
        <div className="flex items-center justify-between gap-3 min-w-0 border-b border-border/40 pb-2">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {videoId ? (
              <div className="relative flex-shrink-0 w-14 h-9 sm:w-16 sm:h-10 overflow-hidden border border-primary/30 bg-black">
                <img
                  src={`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`}
                  alt="Thumbnail"
                  className="w-full h-full object-cover"
                />
              </div>
            ) : (
              <div className="w-12 h-9 sm:w-14 sm:h-10 flex-shrink-0 flex items-center justify-center bg-muted/30 border border-border text-muted-foreground">
                <Film className="w-4 h-4" />
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
                  className="text-[11px] font-mono text-primary/80 hover:text-primary hover:underline flex items-center gap-1 truncate mt-0.5"
                  title="Open video on YouTube"
                >
                  <span className="truncate">{videoUrl}</span>
                  <ExternalLink className="w-3 h-3 flex-shrink-0" />
                </a>
              ) : currentVideo ? (
                <span className="text-[11px] font-mono text-primary/80 truncate mt-0.5">
                  {currentVideo}
                </span>
              ) : null}
            </div>
          </div>
        </div>

        {/* Line 2: Playback & TV Controls Line */}
        <div className="w-full">
          {/* ======================================================== */}
          {/* MOBILE VIEW (< lg): Swapped Controls + Full Width Slider */}
          {/* ======================================================== */}
          <div className="flex lg:hidden items-center justify-between gap-2 w-full">
            {/* Mobile Left: Autoplay & TV Fullscreen */}
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <Button
                variant={roomState?.isAutoplay ? 'cyber' : 'outline'}
                size="sm"
                chamfer="top-right"
                onClick={() => sendCommand('toggleAutoplay')}
                disabled={isLocked}
                className="h-8 px-2 text-xs font-semibold flex items-center gap-1"
                title={`${t('remote.autoplayMode')}: ${
                  roomState?.isAutoplay ? t('remote.autoplayOn') : t('remote.autoplayOff')
                }`}
              >
                <Sparkles
                  className={`w-3.5 h-3.5 ${
                    roomState?.isAutoplay ? 'text-purple-300 animate-pulse' : 'text-muted-foreground'
                  }`}
                />
              </Button>

              <Button
                variant={roomState?.isFullscreen ? 'cyber' : 'outline'}
                size="sm"
                chamfer="top-right"
                onClick={handleToggleFullscreenClick}
                disabled={fullscreenCooldown}
                className="h-8 px-2 text-xs font-semibold flex items-center gap-1"
                title={roomState?.isFullscreen ? t('remote.exitFullscreen') : t('remote.fullscreenTv')}
              >
                {roomState?.isFullscreen ? (
                  <Minimize className="w-3.5 h-3.5" />
                ) : (
                  <Maximize className="w-3.5 h-3.5 text-primary" />
                )}
              </Button>
            </div>

            {/* Mobile Center: Volume Slider (Filled across available width) */}
            <div className="flex-1 min-w-0 flex items-center gap-2 px-1">
              {displayVolume === 0 ? (
                <VolumeX className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
              ) : (
                <Volume2 className="w-3.5 h-3.5 text-primary flex-shrink-0" />
              )}
              <Slider
                value={[displayVolume]}
                min={0}
                max={100}
                step={1}
                onValueChange={handleVolumeValueChange}
                onValueCommit={handleVolumeValueCommit}
                disabled={isLocked}
                className="w-full cursor-pointer py-1"
              />
              <span className="text-[10px] font-mono text-muted-foreground w-6 text-right flex-shrink-0">
                {displayVolume}%
              </span>
            </div>

            {/* Mobile Right: Skip & Play/Pause */}
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {isHostOrAdmin && (
                <Button
                  variant="outline"
                  size="sm"
                  chamfer="top-right"
                  onClick={() => sendCommand('forceSkip')}
                  className="h-8 px-2 text-xs font-bold uppercase tracking-wider flex items-center gap-1"
                  title="Skip to next video"
                >
                  <SkipForward className="w-3.5 h-3.5 fill-current" />
                </Button>
              )}

              {isPlaying ? (
                <Button
                  variant="outline"
                  size="sm"
                  chamfer="dual"
                  onClick={() => sendCommand('pause')}
                  disabled={isLocked}
                  className="h-8 px-3 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5"
                  title={t('watchParty.pauseBtn')}
                >
                  <Pause className="w-3.5 h-3.5 fill-current" />
                  <span>{t('watchParty.pauseBtn')}</span>
                </Button>
              ) : (
                <Button
                  variant="cyber"
                  size="sm"
                  chamfer="dual"
                  onClick={() => sendCommand('play')}
                  disabled={isLocked}
                  className="h-8 px-3 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5"
                  title={t('watchParty.playBtn')}
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>{t('watchParty.playBtn')}</span>
                </Button>
              )}
            </div>
          </div>

          {/* ======================================================== */}
          {/* DESKTOP VIEW (>= lg): Standard Layout (Play Left, TV Right, Capped Volume) */}
          {/* ======================================================== */}
          <div className="hidden lg:flex items-center justify-between w-full">
            {/* Desktop Left: Play/Pause, Skip & Volume Slider */}
            <div className="flex items-center gap-3">
              {/* Play/Pause Button */}
              {isPlaying ? (
                <Button
                  variant="outline"
                  size="sm"
                  chamfer="dual"
                  onClick={() => sendCommand('pause')}
                  disabled={isLocked}
                  className="h-9 px-4 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5"
                  title={t('watchParty.pauseBtn')}
                >
                  <Pause className="w-3.5 h-3.5 fill-current" />
                  <span>{t('watchParty.pauseBtn')}</span>
                </Button>
              ) : (
                <Button
                  variant="cyber"
                  size="sm"
                  chamfer="dual"
                  onClick={() => sendCommand('play')}
                  disabled={isLocked}
                  className="h-9 px-4 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5"
                  title={t('watchParty.playBtn')}
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>{t('watchParty.playBtn')}</span>
                </Button>
              )}

              {/* Skip Button (Host/Admin) */}
              {isHostOrAdmin && (
                <Button
                  variant="outline"
                  size="sm"
                  chamfer="top-right"
                  onClick={() => sendCommand('forceSkip')}
                  className="h-9 px-3 text-xs font-bold uppercase tracking-wider flex items-center gap-1"
                  title="Skip to next video"
                >
                  <SkipForward className="w-3.5 h-3.5 fill-current" />
                  <span>{t('watchParty.skipNextBtn')}</span>
                </Button>
              )}

              {/* TV Volume Slider (Capped width, not filled across) */}
              <div className="flex items-center gap-2 w-44 pl-3 border-l border-border/50">
                {displayVolume === 0 ? (
                  <VolumeX className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                ) : (
                  <Volume2 className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                )}
                <Slider
                  value={[displayVolume]}
                  min={0}
                  max={100}
                  step={1}
                  onValueChange={handleVolumeValueChange}
                  onValueCommit={handleVolumeValueCommit}
                  disabled={isLocked}
                  className="w-full cursor-pointer py-1"
                />
                <span className="text-[10px] font-mono text-muted-foreground w-7 text-right flex-shrink-0">
                  {displayVolume}%
                </span>
              </div>
            </div>

            {/* Desktop Right: Autoplay & TV Fullscreen */}
            <div className="flex items-center gap-2">
              <Button
                variant={roomState?.isAutoplay ? 'cyber' : 'outline'}
                size="sm"
                chamfer="top-right"
                onClick={() => sendCommand('toggleAutoplay')}
                disabled={isLocked}
                className="h-9 px-3 text-xs font-semibold flex items-center gap-1.5"
                title={`${t('remote.autoplayMode')}: ${
                  roomState?.isAutoplay ? t('remote.autoplayOn') : t('remote.autoplayOff')
                }`}
              >
                <Sparkles
                  className={`w-3.5 h-3.5 ${
                    roomState?.isAutoplay ? 'text-purple-300 animate-pulse' : 'text-muted-foreground'
                  }`}
                />
                <span className="text-[11px] uppercase tracking-wider">
                  {t('remote.autoplayMode')}
                </span>
              </Button>

              <Button
                variant={roomState?.isFullscreen ? 'cyber' : 'outline'}
                size="sm"
                chamfer="top-right"
                onClick={handleToggleFullscreenClick}
                disabled={fullscreenCooldown}
                className="h-9 px-3 text-xs font-semibold flex items-center gap-1.5"
                title={roomState?.isFullscreen ? t('remote.exitFullscreen') : t('remote.fullscreenTv')}
              >
                {roomState?.isFullscreen ? (
                  <Minimize className="w-3.5 h-3.5" />
                ) : (
                  <Maximize className="w-3.5 h-3.5 text-primary" />
                )}
                <span className="text-[11px] uppercase tracking-wider">
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
