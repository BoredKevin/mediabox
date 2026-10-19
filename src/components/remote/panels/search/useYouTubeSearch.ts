import { useState, useCallback, useMemo } from 'react';
import { useAction, useQuery } from 'convex/react';
import { api } from '../../../../../convex/_generated/api';
import { SearchResultItem } from '@/lib/roomUtils';
import { TurnstileRef } from '@/components/common/TurnstileWidget';
import { loadApiToken } from '@/lib/apiTokenStore';

interface UseYouTubeSearchProps {
  roomCode?: string;
  user?: any;
  isProxyConfigured?: boolean;
  preferMusicVideos?: boolean;
  turnstileRef?: React.RefObject<TurnstileRef | null>;
  isTurnstileVerifying?: boolean;
}

export function useYouTubeSearch({
  preferMusicVideos = true,
  turnstileRef,
  isTurnstileVerifying = false,
}: UseYouTubeSearchProps = {}) {
  const [isSearching, setIsSearching] = useState(false);
  const [isAcquiringToken, setIsAcquiringToken] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<SearchResultItem[]>([]);

  const searchAction = useAction(api.youtube.search);
  const apiToken = useMemo(() => loadApiToken(), []);

  const tokenVerification = useQuery(
    api.admins.verifyApiToken,
    apiToken ? { token: apiToken } : 'skip'
  );

  const isCleared = Boolean(tokenVerification?.valid);

  // When cleared (e.g. host API token), Turnstile is bypassed.
  // Otherwise, user is verifying if Turnstile is running or actively acquiring a token.
  const isVerifying = !isCleared && (Boolean(isTurnstileVerifying) || isAcquiringToken);

  const performSearch = useCallback(
    async (cleanQuery: string) => {
      const q = cleanQuery.trim();
      if (!q) return;

      setSearchError(null);

      try {
        let turnstileToken: string | undefined = undefined;

        // If client does not have a verified API token, acquire Turnstile token
        if (!isCleared && turnstileRef?.current) {
          const hasCached =
            typeof turnstileRef.current.hasToken === 'function'
              ? turnstileRef.current.hasToken()
              : false;

          if (!hasCached) {
            setIsAcquiringToken(true);
          }
          try {
            turnstileToken = await turnstileRef.current.getToken();
          } finally {
            setIsAcquiringToken(false);
          }
        }

        setIsSearching(true);

        const results = await searchAction({
          query: q,
          apiToken: apiToken || undefined,
          turnstileToken: turnstileToken || undefined,
          preferMusicVideos,
          maxResults: 25,
        });

        const formattedResults: SearchResultItem[] = ((results as any[]) || []).map((item) => ({
          id: item.id,
          url: item.url,
          title: item.title,
          channelTitle: item.channelTitle,
          thumbnail:
            item.thumbnail ||
            item.thumbnailUrl ||
            (item.id ? `https://i.ytimg.com/vi/${item.id}/mqdefault.jpg` : ''),
          durationSeconds: item.durationSeconds,
        }));

        setSearchResults(formattedResults);
      } catch (err: any) {
        console.error('[YouTube Search] Failed:', err);
        setSearchError(err.message || 'Search failed. Please try again.');
        setSearchResults([]);
      } finally {
        setIsSearching(false);
        setIsAcquiringToken(false);
      }
    },
    [searchAction, isCleared, turnstileRef, apiToken, preferMusicVideos]
  );

  const clearSearch = useCallback(() => {
    setSearchResults([]);
    setSearchError(null);
  }, []);

  return {
    isSearching,
    isVerifying,
    searchError,
    searchResults,
    performSearch,
    clearSearch,
    setSearchError,
    isCleared,
  };
}
