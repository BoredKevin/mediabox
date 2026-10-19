import React, { useState } from 'react';
import { RoomState, parseYouTubeVideoId } from '@/lib/roomUtils';
import { NowPlayingTrackInfo } from './now-playing/NowPlayingTrackInfo';
import { NowPlayingMobileControls } from './now-playing/NowPlayingMobileControls';
import { NowPlayingDesktopControls } from './now-playing/NowPlayingDesktopControls';

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
  const [volumeTooltipOpen, setVolumeTooltipOpen] = useState<boolean>(false);
  const isPlaying = roomState?.playback?.status === 'playing';
  const isLoading = roomState?.playback?.status === 'loading';
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
        <NowPlayingTrackInfo
          videoId={videoId}
          videoTitle={videoTitle}
          videoUrl={videoUrl}
          currentVideo={currentVideo}
          isLocked={isLocked}
          isLoading={isLoading}
          isLyricsActive={isLyricsActive}
          onToggleLyrics={onToggleLyrics}
          onStartRadio={onStartRadio}
          onForceSkip={onNextTrack}
        />

        <div className="w-full">
          <NowPlayingMobileControls
            isPlaying={isPlaying}
            isLoading={isLoading}
            isLocked={isLocked}
            isHostOrAdmin={isHostOrAdmin}
            isAutoplay={roomState?.isAutoplay}
            isFullscreen={roomState?.isFullscreen}
            fullscreenCooldown={fullscreenCooldown}
            displayVolume={displayVolume}
            volumeTooltipOpen={volumeTooltipOpen}
            setVolumeTooltipOpen={setVolumeTooltipOpen}
            isLyricsActive={isLyricsActive}
            onToggleAutoplay={onToggleAutoplay}
            onToggleFullscreenClick={handleToggleFullscreenClick}
            onToggleLyrics={onToggleLyrics}
            onPreviousTrack={onPreviousTrack}
            onTogglePlayPause={onTogglePlayPause}
            onNextTrack={onNextTrack}
            handleVolumeValueChange={handleVolumeValueChange}
            handleVolumeValueCommit={handleVolumeValueCommit}
          />

          <NowPlayingDesktopControls
            isPlaying={isPlaying}
            isLoading={isLoading}
            isLocked={isLocked}
            isHostOrAdmin={isHostOrAdmin}
            isAutoplay={roomState?.isAutoplay}
            isFullscreen={roomState?.isFullscreen}
            fullscreenCooldown={fullscreenCooldown}
            displayVolume={displayVolume}
            isLyricsActive={isLyricsActive}
            onToggleAutoplay={onToggleAutoplay}
            onToggleFullscreenClick={handleToggleFullscreenClick}
            onToggleLyrics={onToggleLyrics}
            onPreviousTrack={onPreviousTrack}
            onTogglePlayPause={onTogglePlayPause}
            onNextTrack={onNextTrack}
            handleVolumeValueChange={handleVolumeValueChange}
            handleVolumeValueCommit={handleVolumeValueCommit}
          />
        </div>
      </div>
    </div>
  );
};
