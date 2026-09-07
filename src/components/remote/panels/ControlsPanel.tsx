import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useTranslation } from '@/context/LanguageContext';
import { Card, Button, Slider } from '@boredkevin/ui';
import {
  Play,
  Pause,
  SkipForward,
  Volume2,
  Sparkles,
  Maximize,
  Minimize,
  QrCode,
  Copy,
  Check,
  ShieldAlert,
  Trash2,
  Lock,
  Unlock,
  Timer,
} from 'lucide-react';
import { RoomState } from '@/lib/roomUtils';

interface ControlsPanelProps {
  roomCode: string;
  roomState: RoomState | null;
  isHostOrAdmin: boolean;
  isAdmin: boolean;
  queueLength: number;
  sendCommand: (type: any, payload?: any) => Promise<void>;
  displayVolume: number;
  handleVolumeValueChange: (val: number[]) => void;
  handleVolumeValueCommit: (val: number[]) => void;
  handleClearQueueAdmin: () => void;
  handleToggleRoomLockAdmin: () => void;
  fullscreenCooldown: boolean;
  handleToggleFullscreenClick: () => void;
  showQrCode: boolean;
  setShowQrCode: React.Dispatch<React.SetStateAction<boolean>>;
  copiedLink: boolean;
  handleCopyJoinLink: () => void;
}

