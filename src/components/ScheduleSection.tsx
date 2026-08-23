import React, { useState, useEffect } from 'react';
import { Card, Badge, Button } from '@boredkevin/ui';
import { ScheduleData, ScheduleItem } from '@/types/schedule';
import { timeToMinutes } from '@/lib/utils';
import { useTranslation } from '@/context/LanguageContext';
import { useWatchParty } from '@/context/WatchPartyContext';
import { CountdownOverlay } from '@/components/CountdownOverlay';
import { Sparkles, Timer } from 'lucide-react';

const DAYS_ID = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

export const ScheduleSection: React.FC = () => {
  const { t } = useTranslation();
  const { roomState } = useWatchParty();
  const [scheduleData, setScheduleData] = useState<ScheduleData | null>(null);
  const [now, setNow] = useState<Date>(new Date());
  const [activeCountdown, setActiveCountdown] = useState<{
    item: ScheduleItem;
    targetTimeMs: number;
  } | null>(null);

  useEffect(() => {
    fetch('/schedule.json')
      .then((res) => res.json())
      .then((data: ScheduleData) => setScheduleData(data))
      .catch((err) => console.error('Failed to load schedule.json:', err));
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const dayName = DAYS_ID[now.getDay()];

  const getScheduleDetails = (): {
    current: ScheduleItem;
    next: ScheduleItem;
    progress: number;
    secondsToNext: number;
    nextEndDateMs: number;
  } => {
    const fallbackItem = { start: "00:00", sub: t('schedule.loading') };
    if (!scheduleData) return { current: fallbackItem, next: fallbackItem, progress: 0, secondsToNext: 99999, nextEndDateMs: 0 };

    const daySchedule = scheduleData[dayName] || scheduleData["Senin"] || [];
    if (daySchedule.length === 0) return { current: fallbackItem, next: fallbackItem, progress: 0, secondsToNext: 99999, nextEndDateMs: 0 };

    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    let currentItem = daySchedule[0];
    let nextItem = daySchedule[1] || daySchedule[0];
    let isNextTomorrow = false;
    let found = false;

    for (let i = 0; i < daySchedule.length; i++) {
      const current = daySchedule[i];
      const next = daySchedule[i + 1];

      if (next) {
        if (currentMinutes >= timeToMinutes(current.start) && currentMinutes < timeToMinutes(next.start)) {
          currentItem = current;
          nextItem = next;
          isNextTomorrow = false;
          found = true;
          break;
        }
      } else {
        if (currentMinutes >= timeToMinutes(current.start)) {
          currentItem = current;
          const tomorrowIdx = (DAYS_ID.indexOf(dayName) + 1) % 7;
          const tomorrowName = DAYS_ID[tomorrowIdx];
          const tomorrowSchedule = scheduleData[tomorrowName] || scheduleData["Senin"] || [];
          nextItem = tomorrowSchedule[0] || current;
          isNextTomorrow = true;
          found = true;
          break;
        }
      }
    }

    if (!found) {
      currentItem = daySchedule[0];
      nextItem = daySchedule[1] || daySchedule[0];
    }

    const startDate = new Date(now);
    const [startH, startM] = currentItem.start.split(':').map(Number);
    startDate.setHours(startH, startM, 0, 0);

    const endDate = new Date(now);
    const [nextH, nextM] = nextItem.start.split(':').map(Number);
    endDate.setHours(nextH, nextM, 0, 0);

    if (isNextTomorrow || endDate.getTime() <= startDate.getTime()) {
      endDate.setDate(endDate.getDate() + 1);
    }

    const totalDuration = endDate.getTime() - startDate.getTime();
    const remainingTime = endDate.getTime() - now.getTime();
    const elapsedTime = now.getTime() - startDate.getTime();
    const secondsToNext = Math.ceil(remainingTime / 1000);

    let progress = 0;
    if (totalDuration > 0) {
      const ratio = Math.max(0, Math.min(1, elapsedTime / totalDuration));
      progress = ratio * 100;
    }

    return { current: currentItem, next: nextItem, progress, secondsToNext, nextEndDateMs: endDate.getTime() };
  };

  const { current, next, progress, secondsToNext, nextEndDateMs } = getScheduleDetails();

  // Handle auto-triggering countdown state
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

  // Handle countdown tick & auto-dismiss after 3s post zero
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
            item: next,
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
          <div className="text-sm font-bold uppercase tracking-wider mb-1 text-muted-foreground">
            {t('schedule.currentSchedule')}
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
        className="relative p-4 sm:p-5 md:flex-1 md:min-h-0 flex flex-col justify-center opacity-85 group"
      >
        <div className="pl-2">
          <div className="text-sm font-bold uppercase tracking-wider mb-1 flex items-center justify-between text-muted-foreground">
            <div className="flex items-center gap-2">
              <span>{t('schedule.nextSchedule')}</span>
              {next.countdown && (
                <Badge variant="outline" className="text-[10px] uppercase font-mono px-1.5 py-0.5 gap-1 bg-primary/10 text-primary border-primary/40 rounded-none">
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
          <div className="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground leading-tight">
            {next.sub} <span className="text-foreground/80 font-normal">({next.start})</span>
          </div>
        </div>
      </Card>
    </div>
  );
};

