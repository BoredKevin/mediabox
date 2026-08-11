import React, { useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { ScheduleItem } from '@/types/schedule';
import { useTranslation } from '@/context/LanguageContext';

interface CountdownOverlayProps {
  item: ScheduleItem;
  secondsLeft: number;
  onDismiss?: () => void;
}

export const CountdownOverlay: React.FC<CountdownOverlayProps> = ({ item, secondsLeft }) => {
  const { t } = useTranslation();
  const hasFiredConfetti = useRef(false);

  useEffect(() => {
    if (secondsLeft <= 0 && !hasFiredConfetti.current) {
      hasFiredConfetti.current = true;

      // Confetti burst from multiple angles
      const duration = 2.5 * 1000;
      const animationEnd = Date.now() + duration;

      const frame = () => {
        confetti({
          particleCount: 10,
          angle: 60,
          spread: 60,
          origin: { x: 0, y: 0.7 },
          zIndex: 9999,
          colors: ['#00c8d4', '#3b82f6', '#ec4899', '#f59e0b', '#10b981'],
        });
        confetti({
          particleCount: 10,
          angle: 120,
          spread: 60,
          origin: { x: 1, y: 0.7 },
          zIndex: 9999,
          colors: ['#00c8d4', '#3b82f6', '#ec4899', '#f59e0b', '#10b981'],
        });

        if (Date.now() < animationEnd) {
          requestAnimationFrame(frame);
        }
      };
      frame();
    }
  }, [secondsLeft]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xl transition-all duration-500 animate-in fade-in">
      {/* Ambient background glow element */}
      <div className="absolute inset-0 bg-gradient-to-tr from-cyan-500/10 via-transparent to-blue-600/10 pointer-events-none" />

      {/* Main Countdown Container */}
      <div className="relative z-10 flex flex-col items-center text-center w-full max-w-5xl mx-auto space-y-6">
        {/* Countdown Number / Completion Message */}
        <div className="relative my-2 flex items-center justify-center min-h-[160px]">
          {secondsLeft > 0 ? (
            <div
              key={secondsLeft}
              className="text-8xl sm:text-9xl md:text-[12rem] font-extrabold font-display tracking-tight text-white drop-shadow-[0_0_35px_rgba(0,200,212,0.6)] animate-bounce"
            >
              {secondsLeft}
            </div>
          ) : (
            <div className="text-5xl sm:text-6xl md:text-7xl font-black font-display tracking-wider text-cyan-300 drop-shadow-[0_0_40px_rgba(0,200,212,0.8)] animate-pulse">
              🎉 {t('schedule.itsTime')}
            </div>
          )}
        </div>

        {/* Target Schedule Info */}
        <div className="w-full px-4">
          <div className="text-sm sm:text-base uppercase tracking-widest text-text-muted mb-2 font-mono">
            {t('schedule.nextSchedule')} ({item.start})
          </div>
          <div className="text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-text leading-none whitespace-nowrap overflow-hidden text-ellipsis">
            {item.sub}
          </div>
        </div>
      </div>
    </div>
  );
};
