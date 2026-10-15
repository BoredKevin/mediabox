import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '@boredkevin/ui';
import {
  QrCode,
  Copy,
  Check,
  Timer,
  Sparkles,
  Video,
  Lock,
  Unlock,
  Trash2,
} from 'lucide-react';
import { useTranslation } from '@/context/LanguageContext';
import { RoomState } from '@/lib/roomUtils';

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
            <Video className="w-4 h-4 text-primary" />
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
