import React, { useState, useEffect } from 'react';
import { Card } from '@boredkevin/ui';
import { pad } from '@/lib/utils';
import { WatchPartyControls } from '@/components/WatchPartyControls';
import { useTranslation } from '@/context/LanguageContext';

const formatClockDate = (now: Date, lang: string) => {
  const locale = lang === 'id' ? 'id-ID' : 'en-US';
  return {
    hours: pad(now.getHours()),
    minutes: pad(now.getMinutes()),
    seconds: pad(now.getSeconds()),
    secValue: now.getSeconds(),
    dayName: now.toLocaleDateString(locale, { weekday: 'long' }).toUpperCase(),
    dayNum: pad(now.getDate()),
    monthShort: now.toLocaleDateString(locale, { month: 'short' }).toUpperCase(),
    year: now.getFullYear().toString(),
  };
};

export const ClockSection: React.FC = () => {
  const { language } = useTranslation();

  const [time, setTime] = useState(() => formatClockDate(new Date(), language));

  useEffect(() => {
    const update = () => {
      setTime(formatClockDate(new Date(), language));
    };
    update();
    const interval = setInterval(update, 1000);

    return () => clearInterval(interval);
  }, [language]);

  return (
    <section className="grid grid-cols-1 gap-3 sm:gap-4 md:gap-5 md:grid-cols-2 flex-shrink-0">
      {/* Clock & Date Box - 50% width matching Schedule column */}
      <Card
        telemetry="SYS.TIME"
        cornerLines
        className="py-3 px-2 sm:py-4 sm:px-4 flex items-center justify-center min-h-[90px]"
      >
        <div className="grid grid-cols-2 divide-x-4 divide-border w-full items-center justify-center">
          {/* Left Side: Time (Centered) */}
          <div className="flex flex-col items-center justify-center px-2 sm:px-4 w-full">
            <div className="font-display text-3xl sm:text-4xl md:text-5xl font-light tracking-wider text-foreground drop-shadow-[0_0_30px_rgba(0,200,212,0.15)] select-none whitespace-nowrap text-center">
              {time.hours}
              <span className="text-primary opacity-80 animate-blink">:</span>
              {time.minutes}
              <span className="text-primary opacity-80 animate-blink">:</span>
              {time.seconds}
            </div>
          </div>

          {/* Right Side: Day & Date Box (Left-aligned in right half) */}
          <div className="flex flex-col items-start justify-center pl-3 sm:pl-8 md:pl-10 w-full font-display text-lg sm:text-2xl md:text-3xl font-light tracking-wider select-none leading-tight text-left">
            <div className="text-foreground font-bold">{time.dayName}</div>
            <div className="text-foreground whitespace-nowrap">{time.dayNum} {time.monthShort} {time.year}</div>
          </div>
        </div>
      </Card>

      {/* Watch Party Control Card - 50% width matching MediaBox column */}
      <Card
        telemetry="SYS.SYNC"
        cornerLines
        className="p-2.5 sm:p-3 md:p-4 flex flex-col justify-center min-h-[90px]"
      >
        <WatchPartyControls />
      </Card>
    </section>
  );
};



