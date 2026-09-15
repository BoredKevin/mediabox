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
  Eye,
  EyeOff,
  Check,
  Clock,
  RotateCcw,
} from 'lucide-react';
import { loadProxyConfig, saveProxyConfig, isProxyConfigured } from '@/lib/proxyConfig';

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
    handleClearAllRateLimits,
    handleToggleCountdown,
  } = useWatchParty();

  const [activeTab, setActiveTab] = useState<string>('api');

  // MediaBox YouTube API proxy configuration
  const [proxyUrl, setProxyUrl] = useState('');
  const [proxyToken, setProxyToken] = useState('');
  const [proxyTokenRevealed, setProxyTokenRevealed] = useState(false);
  const [proxyRevealCountdown, setProxyRevealCountdown] = useState(0);
  const [proxySaved, setProxySaved] = useState(false);

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

  useEffect(() => {
    if (open) {
      setRateLimitCountInput(searchSettings.rateLimitCount || 10);
      setRateLimitWindowInput(searchSettings.rateLimitWindowMs || 300000);
      setMaxResultsInput(searchSettings.maxResults || 25);
      const pCfg = loadProxyConfig();
      setProxyUrl(pCfg.proxyUrl);
      setProxyToken(pCfg.proxyToken);
      setProxySaved(false);
    }
  }, [open, searchSettings]);

  // Handle 5-second countdown for proxy token reveal
  useEffect(() => {
    if (!proxyTokenRevealed) return;
    setProxyRevealCountdown(5);
    const interval = setInterval(() => {
      setProxyRevealCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setProxyTokenRevealed(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [proxyTokenRevealed]);

  const handleSaveProxy = async (e: React.FormEvent) => {
    e.preventDefault();
    saveProxyConfig({ proxyUrl, proxyToken });
    setProxySaved(true);
    await handleUpdateSearchSettings({});
    setTimeout(() => setProxySaved(false), 3000);
  };

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

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-2xl w-full h-[540px] max-h-[85vh] bg-card/95 border-border shadow-2xl backdrop-blur-xl flex flex-col p-6 overflow-hidden">
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
              value="api"
              className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider py-2"
            >
              <Key className="w-3.5 h-3.5" />
              <span>{t('tvSettings.tabApiKeys')}</span>
              <Badge
                variant={isProxyConfigured({ proxyUrl, proxyToken }) ? 'default' : 'outline'}
                className="ml-1 px-1.5 py-0 text-[9px] font-mono"
              >
                {isProxyConfigured({ proxyUrl, proxyToken }) ? 'ACTIVE' : 'OFF'}
              </Badge>
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

          {/* TAB 1: MEDIABOX YOUTUBE API */}
          <TabsContent value="api" className="flex-1 overflow-y-auto min-h-0 pr-1 space-y-4 focus-visible:outline-none">
            <div className="p-4 bg-muted/20 border border-border space-y-4">
              <div className="flex items-start justify-between gap-3 border-b border-border pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-foreground uppercase tracking-wider">
                      {t('tvSettings.ytProxyTitle')}
                    </span>
                    <Badge
                      variant={isProxyConfigured({ proxyUrl, proxyToken }) ? 'default' : 'outline'}
                      className="text-[9px] px-1.5 py-0 h-4"
                    >
                      {isProxyConfigured({ proxyUrl, proxyToken })
                        ? t('tvSettings.ytProxyStatusConnected')
                        : t('tvSettings.ytProxyStatusDisconnected')}
                    </Badge>
                  </div>
                  <span className="text-xs text-muted-foreground block mt-1 leading-relaxed">
                    {t('tvSettings.ytProxyDesc')}
                  </span>
                </div>
              </div>

              <form onSubmit={handleSaveProxy} className="space-y-3">
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase font-semibold block mb-1">
                    {t('tvSettings.ytProxyUrlLabel')}
                  </label>
                  <Input
                    type="url"
                    value={proxyUrl}
                    onChange={(e) => setProxyUrl(e.target.value)}
                    placeholder={t('tvSettings.ytProxyUrlPlaceholder')}
                    className="text-xs font-mono h-9"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-muted-foreground uppercase font-semibold block mb-1">
                    {t('tvSettings.ytProxyTokenLabel')}
                  </label>
                  <div className="flex items-center gap-2">
                    <Input
                      type={proxyTokenRevealed ? 'text' : 'password'}
                      value={proxyToken}
                      onChange={(e) => setProxyToken(e.target.value)}
                      placeholder={t('tvSettings.ytProxyTokenPlaceholder')}
                      className="text-xs font-mono h-9 flex-1"
                    />
                    {proxyToken && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setProxyTokenRevealed(!proxyTokenRevealed)}
                        className="h-9 px-2.5 text-muted-foreground hover:text-foreground text-[10px]"
                        title={proxyTokenRevealed ? 'Hide' : 'Reveal for 5s'}
                      >
                        {proxyTokenRevealed ? (
                          <span className="flex items-center gap-1 font-mono text-[10px] text-primary">
                            <EyeOff className="w-3.5 h-3.5" />
                            {proxyRevealCountdown}s
                          </span>
                        ) : (
                          <Eye className="w-3.5 h-3.5" />
                        )}
                      </Button>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  {proxySaved ? (
                    <span className="text-xs text-emerald-400 font-mono flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" />
                      {t('tvSettings.ytProxySavedNotice')}
                    </span>
                  ) : <span />}

                  <Button
                    type="submit"
                    variant="cyber"
                    chamfer="top-right"
                    size="sm"
                    className="py-1 px-4 text-xs font-bold uppercase tracking-wider h-8"
                  >
                    {t('tvSettings.ytProxySaveBtn')}
                  </Button>
                </div>
              </form>
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
