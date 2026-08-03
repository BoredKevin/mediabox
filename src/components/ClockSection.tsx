import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { pad } from '@/lib/utils';
import { WatchPartyControls } from '@/components/WatchPartyControls';

export const ClockSection: React.FC = () => {
  const [time, setTime] = useState<{ hours: string; minutes: string; seconds: string; secValue: number }>(() => {
    const now = new Date();
    return {
      hours: pad(now.getHours()),
      minutes: pad(now.getMinutes()),
      seconds: pad(now.getSeconds()),
      secValue: now.getSeconds(),
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
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const progressPercentage = (time.secValue / 60) * 100;

  return (
    <section className="grid grid-cols-1 gap-3 sm:gap-4 md:gap-5 md:grid-cols-2 flex-shrink-0">
      {/* Clock Box - 50% width matching Schedule column */}
      <Card className="flex flex-col items-center justify-center py-3 px-5 sm:py-4 sm:px-6 rounded-none border border-slate-800 bg-surface">
        <div className="font-display text-4xl font-light tracking-wider text-text sm:text-5xl md:text-6xl drop-shadow-[0_0_30px_rgba(0,200,212,0.25)] select-none">
          {time.hours}
          <span className="text-[#00c8d4] opacity-80 animate-blink">:</span>
          {time.minutes}
          <span className="text-[#00c8d4] opacity-80 animate-blink">:</span>
          {time.seconds}
        </div>

        {/* Seconds Progress Bar Wrap */}
        <div className="mt-2 flex w-full max-w-sm items-center gap-3">
          <span className="font-display text-xs text-text-faint min-w-[2.5ch]">
            {time.seconds}
          </span>
          <Progress value={progressPercentage} className="h-[2px] flex-1 rounded-none" />
        </div>
      </Card>

      {/* Watch Party Control Card - 50% width matching MediaBox column */}
      <Card className="p-3 sm:p-4 rounded-none border border-slate-800 bg-surface flex flex-col justify-center min-h-[90px]">
        <WatchPartyControls />
      </Card>
    </section>
  );
};

