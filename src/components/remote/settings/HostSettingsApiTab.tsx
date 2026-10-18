import React, { useState, useEffect } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Key, Eye, EyeOff, Send, ShieldCheck, ShieldAlert, Check } from 'lucide-react';
import { useTranslation } from '@/context/LanguageContext';
import { RoomState } from '@/lib/roomUtils';
import { RemoteActions } from '../hooks/useRemoteRoom';
import { loadApiToken, saveApiToken } from '@/lib/apiTokenStore';

interface HostSettingsApiTabProps {
  roomState: RoomState | null;
  actions: RemoteActions;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export const HostSettingsApiTab: React.FC<HostSettingsApiTabProps> = ({
  roomState,
  actions,
  showToast,
}) => {
  const { t } = useTranslation();

  const [tokenInput, setTokenInput] = useState('');
  const [isRevealed, setIsRevealed] = useState(false);
  const [isBeaming, setIsBeaming] = useState(false);
  const [isSavedLocally, setIsSavedLocally] = useState(false);

  useEffect(() => {
    setTokenInput(loadApiToken());
  }, []);

  const trimmedToken = tokenInput.trim();
  const verification = useQuery(
    api.admins.verifyApiToken,
    trimmedToken ? { token: trimmedToken } : 'skip'
  );

  const isValid = Boolean(verification?.valid);
  const hasToken = Boolean(trimmedToken);

  const handleBeamToTv = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trimmedToken) {
      showToast('Please enter an API token first', 'error');
      return;
    }

    setIsBeaming(true);
    try {
      // 1. Beam token to TV via isolated roomSecrets table
      await actions.beamTokenToTv(trimmedToken);

      // 2. Also save to host phone's own localStorage so host phone also enjoys clearance
      saveApiToken(trimmedToken);

      showToast('API token beamed to TV screen!', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to beam token to TV', 'error');
    } finally {
      setIsBeaming(false);
    }
  };

  const handleSaveLocally = () => {
    if (!trimmedToken) return;
    saveApiToken(trimmedToken);
    setIsSavedLocally(true);
    showToast('API token saved to this device!', 'success');
    setTimeout(() => setIsSavedLocally(false), 2500);
  };

  const handleClear = () => {
    setTokenInput('');
    saveApiToken('');
    showToast('Token cleared', 'info');
  };

  return (
    <div className="space-y-6">
      {/* Clearance Status Card */}
      <div className="p-4 bg-muted/20 border border-border space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {isValid ? (
              <ShieldCheck className="w-5 h-5 text-primary flex-shrink-0" />
            ) : (
              <ShieldAlert className="w-5 h-5 text-amber-400 flex-shrink-0" />
            )}
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-foreground">
              Clearance Status
            </span>
          </div>
          <Badge
            variant={isValid ? 'default' : 'outline'}
            className={`text-[10px] font-mono ${
              isValid
                ? 'bg-primary/20 text-primary border-primary/40'
                : 'text-amber-400 border-amber-500/40'
            }`}
          >
            {isValid
              ? 'ACTIVE'
              : hasToken
              ? 'INVALID TOKEN'
              : 'NO TOKEN'}
          </Badge>
        </div>

        <p className="text-xs text-muted-foreground leading-relaxed">
          Entering an authorized API token enables seamless YouTube search and instant lyrics resolution.
          Clicking <strong>Send to TV</strong> securely transmits the token to the TV display in real time without exposing it to connected guests.
        </p>
      </div>

      {/* Token Input Form */}
      <form onSubmit={handleBeamToTv} className="space-y-4">
        <div>
          <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground block mb-1.5">
            API Token
          </label>
          <div className="relative">
            <Input
              type={isRevealed ? 'text' : 'password'}
              chamfer="dual"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              placeholder="Paste backend API token..."
              className="text-xs font-mono h-9 pr-12"
            />
            <button
              type="button"
              onClick={() => setIsRevealed((prev) => !prev)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer p-0.5"
              title={isRevealed ? 'Hide' : 'Reveal'}
            >
              {isRevealed ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <Button
            type="submit"
            variant="cyber"
            chamfer="dual"
            disabled={!trimmedToken || isBeaming}
            className="w-full text-xs font-bold uppercase tracking-wider h-9 flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{isBeaming ? 'Beaming to TV...' : 'Send to TV'}</span>
          </Button>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              chamfer="dual"
              disabled={!trimmedToken}
              onClick={handleSaveLocally}
              className="flex-1 text-xs font-mono uppercase tracking-wider h-8 flex items-center justify-center gap-1"
            >
              {isSavedLocally ? <Check className="w-3 h-3 text-primary" /> : <Key className="w-3 h-3" />}
              <span>{isSavedLocally ? 'Saved to device' : 'Save to device'}</span>
            </Button>

            {hasToken && (
              <Button
                type="button"
                variant="ghost"
                onClick={handleClear}
                className="text-xs font-mono h-8 px-3 text-muted-foreground hover:text-destructive"
              >
                Clear
              </Button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
};
