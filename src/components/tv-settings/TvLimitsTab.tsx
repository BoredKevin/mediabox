import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Gauge, Check, ShieldCheck } from 'lucide-react';
import { useTranslation } from '@/context/LanguageContext';
import { SearchSettings } from '@/lib/roomUtils';

interface TvLimitsTabProps {
  roomCode: string | null;
  searchSettings: SearchSettings;
  onUpdateSearchSettings: (patch: Partial<SearchSettings>) => Promise<void>;
  onClearAllRateLimits: () => Promise<void>;
}

export const TvLimitsTab: React.FC<TvLimitsTabProps> = ({
  searchSettings,
  onUpdateSearchSettings,
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

  useEffect(() => {
    setRateLimitCountInput(searchSettings.rateLimitCount || 10);
    setRateLimitWindowInput(searchSettings.rateLimitWindowMs || 300000);
    setMaxResultsInput(searchSettings.maxResults || 25);
  }, [searchSettings]);

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
              Max Requests / Window
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
            Max Search Results
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

      {/* Cloudflare Turnstile & Convex Verification Status */}
      <div className="p-3 bg-muted/20 border border-border flex items-start gap-2.5 rounded-md text-xs">
        <ShieldCheck className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
        <div className="space-y-1">
          <p className="font-semibold text-foreground">Convex & Cloudflare Turnstile Verification</p>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Guest YouTube Music searches are validated via Cloudflare Turnstile and rate-limited securely by Convex backend actions. Approved TV screens bypass verification automatically.
          </p>
        </div>
      </div>
    </div>
  );
};
