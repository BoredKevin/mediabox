import React, { useState, useEffect } from 'react';
import { Card, Badge, Button } from '@boredkevin/ui';
import { ScheduleItem } from '@/types/schedule';
import { useTranslation } from '@/context/LanguageContext';
import { useWatchParty } from '@/context/WatchPartyContext';
import { useSchedule } from '@/hooks/useSchedule';
import { CountdownOverlay } from '@/components/CountdownOverlay';
import { Sparkles, Timer, Clock } from 'lucide-react';

export const ScheduleSection: React.FC = () => {
  const { t } = useTranslation();
  const { roomState } = useWatchParty();
  const {
    current,
    next,
    upcomingItems,
    progress,
    secondsToNext,
    nextEndDateMs,
    endsAt,
    now,
  } = useSchedule();

  const [activeCountdown, setActiveCountdown] = useState<{
    item: ScheduleItem;
    targetTimeMs: number;
  } | null>(null);

  // Playback state determination
  const isMediaPlaying = Boolean(roomState?.currentlyPlaying) && !roomState?.isLocked;
  const [carouselIndex, setCarouselIndex] = useState<number>(0);
  const [carouselProgress, setCarouselProgress] = useState<number>(100);
  const [animPhase, setAnimPhase] = useState<'in' | 'out'>('in');

  // Reset carousel when playback state or upcoming items change
  useEffect(() => {
    setCarouselIndex(0);
    setCarouselProgress(100);
    setAnimPhase('in');
  }, [isMediaPlaying, upcomingItems.length]);

  // 15-second schedule carousel mechanism during playback (starts filled, then empties)
  // Transitions with fade-out slide-up then fade-in slide-up
  useEffect(() => {
    if (!isMediaPlaying || upcomingItems.length <= 1) {
      setCarouselProgress(100);
      setAnimPhase('in');
      return;
    }

    const intervalMs = 15000;
    const tickMs = 100;
    const exitDurationMs = 300;
    let elapsed = 0;

    const timer = setInterval(() => {
      elapsed += tickMs;
      setCarouselProgress(Math.max(0, (1 - elapsed / intervalMs) * 100));

      if (elapsed >= intervalMs - exitDurationMs && elapsed < intervalMs) {
        setAnimPhase('out');
      }

      if (elapsed >= intervalMs) {
        elapsed = 0;
        setCarouselProgress(100);
        setCarouselIndex((prev) => (prev + 1) % upcomingItems.length);
        setAnimPhase('in');
      }
    }, tickMs);

    return () => clearInterval(timer);
  }, [isMediaPlaying, upcomingItems.length]);

  // Active item in next schedule card
  const activeNextItem = isMediaPlaying && upcomingItems.length > 0
    ? (upcomingItems[carouselIndex] || next)
    : next;

  // Auto-trigger countdown overlay when enabled
  useEffect(() => {
    const isCountdownEnabled = Boolean(roomState?.isCountdownEnabled);

    if (isCountdownEnabled && next.countdown && secondsToNext <= 10 && secondsToNext > 0) {
      if (!activeCountdown || Math.abs(activeCountdown.targetTimeMs - nextEndDateMs) > 3000) {
        setActiveCountdown({
          item: next,
          targetTimeMs: nextEndDateMs,
        });
      }
    }
  }, [next, secondsToNext, nextEndDateMs, roomState?.isCountdownEnabled, activeCountdown]);

  // Auto-dismiss countdown after 3s post zero
  useEffect(() => {
    if (!activeCountdown) return;

    const diffSeconds = Math.ceil((activeCountdown.targetTimeMs - now.getTime()) / 1000);
    if (diffSeconds <= -3) {
      setActiveCountdown(null);
    }
  }, [now, activeCountdown]);

  const activeSecondsLeft = activeCountdown
    ? Math.max(0, Math.ceil((activeCountdown.targetTimeMs - now.getTime()) / 1000))
    : 0;

  const handleTestCountdown = () => {
    setActiveCountdown((prev) =>
      prev
        ? null
        : {
          item: activeNextItem,
          targetTimeMs: Date.now() + 10000,
        }
    );
  };

  return (
    <div className="flex flex-col gap-3 sm:gap-4 h-full md:min-h-0">
      {/* Fullscreen Countdown Overlay when active */}
      {activeCountdown && (
        <CountdownOverlay
          item={activeCountdown.item}
          targetTimeMs={activeCountdown.targetTimeMs}
          secondsLeft={activeSecondsLeft}
          onDismiss={() => setActiveCountdown(null)}
        />
      )}

      {/* Current Schedule Box */}
      <Card
        className="relative p-4 sm:p-5 md:flex-1 md:min-h-0 flex flex-col justify-center"
      >
        <div>
          {/* Header with right-aligned Time Status Metadata */}
          <div className="text-sm uppercase tracking-wider mb-1 text-muted-foreground flex items-center justify-between gap-2">
            <span>{t('schedule.currentSchedule')}</span>
            <div className="font-mono text-[10px] sm:text-xs text-primary px-2 sm:px-2.5 py-0.5 sm:py-1 bg-primary/10 border border-primary/30 rounded-none flex items-center gap-1.5 shrink-0 tracking-wider">
              <span>{t('schedule.endsAt', { time: endsAt })}</span>
            </div>
          </div>
          <div className="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground leading-tight">
            {current.sub}
          </div>
        </div>
        {/* Progress Bar at bottom */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-border/20 overflow-hidden">
          <div
            className="h-full bg-primary/50 transition-all duration-1000 ease-linear"
            style={{ width: `${progress}%` }}
          />
        </div>
      </Card>

      {/* Next Schedule Box */}
      <Card
        className="relative p-4 sm:p-5 md:flex-1 md:min-h-0 flex flex-col justify-center opacity-85 group overflow-hidden"
      >
        <div className="pl-2">
          <div className="text-sm font-bold uppercase tracking-wider mb-1 flex items-center justify-between text-muted-foreground">
            <div className="flex items-center gap-2">
              <span>{t('schedule.nextSchedule')}</span>
              {/* Item counter/badge during playback carousel */}
              {isMediaPlaying && upcomingItems.length > 1 && (
                <Badge
                  variant="outline"
                  className="text-[10px] uppercase font-mono px-1.5 py-0.5 border-primary/40 bg-primary/10 text-primary rounded-none"
                >
                  {t('schedule.upNextBadge', {
                    current: carouselIndex + 1,
                    total: upcomingItems.length,
                  })}
                </Badge>
              )}
              {activeNextItem.countdown && (
                <Badge
                  variant="outline"
                  className="text-[10px] uppercase font-mono px-1.5 py-0.5 gap-1 bg-primary/10 text-primary border-primary/40 rounded-none"
                >
                  <Sparkles className="w-3 h-3" /> Special
                </Badge>
              )}
            </div>

            {/* Dev Mode Test Button */}
            {import.meta.env.DEV && (
              <Button
                variant="outline"
                size="sm"
                chamfer="top-right"
                onClick={handleTestCountdown}
                className="h-6 text-[10px] font-mono px-2 py-0 border-dashed border-amber-500/50 text-amber-500 hover:text-amber-400 hover:bg-amber-500/10 hover:border-amber-400 gap-1 tracking-wider cursor-pointer"
                title="DEV: Test 10-Second Countdown Overlay"
              >
                <Timer className="w-3 h-3" />
                <span>{activeCountdown ? 'STOP TEST' : 'TEST COUNTDOWN'}</span>
              </Button>
            )}
          </div>

          <div
            className={
              isMediaPlaying
                ? animPhase === 'out'
                  ? 'animate-fade-out-slide-up'
                  : 'animate-fade-in-slide-up'
                : ''
            }
          >
            <div className="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground leading-tight">
              {activeNextItem.sub}{' '}
              <span className="text-foreground/80 font-normal">({activeNextItem.start})</span>
            </div>
          </div>
        </div>

        {/* 15-Second Carousel Progress Bar: transparent (h-[2px], bg-primary/20) at bottom during Playback */}
        {isMediaPlaying && upcomingItems.length > 1 && (
          <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-white/[0.04] overflow-hidden pointer-events-none">
            <div
              className="h-full bg-primary/20 transition-all duration-100 ease-linear"
              style={{ width: `${carouselProgress}%` }}
            />
          </div>
        )}
      </Card>
    </div>
  );
};

export default ScheduleSection;
