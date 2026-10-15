import { useState, useEffect } from 'react';
import { pad } from '@/lib/utils';

/**
 * Low-power Smart TV optimized clock hook.
 * Only updates state on exact minute boundaries, eliminating 59 unnecessary
 * React re-renders per minute across the MediaBox player tree.
 */
export function useClockTime() {
  const [clockTime, setClockTime] = useState(() => {
    const now = new Date();
    return {
      hours: pad(now.getHours()),
      minutes: pad(now.getMinutes()),
      seconds: '00',
    };
  });

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const updateClock = () => {
      const now = new Date();
      const nextHours = pad(now.getHours());
      const nextMinutes = pad(now.getMinutes());

      setClockTime((prev) => {
        if (prev.hours === nextHours && prev.minutes === nextMinutes) {
          return prev;
        }
        return {
          hours: nextHours,
          minutes: nextMinutes,
          seconds: '00',
        };
      });
    };

    // Calculate delay until the next exact minute boundary
    const now = new Date();
    const delayToNextMinute = (60 - now.getSeconds()) * 1000 - now.getMilliseconds() + 50;

    timeoutId = setTimeout(() => {
      updateClock();
      // Once aligned to minute boundary, tick every 60 seconds
      intervalId = setInterval(updateClock, 60000);
    }, Math.max(50, delayToNextMinute));

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (intervalId) clearInterval(intervalId);
    };
  }, []);

  return clockTime;
}
