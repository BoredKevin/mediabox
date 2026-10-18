import React from 'react';

interface LyricsLoadingSequenceProps {
  isFullscreen?: boolean;
  className?: string;
  message?: string;
}

export const LyricsLoadingSequence: React.FC<LyricsLoadingSequenceProps> = ({
  isFullscreen = false,
  className = '',
}) => {
  if (isFullscreen) {
    return (
      <div
        className={`w-full h-full flex flex-col justify-center select-none py-6 ${className}`}
        aria-label="Loading synced lyrics"
      >

        {/* Staggered pulsing lyric lines mimicking verses */}
        <div className="flex flex-col gap-5 sm:gap-6 w-full max-w-2xl">
          <div
            className="h-9 sm:h-11 rounded-xl bg-white/10 animate-lyric-wave origin-left"
            style={{ width: '65%', animationDelay: '0ms' }}
          />
          <div
            className="h-11 sm:h-14 rounded-xl bg-white/20 animate-lyric-wave origin-left shadow-[0_0_24px_rgba(255,255,255,0.08)]"
            style={{ width: '85%', animationDelay: '250ms' }}
          />
          <div
            className="h-9 sm:h-11 rounded-xl bg-white/10 animate-lyric-wave origin-left"
            style={{ width: '50%', animationDelay: '500ms' }}
          />
          <div
            className="h-10 sm:h-12 rounded-xl bg-white/15 animate-lyric-wave origin-left"
            style={{ width: '75%', animationDelay: '750ms' }}
          />
          <div
            className="h-8 sm:h-10 rounded-xl bg-white/10 animate-lyric-wave origin-left"
            style={{ width: '40%', animationDelay: '1000ms' }}
          />
        </div>
      </div>
    );
  }

  return (
    <div
      className={`w-full h-full flex flex-col items-center justify-center select-none p-6 ${className}`}
      aria-label="Loading synced lyrics"
    >

      {/* Staggered pulsing lyric lines */}
      <div className="flex flex-col items-center gap-3 sm:gap-3.5 w-full max-w-sm sm:max-w-md">
        <div
          className="h-6 sm:h-7 rounded-lg bg-white/10 animate-lyric-wave"
          style={{ width: '60%', animationDelay: '0ms' }}
        />
        <div
          className="h-8 sm:h-9 rounded-lg bg-white/20 animate-lyric-wave shadow-[0_0_16px_rgba(255,255,255,0.06)]"
          style={{ width: '80%', animationDelay: '250ms' }}
        />
        <div
          className="h-6 sm:h-7 rounded-lg bg-white/10 animate-lyric-wave"
          style={{ width: '50%', animationDelay: '500ms' }}
        />
        <div
          className="h-7 sm:h-8 rounded-lg bg-white/15 animate-lyric-wave"
          style={{ width: '70%', animationDelay: '750ms' }}
        />
      </div>
    </div>
  );
};
