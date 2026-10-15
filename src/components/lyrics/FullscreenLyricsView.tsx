import React from 'react';
import type { Lyric } from '@braccato/parsers';
import { BraccatoLyricsRenderer } from './BraccatoLyricsRenderer';
import { Music, Disc } from 'lucide-react';

interface FullscreenLyricsViewProps {
  lyrics: Lyric[] | null;
  isLoading: boolean;
  albumArt: string;
  trackTitle: string;
  artistName: string;
  dominantGradient: string;
  sourceLabel?: string;
  getCurrentTime: () => number;
  isPlaying: boolean;
  onSeek: (timeS: number) => void;
  clockTime?: { hours: string; minutes: string };
  roomCode?: string | null;
  lyricsOffsetMs?: number;
  isWordSync?: boolean;
}

export const FullscreenLyricsView: React.FC<FullscreenLyricsViewProps> = ({
  lyrics,
  isLoading,
  albumArt,
  trackTitle,
  artistName,
  dominantGradient,
  sourceLabel,
  getCurrentTime,
  isPlaying,
  onSeek,
  clockTime,
  roomCode,
  lyricsOffsetMs = 0,
  isWordSync = false,
}) => {
  const hasLyrics = Boolean(lyrics && lyrics.length > 0);

  // Temporary OSD toast when lyricsOffsetMs changes
  const [showOsd, setShowOsd] = React.useState(false);
  const prevOffsetRef = React.useRef(lyricsOffsetMs);
  const osdTimeoutRef = React.useRef<any>(null);

  React.useEffect(() => {
    if (lyricsOffsetMs !== undefined && lyricsOffsetMs !== prevOffsetRef.current) {
      prevOffsetRef.current = lyricsOffsetMs;
      setShowOsd(true);
      if (osdTimeoutRef.current) clearTimeout(osdTimeoutRef.current);
      osdTimeoutRef.current = setTimeout(() => setShowOsd(false), 2500);
    }
    return () => {
      if (osdTimeoutRef.current) clearTimeout(osdTimeoutRef.current);
    };
  }, [lyricsOffsetMs]);

  return (
    <div
      className="absolute inset-0 w-full h-full flex items-center justify-between select-none overflow-hidden"
      style={{
        background: dominantGradient,
      }}
    >
      {/* Real-time Lyrics Offset HUD Indicator */}
      {showOsd && (
        <div className="absolute top-6 left-1/2 -translate-x-1/2 z-50 pointer-events-none select-none transition-all duration-300 animate-in fade-in slide-in-from-top-3">
          <div className="bg-neutral-950/95 border border-primary/60 px-4 py-2 rounded-full flex items-center gap-2.5 text-white font-mono text-sm tracking-wide">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span>Lyrics Sync:</span>
            <span className="font-bold text-primary">
              {lyricsOffsetMs > 0 ? `+${lyricsOffsetMs}ms` : `${lyricsOffsetMs}ms`}
            </span>
            <span className="text-white/50 text-xs">
              ({lyricsOffsetMs > 0 ? `+${(lyricsOffsetMs / 1000).toFixed(2)}s earlier` : lyricsOffsetMs < 0 ? `${(lyricsOffsetMs / 1000).toFixed(2)}s later` : 'Synced'})
            </span>
          </div>
        </div>
      )}

      {/* Subtle vignette layer to frame the screen corners */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0, 0, 0, 0.45) 100%)',
        }}
      />

      {/* Left Column: Syllable-synced Lyrics Renderer (approx 63% width) */}
      <div className="w-[63%] h-full flex flex-col justify-center pl-8 sm:pl-12 md:pl-20 pr-4 sm:pr-8 relative z-10">
        {hasLyrics ? (
          <BraccatoLyricsRenderer
            lyrics={lyrics}
            getCurrentTime={getCurrentTime}
            isPlaying={isPlaying}
            onSeek={onSeek}
            isFullscreen={true}
            lyricsOffsetMs={lyricsOffsetMs}
            isWordSync={isWordSync}
          />
        ) : isLoading ? (
          <div className="flex flex-col items-start justify-center gap-3 animate-pulse text-white/40">
            <div className="h-10 bg-white/10 rounded-lg w-3/4 mb-3" />
            <div className="h-12 bg-white/20 rounded-lg w-5/6 mb-3" />
            <div className="h-10 bg-white/10 rounded-lg w-2/3" />
          </div>
        ) : (
          <div className="flex flex-col items-start justify-center gap-4 text-white/50">
            <div>
              <p className="text-6xl font-bold text-white/90">
                Sorry!
              </p>
              <p className="text-4xl font-regular text-white/90 tracking-tight">
                Synced lyrics unavailable
              </p>
              <p className="text-base text-white/50 mt-1">
                Enjoy the music
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Right Column: Album Artwork Card & Track Details (approx 37% width) */}
      <div className="w-[37%] h-full flex flex-col items-center justify-center pr-8 sm:pr-14 md:pr-20 pl-4 relative z-10">
        <div className="flex flex-col items-center max-w-sm sm:max-w-md w-full text-center">
          {/* Clock HUD placed on top of album cover */}
          {clockTime && (

            <div className="mb-4 sm:mb-6 pointer-events-none select-none">
              <div className="px-3 py-1.5 sm:px-4 sm:py-2 flex items-center justify-center rounded-md">
                <span className="font-display text-base sm:text-4xl md:text-5xl font-bold tracking-wider text-white/90 flex items-center">
                  {clockTime.hours}
                  <span className="text-white/40 animate-blink mx-0.5">:</span>
                  {clockTime.minutes}
                </span>
              </div>
            </div>
          )}

          {/* Album Artwork Card */}
          <div className="relative group w-56 h-56 sm:w-68 sm:h-68 md:w-80 md:h-80 lg:w-92 lg:h-92 rounded-2xl md:rounded-3xl p-1 bg-white/10 border border-white/25">
            <div className="w-full h-full rounded-[14px] md:rounded-[22px] overflow-hidden bg-black/50 relative flex items-center justify-center">
              {albumArt ? (
                <img
                  src={albumArt}
                  alt={trackTitle || 'Track cover'}
                  className="w-full h-full object-cover select-none"
                  loading="eager"
                  decoding="async"
                />
              ) : (
                <Disc className="w-20 h-20 text-white/20 animate-spin" style={{ animationDuration: '8s' }} />
              )}
            </div>
          </div>

          {/* Track Title */}
          <h2 className="mt-7 text-xl sm:text-2xl md:text-3xl font-bold text-white tracking-tight leading-snug line-clamp-2">
            {trackTitle || 'Unknown Track'}
          </h2>

          {/* Artist Name */}
          <p className="mt-2 text-base sm:text-lg md:text-xl font-medium text-white/75 line-clamp-1">
            {artistName || 'Unknown Artist'}
          </p>

          {/* Optional Source Tag (e.g. Unison / Better Lyrics / TTML) */}
          {sourceLabel && (
            <span className="mt-4 px-3 py-1 rounded-full text-xs font-mono font-medium tracking-wider text-white/50">
              Lyrics via {sourceLabel}
            </span>
          )}

          {/* Room Code */}
          {roomCode && (
            <div className="mt-3 flex items-center justify-center font-mono pointer-events-none select-none">
              <span className="text-base sm:text-2lg md:text-3xl font-normal tracking-widest text-white/90 leading-none">
                {roomCode}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
