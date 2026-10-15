import React, { useState, useEffect } from 'react';
import { ref, onValue, off } from 'firebase/database';
import { database } from '@/lib/firebase';
import { Button, Input } from '@boredkevin/ui';
import { Gauge, Check, RotateCcw } from 'lucide-react';
import { useTranslation } from '@/context/LanguageContext';
import { SearchSettings } from '@/lib/roomUtils';

interface TvLimitsTabProps {
  roomCode: string | null;
  searchSettings: SearchSettings;
  onUpdateSearchSettings: (patch: Partial<SearchSettings>) => Promise<void>;
  onClearAllRateLimits: () => Promise<void>;
}

interface RateLimitEntry {
  uid: string;
  count: number;
  windowStart: number;
}

export const TvLimitsTab: React.FC<TvLimitsTabProps> = ({
  roomCode,
  searchSettings,
  onUpdateSearchSettings,
  onClearAllRateLimits,
}) => {
  const { t } = useTranslation();

  const [rateLimitCountInput, setRateLimitCountInput] = useState<number>(
    searchSettings.rateLimitCount || 10
  );
  const [rateLimitWindowInput, setRateLimitWindowInput] = useState<number>(
    searchSettings.rateLimitWindowMs || 300000
  );
  const [maxResultsInput, setMaxResultsInput] = useState<number>(
    searchSettings.maxResults || 25
  );
  const [rateLimitSaved, setRateLimitSaved] = useState(false);
  const [activeRateLimits, setActiveRateLimits] = useState<RateLimitEntry[]>([]);

  useEffect(() => {
    setRateLimitCountInput(searchSettings.rateLimitCount || 10);
    setRateLimitWindowInput(searchSettings.rateLimitWindowMs || 300000);
    setMaxResultsInput(searchSettings.maxResults || 25);
  }, [searchSettings]);

  // Subscribe to RTDB searchRateLimits
  useEffect(() => {
    if (!roomCode) return;

    const rateLimitsRef = ref(database, `rooms/${roomCode}/searchRateLimits`);
    const unsub = onValue(rateLimitsRef, (snapshot) => {
      if (snapshot.exists()) {
        const val = snapshot.val();
        const entries: RateLimitEntry[] = Object.entries(val).map(
          ([uid, item]: [string, any]) => ({
            uid,
            count: item?.count || 0,
            windowStart: item?.windowStart || Date.now(),
          })
        );
        setActiveRateLimits(entries);
      } else {
        setActiveRateLimits([]);
      }
    });

    return () => off(rateLimitsRef);
  }, [roomCode]);

  const handleSaveRateLimits = async (e: React.FormEvent) => {
    e.preventDefault();
    await onUpdateSearchSettings({
      rateLimitCount: Number(rateLimitCountInput) || 10,
      rateLimitWindowMs: Number(rateLimitWindowInput) || 300000,
      maxResults: Math.max(1, Math.min(50, Number(maxResultsInput) || 25)),
    });
    setRateLimitSaved(true);
    setTimeout(() => setRateLimitSaved(false), 2000);
  };

  return (
    <div className="space-y-4">
      <form onSubmit={handleSaveRateLimits} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground block mb-1">
              Time Window (ms)
            </label>
            <Input
              type="number"
              min={10000}
              step={1000}
              value={rateLimitWindowInput}
              onChange={(e) => setRateLimitWindowInput(Number(e.target.value))}
              className="text-xs font-mono h-9"
            />
          </div>

          <div>
            <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground block mb-1">
              Max Searches
            </label>
            <Input
              type="number"
              min={1}
              max={100}
              value={rateLimitCountInput}
              onChange={(e) => setRateLimitCountInput(Number(e.target.value))}
              className="text-xs font-mono h-9"
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground block mb-1">
            {t('tvSettings.maxResults')} (1 - 50)
          </label>
          <Input
            type="number"
            min={1}
            max={50}
            value={maxResultsInput}
            onChange={(e) => setMaxResultsInput(Number(e.target.value))}
            className="text-xs font-mono h-9"
          />
        </div>

        <Button
          type="submit"
          variant="cyber"
          chamfer="dual"
          className="w-full text-xs font-bold uppercase tracking-wider h-9 flex items-center justify-center gap-1.5 cursor-pointer"
        >
          {rateLimitSaved ? (
            <>
              <Check className="w-3.5 h-3.5" />
              <span>Saved!</span>
            </>
          ) : (
            <>
              <Gauge className="w-3.5 h-3.5" />
              <span>{t('tvSettings.saveLimitBtn')}</span>
            </>
          )}
        </Button>
      </form>

      {/* Active Rate Limits List */}
      <div className="space-y-2 pt-2 border-t border-border">
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
            {t('tvSettings.activeRateLimits')} ({activeRateLimits.length})
          </span>
          {activeRateLimits.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={onClearAllRateLimits}
              className="text-[10px] font-mono uppercase tracking-wider h-6 px-2 text-destructive border-destructive/40 hover:bg-destructive/10 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3 mr-1" />
              <span>{t('tvSettings.clearRateLimits')}</span>
            </Button>
          )}
        </div>

        {activeRateLimits.length === 0 ? (
          <p className="text-xs text-muted-foreground/60 italic py-2">
            {t('tvSettings.noRateLimits')}
          </p>
        ) : (
          <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
            {activeRateLimits.map((entry) => (
              <div
                key={entry.uid}
                className="flex items-center justify-between p-2 bg-muted/20 border border-border text-xs font-mono"
              >
                <span className="truncate text-muted-foreground max-w-[160px]">
                  {entry.uid}
                </span>
                <span className="text-primary font-bold">
                  {entry.count} / {rateLimitCountInput}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
