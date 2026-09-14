import { useState, useEffect } from 'react';
import { ScheduleData, ScheduleItem } from '@/types/schedule';
import { timeToMinutes } from '@/lib/utils';
import { useTranslation } from '@/context/LanguageContext';

export const DAYS_ID = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

export interface UseScheduleReturn {
  scheduleData: ScheduleData | null;
  now: Date;
  current: ScheduleItem;
  next: ScheduleItem;
  upcomingItems: ScheduleItem[];
  progress: number;
  secondsToNext: number;
  nextEndDateMs: number;
  endsAt: string;
  dayName: string;
  isTomorrow: boolean;
}

let cachedScheduleData: ScheduleData | null = null;

export const useSchedule = (): UseScheduleReturn => {
  const { t } = useTranslation();
  const [scheduleData, setScheduleData] = useState<ScheduleData | null>(cachedScheduleData);
  const [now, setNow] = useState<Date>(new Date());

  useEffect(() => {
    if (cachedScheduleData) {
      setScheduleData(cachedScheduleData);
      return;
    }

    let isMounted = true;
    fetch('/schedule.json')
      .then((res) => res.json())
      .then((data: ScheduleData) => {
        cachedScheduleData = data;
        if (isMounted) setScheduleData(data);
      })
      .catch((err) => console.error('Failed to load schedule.json:', err));

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const dayName = DAYS_ID[now.getDay()];

  const fallbackItem: ScheduleItem = { start: "00:00", sub: t('schedule.loading') };

  if (!scheduleData) {
    return {
      scheduleData: null,
      now,
      current: fallbackItem,
      next: fallbackItem,
      upcomingItems: [],
      progress: 0,
      secondsToNext: 99999,
      nextEndDateMs: 0,
      endsAt: "--:--",
      dayName,
      isTomorrow: false,
    };
  }

  const daySchedule = scheduleData[dayName] || scheduleData["Senin"] || [];
  if (daySchedule.length === 0) {
    return {
      scheduleData,
      now,
      current: fallbackItem,
      next: fallbackItem,
      upcomingItems: [],
      progress: 0,
      secondsToNext: 99999,
      nextEndDateMs: 0,
      endsAt: "--:--",
      dayName,
      isTomorrow: false,
    };
  }

  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  let currentIndex = 0;
  let found = false;

  for (let i = 0; i < daySchedule.length; i++) {
    const current = daySchedule[i];
    const next = daySchedule[i + 1];

    if (next) {
      if (currentMinutes >= timeToMinutes(current.start) && currentMinutes < timeToMinutes(next.start)) {
        currentIndex = i;
        found = true;
        break;
      }
    } else {
      if (currentMinutes >= timeToMinutes(current.start)) {
        currentIndex = i;
        found = true;
        break;
      }
    }
  }

  if (!found) {
    currentIndex = 0;
  }

  const currentItem = daySchedule[currentIndex];
  const subsequentToday = daySchedule.slice(currentIndex + 1);

  let nextItem: ScheduleItem;
  let upcomingItems: ScheduleItem[];
  let isNextTomorrow = false;

  if (subsequentToday.length > 0) {
    nextItem = subsequentToday[0];
    upcomingItems = subsequentToday;
    isNextTomorrow = false;
  } else {
    const tomorrowIdx = (DAYS_ID.indexOf(dayName) + 1) % 7;
    const tomorrowName = DAYS_ID[tomorrowIdx];
    const tomorrowSchedule = scheduleData[tomorrowName] || scheduleData["Senin"] || [];
    nextItem = tomorrowSchedule[0] || currentItem;
    upcomingItems = tomorrowSchedule.length > 0 ? tomorrowSchedule : [nextItem];
    isNextTomorrow = true;
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

  return {
    scheduleData,
    now,
    current: currentItem,
    next: nextItem,
    upcomingItems,
    progress,
    secondsToNext,
    nextEndDateMs: endDate.getTime(),
    endsAt: nextItem.start,
    dayName,
    isTomorrow: isNextTomorrow,
  };
};
