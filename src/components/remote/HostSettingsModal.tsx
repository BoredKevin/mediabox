import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  Button,
  Input,
  Badge,
} from '@boredkevin/ui';
import {
  ShieldAlert,
  Trash2,
  Lock,
  Unlock,
  Timer,
  Sparkles,
  QrCode,
  Copy,
  Check,
  Key,
} from 'lucide-react';
import { useTranslation } from '@/context/LanguageContext';
import { RoomState } from '@/lib/roomUtils';

interface HostSettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roomCode: string;
  roomState: RoomState | null;
  isAdmin: boolean;
  queueLength: number;
  sendCommand: (type: any, payload?: any) => Promise<void>;
  handleClearQueueAdmin: () => void;
  handleToggleRoomLockAdmin: () => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export const HostSettingsModal: React.FC<HostSettingsModalProps> = ({
  open,
  onOpenChange,
  roomCode,
  roomState,
  isAdmin,
  queueLength,
  sendCommand,
  handleClearQueueAdmin,
  handleToggleRoomLockAdmin,
  showToast,
}) => {
  const { t } = useTranslation();
  const [copiedLink, setCopiedLink] = useState(false);

  // TV Key Management state
  const [showRemoteKeyForm, setShowRemoteKeyForm] = useState(false);
  const [remoteKeyLabel, setRemoteKeyLabel] = useState('');
  const [remoteKeyValue, setRemoteKeyValue] = useState('');

  const searchSettings = roomState?.searchSettings;
  const allowKeyManagement = isAdmin || Boolean(searchSettings?.allowHostKeyManagement);

  const handleCopyLink = async () => {
    try {
      const joinUrl = `${window.location.origin}/#/join?room=${roomCode}`;
      await navigator.clipboard.writeText(joinUrl);
      setCopiedLink(true);
      showToast(t('remote.linkCopied'), 'success');
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      showToast('Failed to copy link', 'error');
    }
  };

  const handleAddRemoteKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!remoteKeyValue.trim()) return;

    try {
      await sendCommand('manageApiKeys', {
        action: 'add',
        key: remoteKeyValue.trim(),
        label: remoteKeyLabel.trim() || 'Remote Added Key',
      });
      setRemoteKeyLabel('');
      setRemoteKeyValue('');
      setShowRemoteKeyForm(false);
      showToast('Sent API key to TV!', 'success');
    } catch {
      showToast('Failed to send key to TV', 'error');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md w-full max-h-[90vh] overflow-y-auto bg-card border-border">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-primary" />
            <DialogTitle className="text-base sm:text-lg font-bold uppercase tracking-wider font-mono">
              {isAdmin ? t('remote.adminOverridePanel') : t('remote.hostSettings')}
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Manage room privileges, playback settings, and TV connectivity.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-5 py-2">
          {/* Section 1: Room Privileges */}
          <div className="flex flex-col gap-2.5">
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-muted-foreground">
              Room Controls
            </span>

            <div className="grid grid-cols-2 gap-2">
              {/* Lock/Unlock */}
              <Button
                variant={roomState?.isLocked ? 'destructive' : 'outline'}
                chamfer="top-right"
                onClick={handleToggleRoomLockAdmin}
                className="py-2 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 h-auto"
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

              {/* Clear Queue */}
              <Button
                variant="destructive"
                chamfer="top-right"
                onClick={handleClearQueueAdmin}
                disabled={queueLength === 0}
                className="py-2 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 h-auto"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>
                  {t('remote.clearQueueBtn')} ({queueLength})
                </span>
              </Button>

              {/* Countdown Mode Toggle */}
              <Button
                variant={roomState?.isCountdownEnabled ? 'cyber' : 'outline'}
                chamfer="top-right"
                onClick={() => sendCommand('toggleCountdown')}
                className="py-2 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 h-auto"
              >
                <Timer className="w-3.5 h-3.5" />
                <span>
                  {roomState?.isCountdownEnabled
                    ? t('remote.countdownOn')
                    : t('remote.countdownOff')}
                </span>
              </Button>

              {/* Autoplay Toggle */}
              <Button
                variant={roomState?.isAutoplay ? 'cyber' : 'outline'}
                chamfer="top-right"
                onClick={() => sendCommand('toggleAutoplay')}
                className="py-2 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 h-auto"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>
                  {roomState?.isAutoplay
                    ? t('remote.autoplayOn')
                    : t('remote.autoplayOff')}
                </span>
              </Button>
            </div>
          </div>

          {/* Section 2: QR Code & Join Link */}
          <div className="flex flex-col gap-2.5 pt-3 border-t border-border">
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <QrCode className="w-3.5 h-3.5 text-primary" />
              {t('remote.joinQrCode')}
            </span>

            <div className="flex flex-col items-center gap-3 p-3 bg-muted/20 border border-border">
              <div className="p-2 bg-white border-2 border-primary shadow-[0_0_15px_rgba(0,200,212,0.15)]">
                <QRCodeSVG
                  value={`${window.location.origin}/#/join?room=${roomCode}`}
                  size={140}
                  level="M"
                />
              </div>

              <div className="flex flex-col items-center gap-0.5">
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
                  {t('watchParty.roomBadge')}
                </span>
                <span className="font-mono text-xl font-bold tracking-[0.2em] text-primary">
                  {roomCode}
                </span>
              </div>

              <Button
                variant="outline"
                chamfer="dual"
                onClick={handleCopyLink}
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
          </div>

          {/* Section 3: Remote TV Key Management */}
          {allowKeyManagement && (
            <div className="flex flex-col gap-2.5 pt-3 border-t border-border">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5" />
                  Remote TV API Keys
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  chamfer="top-right"
                  onClick={() => setShowRemoteKeyForm((prev) => !prev)}
                  className="h-6 px-2 text-[10px] font-bold uppercase"
                >
                  {showRemoteKeyForm ? 'Hide Form' : '+ Add Key'}
                </Button>
              </div>

              {showRemoteKeyForm ? (
                <form
                  onSubmit={handleAddRemoteKey}
                  className="p-3 bg-muted/30 border border-amber-800/40 flex flex-col gap-2 animate-in fade-in-0"
                >
                  <Input
                    type="text"
                    placeholder="Key label (e.g. Host Secondary)"
                    value={remoteKeyLabel}
                    onChange={(e) => setRemoteKeyLabel(e.target.value)}
                    className="text-xs h-8"
                  />
                  <Input
                    type="password"
                    placeholder="API Key string (AIzaSy...)"
                    value={remoteKeyValue}
                    onChange={(e) => setRemoteKeyValue(e.target.value)}
                    className="text-xs font-mono h-8"
                  />
                  <Button
                    type="submit"
                    variant="cyber"
                    chamfer="dual"
                    disabled={!remoteKeyValue.trim()}
                    className="py-1.5 text-xs font-bold uppercase h-8"
                  >
                    Send Key to TV
                  </Button>
                </form>
              ) : (
                <p className="text-[11px] text-muted-foreground">
                  TV Key Count: <span className="font-mono text-primary font-bold">{searchSettings?.keyCount || 0}</span> configured.
                </p>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default HostSettingsModal;
