import React from 'react';
import type { Lyric } from '@braccato/parsers';
import { BraccatoLyricsRenderer } from './BraccatoLyricsRenderer';
import { LyricsLoadingSequence } from './LyricsLoadingSequence';
import { Music, Disc } from 'lucide-react';

interface MediaBoxLyricsViewProps {
  lyrics: Lyric[] | null;
  isLoading: boolean;
  status?: 'idle' | 'fetching' | 'ready' | 'error';
  albumArt: string;
  trackTitle: string;
  artistName: string;
  dominantGradient: string;
  sourceLabel?: string;
  getCurrentTime: () => number;
  isPlaying: boolean;
  onSeek: (timeS: number) => void;
  lyricsOffsetMs?: number;
  isWordSync?: boolean;
}

export const MediaBoxLyricsView: React.FC<MediaBoxLyricsViewProps> = ({
  lyrics,
  isLoading,
  status,
  albumArt,
  trackTitle,
  artistName,
  dominantGradient,
  getCurrentTime,
  isPlaying,
  onSeek,
  lyricsOffsetMs = 0,
  isWordSync = false,
}) => {
  const hasLyrics = Boolean(lyrics && lyrics.length > 0);
  const isFetching = isLoading || status === 'fetching';

  return (
    <div
      className="absolute inset-0 w-full h-full flex flex-col justify-between overflow-hidden select-none"
      style={{
        background: dominantGradient,
      }}
    >
      {/* Upper area: Scrolling Lyrics */}
      <div className="w-full h-full relative overflow-hidden">
        {hasLyrics ? (
          <BraccatoLyricsRenderer
            lyrics={lyrics}
            getCurrentTime={getCurrentTime}
            isPlaying={isPlaying}
            onSeek={onSeek}
            isFullscreen={false}
            lyricsOffsetMs={lyricsOffsetMs}
            isWordSync={isWordSync}
          />
        ) : isFetching ? (
          <LyricsLoadingSequence />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-white/50 text-center px-4">
            <Music className="w-8 h-8 text-white/40" />
            <p className="text-sm sm:text-base font-bold text-white/90">
              Synced lyrics unavailable
            </p>
            <p className="text-xs text-white/50">
              Playing official audio track
            </p>
          </div>
        )}
      </div>

      {/* Compact Track Badge in Bottom-right Corner */}
      <div className="absolute bottom-2.5 right-2.5 sm:bottom-3 sm:right-3 pointer-events-none select-none z-10 max-w-[200px] sm:max-w-[240px]">
        <div className="bg-neutral-950/95 border border-white/20 px-2.5 py-1.5 rounded-lg flex items-center gap-2">
          {/* Mini album artwork */}
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-md overflow-hidden bg-white/10 flex-shrink-0 border border-white/20">
            {albumArt ? (
              <img
                src={albumArt}
                alt=""
                className="w-full h-full object-cover"
                loading="lazy"
                decoding="async"
              />
            ) : (
              <Disc className="w-full h-full text-white/30 p-1" />
            )}
          </div>

          {/* Title & Artist */}
          <div className="min-w-0 pr-1">
            <p className="text-[11px] sm:text-xs font-bold text-white truncate leading-tight">
              {trackTitle || 'Unknown Track'}
            </p>
            <p className="text-[9px] sm:text-[10px] text-white/70 truncate mt-0.5 leading-tight">
              {artistName || 'Loading...'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
