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
  hasToken: () => boolean;
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
    const pendingResolversRef = useRef<Array<(token: string) => void>>([]);
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
              if (onToken) onToken(token);
              if (pendingResolversRef.current.length > 0) {
                const resolvers = [...pendingResolversRef.current];
                pendingResolversRef.current = [];
                tokenRef.current = null;
                resolvers.forEach((resolve) => resolve(token));
                if (widgetIdRef.current && window.turnstile) {
                  try {
                    window.turnstile.reset(widgetIdRef.current);
                  } catch (_) {}
                }
              } else {
                tokenRef.current = token;
              }
            },
            'error-callback': (code) => {
              console.warn('[Turnstile] Challenge error code:', code);
              if (pendingResolversRef.current.length > 0) {
                const resolvers = [...pendingResolversRef.current];
                pendingResolversRef.current = [];
                resolvers.forEach((resolve) => resolve(''));
              }
            },
            'expired-callback': () => {
              tokenRef.current = null;
              if (widgetIdRef.current && window.turnstile) {
                try {
                  window.turnstile.reset(widgetIdRef.current);
                } catch (_) {}
              }
            },
          });
          widgetIdRef.current = id;
          if (isMounted) setIsReady(true);
          if (pendingResolversRef.current.length > 0) {
            try {
              window.turnstile.execute(id);
            } catch (_) {}
          }
        } catch (err) {
          console.warn('[Turnstile] Render error:', err);
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
    }, [effectiveSiteKey, onToken]);

    useImperativeHandle(ref, () => ({
      hasToken: () => Boolean(tokenRef.current),
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
          let timer: any = null;

          const wrappedResolve = (token: string) => {
            if (timer) clearTimeout(timer);
            resolve(token);
          };

          pendingResolversRef.current.push(wrappedResolve);

          if (widgetIdRef.current && window.turnstile) {
            try {
              window.turnstile.execute(widgetIdRef.current);
            } catch (err) {
              console.warn('[Turnstile] Execute error:', err);
            }
          }

          // Safety timeout after 15s to allow for challenge completion
          timer = setTimeout(() => {
            const index = pendingResolversRef.current.indexOf(wrappedResolve);
            if (index !== -1) {
              pendingResolversRef.current.splice(index, 1);
              resolve('');
            }
          }, 15000);
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
          position: 'fixed',
          bottom: 10,
          right: 10,
          zIndex: 9999,
        }}
      />
    );
  }
);

TurnstileWidget.displayName = 'TurnstileWidget';
