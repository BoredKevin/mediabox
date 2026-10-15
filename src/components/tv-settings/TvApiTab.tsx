import React, { useState, useEffect } from 'react';
import { Button, Input, Badge } from '@boredkevin/ui';
import { Key, Eye, Check } from 'lucide-react';
import { useTranslation } from '@/context/LanguageContext';
import { SearchSettings } from '@/lib/roomUtils';
import { loadProxyConfig, saveProxyConfig, isProxyConfigured } from '@/lib/proxyConfig';

interface TvApiTabProps {
  searchSettings: SearchSettings;
  onUpdateSearchSettings: (patch: Partial<SearchSettings>) => Promise<void>;
}

export const TvApiTab: React.FC<TvApiTabProps> = ({
  searchSettings,
  onUpdateSearchSettings,
}) => {
  const { t } = useTranslation();

  const [proxyUrl, setProxyUrl] = useState('');
  const [proxyToken, setProxyToken] = useState('');
  const [proxyTokenRevealed, setProxyTokenRevealed] = useState(false);
  const [proxyRevealCountdown, setProxyRevealCountdown] = useState(0);
  const [proxySaved, setProxySaved] = useState(false);

  useEffect(() => {
    const pCfg = loadProxyConfig();
    setProxyUrl(pCfg.proxyUrl);
    setProxyToken(pCfg.proxyToken);
    setProxySaved(false);
  }, [searchSettings]);

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
    const configured = isProxyConfigured({ proxyUrl, proxyToken });
    await onUpdateSearchSettings({
      proxyUrl: proxyUrl.trim(),
      isProxyConfigured: configured,
    });
    setProxySaved(true);
    setTimeout(() => setProxySaved(false), 3000);
  };

  const configured = isProxyConfigured({ proxyUrl, proxyToken });

  return (
    <form onSubmit={handleSaveProxy} className="space-y-4">
      {/* Proxy Status Pill */}
      <div className="flex items-center justify-between p-3 bg-muted/20 border border-border">
        <span className="text-xs font-mono font-bold uppercase tracking-wider text-foreground">
          Proxy Status
        </span>
        <Badge variant={configured ? 'default' : 'outline'} className="text-[10px] font-mono">
          {configured ? t('tvSettings.ytProxyStatusConnected') : t('tvSettings.ytProxyStatusDisconnected')}
        </Badge>
      </div>

      <p className="text-xs text-muted-foreground leading-relaxed">
        {t('tvSettings.ytProxyDesc')}
      </p>

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
            placeholder={t('tvSettings.ytProxyUrlPlaceholder')}
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
              placeholder={t('tvSettings.ytProxyTokenPlaceholder')}
              className="text-xs font-mono h-9 pr-10"
            />
            <button
              type="button"
              onClick={() => setProxyTokenRevealed((prev) => !prev)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer p-0.5"
              title={proxyTokenRevealed ? 'Hide' : 'Reveal Token (5s)'}
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
