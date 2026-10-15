import React from 'react';
import { User as FirebaseUser } from 'firebase/auth';
import { useTranslation } from '@/context/LanguageContext';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tv, Loader2 } from 'lucide-react';

interface JoinScreenProps {
  inputCode: string;
  setInputCode: (val: string) => void;
  onJoin: (code: string) => Promise<void>;
  loading: boolean;
  user?: FirebaseUser | null;
  onGoogleSignIn?: (roomCode?: string) => Promise<void>;
}

export const JoinScreen: React.FC<JoinScreenProps> = ({
  inputCode,
  setInputCode,
  onJoin,
  loading,
}) => {
  const { t } = useTranslation();
  const cleanCode = inputCode.trim();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!loading && cleanCode.length === 6) {
      onJoin(cleanCode);
    }
  };

  return (
    <div className="relative z-10 flex min-h-screen items-center justify-center p-4">
      <Card
        className="w-full max-w-md p-6 bg-card border-border shadow-2xl flex flex-col gap-6 relative"
      >
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-muted border border-border rounded-lg">
              <Tv className="w-6 h-6 text-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-wide text-foreground">
                {t('remote.title')}
              </h1>
              <p className="text-xs text-muted-foreground">{t('remote.subtitle')}</p>
            </div>
          </div>
          <LanguageSwitcher />
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <label className="text-xs font-medium text-foreground">
            {t('remote.connectDesc')}
          </label>
          <Input
            type="text"
            maxLength={6}
            chamfer="dual"
            value={inputCode}
            onChange={(e) => setInputCode(e.target.value.replace(/\D/g, ''))}
            placeholder={t('remote.enterPinPlaceholder')}
            className="text-center font-mono text-xl tracking-[0.3em] text-foreground placeholder:text-muted-foreground/50 rounded-md"
            autoFocus
          />

          <Button
            type="submit"
            variant="cyber"
            chamfer="dual"
            disabled={loading || cleanCode.length !== 6}
            className="w-full mt-2 py-3 text-sm font-bold uppercase tracking-wider flex items-center justify-center gap-2 h-12 cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{t('remote.connecting')}</span>
              </>
            ) : (
              <span>{t('remote.joinRoomBtn')}</span>
            )}
          </Button>
        </form>
      </Card>
    </div>
  );
};
