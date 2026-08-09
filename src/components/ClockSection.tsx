import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { pad } from '@/lib/utils';
import { WatchPartyControls } from '@/components/WatchPartyControls';

const SHORT_DAYS = ["MINGGU", "SENIN", "SELASA", "RABU", "KAMIS", "JUMAT", "SABTU"];
const SHORT_MONTHS = ["JAN", "FEB", "MAR", "APR", "MEI", "JUN", "JUL", "AGU", "SEP", "OKT", "NOV", "DES"];

export const ClockSection: React.FC = () => {
  const [time, setTime] = useState<{
    hours: string;
    minutes: string;
    seconds: string;
    secValue: number;
    dayName: string;
    dayNum: string;
    monthShort: string;
    year: string;
  }>(() => {
    const now = new Date();
    return {
      hours: pad(now.getHours()),
      minutes: pad(now.getMinutes()),
      seconds: pad(now.getSeconds()),
      secValue: now.getSeconds(),
      dayName: SHORT_DAYS[now.getDay()],
      dayNum: pad(now.getDate()),
      monthShort: SHORT_MONTHS[now.getMonth()],
      year: now.getFullYear().toString(),
    };
  });

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      setTime({
        hours: pad(now.getHours()),
        minutes: pad(now.getMinutes()),
        seconds: pad(now.getSeconds()),
        secValue: now.getSeconds(),
        dayName: SHORT_DAYS[now.getDay()],
        dayNum: pad(now.getDate()),
        monthShort: SHORT_MONTHS[now.getMonth()],
        year: now.getFullYear().toString(),
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const progressPercentage = (time.secValue / 60) * 100;

  return (
    <section className="grid grid-cols-1 gap-3 sm:gap-4 md:gap-5 md:grid-cols-2 flex-shrink-0">
      {/* Clock & Date Box - 50% width matching Schedule column */}
      <Card className="grid grid-cols-2 divide-x-4 divide-border py-3 px-2 sm:py-4 sm:px-4 rounded-none border border-border bg-surface items-center justify-center min-h-[90px]">
        {/* Left Side: Time & Seconds Progress (Centered) */}
        <div className="flex flex-col items-center justify-center px-2 sm:px-4 w-full">
          <div className="font-display text-3xl sm:text-4xl md:text-5xl font-light tracking-wider text-text drop-shadow-[0_0_30px_rgba(0,200,212,0.15)] select-none whitespace-nowrap text-center">
            {time.hours}
            <span className="text-primary opacity-80 animate-blink">:</span>
            {time.minutes}
            <span className="text-primary opacity-80 animate-blink">:</span>
            {time.seconds}
          </div>
        </div>

        {/* Right Side: Day & Date Box (Left-aligned in right half) */}
        <div className="flex flex-col items-start justify-center pl-3 sm:pl-8 md:pl-10 w-full font-display text-lg sm:text-2xl md:text-3xl font-light tracking-wider select-none leading-tight text-left">
          <div className="text-text font-medium">{time.dayName}</div>
          <div className="text-text-muted whitespace-nowrap">{time.dayNum} {time.monthShort} {time.year}</div>
        </div>
      </Card>

      {/* Watch Party Control Card - 50% width matching MediaBox column */}
      <Card className="p-3 sm:p-4 rounded-none border border-border bg-surface flex flex-col justify-center min-h-[90px]">
        <WatchPartyControls />
      </Card>
    </section>
  );
};


