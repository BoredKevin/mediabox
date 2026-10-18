import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useAction } from 'convex/react';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import { detectParser, type Lyric } from '@braccato/parsers';
import { parseYouTubeVideoId } from '@/lib/roomUtils';
import { parseTrackAndArtist, cleanArtistName } from '@/lib/trackParser';
import { isYouTubeMusicTrack } from '@/lib/ytmusicDetector';
import { extractDominantColor } from '@/lib/colorExtractor';
import { loadApiToken } from '@/lib/apiTokenStore';

export interface LyricsState {
  lyrics: Lyric[] | null;
  isLoading: boolean;
  isYTMusic: boolean;
  isFromUnison: boolean;
  shouldShowLyrics: boolean;
  albumArt: string;
  dominantColor: { dominant: string; gradient: string };
  trackTitle: string;
  artistName: string;
  sourceLabel: string;
  syncType: 'word' | 'line' | 'none';
}

export function useLyrics(
  videoUrl?: string | null,
  videoTitle?: string | null,
  playerInstance?: any,
  customGetCurrentTime?: () => number,
  customSeekTo?: (seconds: number) => void,
  roomId?: Id<'rooms'> | null,
  isTvMode: boolean = false,
  channelTitle?: string | null
) {
  const [lyricsState, setLyricsState] = useState<LyricsState>({
    lyrics: null,
    isLoading: false,
    isYTMusic: false,
    isFromUnison: false,
    shouldShowLyrics: false,
    albumArt: '',
    dominantColor: {
      dominant: '#1a101f',
      gradient: 'radial-gradient(circle at 70% 35%, #24132b 0%, #0d0612 100%)',
    },
    trackTitle: '',
    artistName: '',
    sourceLabel: '',
    syncType: 'none',
  });

  const videoId = parseYouTubeVideoId(videoUrl || '');
  const resolveOrFetchAction = useAction(api.lyricsActions.resolveOrFetch);

  // Subscribe to Convex cachedLyrics for this track
  const cachedLyricsDoc = useQuery(
    api.lyrics.get,
    videoId ? { videoId } : 'skip'
  );

  const isResolvingRef = useRef<string | null>(null);

  // Parse cached lyrics document when available
  useEffect(() => {
    if (!videoId) {
      setLyricsState({
        lyrics: null,
        isLoading: false,
        isYTMusic: false,
        isFromUnison: false,
        shouldShowLyrics: false,
        albumArt: '',
        dominantColor: {
          dominant: '#1a101f',
          gradient: 'radial-gradient(circle at 70% 35%, #24132b 0%, #0d0612 100%)',
        },
        trackTitle: '',
        artistName: '',
        sourceLabel: '',
        syncType: 'none',
      });
      return;
    }

    const thumbnail = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
    const isTopic = Boolean(channelTitle && /\s*-\s*Topic$/i.test(channelTitle.trim()));
    const initialParsed = parseTrackAndArtist(videoTitle || '', channelTitle || '');
    const cleanArtist = isTopic ? channelTitle!.replace(/\s*-\s*Topic$/i, '').trim() : (initialParsed.artist || '');
    const cleanTrack = isTopic ? (videoTitle || '').trim() : (initialParsed.track || videoTitle || '');
    const isEagerYTMusic = isTopic || isYouTubeMusicTrack(videoUrl, channelTitle, videoTitle || '');

    // Waiting for initial query response
    if (cachedLyricsDoc === undefined) {
      setLyricsState((prev) => ({
        ...prev,
        isLoading: true,
        isYTMusic: isEagerYTMusic,
        shouldShowLyrics: isEagerYTMusic || prev.shouldShowLyrics,
        albumArt: thumbnail,
        trackTitle: cleanTrack,
        artistName: cleanArtist,
      }));
      return;
    }

    // Document exists in cachedLyrics
    if (cachedLyricsDoc !== null) {
      if (cachedLyricsDoc.status === 'fetching') {
        // External fetch is currently in-flight on the backend
        setLyricsState((prev) => ({
          ...prev,
          isLoading: true,
          isYTMusic: isEagerYTMusic,
          shouldShowLyrics: isEagerYTMusic || prev.shouldShowLyrics,
          albumArt: thumbnail,
          trackTitle: cachedLyricsDoc.trackTitle || initialParsed.track || prev.trackTitle,
          artistName: cachedLyricsDoc.artistName || initialParsed.artist || prev.artistName,
        }));
        return;
      }

      // Error state or negative cache (sourceLabel === 'none' or data === '[]')
      if (
        cachedLyricsDoc.status === 'error' ||
        (cachedLyricsDoc.status === 'ready' && (cachedLyricsDoc.sourceLabel === 'none' || cachedLyricsDoc.data === '[]'))
      ) {
        setLyricsState((prev) => ({
          ...prev,
          lyrics: null,
          isLoading: false,
          isYTMusic: isEagerYTMusic,
          isFromUnison: false,
          shouldShowLyrics: false,
          trackTitle: cachedLyricsDoc.trackTitle || initialParsed.track || prev.trackTitle,
          artistName: cachedLyricsDoc.artistName || initialParsed.artist || prev.artistName,
          sourceLabel: cachedLyricsDoc.sourceLabel || '',
          syncType: 'none',
        }));
        return;
      }

      if (cachedLyricsDoc.status === 'ready') {

        // Parse lyrics data using Braccato's default automatic parser
        let parsedLyrics: Lyric[] | null = null;
        const raw = (cachedLyricsDoc.data || '').trim();
        const durationSec = typeof playerInstance?.getDuration === 'function' ? playerInstance.getDuration() : 180;
        const durationMs = (durationSec || 180) * 1000;

        if (raw && raw !== '[]') {
          try {
            const parser = detectParser(raw);
            parsedLyrics = parser.parse(raw, durationMs);
          } catch (e) {
            console.warn('[useLyrics] Automatic detectParser failed to parse cached lyrics:', e);
            try {
              parsedLyrics = JSON.parse(raw);
            } catch {
              parsedLyrics = null;
            }
          }
        }

        let detectedSyncType: 'word' | 'line' | 'none' = 'none';
        if (parsedLyrics && parsedLyrics.length > 0) {
          const hasParts = parsedLyrics.some((l) => Array.isArray(l.parts) && l.parts.length > 0);
          const hasTiming = parsedLyrics.some((l) => (l.startTimeMs ?? 0) > 0 || (l.durationMs ?? 0) > 0);
          if (hasParts) {
            detectedSyncType = 'word';
          } else if (hasTiming) {
            detectedSyncType = 'line';
          } else {
            detectedSyncType = 'none';
          }
        }

        setLyricsState((prev) => ({
          ...prev,
          lyrics: parsedLyrics,
          isLoading: false,
          isYTMusic: isEagerYTMusic,
          isFromUnison: cachedLyricsDoc.sourceLabel === 'Unison',
          shouldShowLyrics: Boolean(parsedLyrics && parsedLyrics.length > 0) || isEagerYTMusic,
          trackTitle: cachedLyricsDoc.trackTitle || initialParsed.track || prev.trackTitle,
          artistName: cachedLyricsDoc.artistName || initialParsed.artist || prev.artistName,
          sourceLabel: cachedLyricsDoc.sourceLabel,
          syncType: detectedSyncType,
          albumArt: thumbnail,
        }));
      }
    }
  }, [videoId, videoUrl, videoTitle, channelTitle, cachedLyricsDoc, playerInstance]);

  // Dominant color extraction
  useEffect(() => {
    if (!videoId) return;
    const thumbnail = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
    let active = true;

    extractDominantColor(thumbnail).then((colors) => {
      if (active) {
        setLyricsState((prev) => ({ ...prev, dominantColor: colors }));
      }
    });

    return () => {
      active = false;
    };
  }, [videoId]);

  // Thundering herd protection: ONLY the active player (TV or standalone) initiates resolveOrFetch
  useEffect(() => {
    if (!videoId) return;

    // Remote clients in a room do NOT resolve lyrics directly; they wait for the TV to resolve and cache
    const canInitiateResolution = isTvMode || !roomId;
    if (!canInitiateResolution) return;

    // If already waiting for query result or doc is from previous videoId, wait
    if (cachedLyricsDoc === undefined || (cachedLyricsDoc && cachedLyricsDoc.videoId !== videoId)) return;

    // If doc is ready or error for this videoId, no need to resolve
    if (cachedLyricsDoc && (cachedLyricsDoc.status === 'ready' || cachedLyricsDoc.status === 'error')) return;

    // If fetching and not stale (< 30s), wait
    if (cachedLyricsDoc && cachedLyricsDoc.status === 'fetching' && Date.now() - cachedLyricsDoc.updatedAt < 30_000) {
      return;
    }

    // Prevent duplicate action trigger for the same videoId in this session
    if (isResolvingRef.current === videoId) return;
    isResolvingRef.current = videoId;

    const isTopic = Boolean(channelTitle && /\s*-\s*Topic$/i.test(channelTitle.trim()));
    const initialParsed = parseTrackAndArtist(videoTitle || '', channelTitle || '');
    const cleanArtist = isTopic ? channelTitle!.replace(/\s*-\s*Topic$/i, '').trim() : (initialParsed.artist || cleanArtistName(channelTitle || ''));
    const cleanTrack = isTopic ? (videoTitle || '').trim() : (initialParsed.track || videoTitle || '');
    const duration = typeof playerInstance?.getDuration === 'function' ? playerInstance.getDuration() : undefined;
    const token = loadApiToken();

    resolveOrFetchAction({
      videoId,
      trackTitle: cleanTrack || undefined,
      artistName: cleanArtist || undefined,
      duration,
      roomId: roomId || undefined,
      apiToken: token || undefined,
    }).catch((err) => {
      console.warn('[useLyrics] resolveOrFetchAction error:', err);
      isResolvingRef.current = null;
    });
  }, [videoId, videoTitle, channelTitle, isTvMode, roomId, cachedLyricsDoc, playerInstance, resolveOrFetchAction]);

  const seekTo = useCallback(
    (seconds: number) => {
      if (customSeekTo) {
        customSeekTo(seconds);
      } else if (playerInstance && typeof playerInstance.seekTo === 'function') {
        playerInstance.seekTo(seconds, true);
      }
    },
    [playerInstance, customSeekTo]
  );

  const getCurrentTime = useCallback((): number => {
    if (customGetCurrentTime) {
      return customGetCurrentTime();
    }
    if (playerInstance && typeof playerInstance.getCurrentTime === 'function') {
      return playerInstance.getCurrentTime();
    }
    return 0;
  }, [playerInstance, customGetCurrentTime]);

  return {
    ...lyricsState,
    seekTo,
    getCurrentTime,
  };
}
