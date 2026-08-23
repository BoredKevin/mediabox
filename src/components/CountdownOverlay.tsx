import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import confetti from 'canvas-confetti';
import { ScheduleItem } from '@/types/schedule';
import { useTranslation } from '@/context/LanguageContext';
import { X } from 'lucide-react';
import { Button } from '@boredkevin/ui';

interface CountdownOverlayProps {
  item: ScheduleItem;
  secondsLeft?: number;
  targetTimeMs?: number;
  onDismiss?: () => void;
}

export const CountdownOverlay: React.FC<CountdownOverlayProps> = ({
  item,
  secondsLeft: initialSecondsLeft = 0,
  targetTimeMs,
  onDismiss,
}) => {
  const { t } = useTranslation();
  const hasFiredConfetti = useRef(false);

  const [seconds, setSeconds] = useState(() => {
    if (targetTimeMs) {
      return Math.max(0, Math.ceil((targetTimeMs - Date.now()) / 1000));
    }
    return initialSecondsLeft;
  });

  useEffect(() => {
    if (!targetTimeMs) {
      setSeconds(initialSecondsLeft);
      return;
    }

    const update = () => {
      const remaining = Math.max(0, Math.ceil((targetTimeMs - Date.now()) / 1000));
      setSeconds(remaining);
    };

    update();
    const interval = setInterval(update, 50);
    return () => clearInterval(interval);
  }, [targetTimeMs, initialSecondsLeft]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onDismiss) {
        onDismiss();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onDismiss]);

  useEffect(() => {
    if (seconds > 0) {
      hasFiredConfetti.current = false;
    } else if (seconds <= 0 && !hasFiredConfetti.current) {
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
          zIndex: 10001,
          colors: ['#00c8d4', '#3b82f6', '#ec4899', '#f59e0b', '#10b981'],
        });
        confetti({
          particleCount: 10,
          angle: 120,
          spread: 60,
          origin: { x: 1, y: 0.7 },
          zIndex: 10001,
          colors: ['#00c8d4', '#3b82f6', '#ec4899', '#f59e0b', '#10b981'],
        });

        if (Date.now() < animationEnd) {
          requestAnimationFrame(frame);
        }
      };
      frame();
    }
  }, [seconds]);

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center p-4 sm:p-6 md:p-8 bg-black/85 backdrop-blur-2xl animate-overlay-fade select-none">
      {/* Dismiss Button */}
      {onDismiss && (
        <Button
          variant="ghost"
          size="icon"
          chamfer="none"
          onClick={onDismiss}
          className="absolute top-4 right-4 z-50 text-muted-foreground hover:text-white hover:bg-white/10"
          title="Close (Esc)"
        >
          <X className="w-6 h-6" />
        </Button>
      )}

      {/* Subtle neutral radial vignette for depth */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_transparent_20%,_rgba(0,0,0,0.7)_100%)] pointer-events-none" />

      {/* Main Countdown / Completion Container */}
      <div className="relative z-10 flex flex-col items-center justify-center text-center w-full max-w-6xl mx-auto px-4">
        {seconds > 0 ? (
          <div
            key={seconds}
            className="animate-countdown-fade text-9xl sm:text-[12rem] md:text-[16rem] lg:text-[20rem] font-extrabold font-display tracking-tight text-white drop-shadow-[0_0_50px_rgba(255,255,255,0.4)] select-none leading-none"
          >
            {seconds}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 max-w-5xl animate-in fade-in zoom-in-95 duration-500">
            <div className="text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-black font-display uppercase tracking-wider text-amber-300 drop-shadow-[0_0_45px_rgba(251,191,36,0.65)] leading-tight">
              {t('schedule.timeFor', { name: item.sub })}
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};
