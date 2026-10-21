import React, { useEffect, useRef, useImperativeHandle, forwardRef, useState, useCallback } from 'react';
import { ShieldCheck } from 'lucide-react';

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement | string,
        params: {
          sitekey: string;
          action?: string;
          cData?: string;
          execution?: 'render' | 'execute';
          appearance?: 'always' | 'execute' | 'interaction-only';
          theme?: 'auto' | 'light' | 'dark';
          size?: 'normal' | 'compact' | 'flexible';
          callback?: (token: string) => void;
          'error-callback'?: (code?: string) => void;
          'expired-callback'?: () => void;
          'timeout-callback'?: () => void;
          'before-interactive-callback'?: () => void;
          'after-interactive-callback'?: () => void;
          'refresh-expired'?: 'auto' | 'manual' | 'never';
          'refresh-timeout'?: 'auto' | 'manual' | 'never';
          retry?: 'auto' | 'never';
          'retry-interval'?: number;
        }
      ) => string;
      reset: (widgetId: string) => void;
      execute: (container?: HTMLElement | string | null, params?: any) => void;
      remove: (widgetId: string) => void;
    };
  }
}

export type TurnstileStatus = 'idle' | 'loading' | 'verifying' | 'ready' | 'error' | 'expired';

export interface TurnstileRef {
  getToken: () => Promise<string>;
  hasToken: () => boolean;
  isVerifying: () => boolean;
  reset: () => void;
}

interface TurnstileWidgetProps {
  onToken?: (token: string) => void;
  onVerifyingChange?: (isVerifying: boolean) => void;
  onStatusChange?: (status: TurnstileStatus) => void;
  onError?: (error: string) => void;
  siteKey?: string;
  isCleared?: boolean;
}

// Module-level singleton script loader to ensure api.js is only injected once
let turnstileLoadPromise: Promise<void> | null = null;

export function loadTurnstileScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.turnstile) return Promise.resolve();
  if (turnstileLoadPromise) return turnstileLoadPromise;

  turnstileLoadPromise = new Promise<void>((resolve, reject) => {
    // Unique global callback name so onload can notify this exact loader
    const callbackName = 'onTurnstileLoaded_' + Math.random().toString(36).substring(2, 9);
    (window as any)[callbackName] = () => {
      try {
        delete (window as any)[callbackName];
      } catch (_) {}
      resolve();
    };

    const existingScript = document.getElementById('cf-turnstile-script') as HTMLScriptElement | null;
    if (existingScript) {
      if (window.turnstile) {
        resolve();
      } else {
        existingScript.addEventListener('load', () => resolve(), { once: true });
      }
      return;
    }

    const script = document.createElement('script');
    script.id = 'cf-turnstile-script';
    script.src = `https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=${callbackName}`;
    script.async = true;
    script.defer = true;
    script.onerror = (err) => {
      turnstileLoadPromise = null; // Allow retry on network failure
      try {
        delete (window as any)[callbackName];
      } catch (_) {}
      reject(err);
    };

    document.head.appendChild(script);
  });

  return turnstileLoadPromise;
}

