import React, { useEffect, useRef, useImperativeHandle, forwardRef, useState } from 'react';

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement | string,
        params: {
          sitekey: string;
          size?: 'normal' | 'compact' | 'invisible';
          callback?: (token: string) => void;
          'error-callback'?: (code?: string) => void;
          'expired-callback'?: () => void;
        }
      ) => string;
      reset: (widgetId: string) => void;
      execute: (widgetId: string) => void;
      remove: (widgetId: string) => void;
    };
    onloadTurnstileCallback?: () => void;
  }
}

export interface TurnstileRef {
  getToken: () => Promise<string>;
  reset: () => void;
}

interface TurnstileWidgetProps {
  onToken?: (token: string) => void;
  siteKey?: string;
}

export const TurnstileWidget = forwardRef<TurnstileRef, TurnstileWidgetProps>(
  ({ onToken, siteKey }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const widgetIdRef = useRef<string | null>(null);
    const tokenRef = useRef<string | null>(null);
    const pendingResolveRef = useRef<((token: string) => void) | null>(null);
    const [isReady, setIsReady] = useState(false);

    const effectiveSiteKey =
      siteKey ||
      import.meta.env.VITE_TURNSTILE_SITE_KEY ||
      '1x00000000000000000000AA'; // Cloudflare official test key (always passes)

    useEffect(() => {
      let isMounted = true;

      const initTurnstile = () => {
        if (!containerRef.current || !window.turnstile || widgetIdRef.current) return;

        try {
          const id = window.turnstile.render(containerRef.current, {
            sitekey: effectiveSiteKey,
            size: 'invisible',
            callback: (token: string) => {
              tokenRef.current = token;
              if (onToken) onToken(token);
              if (pendingResolveRef.current) {
                const resolve = pendingResolveRef.current;
                pendingResolveRef.current = null;
                resolve(token);
              }
            },
            'error-callback': (code) => {
              console.warn('[Turnstile] Challenge error code:', code);
              if (pendingResolveRef.current) {
                const resolve = pendingResolveRef.current;
                pendingResolveRef.current = null;
                // Fallback to empty string on error so development doesn't block completely
                resolve('');
              }
            },
            'expired-callback': () => {
              tokenRef.current = null;
            },
          });
          widgetIdRef.current = id;
          if (isMounted) setIsReady(true);
        } catch (err) {
          console.warn('[Turnstile] Render error:', err);
        }
      };

      if (window.turnstile) {
        initTurnstile();
      } else {
        const existingScript = document.getElementById('cf-turnstile-script');
        if (!existingScript) {
          const script = document.createElement('script');
          script.id = 'cf-turnstile-script';
          script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
          script.async = true;
          script.defer = true;
          script.onload = () => {
            initTurnstile();
          };
          document.head.appendChild(script);
        } else {
          existingScript.addEventListener('load', initTurnstile);
        }
      }

      return () => {
        isMounted = false;
        if (widgetIdRef.current && window.turnstile) {
          try {
            window.turnstile.remove(widgetIdRef.current);
          } catch (_) {}
          widgetIdRef.current = null;
        }
      };
    }, [effectiveSiteKey, onToken]);

    useImperativeHandle(ref, () => ({
      getToken: async (): Promise<string> => {
        // If we already have a cached token, consume it and trigger background renewal
        if (tokenRef.current) {
          const token = tokenRef.current;
          tokenRef.current = null;
          if (widgetIdRef.current && window.turnstile) {
            try {
              window.turnstile.reset(widgetIdRef.current);
            } catch (_) {}
          }
          return token;
        }

        // Otherwise execute invisible challenge and wait for token
        return new Promise<string>((resolve) => {
          pendingResolveRef.current = resolve;
          if (widgetIdRef.current && window.turnstile) {
            try {
              window.turnstile.execute(widgetIdRef.current);
            } catch (err) {
              console.warn('[Turnstile] Execute error:', err);
              resolve('');
            }
          } else {
            // Widget not initialized yet or script blocked
            resolve('');
          }

          // Safety timeout after 4s
          setTimeout(() => {
            if (pendingResolveRef.current === resolve) {
              pendingResolveRef.current = null;
              resolve('');
            }
          }, 4000);
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
        ref={containerRef}
        aria-hidden="true"
        style={{
          position: 'absolute',
          width: 0,
          height: 0,
          overflow: 'hidden',
          opacity: 0,
          pointerEvents: 'none',
        }}
      />
    );
  }
);

TurnstileWidget.displayName = 'TurnstileWidget';
