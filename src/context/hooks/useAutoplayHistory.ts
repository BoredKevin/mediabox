import { useRef, useCallback } from 'react';
import { parseTrackAndArtist } from '@/lib/trackParser';

/**
 * Hook for managing recent tracks, URLs, and artists played during a room session
 * to prevent duplicates and repetitive artist runs during autoplay.
 */
export const useAutoplayHistory = () => {
  const historyRef = useRef<string[]>([]);
  const urlHistoryRef = useRef<string[]>([]);
  const artistHistoryRef = useRef<string[]>([]);

  const pushTrack = useCallback((currentTitle: string, channelTitle: string = '') => {
    if (!currentTitle) return;
    const parsed = parseTrackAndArtist(currentTitle, channelTitle);
    const cleanTrackName = parsed.track || currentTitle;
    historyRef.current = Array.from(
      new Set([cleanTrackName, currentTitle, ...historyRef.current])
    ).slice(0, 20);

    if (parsed.artist && artistHistoryRef.current.length === 0) {
      artistHistoryRef.current = [parsed.artist];
    }
  }, []);

  const pushUrl = useCallback((url: string) => {
    if (!url) return;
    urlHistoryRef.current = [
      url,
      ...urlHistoryRef.current.filter((u) => u !== url),
    ].slice(0, 15);
  }, []);

  const pushArtist = useCallback((artist: string) => {
    if (!artist) return;
    artistHistoryRef.current = [
      artist,
      ...artistHistoryRef.current,
    ].slice(0, 10);
  }, []);

  const clearHistory = useCallback(() => {
    historyRef.current = [];
    urlHistoryRef.current = [];
    artistHistoryRef.current = [];
  }, []);

  return {
    historyRef,
    urlHistoryRef,
    artistHistoryRef,
    pushTrack,
    pushUrl,
    pushArtist,
    clearHistory,
  };
};
