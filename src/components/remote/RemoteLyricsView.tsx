import React from 'react';
import { RoomState, calculatePlaybackCurrentTimeSec } from '@/lib/roomUtils';
import { useLyrics } from '@/hooks/useLyrics';
import { useCurrentMediaMeta } from '@/hooks/useCurrentMediaMeta';
import { BraccatoLyricsRenderer } from '@/components/lyrics/BraccatoLyricsRenderer';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, Disc, Music, Mic2 } from 'lucide-react';
import { useTranslation } from '@/context/LanguageContext';

import type { Id } from '../../../convex/_generated/dataModel';

interface RemoteLyricsViewProps {
  roomId?: Id<'rooms'> | null;
  roomState: RoomState | null;
  isHostOrAdmin: boolean;
  onSeek: (positionMs: number) => Promise<void>;
  onClose?: () => void;
}

export const RemoteLyricsView: React.FC<RemoteLyricsViewProps> = ({
  roomId,
  roomState,
  isHostOrAdmin,
  onSeek,
  onClose,
}) => {
  const { t } = useTranslation();
  const playback = roomState?.playback;
  const isPlaying = playback?.status === 'playing';
  const lyricsOffsetMs = roomState?.lyricsOffsetMs ?? 0;
  const isWordSync = roomState?.lyricsWordSync ?? false;

  // Dead-reckoning high precision remote time provider:
  // Base timestamp positionMs + elapsed time since last update (Date.now() - updatedAt)
  const getCurrentTime = React.useCallback((): number => {
    return calculatePlaybackCurrentTimeSec(playback);
  }, [playback]);

  const handleSeek = React.useCallback(
    (seconds: number) => {
      onSeek(Math.round(seconds * 1000));
    },
    [onSeek]
  );

  const currentVideoMeta = useCurrentMediaMeta(
    roomState?.currentlyPlaying,
    roomState?.currentlyPlayingTitle
  );

  const lyricsData = useLyrics(
    roomState?.currentlyPlaying,
    roomState?.currentlyPlayingTitle,
    null,
    getCurrentTime,
    handleSeek,
    roomId,
    false,
    currentVideoMeta.author
  );

  const hasLyrics = Boolean(lyricsData.lyrics && lyricsData.lyrics.length > 0);

  return (
    <div
      className="w-full h-full flex flex-col overflow-hidden relative rounded-lg border border-border select-none"
      style={{
        background: lyricsData.dominantColor?.gradient || 'linear-gradient(180deg, rgba(20,20,30,0.95) 0%, rgba(10,10,15,0.98) 100%)',
      }}
    >
      {/* Vignette overlay */}
      <div
        className="absolute inset-0 pointer-events-none z-0"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 30%, rgba(0, 0, 0, 0.6) 100%)',
        }}
      />

      {/* Header bar: Track Info & Switch back to Search Button */}
      <div className="relative z-10 flex items-center justify-between p-3 sm:p-4 border-b border-white/10 bg-black/40 backdrop-blur-md flex-shrink-0">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 pr-2">
          {/* Mini Album Cover */}
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-lg overflow-hidden bg-black/60 border border-white/20 flex-shrink-0 flex items-center justify-center">
            {lyricsData.albumArt ? (
              <img
                src={lyricsData.albumArt}
                alt={lyricsData.trackTitle || 'Track cover'}
                className="w-full h-full object-cover"
                loading="eager"
              />
            ) : (
              <Disc className="w-5 h-5 text-white/30 animate-spin" style={{ animationDuration: '8s' }} />
            )}
          </div>

          {/* Title & Artist */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h3 className="text-xs sm:text-sm font-bold text-white truncate font-sans">
                {lyricsData.trackTitle || roomState?.currentlyPlayingTitle || t('remote.noVideoSelected')}
              </h3>
              {lyricsData.sourceLabel && (
                <Badge
                  variant="outline"
                  className="text-[9px] px-1.5 py-0 h-4 text-red-400 border-red-500/30 font-mono tracking-wider"
                >
                  (BETA)
                </Badge>
              )}
            </div>
            <p className="text-[11px] sm:text-xs text-white/60 truncate font-sans mt-0.5">
              {lyricsData.artistName || 'Unknown Artist'}
            </p>
          </div>
        </div>

        {/* Back to Search Button */}
        {onClose && (
          <Button
            variant="outline"
            size="sm"
            chamfer="top-right"
            onClick={onClose}
            className="h-8 px-2.5 sm:px-3 text-xs font-mono font-bold uppercase tracking-wider flex items-center gap-1.5 border-white/20 bg-black/40 hover:bg-white/10 text-white flex-shrink-0 cursor-pointer"
            title="Back to Search"
          >
            <Search className="w-3.5 h-3.5 text-primary flex-shrink-0" />
            <span className="hidden sm:inline">Search</span>
          </Button>
        )}
      </div>

      {/* Lyrics Content Body */}
      <div className="relative z-10 flex-1 min-h-0 overflow-hidden flex flex-col justify-center">
        {!roomState?.currentlyPlaying ? (
          <div className="flex flex-col items-center justify-center gap-3 p-6 text-center text-white/50 h-full font-sans">
            <Music className="w-10 h-10 text-white/30" />
            <p className="text-base font-bold text-white/80 font-sans">
              No track currently playing
            </p>
            <p className="text-xs text-white/40 max-w-xs font-sans">
              Choose a track from the queue or search panel to view synced lyrics.
            </p>
          </div>
        ) : hasLyrics ? (
          <BraccatoLyricsRenderer
            lyrics={lyricsData.lyrics}
            getCurrentTime={lyricsData.getCurrentTime}
            isPlaying={isPlaying}
            onSeek={lyricsData.seekTo}
            isFullscreen={false}
            fontSize="clamp(2rem, 5.5vw, 3rem)"
            padding="2rem 1.25rem"
            lyricsOffsetMs={lyricsOffsetMs}
            isWordSync={isWordSync}
            className="px-1 sm:px-2 py-1"
          />
        ) : lyricsData.isLoading ? (
          <div className="flex flex-col items-center justify-center gap-3 p-8 animate-pulse text-white/30 h-full">
            <div className="h-7 bg-white/15 rounded-lg w-3/4 mb-2" />
            <div className="h-9 bg-white/25 rounded-lg w-5/6 mb-2" />
            <div className="h-7 bg-white/15 rounded-lg w-2/3" />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-3 p-6 text-center text-white/50 h-full font-sans">
            <Mic2 className="w-10 h-10 text-white/30" />
            <div>
              <p className="text-lg sm:text-xl font-bold text-white/90 font-sans">
                Synced lyrics unavailable
              </p>
              <p className="text-xs text-white/50 mt-1 font-sans">
                Enjoy the music! You can adjust timing sync from the controls below.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RemoteLyricsView;
