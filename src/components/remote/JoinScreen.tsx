import React, { useState, useEffect } from 'react';
import { ref, get } from 'firebase/database';
import { User as FirebaseUser } from 'firebase/auth';
import { database } from '@/lib/firebase';
import { useTranslation } from '@/context/LanguageContext';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { Card, Button, Input } from '@boredkevin/ui';
import { Tv, Loader2, LogIn, ShieldAlert } from 'lucide-react';

interface JoinScreenProps {
  inputCode: string;
  setInputCode: (val: string) => void;
  onJoin: (code: string) => Promise<void>;
  loading: boolean;
  user: FirebaseUser | null;
  onGoogleSignIn: () => Promise<void>;
}

export const JoinScreen: React.FC<JoinScreenProps> = ({
  inputCode,
  setInputCode,
  onJoin,
  loading,
  user,
  onGoogleSignIn,
}) => {
  const { t } = useTranslation();
  const [checkingRoom, setCheckingRoom] = useState(false);
  const [roomHasKeys, setRoomHasKeys] = useState<boolean | null>(null);

  const cleanCode = inputCode.trim();
  const isGoogleAuthed = Boolean(user && !user.isAnonymous);

  // Check if room has API keys configured whenever a 6-digit code is entered
  useEffect(() => {
    if (cleanCode.length !== 6) {
      setRoomHasKeys(null);
      return;
    }

    let isMounted = true;
    setCheckingRoom(true);

    const checkKeyStatus = async () => {
      try {
        const snap = await get(ref(database, `rooms/${cleanCode}/state/searchSettings/hasApiKeys`));
        if (isMounted) {
          setRoomHasKeys(snap.exists() && snap.val() === true);
        }
      } catch {
        if (isMounted) {
          setRoomHasKeys(null);
        }
      } finally {
        if (isMounted) {
          setCheckingRoom(false);
        }
      }
    };

    checkKeyStatus();

    return () => {
      isMounted = false;
    };
  }, [cleanCode]);

  const requiresGoogleAuth = roomHasKeys === true && !isGoogleAuthed;

  return (
    <div className="relative z-10 flex min-h-screen items-center justify-center p-4">
      <Card
        telemetry="AUTH.JOIN"
        cornerLines
        className="w-full max-w-md p-6 bg-card border-border shadow-2xl flex flex-col gap-6 relative"
      >
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary/10 border border-primary/30">
              <Tv className="w-6 h-6 text-primary" />
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

        <div className="flex flex-col gap-3">
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
            className="text-center font-mono text-xl tracking-[0.3em] text-primary placeholder:text-muted-foreground/50"
          />

          {checkingRoom && (
            <div className="flex items-center justify-center gap-2 py-2 text-xs text-muted-foreground">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Checking room settings...</span>
            </div>
          )}

          {/* Google Sign-in Gate if room has API keys */}
          {requiresGoogleAuth ? (
            <div className="p-3.5 bg-amber-950/30 border border-amber-800/60 flex flex-col gap-2.5">
              <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-wide">
                <ShieldAlert className="w-4 h-4 text-amber-400 flex-shrink-0" />
                <span>Google Sign-In Required</span>
              </div>
              <p className="text-[11px] text-amber-300/80 leading-relaxed">
                This room routes YouTube keyword searches through the TV with per-member rate limits. Please sign in with Google to join.
              </p>
              <Button
                variant="outline"
                chamfer="dual"
                onClick={onGoogleSignIn}
                disabled={loading}
                className="w-full py-2.5 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 h-11 border-primary/50 text-foreground hover:border-primary"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>{t('remote.signInWithGoogle')}</span>
              </Button>
            </div>
          ) : (
            <Button
              variant="cyber"
              chamfer="dual"
              onClick={() => onJoin(inputCode)}
              disabled={loading || inputCode.length !== 6 || requiresGoogleAuth}
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
          )}
        </div>
      </Card>
    </div>
  );
};
