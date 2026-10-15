import { useRef, useCallback } from 'react';
import { parseTrackAndArtist } from '@/lib/trackParser';

export interface PlayedTrack {
  url: string;
  title: string;
  channelTitle?: string;
  artist?: string;
}

/**
 * Hook for managing recent tracks, URLs, artists, and played track stack
 * to prevent duplicates, avoid repetitive artist runs, and enable previous track playback.
 */
export const useAutoplayHistory = () => {
  const historyRef = useRef<string[]>([]);
  const urlHistoryRef = useRef<string[]>([]);
  const artistHistoryRef = useRef<string[]>([]);
  const playedTracksRef = useRef<PlayedTrack[]>([]);

  const pushTrack = useCallback((currentTitle: string, channelTitle: string = '') => {
    if (!currentTitle) return;
    const parsed = parseTrackAndArtist(currentTitle, channelTitle);
    const cleanTrackName = parsed.track || currentTitle;
    historyRef.current = Array.from(
      new Set([cleanTrackName, currentTitle, ...historyRef.current])
    ).slice(0, 25);

    if (parsed.artist && artistHistoryRef.current.length === 0) {
      artistHistoryRef.current = [parsed.artist];
    }
  }, []);

  const pushUrl = useCallback((url: string) => {
    if (!url) return;
    urlHistoryRef.current = [
      url,
      ...urlHistoryRef.current.filter((u) => u !== url),
    ].slice(0, 20);
  }, []);

  const pushArtist = useCallback((artist: string) => {
    if (!artist) return;
    artistHistoryRef.current = [
      artist,
      ...artistHistoryRef.current,
    ].slice(0, 15);
  }, []);

  const pushPlayedTrack = useCallback((track: PlayedTrack) => {
    if (!track || !track.url) return;
    // Avoid pushing identical duplicate at top of stack
    const last = playedTracksRef.current[playedTracksRef.current.length - 1];
    if (last && last.url === track.url) return;

    playedTracksRef.current = [...playedTracksRef.current, track].slice(-30);
  }, []);

  const popPreviousTrack = useCallback((): PlayedTrack | null => {
    if (playedTracksRef.current.length === 0) return null;
    return playedTracksRef.current.pop() || null;
  }, []);

  const clearHistory = useCallback(() => {
    historyRef.current = [];
    urlHistoryRef.current = [];
    artistHistoryRef.current = [];
    playedTracksRef.current = [];
  }, []);

  return {
    historyRef,
    urlHistoryRef,
    artistHistoryRef,
    playedTracksRef,
    pushTrack,
    pushUrl,
    pushArtist,
    pushPlayedTrack,
    popPreviousTrack,
    clearHistory,
  };
};
