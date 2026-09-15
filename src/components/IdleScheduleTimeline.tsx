import React, { useState, useEffect } from 'react';
import { Badge, Button } from '@boredkevin/ui';
import { useSchedule } from '@/hooks/useSchedule';
import { useTranslation } from '@/context/LanguageContext';
import { CalendarDays, Sparkles, Clock, ChevronLeft, ChevronRight } from 'lucide-react';

interface IdleScheduleTimelineProps {
  isLocked?: boolean;
}

export const IdleScheduleTimeline: React.FC<IdleScheduleTimelineProps> = () => {
  const { t } = useTranslation();
  const { upcomingItems, isTomorrow } = useSchedule();
  const [currentPage, setCurrentPage] = useState<number>(0);
  const [cycleProgress, setCycleProgress] = useState<number>(100);
  const [animPhase, setAnimPhase] = useState<'in' | 'out'>('in');

  const itemsPerPage = 3;
  const totalPages = Math.max(1, Math.ceil(upcomingItems.length / itemsPerPage));

  // Reset to page 0 if upcomingItems change
  useEffect(() => {
    setCurrentPage(0);
    setCycleProgress(100);
    setAnimPhase('in');
  }, [upcomingItems.length]);

  // 15-second carousel timer for multi-page rotation (starts filled, then empties)
  // Plays fade-out slide-up before switching, then fade-in slide-up
  useEffect(() => {
    if (totalPages <= 1) {
      setCycleProgress(100);
      setAnimPhase('in');
      return;
    }

    const intervalMs = 15000;
    const tickMs = 100;
    const exitDurationMs = 300;
    let elapsed = 0;

    const interval = setInterval(() => {
      elapsed += tickMs;
      const pct = Math.max(0, (1 - elapsed / intervalMs) * 100);
      setCycleProgress(pct);

      if (elapsed >= intervalMs - exitDurationMs && elapsed < intervalMs) {
        setAnimPhase('out');
      }

      if (elapsed >= intervalMs) {
        elapsed = 0;
        setCycleProgress(100);
        setCurrentPage((prev) => (prev + 1) % totalPages);
        setAnimPhase('in');
      }
    }, tickMs);

    return () => clearInterval(interval);
  }, [totalPages, currentPage]);

  const handlePageChange = (idx: number) => {
    if (idx === currentPage || animPhase === 'out') return;
    setAnimPhase('out');
    setTimeout(() => {
      setCurrentPage(idx);
      setAnimPhase('in');
      setCycleProgress(100);
    }, 250);
  };

  const handlePrevPage = () => {
    if (animPhase === 'out') return;
    handlePageChange((currentPage - 1 + totalPages) % totalPages);
  };

  const handleNextPage = () => {
    if (animPhase === 'out') return;
    handlePageChange((currentPage + 1) % totalPages);
  };

  const startIndex = currentPage * itemsPerPage;
  const currentItems = upcomingItems.slice(startIndex, startIndex + itemsPerPage);

  return (
    <div className="w-full h-full flex flex-col justify-between p-4 sm:p-6 md:p-8 bg-black/90 relative overflow-hidden select-none">
      {/* Top 15s Progress Line: high transparency (bg-primary/20, h-[2px]) as to not distract */}
      {totalPages > 1 && (
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-white/[0.04] overflow-hidden z-20 pointer-events-none">
          <div
            className="h-full bg-primary/20 transition-all duration-100 ease-linear"
            style={{ width: `${cycleProgress}%` }}
          />
        </div>
      )}

      {/* Header Row */}
      <div className="flex items-center justify-between z-10 border-b border-border/40 pb-3 sm:pb-4">
        <div className="flex items-center gap-2 sm:gap-2.5">
          <CalendarDays className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
          <span className="text-xs sm:text-sm md:text-base font-bold uppercase tracking-wider text-muted-foreground">
            {t('schedule.upcomingAgenda')}
          </span>
          {isTomorrow && (
            <Badge variant="outline" className="text-[10px] font-mono uppercase px-1.5 py-0 border-border/60 text-muted-foreground">
              {t('schedule.tomorrow')}
            </Badge>
          )}
        </div>

        {/* Page indicator pill */}
        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <span className="text-xs sm:text-sm font-mono tracking-wider text-muted-foreground">
              {t('schedule.pageIndicator', { current: currentPage + 1, total: totalPages })}
            </span>
          </div>
        )}
      </div>

      {/* Main 3-Line Vertical Agenda Timeline with fade-out/fade-in slide-up animation */}
      <div
        className={`flex-1 grid grid-rows-3 items-center py-3 sm:py-4 gap-3 sm:gap-4 relative z-10 ${animPhase === 'out' ? 'animate-fade-out-slide-up' : 'animate-fade-in-slide-up'
          }`}
      >
        {currentItems.length > 0 ? (
          Array.from({ length: itemsPerPage }).map((_, slotIdx) => {
            const item = currentItems[slotIdx];
            if (item) {
              return (
                <div
                  key={`${item.start}-${item.sub}-${slotIdx}`}
                  className="flex items-center gap-3 sm:gap-4 md:gap-5 group"
                >
                  {/* Monospace Time Pill styled like the ends at badge */}
                  <div className="font-mono text-sm sm:text-base md:text-lg font-medium text-foreground px-2 sm:px-2.5 py-1 bg-muted/20 border border-border/60 rounded-none w-20 sm:w-24 md:w-28 text-center shrink-0 tracking-wider flex items-center justify-center gap-1.5">
                    <span>{item.start}</span>
                  </div>

                  {/* Title*/}
                  <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
                    <span className="text-sm sm:text-lg md:text-2xl font-bold text-foreground truncate tracking-tight">
                      {item.sub}
                    </span>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={`placeholder-slot-${slotIdx}`}
                className="flex items-center gap-3 sm:gap-4 md:gap-5 invisible pointer-events-none select-none"
                aria-hidden="true"
              >
                <div className="font-mono text-xs sm:text-sm md:text-base px-2 sm:px-2.5 py-1 w-20 sm:w-24 md:w-28 border">
                  --:--
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-sm sm:text-lg md:text-2xl">&nbsp;</span>
                </div>
              </div>
            );
          })
        ) : (
          <div className="row-span-3 flex flex-col items-center justify-center text-center text-muted-foreground p-6">
            <p className="text-sm font-mono">{t('schedule.noMoreToday')}</p>
          </div>
        )}
      </div>

      {/* Footer Navigation (if multiple pages) */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 sm:gap-3 z-10 pt-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            chamfer="none"
            onClick={(e) => {
              e.stopPropagation();
              handlePrevPage();
            }}
            aria-label={t('schedule.previousPage')}
            title={t('schedule.previousPage')}
            className="h-7 w-7 sm:h-8 sm:w-8 text-muted-foreground hover:text-foreground hover:bg-white/10 rounded-full cursor-pointer transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <div className="flex items-center gap-1.5">
            {Array.from({ length: totalPages }).map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handlePageChange(idx);
                }}
                aria-label={`Go to page ${idx + 1}`}
                className={`h-1.5 transition-all duration-300 rounded-full cursor-pointer ${idx === currentPage ? 'w-6 bg-primary' : 'w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/60'
                  }`}
              />
            ))}
          </div>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            chamfer="none"
            onClick={(e) => {
              e.stopPropagation();
              handleNextPage();
            }}
            aria-label={t('schedule.nextPage')}
            title={t('schedule.nextPage')}
            className="h-7 w-7 sm:h-8 sm:w-8 text-muted-foreground hover:text-foreground hover:bg-white/10 rounded-full cursor-pointer transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
};

export default IdleScheduleTimeline;
