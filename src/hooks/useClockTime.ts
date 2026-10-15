import { useState, useEffect } from 'react';
import { pad } from '@/lib/utils';

export function useClockTime() {
  const [clockTime, setClockTime] = useState(() => {
    const now = new Date();
    return {
      hours: pad(now.getHours()),
      minutes: pad(now.getMinutes()),
      seconds: pad(now.getSeconds()),
    };
  });

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      setClockTime({
        hours: pad(now.getHours()),
        minutes: pad(now.getMinutes()),
        seconds: pad(now.getSeconds()),
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return clockTime;
}
