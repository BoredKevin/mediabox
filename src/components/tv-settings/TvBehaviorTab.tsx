import React from 'react';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Timer, MusicIcon, Mic2, RotateCcw, Type } from 'lucide-react';
import { useTranslation } from '@/context/LanguageContext';
import { RoomState, SearchSettings } from '@/lib/roomUtils';

interface TvBehaviorTabProps {
  roomState: RoomState | null;
  searchSettings: SearchSettings;
  onToggleCountdown: () => Promise<void>;
  onUpdateSearchSettings: (patch: Partial<SearchSettings>) => Promise<void>;
  onSetLyricsOffset?: (offsetMs: number) => Promise<void>;
  onSetLyricsWordSync?: (enabled: boolean) => Promise<void>;
}

export const TvBehaviorTab: React.FC<TvBehaviorTabProps> = ({
  roomState,
  searchSettings,
  onToggleCountdown,
  onUpdateSearchSettings,
  onSetLyricsOffset,
  onSetLyricsWordSync,
}) => {
  const { t } = useTranslation();
  const currentOffset = roomState?.lyricsOffsetMs ?? 0;

  const handleOffsetStep = (delta: number) => {
    if (!onSetLyricsOffset) return;
    const next = Math.min(5000, Math.max(-5000, currentOffset + delta));
    onSetLyricsOffset(next);
  };

  const handleResetOffset = () => {
    if (!onSetLyricsOffset) return;
    onSetLyricsOffset(0);
  };

  return (
    <div className="space-y-4">
      {/* 10-Second Countdown Overlay Toggle */}
      <div className="flex items-center justify-between p-3.5 bg-muted/20 border border-border">
        <div className="flex items-start gap-3">
          <Timer className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
          <div className="space-y-0.5">
            <p className="text-xs font-semibold text-foreground">
              {t('tvSettings.countdownTitle')}
            </p>
            <p className="text-[11px] text-muted-foreground leading-relaxed max-w-sm">
              {t('tvSettings.countdownDesc')}
            </p>
          </div>
        </div>
        <Switch
          checked={Boolean(roomState?.isCountdownEnabled)}
          onCheckedChange={onToggleCountdown}
          className="ml-4"
        />
      </div>

      {/* Prefer Music Videos / Innertube Music Search Toggle */}
      <div className="flex items-center justify-between p-3.5 bg-muted/20 border border-border">
        <div className="flex items-start gap-3">
          <MusicIcon className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
          <div className="space-y-0.5">
            <p className="text-xs font-semibold text-foreground">
              {t('tvSettings.preferMusicVideosTitle')}
            </p>
            <p className="text-[11px] text-muted-foreground leading-relaxed max-w-sm">
              {t('tvSettings.preferMusicVideosDesc')}
            </p>
          </div>
        </div>
        <Switch
          checked={Boolean(searchSettings.preferMusicVideos)}
          onCheckedChange={(checked) =>
            onUpdateSearchSettings({ preferMusicVideos: checked })
          }
          className="ml-4"
        />
      </div>

      {/* Word-by-Word Lyrics Sync Toggle */}
      <div className="flex items-center justify-between p-3.5 bg-muted/20 border border-border">
        <div className="flex items-start gap-3">
          <Type className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <p className="text-xs font-semibold text-foreground">
                {t('tvSettings.lyricsWordSyncTitle') || 'Word-by-Word Sync'}
              </p>
              <span className="text-[10px] px-1.5 py-0.5 bg-primary/20 text-primary border border-primary/30 font-mono rounded">
                {t('tvSettings.lyricsWordSyncBadge') || 'Optimized'}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed max-w-sm">
              {t('tvSettings.lyricsWordSyncDesc') || 'Highlights full words instead of syllables. Recommended on Smart TVs to eliminate micro-stutters and reduce CPU load.'}
            </p>
          </div>
        </div>
        <Switch
          checked={Boolean(roomState?.lyricsWordSync ?? true)}
          onCheckedChange={(checked) =>
            onSetLyricsWordSync && onSetLyricsWordSync(checked)
          }
          className="ml-4"
        />
      </div>

      {/* Lyrics Synchronization Offset */}
      <div className="p-3.5 bg-muted/20 border border-border space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <Mic2 className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
            <div className="space-y-0.5">
              <p className="text-xs font-semibold text-foreground">
                {t('tvSettings.lyricsOffsetTitle') || 'Lyrics Sync Offset'}
              </p>
              <p className="text-[11px] text-muted-foreground leading-relaxed max-w-sm">
                {t('tvSettings.lyricsOffsetDesc') || 'Adjust timing if lyrics appear earlier or later than the vocals.'}
              </p>
            </div>
          </div>
          <div className="text-right flex-shrink-0 font-mono">
            <span className="text-xs font-bold text-primary">
              {currentOffset > 0 ? `+${currentOffset}ms` : `${currentOffset}ms`}
            </span>
            <p className="text-[10px] text-muted-foreground">
              {currentOffset === 0
                ? 'Synced'
                : currentOffset > 0
                ? `+${(currentOffset / 1000).toFixed(2)}s early`
                : `${(currentOffset / 1000).toFixed(2)}s late`}
            </p>
          </div>
        </div>

        {/* Stepper Presets */}
        <div className="grid grid-cols-5 gap-1.5 pt-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleOffsetStep(-500)}
            className="text-[11px] font-mono h-7 px-1"
          >
            -0.5s
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleOffsetStep(-100)}
            className="text-[11px] font-mono h-7 px-1"
          >
            -0.1s
          </Button>
          <Button
            variant={currentOffset === 0 ? 'secondary' : 'cyber'}
            size="sm"
            onClick={handleResetOffset}
            className="text-[11px] font-mono h-7 px-1 flex items-center justify-center gap-1"
          >
            <RotateCcw className="w-3 h-3" />
            <span>0s</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleOffsetStep(100)}
            className="text-[11px] font-mono h-7 px-1"
          >
            +0.1s
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleOffsetStep(500)}
            className="text-[11px] font-mono h-7 px-1"
          >
            +0.5s
          </Button>
        </div>

        {/* Range Slider */}
        <div className="pt-2">
          <Slider
            value={[currentOffset]}
            min={-5000}
            max={5000}
            step={50}
            onValueChange={(val) => onSetLyricsOffset && onSetLyricsOffset(val[0])}
            className="w-full cursor-pointer py-1.5"
          />
          <div className="flex justify-between text-[10px] font-mono text-muted-foreground mt-1">
            <span>-5.0s (later)</span>
            <span>0.0s</span>
            <span>+5.0s (earlier)</span>
          </div>
        </div>
      </div>
    </div>
  );
};

