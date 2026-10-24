import React from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import {
  Timer,
  Sparkles,
  MusicIcon,
  Mic2,
  RotateCcw,
  Type,
  ShieldCheck,
} from 'lucide-react';
import { useTranslation } from '@/context/LanguageContext';
import { RoomState } from '@/lib/roomUtils';
import { saveLyricsOffset } from '@/lib/lyricsOffsetStore';
import { RemoteActions } from '../hooks/useRemoteActions';

interface HostSettingsBehaviorSectionProps {
  roomState: RoomState | null;
  actions: RemoteActions;
}

export const HostSettingsBehaviorSection: React.FC<HostSettingsBehaviorSectionProps> = ({
  roomState,
  actions,
}) => {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <div className="p-4 bg-muted/10 border border-border flex flex-col gap-3">
        <span className="text-xs font-mono font-bold uppercase tracking-wider text-muted-foreground">
          {t('tvSettings.title')}
        </span>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {/* Autoplay Toggle */}
          <div className="p-3 bg-card border border-border flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <Sparkles className="w-4 h-4 text-purple-400 flex-shrink-0" />
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-bold text-foreground truncate">
                  {t('remote.autoplayMode')}
                </span>
                <span className="text-[10px] text-muted-foreground truncate">
                  Autoplay recommended tracks when queue is empty.
                </span>
              </div>
            </div>
            <Button
              variant={roomState?.isAutoplay ? 'cyber' : 'outline'}
              size="sm"
              onClick={actions.toggleAutoplay}
              className="h-7 px-2.5 text-[10px] font-mono font-bold uppercase cursor-pointer flex-shrink-0"
            >
              {roomState?.isAutoplay ? t('remote.autoplayOn') : t('remote.autoplayOff')}
            </Button>
          </div>

          {/* Countdown Toggle */}
          <div className="p-3 bg-card border border-border flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <Timer className="w-4 h-4 text-primary flex-shrink-0" />
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-bold text-foreground truncate">
                  {t('tvSettings.countdownTitle')}
                </span>
                <span className="text-[10px] text-muted-foreground truncate">
                  {t('tvSettings.countdownDesc')}
                </span>
              </div>
            </div>
            <Button
              variant={roomState?.isCountdownEnabled ? 'cyber' : 'outline'}
              size="sm"
              onClick={actions.toggleCountdown}
              className="h-7 px-2.5 text-[10px] font-mono font-bold uppercase cursor-pointer flex-shrink-0"
            >
              {roomState?.isCountdownEnabled ? t('remote.countdownOn') : t('remote.countdownOff')}
            </Button>
          </div>

          {/* Prefer Music Videos Toggle */}
          <div className="p-3 bg-card border border-border flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <MusicIcon className="w-4 h-4 text-primary flex-shrink-0" />
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-bold text-foreground truncate">
                  {t('tvSettings.preferMusicVideosTitle')}
                </span>
                <span className="text-[10px] text-muted-foreground truncate">
                  {t('tvSettings.preferMusicVideosDesc')}
                </span>
              </div>
            </div>
            <Button
              variant={roomState?.searchSettings?.preferMusicVideos ? 'cyber' : 'outline'}
              size="sm"
              onClick={() => {
                const current = roomState?.searchSettings?.preferMusicVideos ?? true;
                actions.updateSettings({ preferMusicVideos: !current });
              }}
              className="h-7 px-2.5 text-[10px] font-mono font-bold uppercase cursor-pointer flex-shrink-0"
            >
              {roomState?.searchSettings?.preferMusicVideos ? t('remote.autoplayOn') : t('remote.autoplayOff')}
            </Button>
          </div>

          {/* Word-by-Word Lyrics Sync Toggle */}
          <div className="p-3 bg-card border border-border flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <Type className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-bold text-foreground truncate">
                  {t('tvSettings.lyricsWordSyncTitle')}
                </span>
                <span className="text-[10px] text-muted-foreground truncate">
                  {t('tvSettings.lyricsWordSyncDesc')}
                </span>
              </div>
            </div>
            <Button
              variant={roomState?.lyricsWordSync ? 'cyber' : 'outline'}
              size="sm"
              onClick={() => {
                const current = Boolean(roomState?.lyricsWordSync);
                actions.updateSettings({ lyricsWordSync: !current });
              }}
              className="h-7 px-2.5 text-[10px] font-mono font-bold uppercase cursor-pointer flex-shrink-0"
            >
              {roomState?.lyricsWordSync ? t('remote.autoplayOn') : t('remote.autoplayOff')}
            </Button>
          </div>

          {/* Lock Playback Controls Toggle */}
          <div className="p-3 bg-card border border-border flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <ShieldCheck className="w-4 h-4 text-primary flex-shrink-0" />
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-bold text-foreground truncate">
                  {t('remote.lockPlaybackTitle')}
                </span>
                <span className="text-[10px] text-muted-foreground truncate">
                  {t('remote.lockPlaybackDesc')}
                </span>
              </div>
            </div>
            <Button
              variant={roomState?.lockPlaybackControls ? 'destructive' : 'outline'}
              size="sm"
              onClick={actions.toggleLockPlaybackControls}
              className="h-7 px-2.5 text-[10px] font-mono font-bold uppercase cursor-pointer flex-shrink-0"
            >
              {roomState?.lockPlaybackControls ? t('remote.playbackControlsLocked') : t('watchParty.unlockBtn')}
            </Button>
          </div>
        </div>

        {/* Global Lyrics Calibration Offset Slider */}
        <div className="p-3 bg-card border border-border flex flex-col gap-2 mt-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <Mic2 className="w-4 h-4 text-primary flex-shrink-0" />
              <span className="text-xs font-bold text-foreground">
                {t('tvSettings.lyricsOffsetTitle')}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-primary">
                {(roomState?.lyricsOffsetMs || 0) > 0 ? `+${roomState?.lyricsOffsetMs}` : roomState?.lyricsOffsetMs || 0} ms
              </span>
              {(roomState?.lyricsOffsetMs || 0) !== 0 && (
                <button
                  type="button"
                  onClick={() => {
                    saveLyricsOffset(0);
                    actions.updateSettings({ lyricsOffsetMs: 0 });
                  }}
                  className="text-muted-foreground hover:text-foreground p-0.5"
                  title="Reset offset to 0 ms"
                >
                  <RotateCcw className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground leading-relaxed">
            {t('tvSettings.lyricsOffsetDesc')}
          </p>
          <div className="flex items-center gap-3 pt-1">
            <span className="text-[10px] font-mono text-muted-foreground">-5s</span>
            <Slider
              value={[roomState?.lyricsOffsetMs || 0]}
              min={-5000}
              max={5000}
              step={50}
              onValueCommit={(val) => {
                saveLyricsOffset(val[0]);
                actions.updateSettings({ lyricsOffsetMs: val[0] });
              }}
              className="flex-1 cursor-pointer"
            />
            <span className="text-[10px] font-mono text-muted-foreground">+5s</span>
          </div>
        </div>
      </div>
    </div>
  );
};