export const TurnstileWidget = forwardRef<TurnstileRef, TurnstileWidgetProps>(
  ({ onToken, onVerifyingChange, onStatusChange, onError, siteKey, isCleared = false }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const widgetIdRef = useRef<string | null>(null);
    const tokenRef = useRef<string | null>(null);
    const pendingResolversRef = useRef<Array<(token: string) => void>>([]);
    const [isVerifyingState, setIsVerifyingState] = useState(false);
    const [isInteractive, setIsInteractive] = useState(false);

    const effectiveSiteKey =
      siteKey ||
      import.meta.env.VITE_TURNSTILE_SITE_KEY ||
      '1x00000000000000000000AA'; // Cloudflare official test key (always passes)

    const onTokenRef = useRef(onToken);
    const onVerifyingChangeRef = useRef(onVerifyingChange);
    const onStatusChangeRef = useRef(onStatusChange);
    const onErrorRef = useRef(onError);
    const isClearedRef = useRef(isCleared);
    const isVerifyingRef = useRef(false);

    useEffect(() => {
      onTokenRef.current = onToken;
      onVerifyingChangeRef.current = onVerifyingChange;
      onStatusChangeRef.current = onStatusChange;
      onErrorRef.current = onError;
      isClearedRef.current = isCleared;
    });

    const updateVerifying = useCallback((verifying: boolean, status?: TurnstileStatus) => {
      if (isClearedRef.current) {
        if (isVerifyingRef.current) {
          isVerifyingRef.current = false;
          setIsVerifyingState(false);
          onVerifyingChangeRef.current?.(false);
        }
        return;
      }
      if (isVerifyingRef.current !== verifying) {
        isVerifyingRef.current = verifying;
        setIsVerifyingState(verifying);
        onVerifyingChangeRef.current?.(verifying);
      }
      if (status) {
        onStatusChangeRef.current?.(status);
      }
    }, []);

    useEffect(() => {
      let isMounted = true;

      // If client has bypass clearance (e.g. host API token), do not block UI or initialize Turnstile
      if (isCleared) {
        isVerifyingRef.current = false;
        setIsVerifyingState(false);
        onVerifyingChangeRef.current?.(false);
        onStatusChangeRef.current?.('ready');
        return;
      }

      const initTurnstile = () => {
        if (!containerRef.current || !window.turnstile || widgetIdRef.current || !isMounted) return;

        try {
          const id = window.turnstile.render(containerRef.current, {
            sitekey: effectiveSiteKey,
            action: 'mediabox-search',
            execution: 'render',
            appearance: 'interaction-only',
            theme: 'dark',
            size: 'normal',
            'refresh-expired': 'auto',
            'refresh-timeout': 'auto',
            retry: 'auto',
            'retry-interval': 4000,
            callback: (token: string) => {
              if (!isMounted) return;
              tokenRef.current = token;
              updateVerifying(false, 'ready');
              setIsInteractive(false);
              onTokenRef.current?.(token);

              if (pendingResolversRef.current.length > 0) {
                const resolvers = [...pendingResolversRef.current];
                pendingResolversRef.current = [];
                // Tokens are single-use; consume for waiting caller and pre-solve next token
                tokenRef.current = null;
                resolvers.forEach((resolve) => resolve(token));
                // Proactively pre-solve next token for subsequent searches
                if (widgetIdRef.current && window.turnstile) {
                  try {
                    window.turnstile.reset(widgetIdRef.current);
                  } catch (_) {}
                }
              }
            },
            'error-callback': (code) => {
              if (!isMounted) return;
              console.warn('[Turnstile] Challenge error code:', code);
              tokenRef.current = null;
              updateVerifying(false, 'error');
              setIsInteractive(false);
              onErrorRef.current?.(code || 'Verification failed');
              if (pendingResolversRef.current.length > 0) {
                const resolvers = [...pendingResolversRef.current];
                pendingResolversRef.current = [];
                resolvers.forEach((resolve) => resolve(''));
              }
            },
            'expired-callback': () => {
              if (!isMounted) return;
              tokenRef.current = null;
              updateVerifying(true, 'expired');
              // Proactively re-acquire a fresh token
              if (widgetIdRef.current && window.turnstile) {
                try {
                  window.turnstile.reset(widgetIdRef.current);
                } catch (_) {}
              }
            },
            'timeout-callback': () => {
              if (!isMounted) return;
              setIsInteractive(false);
              updateVerifying(false, 'error');
              if (widgetIdRef.current && window.turnstile) {
                try {
                  window.turnstile.reset(widgetIdRef.current);
                } catch (_) {}
              }
              if (pendingResolversRef.current.length > 0) {
                const resolvers = [...pendingResolversRef.current];
                pendingResolversRef.current = [];
                resolvers.forEach((resolve) => resolve(''));
              }
            },
            'before-interactive-callback': () => {
              if (!isMounted) return;
              setIsInteractive(true);
            },
            'after-interactive-callback': () => {
              if (!isMounted) return;
              setIsInteractive(false);
            },
          });
          widgetIdRef.current = id;
          // In 'render' execution mode, Turnstile immediately begins pre-verifying in the background
          if (!tokenRef.current) {
            updateVerifying(true, 'verifying');
          }
        } catch (err: any) {
          console.warn('[Turnstile] Render error:', err);
          if (!isMounted) return;
          tokenRef.current = null;
          updateVerifying(false, 'error');
          onErrorRef.current?.(err?.message || 'Failed to initialize security verification');
          if (pendingResolversRef.current.length > 0) {
            const resolvers = [...pendingResolversRef.current];
            pendingResolversRef.current = [];
            resolvers.forEach((resolve) => resolve(''));
          }
        }
      };

      loadTurnstileScript()
        .then(() => {
          if (isMounted) initTurnstile();
        })
        .catch((err) => {
          console.warn('[Turnstile] Script loading error:', err);
          if (isMounted) {
            updateVerifying(false, 'error');
            onErrorRef.current?.('Security verification script could not be loaded.');
            if (pendingResolversRef.current.length > 0) {
              const resolvers = [...pendingResolversRef.current];
              pendingResolversRef.current = [];
              resolvers.forEach((resolve) => resolve(''));
            }
          }
        });

      return () => {
        isMounted = false;
        if (pendingResolversRef.current.length > 0) {
          const resolvers = [...pendingResolversRef.current];
          pendingResolversRef.current = [];
          resolvers.forEach((resolve) => resolve(''));
        }
        if (widgetIdRef.current && window.turnstile) {
          try {
            window.turnstile.remove(widgetIdRef.current);
          } catch (_) {}
          widgetIdRef.current = null;
        }
      };
    }, [effectiveSiteKey, isCleared, updateVerifying]);

    useImperativeHandle(ref, () => ({
      hasToken: () => Boolean(tokenRef.current),
      isVerifying: () => isVerifyingState,
      getToken: async (): Promise<string> => {
        // If we already have a pre-solved valid token, consume it immediately and trigger background renewal
        if (tokenRef.current) {
          const token = tokenRef.current;
          tokenRef.current = null;
          // Immediately pre-solve the next token in the background for subsequent searches
          if (widgetIdRef.current && window.turnstile) {
            try {
              window.turnstile.reset(widgetIdRef.current);
            } catch (_) {}
          }
          return token;
        }

        // Token not ready yet (e.g. user clicked Search instantly within 0-1s of opening panel)
        updateVerifying(true, 'verifying');
        return new Promise<string>((resolve) => {
          let timer: any = null;

          const wrappedResolve = (token: string) => {
            if (timer) clearTimeout(timer);
            resolve(token);
          };

          pendingResolversRef.current.push(wrappedResolve);

          if (widgetIdRef.current && window.turnstile) {
            try {
              // If challenge is stuck or not running, trigger a reset to prompt evaluation
              window.turnstile.reset(widgetIdRef.current);
            } catch (err) {
              console.warn('[Turnstile] Reset error on demand:', err);
            }
          } else {
            // Widget not rendered yet; wait for load
            loadTurnstileScript()
              .then(() => {
                if (widgetIdRef.current && window.turnstile) {
                  window.turnstile.reset(widgetIdRef.current);
                }
              })
              .catch(() => {
                wrappedResolve('');
              });
          }

          // Safety timeout after 10s to prevent indefinite UI freeze
          timer = setTimeout(() => {
            const index = pendingResolversRef.current.indexOf(wrappedResolve);
            if (index !== -1) {
              pendingResolversRef.current.splice(index, 1);
              updateVerifying(false, 'error');
              resolve('');
            }
          }, 10000);
        });
      },
      reset: () => {
        tokenRef.current = null;
        if (widgetIdRef.current && window.turnstile) {
          try {
            window.turnstile.reset(widgetIdRef.current);
          } catch (_) {}
        }
      },
    }));

    return (
      <div
        aria-hidden={!isInteractive}
        className={
          isInteractive
            ? 'fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200'
            : 'fixed bottom-4 right-4 z-10 pointer-events-none'
        }
      >
        <div
          className={
            isInteractive
              ? 'bg-card border border-primary/40 rounded-lg p-5 max-w-sm w-full shadow-2xl flex flex-col items-center gap-3 text-center pointer-events-auto'
              : 'w-[300px] min-h-[65px] flex items-center justify-center'
          }
        >
          {isInteractive && (
            <>
              <div className="flex items-center gap-2 text-primary font-bold text-sm tracking-wider uppercase">
                <ShieldCheck className="w-5 h-5 text-primary animate-pulse" />
                <span>Security Check</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Please complete the Cloudflare challenge below to verify your connection.
              </p>
            </>
          )}

          {/* Stable DOM node - never reparented across renders to prevent challenge reset */}
          <div
            ref={containerRef}
            className={`w-[300px] min-h-[65px] flex justify-center items-center ${
              isInteractive ? 'py-2 pointer-events-auto' : ''
            }`}
          />
        </div>
      </div>
    );
  }
);

TurnstileWidget.displayName = 'TurnstileWidget';
