import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { ScheduleData, CurrentAndNextSchedule } from '@/types/schedule';
import { timeToMinutes } from '@/lib/utils';
import { useTranslation } from '@/context/LanguageContext';

const DAYS_ID = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

export const ScheduleSection: React.FC = () => {
  const { t } = useTranslation();
  const [scheduleData, setScheduleData] = useState<ScheduleData | null>(null);
  const [now, setNow] = useState<Date>(new Date());

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

  const getSchedule = (): CurrentAndNextSchedule => {
    const fallbackItem = { start: "00:00", sub: t('schedule.loading') };
    if (!scheduleData) return { current: fallbackItem, next: fallbackItem };

    const daySchedule = scheduleData[dayName] || scheduleData["Senin"] || [];
    if (daySchedule.length === 0) return { current: fallbackItem, next: fallbackItem };

    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    for (let i = 0; i < daySchedule.length; i++) {
      const current = daySchedule[i];
      const next = daySchedule[i + 1];

      if (next) {
        if (currentMinutes >= timeToMinutes(current.start) && currentMinutes < timeToMinutes(next.start)) {
          return { current, next };
        }
      } else {
        if (currentMinutes >= timeToMinutes(current.start)) {
          const tomorrowIdx = (DAYS_ID.indexOf(dayName) + 1) % 7;
          const tomorrowName = DAYS_ID[tomorrowIdx];
          const tomorrowSchedule = scheduleData[tomorrowName] || scheduleData["Senin"] || [];
          return { current, next: tomorrowSchedule[0] || current };
        }
      }
    }

    return { current: daySchedule[0], next: daySchedule[1] || daySchedule[0] };
  };

  const { current, next } = getSchedule();

  return (
    <div className="flex flex-col gap-3 sm:gap-4 h-full md:min-h-0">
      {/* Current Schedule Box */}
      <Card className="relative overflow-hidden p-4 sm:p-5 md:flex-1 md:min-h-0 flex flex-col justify-center rounded-none border border-border bg-surface">
        <div className="absolute top-0 bottom-0 left-0 w-1 bg-primary" />
        <div className="pl-2">
          <div className="text-m font-bold uppercase tracking-wider mb-1">
            {t('schedule.currentSchedule')}
          </div>
          <div className="text-2xl sm:text-3xl lg:text-4xl font-bold text-text leading-tight">
            {current.sub}
          </div>
        </div>
      </Card>

      {/* Next Schedule Box */}
      <Card className="relative overflow-hidden p-4 sm:p-5 md:flex-1 md:min-h-0 flex flex-col justify-center rounded-none border border-border bg-surface opacity-80">
        <div className="absolute top-0 bottom-0 left-0 w-1 bg-primary/70" />
        <div className="pl-2">
          <div className="text-m font-bold uppercase tracking-wider mb-1">
            {t('schedule.nextSchedule')}
          </div>
          <div className="text-2xl sm:text-3xl lg:text-4xl font-bold text-text leading-tight">
            {next.sub} <span className="text-text font-normal">({next.start})</span>
          </div>
        </div>
      </Card>
    </div>
  );
};
