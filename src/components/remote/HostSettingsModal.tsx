import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { ref, onValue, off } from 'firebase/database';
import { database } from '@/lib/firebase';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Switch,
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
  Gauge,
  Plus,
  X,
  RotateCcw,
  Clock,
  Video,
} from 'lucide-react';
import { useTranslation } from '@/context/LanguageContext';
import { RoomState, TruncatedApiKeyRecord } from '@/lib/roomUtils';

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

interface RateLimitEntry {
  uid: string;
  count: number;
  windowStart: number;
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
  const [activeTab, setActiveTab] = useState<string>('room');
  const [copiedLink, setCopiedLink] = useState(false);

  // Add Key Form state
  const [newKeyLabel, setNewKeyLabel] = useState('');
  const [newKeyValue, setNewKeyValue] = useState('');
  const [addKeyError, setAddKeyError] = useState<string | null>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);

  // Rate Limit configuration form state
  const searchSettings = roomState?.searchSettings;
  const [rateLimitCountInput, setRateLimitCountInput] = useState<number>(
    searchSettings?.rateLimitCount || 10
  );
  const [rateLimitWindowInput, setRateLimitWindowInput] = useState<number>(
    searchSettings?.rateLimitWindowMs || 300000
  );
  const [maxResultsInput, setMaxResultsInput] = useState<number>(
    searchSettings?.maxResults || 25
  );
  const [rateLimitSaved, setRateLimitSaved] = useState(false);

  // Active Rate Limits data from RTDB
  const [activeRateLimits, setActiveRateLimits] = useState<RateLimitEntry[]>([]);

  // Sync rate limit inputs when settings update or modal opens
  useEffect(() => {
    if (open) {
      setRateLimitCountInput(searchSettings?.rateLimitCount || 10);
      setRateLimitWindowInput(searchSettings?.rateLimitWindowMs || 300000);
      setMaxResultsInput(searchSettings?.maxResults || 25);
    }
  }, [open, searchSettings]);

  // Subscribe to RTDB searchRateLimits when modal is open on Rate Limits tab
  useEffect(() => {
    if (!open || !roomCode || activeTab !== 'rate-limits') return;

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
  }, [open, roomCode, activeTab]);

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

  const handleAddKeySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyValue.trim()) {
      setAddKeyError('API Key string cannot be empty.');
      return;
    }

    try {
      await sendCommand('manageApiKeys', {
        action: 'add',
        key: newKeyValue.trim(),
        label: newKeyLabel.trim() || 'Remote Key',
      });
      setNewKeyLabel('');
      setNewKeyValue('');
      setAddKeyError(null);
      showToast('Added API key!', 'success');
    } catch {
      showToast('Failed to send key to TV', 'error');
    }
  };

  const handleToggleKeyEnabled = async (keyItem: TruncatedApiKeyRecord) => {
    try {
      await sendCommand('manageApiKeys', {
        action: 'update',
        keyId: keyItem.id,
        enabled: !keyItem.enabled,
      });
      showToast(
        `${keyItem.label} ${!keyItem.enabled ? 'enabled' : 'disabled'}`,
        'info'
      );
    } catch {
      showToast('Failed to update key', 'error');
    }
  };

  const handleDeleteKey = async (keyId: string) => {
    try {
      await sendCommand('manageApiKeys', {
        action: 'delete',
        keyId,
      });
      setConfirmingDeleteId(null);
      showToast('API key deleted', 'success');
    } catch {
      showToast('Failed to delete key', 'error');
    }
  };

  const handleStrategyChange = async (strategy: 'roundRobin' | 'leastUsed') => {
    try {
      await sendCommand('manageApiKeys', {
        action: 'setStrategy',
        strategy,
      });
      showToast(
        `Load balancing set to ${
          strategy === 'roundRobin'
            ? t('tvSettings.roundRobin')
            : t('tvSettings.leastUsed')
        }`,
        'info'
      );
    } catch {
      showToast('Failed to update strategy', 'error');
    }
  };

  const handleAllowHostChange = async (checked: boolean) => {
    try {
      await sendCommand('manageApiKeys', {
        action: 'setAllowHost',
        allowHostKeyManagement: checked,
      });
      showToast(
        `Host key management ${checked ? 'enabled' : 'disabled'}`,
        'info'
      );
    } catch {
      showToast('Failed to update permission', 'error');
    }
  };

  const handleSaveRateLimits = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await sendCommand('manageApiKeys', {
        action: 'setRateLimit',
        rateLimitCount: Number(rateLimitCountInput) || 10,
        rateLimitWindowMs: Number(rateLimitWindowInput) || 300000,
      });
      await sendCommand('manageApiKeys', {
        action: 'setMaxResults',
        maxResults: Math.max(1, Math.min(50, Number(maxResultsInput) || 25)),
      });
      setRateLimitSaved(true);
      showToast(t('tvSettings.saveLimitBtn') + ' successful', 'success');
      setTimeout(() => setRateLimitSaved(false), 2000);
    } catch {
      showToast('Failed to save rate limits', 'error');
    }
  };

  const handleClearRateLimits = async () => {
    try {
      await sendCommand('manageApiKeys', { action: 'clearRateLimits' });
      showToast(t('tvSettings.clearRateLimits'), 'success');
    } catch {
      showToast('Failed to clear rate limits', 'error');
    }
  };

  const keysList: TruncatedApiKeyRecord[] = searchSettings?.keys || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl w-full h-[620px] max-h-[90vh] flex flex-col bg-card border-border overflow-hidden p-5 sm:p-6 shadow-2xl backdrop-blur-xl">
        <DialogHeader className="border-b border-border pb-3 flex-shrink-0">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-primary" />
            <DialogTitle className="text-base sm:text-lg font-bold uppercase tracking-wider font-mono">
              {isAdmin ? t('remote.adminOverridePanel') : t('remote.hostSettings')}
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Manage room privileges, playback settings, YouTube API keys, and rate limits.
          </DialogDescription>
        </DialogHeader>

        {/* Tab Navigation */}
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="w-full flex-1 flex flex-col min-h-0 overflow-hidden mt-3"
        >
          <TabsList className="grid grid-cols-3 w-full border-b border-border bg-muted/40 p-1 mb-3 rounded-none flex-shrink-0">
            <TabsTrigger
              value="room"
              className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider py-2"
            >
              <Clock className="w-3.5 h-3.5" />
              <span>{t('tvSettings.tabRoom') || 'Room'}</span>
            </TabsTrigger>
            <TabsTrigger
              value="api-keys"
              className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider py-2"
            >
              <Key className="w-3.5 h-3.5" />
              <span>{t('tvSettings.tabApiKeys')}</span>
              {keysList.length > 0 && (
                <Badge
                  variant="outline"
                  className="ml-1 px-1.5 py-0 text-[10px] bg-primary/10 text-primary border-primary/40 font-mono"
                >
                  {keysList.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="rate-limits"
              className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider py-2"
            >
              <Gauge className="w-3.5 h-3.5" />
              <span>{t('tvSettings.tabRateLimits')}</span>
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: ROOM CONTROLS & QR CODE (Existing Remote Settings) */}
          <TabsContent
            value="room"
            className="flex-1 overflow-y-auto min-h-0 pr-1 space-y-4 focus-visible:outline-none"
          >
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

                {/* Prefer Music Videos Toggle */}
                <Button
                  variant={roomState?.searchSettings?.preferMusicVideos ?? true ? 'cyber' : 'outline'}
                  chamfer="top-right"
                  onClick={() => sendCommand('togglePreferMusicVideos')}
                  className="py-2 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 h-auto col-span-2"
                >
                  <Video className="w-3.5 h-3.5" />
                  <span>
                    {t('tvSettings.preferMusicVideosTitle')}:{' '}
                    {roomState?.searchSettings?.preferMusicVideos ?? true
                      ? 'ON'
                      : 'OFF'}
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
                    size={130}
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
          </TabsContent>

          {/* TAB 2: YOUTUBE DATA API KEYS CRUD */}
          <TabsContent
            value="api-keys"
            className="flex-1 overflow-y-auto min-h-0 pr-1 space-y-4 focus-visible:outline-none"
          >
            {/* Header */}
            <div>
              <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
                {t('tvSettings.apiKeysTitle')}
              </h4>
              <p className="text-[11px] text-muted-foreground">
                {t('tvSettings.apiKeysDesc')}
              </p>
            </div>

            {/* Keys List */}
            <div className="space-y-2">
              {keysList.length === 0 ? (
                <div className="p-4 bg-muted/20 border border-dashed border-border text-center">
                  <Key className="w-6 h-6 text-muted-foreground mx-auto mb-1 opacity-50" />
                  <p className="text-xs text-muted-foreground">
                    {t('tvSettings.noKeys')}
                  </p>
                </div>
              ) : (
                keysList.map((keyItem) => (
                  <div
                    key={keyItem.id}
                    className={`p-3 border transition-all flex flex-col gap-2 ${
                      keyItem.enabled
                        ? 'bg-muted/30 border-border'
                        : 'bg-muted/10 border-border/50 opacity-60'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-bold text-xs text-foreground truncate">
                          {keyItem.label}
                        </span>
                        <Badge
                          variant={keyItem.enabled ? 'outline' : 'secondary'}
                          className="px-1.5 py-0 text-[9px] font-mono"
                        >
                          {keyItem.enabled ? 'ENABLED' : 'DISABLED'}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground font-mono">
                          Today: {keyItem.usageToday || 0} reqs
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Enable/Disable Switch */}
                        <Switch
                          checked={keyItem.enabled}
                          onCheckedChange={() => handleToggleKeyEnabled(keyItem)}
                          aria-label={`Toggle ${keyItem.label}`}
                        />

                        {/* Delete Key with inline confirmation */}
                        {confirmingDeleteId === keyItem.id ? (
                          <div className="flex items-center gap-1 animate-in fade-in duration-150">
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              onClick={() => handleDeleteKey(keyItem.id)}
                              className="h-7 px-2 text-[10px] font-bold uppercase rounded-none flex items-center gap-1"
                              title="Confirm Delete"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>{t('tvSettings.confirmDelete') || 'Delete'}</span>
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setConfirmingDeleteId(null)}
                              className="h-7 px-1.5 text-[10px] text-muted-foreground hover:text-foreground rounded-none"
                              title="Cancel"
                            >
                              <X className="w-3 h-3" />
                            </Button>
                          </div>
                        ) : (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => setConfirmingDeleteId(keyItem.id)}
                            className="h-7 w-7 text-muted-foreground hover:text-destructive transition-colors rounded-none"
                            title="Delete API key"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Key Display Row - Truncated only, strictly no reveal button */}
                    <div className="flex items-center justify-between gap-2 bg-background/80 p-2 border border-border/70 font-mono text-xs">
                      <span className="truncate text-primary select-all">
                        {keyItem.key}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Add Key Form */}
            <form
              onSubmit={handleAddKeySubmit}
              className="p-3 bg-muted/20 border border-border flex flex-col gap-2.5"
            >
              <span className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1">
                <Plus className="w-3.5 h-3.5 text-primary" />
                <span>{t('tvSettings.addKeyBtn')}</span>
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label
                    htmlFor="remote-key-label"
                    className="text-[10px] text-muted-foreground uppercase font-semibold block mb-1"
                  >
                    {t('tvSettings.keyLabel')}
                  </label>
                  <Input
                    id="remote-key-label"
                    type="text"
                    value={newKeyLabel}
                    onChange={(e) => setNewKeyLabel(e.target.value)}
                    placeholder={t('tvSettings.keyLabelPlaceholder')}
                    className="text-xs h-8"
                  />
                </div>
                <div>
                  <label
                    htmlFor="remote-key-val"
                    className="text-[10px] text-muted-foreground uppercase font-semibold block mb-1"
                  >
                    {t('tvSettings.keyValue')}
                  </label>
                  <Input
                    id="remote-key-val"
                    type="password"
                    value={newKeyValue}
                    onChange={(e) => setNewKeyValue(e.target.value)}
                    placeholder={t('tvSettings.keyValuePlaceholder')}
                    className="text-xs font-mono h-8"
                  />
                </div>
              </div>

              {addKeyError && (
                <p className="text-[11px] text-destructive font-mono bg-destructive/10 p-1 border border-destructive/30">
                  {addKeyError}
                </p>
              )}

              <Button
                type="submit"
                variant="cyber"
                chamfer="top-right"
                disabled={!newKeyValue.trim()}
                className="py-1.5 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 h-8 mt-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{t('tvSettings.addKeyBtn')}</span>
              </Button>
            </form>

            {/* Strategy & Host Management Settings */}
            <div className="p-3 bg-muted/20 border border-border space-y-3">
              <div className="flex items-center justify-between border-b border-border pb-2">
                <div>
                  <span className="text-xs font-bold text-foreground uppercase tracking-wider block">
                    {t('tvSettings.strategyTitle')}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    Balances quota usage across all active keys.
                  </span>
                </div>
                <div className="flex items-center gap-1 bg-muted/60 p-0.5 border border-border">
                  <Button
                    type="button"
                    variant={
                      searchSettings?.strategy === 'roundRobin'
                        ? 'cyber'
                        : 'ghost'
                    }
                    size="sm"
                    onClick={() => handleStrategyChange('roundRobin')}
                    className="px-2.5 py-1 text-[10px] font-bold uppercase h-6"
                  >
                    {t('tvSettings.roundRobin')}
                  </Button>
                  <Button
                    type="button"
                    variant={
                      searchSettings?.strategy === 'leastUsed' ? 'cyber' : 'ghost'
                    }
                    size="sm"
                    onClick={() => handleStrategyChange('leastUsed')}
                    className="px-2.5 py-1 text-[10px] font-bold uppercase h-6"
                  >
                    {t('tvSettings.leastUsed')}
                  </Button>
                </div>
              </div>

              {/* Allow Host Key Management Toggle (shown to Admin) */}
              {isAdmin && (
                <div className="flex items-center justify-between pt-1">
                  <div>
                    <span className="text-xs font-bold text-foreground uppercase tracking-wider block">
                      {t('tvSettings.allowHostManagement')}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {t('tvSettings.allowHostDesc')}
                    </span>
                  </div>
                  <Switch
                    checked={Boolean(searchSettings?.allowHostKeyManagement)}
                    onCheckedChange={handleAllowHostChange}
                    aria-label="Allow Host to Manage Keys"
                  />
                </div>
              )}
            </div>
          </TabsContent>

          {/* TAB 3: RATE LIMITS */}
          <TabsContent
            value="rate-limits"
            className="flex-1 overflow-y-auto min-h-0 pr-1 space-y-4 focus-visible:outline-none"
          >
            <form
              onSubmit={handleSaveRateLimits}
              className="p-4 bg-muted/20 border border-border space-y-3"
            >
              <div>
                <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
                  {t('tvSettings.rateLimitTitle')}
                </h4>
                <p className="text-[11px] text-muted-foreground">
                  {t('tvSettings.rateLimitDesc')}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                <div>
                  <label
                    htmlFor="remote-rate-limit-count"
                    className="text-[10px] text-muted-foreground uppercase font-semibold block mb-1"
                  >
                    Searches allowed
                  </label>
                  <Input
                    id="remote-rate-limit-count"
                    type="number"
                    min={1}
                    max={100}
                    value={rateLimitCountInput}
                    onChange={(e) =>
                      setRateLimitCountInput(parseInt(e.target.value, 10) || 10)
                    }
                    className="text-xs h-8"
                  />
                </div>

                <div>
                  <label
                    htmlFor="remote-rate-limit-window"
                    className="text-[10px] text-muted-foreground uppercase font-semibold block mb-1"
                  >
                    Time Window
                  </label>
                  <select
                    id="remote-rate-limit-window"
                    value={rateLimitWindowInput}
                    onChange={(e) =>
                      setRateLimitWindowInput(parseInt(e.target.value, 10))
                    }
                    className="w-full h-8 text-xs bg-background border border-border px-2 text-foreground font-sans focus:outline-none focus:border-primary"
                  >
                    <option value={60000}>1 Minute</option>
                    <option value={300000}>5 Minutes (Default)</option>
                    <option value={600000}>10 Minutes</option>
                    <option value={3600000}>1 Hour</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="remote-rate-limit-maxresults"
                    className="text-[10px] text-muted-foreground uppercase font-semibold block mb-1"
                  >
                    {t('tvSettings.maxResults')} (1 - 50)
                  </label>
                  <Input
                    id="remote-rate-limit-maxresults"
                    type="number"
                    min={1}
                    max={50}
                    value={maxResultsInput}
                    onChange={(e) =>
                      setMaxResultsInput(parseInt(e.target.value, 10) || 5)
                    }
                    className="text-xs h-8"
                  />
                </div>
              </div>

              <Button
                type="submit"
                variant="cyber"
                chamfer="top-right"
                className="py-1.5 px-4 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 h-8 mt-2"
              >
                {rateLimitSaved ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Saved!</span>
                  </>
                ) : (
                  <span>{t('tvSettings.saveLimitBtn')}</span>
                )}
              </Button>
            </form>

            {/* Active Rate Limits Table */}
            <div className="p-3 bg-muted/20 border border-border space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground uppercase tracking-wider">
                  {t('tvSettings.activeRateLimits')}
                </span>
                {activeRateLimits.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleClearRateLimits}
                    className="h-6 px-2 text-[10px] uppercase font-bold text-destructive hover:text-destructive hover:border-destructive flex items-center gap-1"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>{t('tvSettings.clearRateLimits')}</span>
                  </Button>
                )}
              </div>

              {activeRateLimits.length === 0 ? (
                <p className="text-[11px] text-muted-foreground italic py-2">
                  {t('tvSettings.noRateLimits')}
                </p>
              ) : (
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {activeRateLimits.map((entry) => {
                    const elapsed = Date.now() - (entry.windowStart || 0);
                    const remainingMs = Math.max(
                      0,
                      (searchSettings?.rateLimitWindowMs || 300000) - elapsed
                    );
                    const remainingSec = Math.ceil(remainingMs / 1000);

                    return (
                      <div
                        key={entry.uid}
                        className="flex items-center justify-between p-1.5 bg-background/60 border border-border text-xs font-mono"
                      >
                        <span className="text-muted-foreground text-[11px] truncate max-w-[180px]">
                          UID: {entry.uid}
                        </span>
                        <div className="flex items-center gap-3">
                          <span className="text-foreground font-bold">
                            {entry.count} / {searchSettings?.rateLimitCount || 10}
                          </span>
                          <span className="text-[10px] text-primary">
                            resets in {remainingSec}s
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default HostSettingsModal;