export const ControlsPanel: React.FC<ControlsPanelProps> = ({
  roomCode,
  roomState,
  isHostOrAdmin,
  isAdmin,
  queueLength,
  sendCommand,
  displayVolume,
  handleVolumeValueChange,
  handleVolumeValueCommit,
  handleClearQueueAdmin,
  handleToggleRoomLockAdmin,
  fullscreenCooldown,
  handleToggleFullscreenClick,
  showQrCode,
  setShowQrCode,
  copiedLink,
  handleCopyJoinLink,
}) => {
  const { t } = useTranslation();
  const isPlaying = roomState?.playback?.status === 'playing';
  const isLocked = Boolean(roomState?.isLocked) && !isHostOrAdmin;

  return (
    <div className="flex flex-col gap-5">
      {/* Admin / Host Privileged Quick Control Panel */}
      {isHostOrAdmin && (
        <Card
          cornerLines
          className="p-4 bg-card border-purple-900/50 flex flex-col gap-3 shadow-[0_0_15px_rgba(168,85,247,0.1)]"
        >
          <div className="text-xs font-bold text-purple-300 uppercase tracking-wider border-b border-purple-900/40 pb-2 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-purple-400" />
              {isAdmin ? t('remote.adminOverridePanel') : t('remote.hostManagementPanel')}
            </span>
            <span className="text-[10px] text-purple-400/80 font-mono">
              {t('remote.overrideActive')}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Button
              variant="destructive"
              chamfer="dual"
              onClick={handleClearQueueAdmin}
              disabled={queueLength === 0}
              className="py-2.5 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 h-auto"
              title="Clear all videos in the queue"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>
                {t('remote.clearQueueBtn')} ({queueLength})
              </span>
            </Button>

            <Button
              variant={roomState?.isLocked ? 'destructive' : 'outline'}
              chamfer="top-right"
              onClick={handleToggleRoomLockAdmin}
              className={`py-2.5 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 h-auto ${
                roomState?.isLocked
                  ? 'border-amber-500 text-amber-300 bg-amber-950/80 shadow-[0_0_10px_rgba(245,158,11,0.2)]'
                  : ''
              }`}
              title="Lock/Unlock room controls for regular members"
            >
              {roomState?.isLocked ? (
                <>
                  <Lock className="w-3.5 h-3.5 text-amber-400" />
                  <span>{t('remote.unlockRoomBtn')}</span>
                </>
              ) : (
                <>
                  <Unlock className="w-3.5 h-3.5 text-muted-foreground" />
                  <span>{t('remote.lockRoomBtn')}</span>
                </>
              )}
            </Button>

            <Button
              variant={roomState?.isCountdownEnabled ? 'cyber' : 'outline'}
              chamfer="top-right"
              onClick={() => sendCommand('toggleCountdown')}
              className="py-2.5 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 h-auto"
              title="Toggle 10-Second Countdown on TV"
            >
              <Timer className="w-3.5 h-3.5" />
              <span>
                {roomState?.isCountdownEnabled
                  ? t('remote.countdownOn')
                  : t('remote.countdownOff')}
              </span>
            </Button>
          </div>
        </Card>
      )}

      {/* Main Playback Controls Card */}
      <Card cornerLines className="p-5 bg-card border-border flex flex-col gap-5">
        <div className="text-xs font-bold text-foreground uppercase tracking-wider border-b border-border pb-2 flex items-center justify-between">
          <span>{t('remote.playbackControls')}</span>
          {isHostOrAdmin && (
            <span className="text-[10px] text-amber-400 font-semibold">
              {t('remote.privilegedOverrideActive')}
            </span>
          )}
        </div>

        <div className="flex items-center justify-center gap-3">
          <Button
            variant="cyber"
            chamfer="dual"
            onClick={() => sendCommand('play')}
            disabled={isPlaying || isLocked}
            className="flex-1 py-3.5 font-bold uppercase tracking-wider text-xs sm:text-sm flex items-center justify-center gap-1.5 h-auto"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>{t('watchParty.playBtn')}</span>
          </Button>

          <Button
            variant="outline"
            chamfer="dual"
            onClick={() => sendCommand('pause')}
            disabled={!isPlaying || isLocked}
            className="flex-1 py-3.5 font-bold uppercase tracking-wider text-xs sm:text-sm flex items-center justify-center gap-1.5 h-auto"
          >
            <Pause className="w-4 h-4 fill-current" />
            <span>{t('watchParty.pauseBtn')}</span>
          </Button>

          {isHostOrAdmin && (
            <Button
              variant="cyber"
              chamfer="top-right"
              onClick={() => sendCommand('forceSkip')}
              className="px-4 py-3.5 font-bold uppercase tracking-wider text-xs sm:text-sm flex items-center justify-center gap-1.5 h-auto"
              title="Skip video on TV (Privileged action)"
            >
              <SkipForward className="w-4 h-4 fill-current" />
              <span>{t('watchParty.skipNextBtn')}</span>
            </Button>
          )}
        </div>

        {/* Volume Slider */}
        <div className="flex flex-col gap-2.5 pt-2 border-t border-border">
          <div className="flex items-center justify-between text-xs text-foreground">
            <span className="flex items-center gap-1.5 font-mono uppercase tracking-wider text-muted-foreground">
              <Volume2 className="w-4 h-4 text-primary" />
              {t('remote.tvVolume')}
            </span>
            <span className="font-mono text-primary font-bold">{displayVolume}%</span>
          </div>
          <Slider
            value={[displayVolume]}
            min={0}
            max={100}
            step={1}
            onValueChange={handleVolumeValueChange}
            onValueCommit={handleVolumeValueCommit}
            disabled={isLocked}
            className="w-full cursor-pointer py-1.5"
          />
        </div>

        {/* Autoplay Toggle Row */}
        <div className="pt-2 border-t border-border flex items-center justify-between">
          <span className="text-xs text-foreground flex items-center gap-1.5 font-medium">
            <Sparkles
              className={`w-4 h-4 ${
                roomState?.isAutoplay ? 'text-purple-400 animate-pulse' : 'text-muted-foreground'
              }`}
            />
            {t('remote.autoplayMode')}
          </span>
          <Button
            variant={roomState?.isAutoplay ? 'cyber' : 'outline'}
            chamfer="top-right"
            onClick={() => sendCommand('toggleAutoplay')}
            disabled={isLocked}
            className="px-3 py-1.5 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 h-auto"
            title="Toggle Autoplay mode via Last.fm recommendation"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>
              {roomState?.isAutoplay ? t('remote.autoplayOn') : t('remote.autoplayOff')}
            </span>
          </Button>
        </div>

        {/* Fullscreen Toggle Row */}
        <div className="pt-2 border-t border-border flex items-center justify-between">
          <span className="text-xs text-foreground flex items-center gap-1.5 font-medium">
            {roomState?.isFullscreen ? (
              <Minimize className="w-4 h-4 text-primary" />
            ) : (
              <Maximize className="w-4 h-4 text-muted-foreground" />
            )}
            {t('remote.tvDisplayMode')}
          </span>
          <Button
            variant={roomState?.isFullscreen ? 'cyber' : 'outline'}
            chamfer="top-right"
            onClick={handleToggleFullscreenClick}
            disabled={fullscreenCooldown}
            className="px-3 py-1.5 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 h-auto"
            title="Toggle TV Fullscreen (5s cooldown)"
          >
            {roomState?.isFullscreen ? (
              <>
                <Minimize className="w-3.5 h-3.5" />
                <span>{t('remote.exitFullscreen')}</span>
              </>
            ) : (
              <>
                <Maximize className="w-3.5 h-3.5 text-primary" />
                <span>{t('remote.fullscreenTv')}</span>
              </>
            )}
          </Button>
        </div>

        {/* Show Join Link QR Code Row */}
        <div className="pt-2 border-t border-border flex items-center justify-between">
          <span className="text-xs text-foreground flex items-center gap-1.5 font-medium">
            <QrCode className="w-4 h-4 text-primary" />
            {t('remote.joinQrCode')}
          </span>
          <Button
            variant={showQrCode ? 'cyber' : 'outline'}
            chamfer="top-right"
            onClick={() => setShowQrCode((prev) => !prev)}
            className="px-3 py-1.5 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 h-auto"
            title="Toggle Join Link QR Code"
          >
            <QrCode className="w-3.5 h-3.5" />
            <span>{showQrCode ? t('remote.hideQrCode') : t('remote.showQrCode')}</span>
          </Button>
        </div>

        {/* Join Link QR Code Panel */}
        {showQrCode && (
          <div className="pt-2 border-t border-border flex flex-col items-center gap-3 p-4 bg-muted/30 text-center transition-all animate-in fade-in-0">
            <p className="text-xs text-muted-foreground font-medium">
              {t('remote.scanToJoin')}
            </p>
            <div className="p-3 bg-white border-4 border-primary shadow-[0_0_15px_rgba(0,200,212,0.2)]">
              <QRCodeSVG
                value={`${window.location.origin}/#/join?room=${roomCode}`}
                size={160}
                level="M"
              />
            </div>
            <div className="flex flex-col items-center gap-1.5 w-full">
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
                {t('watchParty.roomBadge')}
              </span>
              <span className="font-mono text-2xl font-bold tracking-[0.2em] text-primary">
                {roomCode}
              </span>
            </div>
            <Button
              variant="outline"
              chamfer="dual"
              onClick={handleCopyJoinLink}
              className="px-4 py-2 text-xs font-bold uppercase tracking-wider flex items-center gap-2 w-full justify-center h-auto"
            >
              {copiedLink ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">{t('remote.linkCopied')}</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-primary" />
                  <span>{t('remote.copyJoinLink')}</span>
                </>
              )}
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
};
