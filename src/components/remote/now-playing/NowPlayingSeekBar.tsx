import React, { useState, useEffect, useRef } from 'react';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';

interface NowPlayingSeekBarProps {
  positionMs: number;
  durationMs: number;
  status: 'playing' | 'paused' | 'loading';
  updatedAt: number;
  isLocked: boolean;
  onSeek: (positionMs: number) => Promise<void>;
  className?: string;
}

export function formatTime(ms: number): string {
  if (!ms || isNaN(ms) || ms < 0) return '0:00';
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function formatRemaining(posMs: number, durMs: number): string {
  if (!durMs || durMs <= 0 || isNaN(durMs)) return '--:--';
  const remainingMs = Math.max(0, durMs - posMs);
  return `-${formatTime(remainingMs)}`;
}

export const NowPlayingSeekBar: React.FC<NowPlayingSeekBarProps> = ({
  positionMs,
  durationMs,
  status,
  updatedAt,
  isLocked,
  onSeek,
  className,
}) => {
  const [displayPositionMs, setDisplayPositionMs] = useState<number>(positionMs);
  const [isScrubbing, setIsScrubbing] = useState<boolean>(false);
  const isScrubbingRef = useRef<boolean>(false);
  isScrubbingRef.current = isScrubbing;

  // Real-time dead-reckoning playback position timer
  useEffect(() => {
    if (isScrubbingRef.current) return;

    if (status !== 'playing') {
      setDisplayPositionMs(positionMs);
      return;
    }

    const updateDeadReckoned = () => {
      if (isScrubbingRef.current) return;
      const now = Date.now();
      const elapsed = Math.max(0, now - (updatedAt || now));
      const deadReckoned = positionMs + elapsed;
      const bounded = durationMs > 0 ? Math.min(deadReckoned, durationMs) : deadReckoned;
      setDisplayPositionMs(bounded);
    };

    updateDeadReckoned();
    const interval = setInterval(updateDeadReckoned, 250);
    return () => clearInterval(interval);
  }, [positionMs, durationMs, status, updatedAt]);

  const effectiveDuration = durationMs > 0 ? durationMs : 1000;
  const clampedPosition = Math.max(0, Math.min(displayPositionMs, effectiveDuration));

  const handleValueChange = (val: number[]) => {
    setIsScrubbing(true);
    setDisplayPositionMs(val[0]);
  };

  const handleValueCommit = async (val: number[]) => {
    setIsScrubbing(false);
    const targetMs = Math.max(0, Math.min(val[0], effectiveDuration));
    setDisplayPositionMs(targetMs);
    try {
      await onSeek(targetMs);
    } catch (err) {
      console.error('[NowPlayingSeekBar] Seek error:', err);
    }
  };

  const hasValidDuration = durationMs > 0;

  return (
    <div
      className={cn(
        'w-full flex items-center gap-2 sm:gap-3 text-[10px] sm:text-[11px] font-mono text-muted-foreground select-none',
        className
      )}
    >
      {/* Elapsed Time on the Left */}
      <span className="w-9 sm:w-11 text-right tabular-nums flex-shrink-0 text-foreground/80 font-medium">
        {formatTime(clampedPosition)}
      </span>

      {/* Seek Progress Slider */}
      <div className="flex-1 flex items-center">
        <Slider
          value={[clampedPosition]}
          min={0}
          max={effectiveDuration}
          step={1000}
          disabled={isLocked || !hasValidDuration}
          onValueChange={handleValueChange}
          onValueCommit={handleValueCommit}
          className="cursor-pointer py-1"
          title={
            !hasValidDuration
              ? 'Duration not available'
              : isLocked
              ? 'Seeking locked by host'
              : 'Seek playback position'
          }
        />
      </div>

      {/* Remaining Time on the Right */}
      <span className="w-9 sm:w-11 text-left tabular-nums flex-shrink-0 text-foreground/80 font-medium">
        {formatRemaining(clampedPosition, durationMs)}
      </span>
    </div>
  );
};

export default NowPlayingSeekBar;
