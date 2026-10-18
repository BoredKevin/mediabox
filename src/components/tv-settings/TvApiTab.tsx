import React, { useState, useEffect } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Key, Eye, EyeOff, Check, ShieldCheck, ShieldAlert } from 'lucide-react';
import { useTranslation } from '@/context/LanguageContext';
import { loadApiToken, saveApiToken } from '@/lib/apiTokenStore';

export const TvApiTab: React.FC = () => {
  const { t } = useTranslation();

  const [tokenInput, setTokenInput] = useState('');
  const [isRevealed, setIsRevealed] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    setTokenInput(loadApiToken());
  }, []);

  const verification = useQuery(
    api.admins.verifyApiToken,
    tokenInput.trim() ? { token: tokenInput.trim() } : 'skip'
  );

  const isValid = Boolean(verification?.valid);
  const hasToken = Boolean(tokenInput.trim());

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    saveApiToken(tokenInput.trim());
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2500);
  };

  const handleClear = () => {
    setTokenInput('');
    saveApiToken('');
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
          Authorized TV displays with a valid clearance token can search YouTube and resolve lyrics freely without human verification.
          Hosts can also beam a token directly to this TV from Host Settings on their phone.
        </p>
      </div>

      {/* API Token Form */}
      <form onSubmit={handleSave} className="space-y-4">
        <div>
          <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground block mb-1.5">
            TV Master Clearance Token
          </label>
          <div className="relative">
            <Input
              type={isRevealed ? 'text' : 'password'}
              chamfer="dual"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              placeholder="Paste backend API token here..."
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

        <div className="flex gap-2">
          <Button
            type="submit"
            variant="cyber"
            chamfer="dual"
            className="flex-1 text-xs font-bold uppercase tracking-wider h-9 flex items-center justify-center gap-1.5 cursor-pointer"
          >
            {isSaved ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Token Saved!</span>
              </>
            ) : (
              <>
                <Key className="w-3.5 h-3.5" />
                <span>Save Token</span>
              </>
            )}
          </Button>

          {hasToken && (
            <Button
              type="button"
              variant="outline"
              chamfer="dual"
              onClick={handleClear}
              className="text-xs font-mono h-9 px-3 text-muted-foreground hover:text-destructive"
            >
              Clear
            </Button>
          )}
        </div>
      </form>
    </div>
  );
};
