import React, { useState, useEffect } from 'react';
import { Button, Input } from '@boredkevin/ui';
import { Key, Eye, EyeOff, Check } from 'lucide-react';
import { useTranslation } from '@/context/LanguageContext';
import { RoomState } from '@/lib/roomUtils';
import { loadProxyConfig, saveProxyConfig } from '@/lib/proxyConfig';

interface HostSettingsApiTabProps {
  roomState: RoomState | null;
  sendCommand: (type: any, payload?: any) => Promise<void>;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export const HostSettingsApiTab: React.FC<HostSettingsApiTabProps> = ({
  roomState,
  sendCommand,
  showToast,
}) => {
  const { t } = useTranslation();
  const searchSettings = roomState?.searchSettings;

  const [proxyUrl, setProxyUrl] = useState('');
  const [proxyToken, setProxyToken] = useState('');
  const [proxyTokenRevealed, setProxyTokenRevealed] = useState(false);
  const [proxyRevealCountdown, setProxyRevealCountdown] = useState(0);
  const [proxySaved, setProxySaved] = useState(false);

  useEffect(() => {
    const pCfg = loadProxyConfig();
    setProxyUrl(pCfg.proxyUrl || searchSettings?.proxyUrl || '');
    setProxyToken(pCfg.proxyToken);
    setProxySaved(false);
  }, [searchSettings]);

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
    try {
      saveProxyConfig({ proxyUrl, proxyToken });
      await sendCommand('setYtProxy', {
        proxyUrl: proxyUrl.trim(),
        proxyToken: proxyToken.trim(),
      });
      setProxySaved(true);
      showToast(t('tvSettings.ytProxySavedNotice'), 'success');
      setTimeout(() => setProxySaved(false), 3000);
    } catch {
      showToast('Failed to save proxy settings', 'error');
    }
  };

  return (
    <form onSubmit={handleSaveProxy} className="space-y-4">
      <div className="p-3 bg-muted/20 border border-border text-xs text-muted-foreground leading-relaxed">
        {t('tvSettings.ytProxyDesc')}
      </div>

      <div className="space-y-3">
        <div>
          <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground block mb-1">
            {t('tvSettings.ytProxyUrlLabel')}
          </label>
          <Input
            type="url"
            chamfer="dual"
            value={proxyUrl}
            onChange={(e) => setProxyUrl(e.target.value)}
            placeholder="https://your-worker.workers.dev"
            className="text-xs font-mono h-9"
          />
        </div>

        <div>
          <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground block mb-1">
            {t('tvSettings.ytProxyTokenLabel')}
          </label>
          <div className="relative">
            <Input
              type={proxyTokenRevealed ? 'text' : 'password'}
              chamfer="dual"
              value={proxyToken}
              onChange={(e) => setProxyToken(e.target.value)}
              placeholder="Secret Bearer Token"
              className="text-xs font-mono h-9 pr-10"
            />
            <button
              type="button"
              onClick={() => setProxyTokenRevealed((prev) => !prev)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer p-0.5"
              title={proxyTokenRevealed ? 'Hide Token' : 'Reveal Token (5s)'}
            >
              {proxyTokenRevealed ? (
                <span className="text-[10px] font-mono font-bold text-amber-400">
                  {proxyRevealCountdown}s
                </span>
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      </div>

      <Button
        type="submit"
        variant="cyber"
        chamfer="dual"
        className="w-full text-xs font-bold uppercase tracking-wider h-9 flex items-center justify-center gap-1.5 cursor-pointer"
      >
        {proxySaved ? (
          <>
            <Check className="w-3.5 h-3.5" />
            <span>{t('tvSettings.ytProxySavedNotice')}</span>
          </>
        ) : (
          <>
            <Key className="w-3.5 h-3.5" />
            <span>{t('tvSettings.ytProxySaveBtn')}</span>
          </>
        )}
      </Button>
    </form>
  );
};
