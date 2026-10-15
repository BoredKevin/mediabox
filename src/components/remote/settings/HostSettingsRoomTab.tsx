import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import {
  QrCode,
  Copy,
  Check,
  Timer,
  Sparkles,
  MusicIcon,
  Mic2,
  RotateCcw,
  Lock,
  Unlock,
  Trash2,
  Type,
} from 'lucide-react';
import { useTranslation } from '@/context/LanguageContext';
import { RoomState } from '@/lib/roomUtils';
import { saveLyricsOffset } from '@/lib/lyricsOffsetStore';

interface HostSettingsRoomTabProps {
  roomCode: string;
  roomState: RoomState | null;
  queueLength: number;
  sendCommand: (type: any, payload?: any) => Promise<void>;
  handleClearQueueAdmin: () => void;
  handleToggleRoomLockAdmin: () => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export const HostSettingsRoomTab: React.FC<HostSettingsRoomTabProps> = ({
  roomCode,
  roomState,
  queueLength,
  sendCommand,
  handleClearQueueAdmin,
  handleToggleRoomLockAdmin,
  showToast,
}) => {
  const { t } = useTranslation();
  const [copiedLink, setCopiedLink] = useState(false);

  const handleCopyLink = async () => {
    try {
      const joinUrl = `${window.location.origin}/join?room=${roomCode}`;
      await navigator.clipboard.writeText(joinUrl);
      setCopiedLink(true);
      showToast(t('remote.linkCopied'), 'success');
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      showToast('Failed to copy link', 'error');
    }
  };

  return (
    <div className="space-y-4">
      {/* QR Code and Quick Share Link */}
      <div className="p-4 bg-muted/20 border border-border flex flex-col sm:flex-row items-center gap-4">
        <div className="p-2 bg-white rounded-none border border-border shadow-md flex-shrink-0">
          <QRCodeSVG
            value={`${window.location.origin}/join?room=${roomCode}`}
            size={90}
            level="M"
          />
        </div>
        <div className="flex-1 min-w-0 flex flex-col gap-1.5 w-full">
          <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-foreground uppercase tracking-wider">
            <QrCode className="w-3.5 h-3.5 text-primary" />
            <span>{t('remote.joinQrCode')}</span>
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            {t('remote.scanToJoin')}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyLink}
              className="text-xs font-mono uppercase tracking-wider h-8 flex items-center gap-1.5 cursor-pointer"
            >
              {copiedLink ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">{t('remote.linkCopied')}</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>{t('remote.copyJoinLink')}</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Playback & Behavior Toggles */}
      <div className="space-y-2">
        <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
          {t('tvSettings.title')}
        </span>

        {/* Countdown Overlay Toggle */}
        <div className="flex items-center justify-between p-3 bg-muted/20 border border-border">
          <div className="flex items-center gap-2.5">
            <Timer className="w-4 h-4 text-primary" />
            <div>
              <p className="text-xs font-semibold text-foreground">
                {t('tvSettings.countdownTitle')}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {t('tvSettings.countdownDesc')}
              </p>
            </div>
          </div>
          <Button
            variant={roomState?.isCountdownEnabled ? 'default' : 'outline'}
            size="sm"
            onClick={() => sendCommand('toggleCountdown')}
            className="text-xs font-mono uppercase h-7 cursor-pointer"
          >
            {roomState?.isCountdownEnabled ? t('remote.countdownOn') : t('remote.countdownOff')}
          </Button>
        </div>

        {/* Autoplay Similar Songs Toggle */}
        <div className="flex items-center justify-between p-3 bg-muted/20 border border-border">
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-4 h-4 text-primary" />
            <div>
              <p className="text-xs font-semibold text-foreground">
                {t('remote.autoplayMode')}
              </p>
              <p className="text-[11px] text-muted-foreground">
                Autoplay recommended tracks when queue is empty.
              </p>
            </div>
          </div>
          <Button
            variant={roomState?.isAutoplay ? 'default' : 'outline'}
            size="sm"
            onClick={() => sendCommand('toggleAutoplay')}
            className="text-xs font-mono uppercase h-7 cursor-pointer"
          >
            {roomState?.isAutoplay ? t('remote.autoplayOn') : t('remote.autoplayOff')}
          </Button>
        </div>

        {/* Prefer Music Videos Toggle */}
        <div className="flex items-center justify-between p-3 bg-muted/20 border border-border">
          <div className="flex items-center gap-2.5">
            <MusicIcon className="w-4 h-4 text-primary" />
            <div>
              <p className="text-xs font-semibold text-foreground">
                {t('tvSettings.preferMusicVideosTitle')}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {t('tvSettings.preferMusicVideosDesc')}
              </p>
            </div>
          </div>
          <Button
            variant={roomState?.searchSettings?.preferMusicVideos ? 'default' : 'outline'}
            size="sm"
            onClick={() => sendCommand('togglePreferMusicVideos')}
            className="text-xs font-mono uppercase h-7 cursor-pointer"
          >
            {roomState?.searchSettings?.preferMusicVideos ? t('remote.autoplayOn') : t('remote.autoplayOff')}
          </Button>
        </div>

        {/* Word-by-Word Lyrics Sync Toggle */}
        <div className="flex items-center justify-between p-3 bg-muted/20 border border-border">
          <div className="flex items-center gap-2.5">
            <Type className="w-4 h-4 text-primary" />
            <div>
              <div className="flex items-center gap-1.5">
                <p className="text-xs font-semibold text-foreground">
                  {t('tvSettings.lyricsWordSyncTitle') || 'Word-by-Word Sync'}
                </p>
                <span className="text-[9px] px-1 py-0.5 bg-primary/20 text-primary border border-primary/30 font-mono rounded">
                  {t('tvSettings.lyricsWordSyncBadge') || 'Optimized'}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                {t('tvSettings.lyricsWordSyncDesc') || 'Highlights full words instead of syllables.'}
              </p>
            </div>
          </div>
          <Button
            variant={(roomState?.lyricsWordSync ?? true) ? 'default' : 'outline'}
            size="sm"
            onClick={() => {
              const current = roomState?.lyricsWordSync ?? true;
              sendCommand('setLyricsWordSync', { enabled: !current });
            }}
            className="text-xs font-mono uppercase h-7 cursor-pointer"
          >
            {(roomState?.lyricsWordSync ?? true) ? t('remote.autoplayOn') : t('remote.autoplayOff')}
          </Button>
        </div>

        {/* Lyrics Timing Calibration */}
        <div className="p-3 bg-muted/20 border border-border space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Mic2 className="w-4 h-4 text-primary" />
              <div>
                <p className="text-xs font-semibold text-foreground">
                  {t('tvSettings.lyricsOffsetTitle') || 'Lyrics Sync Offset'}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {t('tvSettings.lyricsOffsetDesc') || 'Micro-adjust syllable timing on TV.'}
                </p>
              </div>
            </div>
            <div className="text-right font-mono">
              <span className="text-xs font-bold text-primary">
                {(roomState?.lyricsOffsetMs ?? 0) > 0 ? `+${roomState?.lyricsOffsetMs}ms` : `${roomState?.lyricsOffsetMs ?? 0}ms`}
              </span>
            </div>
          </div>

          {/* Steppers */}
          <div className="grid grid-cols-5 gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const current = roomState?.lyricsOffsetMs ?? 0;
                const next = Math.max(-5000, current - 500);
                saveLyricsOffset(next);
                sendCommand('setLyricsOffset', { offsetMs: next });
              }}
              className="text-[11px] font-mono h-7 px-1 cursor-pointer"
            >
              -0.5s
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const current = roomState?.lyricsOffsetMs ?? 0;
                const next = Math.max(-5000, current - 100);
                saveLyricsOffset(next);
                sendCommand('setLyricsOffset', { offsetMs: next });
              }}
              className="text-[11px] font-mono h-7 px-1 cursor-pointer"
            >
              -0.1s
            </Button>
            <Button
              variant={(roomState?.lyricsOffsetMs ?? 0) === 0 ? 'secondary' : 'default'}
              size="sm"
              onClick={() => {
                saveLyricsOffset(0);
                sendCommand('setLyricsOffset', { offsetMs: 0 });
              }}
              className="text-[11px] font-mono h-7 px-1 flex items-center justify-center gap-0.5 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>0s</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const current = roomState?.lyricsOffsetMs ?? 0;
                const next = Math.min(5000, current + 100);
                saveLyricsOffset(next);
                sendCommand('setLyricsOffset', { offsetMs: next });
              }}
              className="text-[11px] font-mono h-7 px-1 cursor-pointer"
            >
              +0.1s
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const current = roomState?.lyricsOffsetMs ?? 0;
                const next = Math.min(5000, current + 500);
                saveLyricsOffset(next);
                sendCommand('setLyricsOffset', { offsetMs: next });
              }}
              className="text-[11px] font-mono h-7 px-1 cursor-pointer"
            >
              +0.5s
            </Button>
          </div>

          <div className="pt-1">
            <Slider
              value={[roomState?.lyricsOffsetMs ?? 0]}
              min={-5000}
              max={5000}
              step={50}
              onValueChange={(val) => {
                saveLyricsOffset(val[0]);
                sendCommand('setLyricsOffset', { offsetMs: val[0] });
              }}
              className="w-full cursor-pointer py-1"
            />
          </div>
        </div>
      </div>

      {/* Danger Zone: Room Lock & Queue Clear */}
      <div className="space-y-2 pt-2 border-t border-border/60">
        <span className="text-[10px] font-mono uppercase tracking-widest text-destructive">
          Controls
        </span>

        {/* Toggle Room Lock */}
        <div className="flex items-center justify-between p-3 bg-destructive/5 border border-destructive/20">
          <div className="flex items-center gap-2.5">
            {roomState?.isLocked ? (
              <Lock className="w-4 h-4 text-amber-400" />
            ) : (
              <Unlock className="w-4 h-4 text-muted-foreground" />
            )}
            <div>
              <p className="text-xs font-semibold text-foreground">
                {roomState?.isLocked ? t('remote.unlockRoomBtn') : t('remote.lockRoomBtn')}
              </p>
              <p className="text-[11px] text-muted-foreground">
                Restrict queue and player controls to host/admins.
              </p>
            </div>
          </div>
          <Button
            variant={roomState?.isLocked ? 'default' : 'outline'}
            size="sm"
            onClick={handleToggleRoomLockAdmin}
            className="text-xs font-mono uppercase h-7 cursor-pointer"
          >
            {roomState?.isLocked ? t('remote.unlockRoomBtn') : t('remote.lockRoomBtn')}
          </Button>
        </div>

        {/* Clear Queue */}
        <div className="flex items-center justify-between p-3 bg-destructive/5 border border-destructive/20">
          <div className="flex items-center gap-2.5">
            <Trash2 className="w-4 h-4 text-destructive" />
            <div>
              <p className="text-xs font-semibold text-foreground">
                {t('remote.clearQueueBtn')} ({queueLength})
              </p>
              <p className="text-[11px] text-muted-foreground">
                {t('remote.clearQueueConfirm')}
              </p>
            </div>
          </div>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleClearQueueAdmin}
            disabled={queueLength === 0}
            className="text-xs font-mono uppercase h-7 cursor-pointer"
          >
            {t('remote.clearQueueBtn')}
          </Button>
        </div>
      </div>
    </div>
  );
};
