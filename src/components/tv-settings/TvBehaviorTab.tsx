import React from 'react';
import { Switch } from '@/components/ui/switch';
import { Timer, Video } from 'lucide-react';
import { useTranslation } from '@/context/LanguageContext';
import { RoomState, SearchSettings } from '@/lib/roomUtils';

interface TvBehaviorTabProps {
  roomState: RoomState | null;
  searchSettings: SearchSettings;
  onToggleCountdown: () => Promise<void>;
  onUpdateSearchSettings: (patch: Partial<SearchSettings>) => Promise<void>;
}

export const TvBehaviorTab: React.FC<TvBehaviorTabProps> = ({
  roomState,
  searchSettings,
  onToggleCountdown,
  onUpdateSearchSettings,
}) => {
  const { t } = useTranslation();

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
          <Video className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
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
    </div>
  );
};
