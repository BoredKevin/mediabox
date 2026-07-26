import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { ScheduleData, CurrentAndNextSchedule } from '@/types/schedule';
import { timeToMinutes } from '@/lib/utils';

const DAYS_ID = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const MONTHS_ID = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember"
];

export const ScheduleSection: React.FC = () => {
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
  const dateFormatted = `${now.getDate()} ${MONTHS_ID[now.getMonth()]} ${now.getFullYear()}`;

  const getSchedule = (): CurrentAndNextSchedule => {
    const fallbackItem = { start: "00:00", sub: "Memuat..." };
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
    <div className="flex flex-col gap-3 sm:gap-4 h-full min-h-0">
      {/* Date Box */}
      <Card className="p-3 sm:p-4 rounded-none border border-slate-800 bg-surface text-base sm:text-lg font-normal text-text-muted flex-shrink-0">
        <span className="font-semibold text-[#00c8d4]">{dayName}</span>, {dateFormatted}
      </Card>

      {/* Current Schedule Box */}
      <Card className="relative overflow-hidden p-4 sm:p-5 flex-1 min-h-0 flex flex-col justify-center rounded-none border border-slate-800 bg-surface">
        <div className="absolute top-0 bottom-0 left-0 w-1 bg-[#00c8d4]" />
        <div className="pl-2">
          <div className="text-xs font-bold uppercase tracking-wider text-text-faint mb-1">
            Jadwal Sekarang
          </div>
          <div className="text-2xl sm:text-3xl lg:text-4xl font-bold text-text leading-tight">
            {current.sub}
          </div>
        </div>
      </Card>

      {/* Next Schedule Box */}
      <Card className="relative overflow-hidden p-4 sm:p-5 flex-1 min-h-0 flex flex-col justify-center rounded-none border border-slate-800 bg-surface opacity-80">
        <div className="absolute top-0 bottom-0 left-0 w-1 bg-[#00c8d4]/70" />
        <div className="pl-2">
          <div className="text-xs font-bold uppercase tracking-wider text-text-faint mb-1">
            Jadwal Berikutnya
          </div>
          <div className="text-2xl sm:text-3xl lg:text-4xl font-bold text-text leading-tight">
            {next.sub} <span className="text-text-faint font-normal">({next.start})</span>
          </div>
        </div>
      </Card>
    </div>
  );
};
