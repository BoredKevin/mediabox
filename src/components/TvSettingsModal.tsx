import React, { useState, useEffect } from 'react';
import { ref, onValue, off } from 'firebase/database';
import { database } from '@/lib/firebase';
import { useWatchParty } from '@/context/WatchPartyContext';
import { useTranslation } from '@/context/LanguageContext';
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
  Key,
  Gauge,
  Sliders,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Check,
  AlertCircle,
  Clock,
  ShieldAlert,
  RotateCcw,
  Sparkles,
  X,
} from 'lucide-react';
import { loadKeys, deleteKey, getMaskedKey } from '@/lib/apiKeyStore';
import { ApiKeyRecord } from '@/lib/roomUtils';

interface TvSettingsModalProps {
  open: boolean;
  onClose: () => void;
}

interface RateLimitEntry {
  uid: string;
  count: number;
  windowStart: number;
}

export const TvSettingsModal: React.FC<TvSettingsModalProps> = ({ open, onClose }) => {
  const { t } = useTranslation();
  const {
    roomCode,
    roomState,
    searchSettings,
    handleUpdateSearchSettings,
    handleManageLocalKeys,
    handleClearAllRateLimits,
    handleToggleCountdown,
  } = useWatchParty();

  const [activeTab, setActiveTab] = useState<string>('api-keys');
  const [keysList, setKeysList] = useState<ApiKeyRecord[]>([]);

  // Add Key Form state
  const [newKeyLabel, setNewKeyLabel] = useState('');
  const [newKeyValue, setNewKeyValue] = useState('');
  const [addKeyError, setAddKeyError] = useState<string | null>(null);

  // Temporary key reveal state (5 seconds)
  const [revealedKeyId, setRevealedKeyId] = useState<string | null>(null);
  const [revealCountdown, setRevealCountdown] = useState<number>(0);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);

  // Rate Limit configuration form state
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

  // Active Rate Limits data from RTDB
  const [activeRateLimits, setActiveRateLimits] = useState<RateLimitEntry[]>([]);

  // Refresh keys from localStorage whenever modal opens or keys are modified
  const refreshKeys = () => {
    setKeysList(loadKeys());
  };

  useEffect(() => {
    if (open) {
      refreshKeys();
      setRateLimitCountInput(searchSettings.rateLimitCount || 10);
      setRateLimitWindowInput(searchSettings.rateLimitWindowMs || 300000);
      setMaxResultsInput(searchSettings.maxResults || 25);
    }
  }, [open, searchSettings]);

  // Handle 5-second countdown for key reveal
  useEffect(() => {
    if (!revealedKeyId) return;

    setRevealCountdown(5);
    const interval = setInterval(() => {
      setRevealCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setRevealedKeyId(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [revealedKeyId]);

  // Subscribe to RTDB searchRateLimits when modal is open and on Rate Limits tab
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

  const handleAddKeySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyValue.trim()) {
      setAddKeyError('API Key string cannot be empty.');
      return;
    }

    try {
      await handleManageLocalKeys('add', {
        key: newKeyValue.trim(),
        label: newKeyLabel.trim(),
      });
      setNewKeyLabel('');
      setNewKeyValue('');
      setAddKeyError(null);
      refreshKeys();
    } catch (err: any) {
      setAddKeyError(err.message || 'Failed to add API key.');
    }
  };

  const handleToggleKeyEnabled = async (keyRecord: ApiKeyRecord) => {
    await handleManageLocalKeys('update', {
      id: keyRecord.id,
      patch: { enabled: !keyRecord.enabled },
    });
    refreshKeys();
  };

  const handleDeleteKey = async (keyId: string) => {
    try {
      deleteKey(keyId);
      refreshKeys();
      setConfirmingDeleteId(null);
      await handleManageLocalKeys('delete', { id: keyId });
    } catch (err) {
      console.warn('Error deleting API key:', err);
      refreshKeys();
    }
  };

  const handleToggleReveal = (keyId: string) => {
    if (revealedKeyId === keyId) {
      setRevealedKeyId(null);
    } else {
      setRevealedKeyId(keyId);
    }
  };

  const handleSaveRateLimits = async (e: React.FormEvent) => {
    e.preventDefault();
    await handleUpdateSearchSettings({
      rateLimitCount: Number(rateLimitCountInput) || 10,
      rateLimitWindowMs: Number(rateLimitWindowInput) || 300000,
      maxResults: Math.max(1, Math.min(50, Number(maxResultsInput) || 25)),
    });
    setRateLimitSaved(true);
    setTimeout(() => setRateLimitSaved(false), 2000);
  };

  const handleStrategyChange = async (strategy: 'roundRobin' | 'leastUsed') => {
    await handleUpdateSearchSettings({ strategy });
  };

  const handleAllowHostChange = async (checked: boolean) => {
    await handleUpdateSearchSettings({ allowHostKeyManagement: checked });
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-2xl w-full h-[620px] max-h-[85vh] bg-card/95 border-border shadow-2xl backdrop-blur-xl flex flex-col p-6 overflow-hidden">
        <DialogHeader className="border-b border-border pb-3 flex-shrink-0">
          <DialogTitle className="flex items-center gap-2 text-foreground font-display tracking-wider uppercase text-base">
            <Sliders className="w-5 h-5 text-primary" />
            <span>{t('tvSettings.title')}</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {t('tvSettings.description')}
          </DialogDescription>
        </DialogHeader>

        {/* Tab Navigation */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full flex-1 flex flex-col min-h-0 overflow-hidden">
          <TabsList className="grid grid-cols-3 w-full border-b border-border bg-muted/40 p-1 mb-4 rounded-none flex-shrink-0">
            <TabsTrigger
              value="api-keys"
              className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider py-2"
            >
              <Key className="w-3.5 h-3.5" />
              <span>{t('tvSettings.tabApiKeys')}</span>
              {keysList.length > 0 && (
                <Badge variant="outline" className="ml-1 px-1.5 py-0 text-[10px] bg-primary/10 text-primary border-primary/40 font-mono">
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
            <TabsTrigger
              value="room"
              className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider py-2"
            >
              <Clock className="w-3.5 h-3.5" />
              <span>{t('tvSettings.tabRoom')}</span>
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: API KEYS */}
          <TabsContent value="api-keys" className="flex-1 overflow-y-auto min-h-0 pr-1 space-y-4 focus-visible:outline-none">
            {/* Header / Description */}
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
                  {t('tvSettings.apiKeysTitle')}
                </h4>
                <p className="text-[11px] text-muted-foreground">
                  {t('tvSettings.apiKeysDesc')}
                </p>
              </div>
            </div>

            {/* Existing Keys List */}
            <div className="space-y-2">
              {keysList.length === 0 ? (
                <div className="p-4 bg-muted/20 border border-dashed border-border text-center">
                  <Key className="w-6 h-6 text-muted-foreground mx-auto mb-1 opacity-50" />
                  <p className="text-xs text-muted-foreground">{t('tvSettings.noKeys')}</p>
                </div>
              ) : (
                keysList.map((keyItem) => {
                  const isRevealed = revealedKeyId === keyItem.id;
                  return (
                    <div
                      key={keyItem.id}
                      className={`p-3 border transition-all flex flex-col gap-2 ${keyItem.enabled
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
                          {/* Delete Key Button with inline confirmation */}
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

                      {/* Key Display Row with 5s Reveal */}
                      <div className="flex items-center justify-between gap-2 bg-background/80 p-1.5 border border-border/70 font-mono text-xs">
                        <span className="truncate text-primary select-all">
                          {isRevealed ? keyItem.key : getMaskedKey(keyItem.key)}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleReveal(keyItem.id)}
                          className="h-6 px-2 text-[10px] uppercase font-bold flex items-center gap-1 text-muted-foreground hover:text-foreground"
                          title={isRevealed ? 'Hide API key' : 'Temporarily reveal key for 5 seconds'}
                        >
                          {isRevealed ? (
                            <>
                              <EyeOff className="w-3 h-3 text-amber-400" />
                              <span className="text-amber-400 font-mono">{revealCountdown}s</span>
                            </>
                          ) : (
                            <>
                              <Eye className="w-3 h-3" />
                              <span>Reveal</span>
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  );
                })
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
                  <label className="text-[10px] text-muted-foreground uppercase font-semibold block mb-1">
                    {t('tvSettings.keyLabel')}
                  </label>
                  <Input
                    type="text"
                    value={newKeyLabel}
                    onChange={(e) => setNewKeyLabel(e.target.value)}
                    placeholder={t('tvSettings.keyLabelPlaceholder')}
                    className="text-xs h-8"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase font-semibold block mb-1">
                    {t('tvSettings.keyValue')}
                  </label>
                  <Input
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
                    variant={searchSettings.strategy === 'roundRobin' ? 'cyber' : 'ghost'}
                    size="sm"
                    onClick={() => handleStrategyChange('roundRobin')}
                    className="px-2.5 py-1 text-[10px] font-bold uppercase h-6"
                  >
                    {t('tvSettings.roundRobin')}
                  </Button>
                  <Button
                    type="button"
                    variant={searchSettings.strategy === 'leastUsed' ? 'cyber' : 'ghost'}
                    size="sm"
                    onClick={() => handleStrategyChange('leastUsed')}
                    className="px-2.5 py-1 text-[10px] font-bold uppercase h-6"
                  >
                    {t('tvSettings.leastUsed')}
                  </Button>
                </div>
              </div>

              {/* Allow Host Key Management Toggle */}
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
                  checked={searchSettings.allowHostKeyManagement}
                  onCheckedChange={handleAllowHostChange}
                  aria-label="Allow Host to Manage Keys"
                />
              </div>
            </div>
          </TabsContent>

          {/* TAB 2: RATE LIMITS */}
          <TabsContent value="rate-limits" className="flex-1 overflow-y-auto min-h-0 pr-1 space-y-4 focus-visible:outline-none">
            <form onSubmit={handleSaveRateLimits} className="p-4 bg-muted/20 border border-border space-y-3">
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
                  <label className="text-[10px] text-muted-foreground uppercase font-semibold block mb-1">
                    Searches allowed
                  </label>
                  <Input
                    type="number"
                    min={1}
                    max={100}
                    value={rateLimitCountInput}
                    onChange={(e) => setRateLimitCountInput(parseInt(e.target.value, 10) || 10)}
                    className="text-xs h-8"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-muted-foreground uppercase font-semibold block mb-1">
                    Time Window
                  </label>
                  <select
                    value={rateLimitWindowInput}
                    onChange={(e) => setRateLimitWindowInput(parseInt(e.target.value, 10))}
                    className="w-full h-8 text-xs bg-background border border-border px-2 text-foreground font-sans focus:outline-none focus:border-primary"
                  >
                    <option value={60000}>1 Minute</option>
                    <option value={300000}>5 Minutes (Default)</option>
                    <option value={600000}>10 Minutes</option>
                    <option value={3600000}>1 Hour</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] text-muted-foreground uppercase font-semibold block mb-1">
                    {t('tvSettings.maxResults')} (1 - 50)
                  </label>
                  <Input
                    type="number"
                    min={1}
                    max={50}
                    value={maxResultsInput}
                    onChange={(e) => setMaxResultsInput(parseInt(e.target.value, 10) || 5)}
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
                    onClick={handleClearAllRateLimits}
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
                    const remainingMs = Math.max(0, (searchSettings.rateLimitWindowMs || 300000) - elapsed);
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
                            {entry.count} / {searchSettings.rateLimitCount || 10}
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

          {/* TAB 3: ROOM SETTINGS */}
          <TabsContent value="room" className="flex-1 overflow-y-auto min-h-0 pr-1 space-y-4 focus-visible:outline-none">
            <div className="p-4 bg-muted/20 border border-border space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-foreground uppercase tracking-wider block">
                    {t('tvSettings.countdownTitle')}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {t('tvSettings.countdownDesc')}
                  </span>
                </div>
                <Switch
                  checked={Boolean(roomState?.isCountdownEnabled)}
                  onCheckedChange={handleToggleCountdown}
                  aria-label="Toggle Countdown"
                />
              </div>

              <div className="pt-3 border-t border-border/50 flex items-center justify-between gap-4">
                <div>
                  <span className="text-xs font-bold text-foreground uppercase tracking-wider block">
                    {t('tvSettings.preferMusicVideosTitle')}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {t('tvSettings.preferMusicVideosDesc')}
                  </span>
                </div>
                <Switch
                  checked={searchSettings?.preferMusicVideos ?? true}
                  onCheckedChange={(checked) => handleUpdateSearchSettings({ preferMusicVideos: checked })}
                  aria-label="Toggle Prefer Music Videos"
                />
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
