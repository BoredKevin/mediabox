import { useState, useRef, useEffect, useCallback } from 'react';
import { ref, set, onValue, off, remove } from 'firebase/database';
import { User as FirebaseUser } from 'firebase/auth';
import { database } from '@/lib/firebase';
import { SearchResultItem } from '@/lib/roomUtils';

interface UseYouTubeSearchProps {
  roomCode: string;
  user: FirebaseUser | null;
  isProxyConfigured: boolean;
}

export function useYouTubeSearch({
  roomCode,
  user,
  isProxyConfigured,
}: UseYouTubeSearchProps) {
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<SearchResultItem[]>([]);

  const activeReqRef = useRef<{ reqId: string; timeoutId: any; nodeRef: any } | null>(null);

  // Clean up any pending search listeners on unmount
  useEffect(() => {
    return () => {
      if (activeReqRef.current) {
        clearTimeout(activeReqRef.current.timeoutId);
        off(activeReqRef.current.nodeRef);
      }
    };
  }, []);

  const performSearch = useCallback(
    async (cleanQuery: string) => {
      if (!cleanQuery || !user || !roomCode) return;

      if (!isProxyConfigured) {
        setSearchError(
          'Keyword search requires the MediaBox YouTube API proxy to be configured on the TV. You can paste any direct YouTube link above to queue videos with zero setup.'
        );
        return;
      }

      setIsSearching(true);
      setSearchError(null);
      setSearchResults([]);

      if (activeReqRef.current) {
        clearTimeout(activeReqRef.current.timeoutId);
        off(activeReqRef.current.nodeRef);
      }

      const reqId = `${user.uid}_${Date.now()}`;
      const searchReqRef = ref(database, `rooms/${roomCode}/searchRequests/${reqId}`);
      const searchResRef = ref(database, `rooms/${roomCode}/searchResults/${reqId}`);

      const timeoutId = setTimeout(() => {
        off(searchResRef);
        setIsSearching(false);
        setSearchError('TV not responding (timeout after 25s). Please check TV connection.');
        activeReqRef.current = null;
      }, 25000);

      activeReqRef.current = { reqId, timeoutId, nodeRef: searchResRef };

      onValue(searchResRef, (snapshot) => {
        if (!snapshot.exists()) return;

        const data = snapshot.val();
        clearTimeout(timeoutId);
        off(searchResRef);
        setIsSearching(false);
        activeReqRef.current = null;

        if (data.error) {
          setSearchError(data.error);
          setSearchResults([]);
        } else if (Array.isArray(data.results)) {
          setSearchResults(data.results);
        }

        remove(searchResRef).catch(() => {});
      });

      try {
        await set(searchReqRef, {
          requestedBy: user.uid,
          query: cleanQuery,
          createdAt: Date.now(),
        });
      } catch (err: any) {
        clearTimeout(timeoutId);
        off(searchResRef);
        setIsSearching(false);
        setSearchError(err.message || 'Failed to submit search request to TV.');
        activeReqRef.current = null;
      }
    },
    [roomCode, user, isProxyConfigured]
  );

  const clearSearch = useCallback(() => {
    setSearchResults([]);
    setSearchError(null);
  }, []);

  return {
    isSearching,
    searchError,
    searchResults,
    performSearch,
    clearSearch,
    setSearchError,
  };
}
