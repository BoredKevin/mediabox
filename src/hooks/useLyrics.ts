import { useState, useEffect, useRef, useCallback } from 'react';
import type { Lyric } from '@braccato/parsers';
import { parseYouTubeVideoId } from '@/lib/roomUtils';
import { fetchVideoTitle } from '@/lib/youtube';
import { parseTrackAndArtist } from '@/lib/trackParser';
import { isYouTubeMusicTrack } from '@/lib/ytmusicDetector';
import { resolveLyrics, fetchUnisonByVideoId, ResolvedLyricsData } from '@/lib/lyricsService';
import { extractDominantColor } from '@/lib/colorExtractor';

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
}

export function useLyrics(
  videoUrl?: string | null,
  videoTitle?: string | null,
  playerInstance?: any,
  customGetCurrentTime?: () => number,
  customSeekTo?: (seconds: number) => void
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
  });

  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!videoUrl) {
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
      });
      return;
    }

    const videoId = parseYouTubeVideoId(videoUrl);
    if (!videoId) return;

    if (abortRef.current) {
      abortRef.current.abort();
    }
    const controller = new AbortController();
    abortRef.current = controller;

    let cancelled = false;

    // High quality thumbnail URL
    const thumbnail = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

    // Fast initial title parse from room state
    const initialParsed = parseTrackAndArtist(videoTitle || '');
    const isEagerYTMusic = isYouTubeMusicTrack(videoUrl, '', videoTitle || '');

    // Eagerly switch to lyrics view skeleton if track is from YouTube Music
    // This eliminates the 2-5s frozen video player deadzone completely!
    setLyricsState((prev) => ({
      ...prev,
      isLoading: true,
      isYTMusic: isEagerYTMusic,
      shouldShowLyrics: isEagerYTMusic || prev.shouldShowLyrics,
      albumArt: thumbnail,
      trackTitle: initialParsed.track || videoTitle || '',
      artistName: initialParsed.artist || '',
    }));

    // Trigger dominant color extraction (non-blocking)
    extractDominantColor(thumbnail).then((colors) => {
      if (!cancelled) {
        setLyricsState((prev) => ({ ...prev, dominantColor: colors }));
      }
    });

    // Resolve full video title & lyrics in parallel
    (async () => {
      // 1. Parallel fetch: query Unison by videoId AND fetch full video title concurrently!
      const [unisonResult, info] = await Promise.all([
        fetchUnisonByVideoId(videoId, controller.signal),
        fetchVideoTitle(videoUrl).catch(() => ({})),
      ]);

      if (cancelled) return;

      const resolvedTitle = (info as any)?.title || videoTitle || '';
      const channelTitle = (info as any)?.channelTitle || '';
      const parsed = parseTrackAndArtist(resolvedTitle, channelTitle);
      const trackTitle = parsed.track || resolvedTitle || initialParsed.track;
      const artistName = parsed.artist || channelTitle || initialParsed.artist;
      const isYTMusic = isEagerYTMusic || isYouTubeMusicTrack(videoUrl, channelTitle, resolvedTitle);

      // Fast Path: Direct Unison hit (<200ms)!
      if (unisonResult && unisonResult.lyrics && unisonResult.lyrics.length > 0) {
        setLyricsState((prev) => ({
          ...prev,
          lyrics: unisonResult.lyrics,
          isLoading: false,
          isYTMusic,
          isFromUnison: true,
          shouldShowLyrics: true,
          trackTitle,
          artistName,
          sourceLabel: 'Unison',
        }));
        return;
      }

      // If not from YouTube Music and no Unison lyrics, don't show lyrics view
      if (!isYTMusic) {
        setLyricsState((prev) => ({
          ...prev,
          lyrics: null,
          isLoading: false,
          isYTMusic: false,
          isFromUnison: false,
          shouldShowLyrics: false,
        }));
        return;
      }

      const duration = typeof playerInstance?.getDuration === 'function' ? playerInstance.getDuration() : 0;

      // Secondary resolution: Better Lyrics, Binimum, QQ, Kugou, LRCLib
      const result: ResolvedLyricsData | null = await resolveLyrics({
        videoId,
        rawTitle: resolvedTitle,
        channelTitle,
        url: videoUrl,
        duration,
        signal: controller.signal,
      });

      if (cancelled) return;

      const hasLyrics = Boolean(result && result.lyrics && result.lyrics.length > 0);
      const shouldShowLyrics = hasLyrics || isYTMusic;
      const finalTitle = result?.enrichedMeta?.song || trackTitle;
      const finalArtist = result?.enrichedMeta?.artist || artistName;
      const finalArtwork = result?.enrichedMeta?.artworkUrl || thumbnail;

      setLyricsState((prev) => ({
        ...prev,
        lyrics: result?.lyrics || null,
        isLoading: false,
        isYTMusic,
        isFromUnison: Boolean(result?.isFromUnison),
        shouldShowLyrics,
        albumArt: finalArtwork,
        trackTitle: finalTitle,
        artistName: finalArtist,
        sourceLabel: result?.source || '',
      }));

      // Non-blocking dominant color update for enriched artwork
      if (result?.enrichedMeta?.artworkUrl && result.enrichedMeta.artworkUrl !== thumbnail) {
        extractDominantColor(result.enrichedMeta.artworkUrl).then((colors) => {
          if (!cancelled) {
            setLyricsState((prev) => ({ ...prev, dominantColor: colors }));
          }
        });
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [videoUrl, videoTitle, playerInstance]);

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
