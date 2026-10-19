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
        }
      ) => string;
      reset: (widgetId: string) => void;
      execute: (container?: HTMLElement | string | null, params?: any) => void;
      remove: (widgetId: string) => void;
    };
    onloadTurnstileCallback?: () => void;
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

export const TurnstileWidget = forwardRef<TurnstileRef, TurnstileWidgetProps>(
  ({ onToken, onVerifyingChange, onStatusChange, onError, siteKey, isCleared = false }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const widgetIdRef = useRef<string | null>(null);
    const tokenRef = useRef<string | null>(null);
    const pendingResolversRef = useRef<Array<(token: string) => void>>([]);
    const [isVerifyingState, setIsVerifyingState] = useState(!isCleared);
    const [isInteractive, setIsInteractive] = useState(false);

    const effectiveSiteKey =
      siteKey ||
      import.meta.env.VITE_TURNSTILE_SITE_KEY ||
      '1x00000000000000000000AA'; // Cloudflare official test key (always passes)

    // Store callbacks in refs to decouple them from the widget lifecycle effect.
    // This prevents parent re-renders from recreating the Turnstile widget in an infinite loop.
    const onTokenRef = useRef(onToken);
    const onVerifyingChangeRef = useRef(onVerifyingChange);
    const onStatusChangeRef = useRef(onStatusChange);
    const onErrorRef = useRef(onError);
    const isClearedRef = useRef(isCleared);
    const isVerifyingRef = useRef(!isCleared);

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

      updateVerifying(true, 'verifying');

      const initTurnstile = () => {
        if (!containerRef.current || !window.turnstile || widgetIdRef.current || !isMounted) return;

        try {
          const id = window.turnstile.render(containerRef.current, {
            sitekey: effectiveSiteKey,
            action: 'mediabox-search',
            appearance: 'interaction-only',
            theme: 'dark',
            size: 'flexible',
            callback: (token: string) => {
              if (!isMounted) return;
              tokenRef.current = token;
              updateVerifying(false, 'ready');
              setIsInteractive(false);
              onTokenRef.current?.(token);

              if (pendingResolversRef.current.length > 0) {
                const resolvers = [...pendingResolversRef.current];
                pendingResolversRef.current = [];
                // Token consumed by waiting caller -> trigger background renewal
                tokenRef.current = null;
                resolvers.forEach((resolve) => resolve(token));
                if (!isClearedRef.current) {
                  updateVerifying(true, 'verifying');
                }
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

      if (window.turnstile) {
        initTurnstile();
      } else {
        const existingScript = document.getElementById('cf-turnstile-script') as HTMLScriptElement | null;
        if (!existingScript) {
          const script = document.createElement('script');
          script.id = 'cf-turnstile-script';
          script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
          script.async = true;
          script.defer = true;
          script.onload = () => {
            initTurnstile();
          };
          script.onerror = () => {
            console.warn('[Turnstile] Failed to load Cloudflare Turnstile script (possibly blocked by ad-blocker).');
            if (isMounted) {
              updateVerifying(false, 'error');
              onErrorRef.current?.('Security verification script could not be loaded.');
              if (pendingResolversRef.current.length > 0) {
                const resolvers = [...pendingResolversRef.current];
                pendingResolversRef.current = [];
                resolvers.forEach((resolve) => resolve(''));
              }
            }
          };
          document.head.appendChild(script);
        } else {
          existingScript.addEventListener('load', initTurnstile);
        }
      }

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
        // If we already have a cached token, consume it and trigger background renewal
        if (tokenRef.current) {
          const token = tokenRef.current;
          tokenRef.current = null;
          if (!isCleared) {
            updateVerifying(true, 'verifying');
          }
          if (widgetIdRef.current && window.turnstile) {
            try {
              window.turnstile.reset(widgetIdRef.current);
            } catch (_) {}
          }
          return token;
        }

        // Otherwise execute challenge and wait for token
        updateVerifying(true, 'verifying');
        return new Promise<string>((resolve) => {
          let timer: any = null;

          const wrappedResolve = (token: string) => {
            if (timer) clearTimeout(timer);
            resolve(token);
          };

          pendingResolversRef.current.push(wrappedResolve);

          // Only reset to start a challenge if not already verifying
          if (widgetIdRef.current && window.turnstile && !isVerifyingRef.current) {
            try {
              window.turnstile.reset(widgetIdRef.current);
            } catch (err) {
              console.warn('[Turnstile] Reset error:', err);
            }
          }

          // Safety timeout after 10s to prevent indefinite freeze
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
        if (!isCleared) {
          updateVerifying(true, 'verifying');
        }
        if (widgetIdRef.current && window.turnstile) {
          try {
            window.turnstile.reset(widgetIdRef.current);
          } catch (_) {}
        }
      },
    }));

    if (isInteractive) {
      return (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Security Verification"
          className="fixed inset-0 z-[9999] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
        >
          <div className="bg-card border border-primary/40 rounded-lg p-5 max-w-sm w-full shadow-2xl flex flex-col items-center gap-3 text-center">
            <div className="flex items-center gap-2 text-primary font-bold text-sm tracking-wider uppercase">
              <ShieldCheck className="w-5 h-5 text-primary animate-pulse" />
              <span>Security Check</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Please complete the Cloudflare challenge below to verify your connection.
            </p>
            <div ref={containerRef} className="w-full flex justify-center py-2" />
          </div>
        </div>
      );
    }

    return (
      <div
        ref={containerRef}
        aria-hidden="true"
        style={{
          position: 'fixed',
          bottom: 10,
          right: 10,
          zIndex: -1,
          opacity: 0,
          pointerEvents: 'none',
        }}
      />
    );
  }
);

TurnstileWidget.displayName = 'TurnstileWidget';

