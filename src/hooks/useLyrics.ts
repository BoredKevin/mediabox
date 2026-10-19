import { useState, useEffect, useRef } from 'react';
import { useQuery, useAction } from 'convex/react';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import { detectParser, type Lyric } from '@braccato/parsers';
import { parseYouTubeVideoId } from '@/lib/roomUtils';
import { parseTrackAndArtist, cleanArtistName, isGenericTopic } from '@/lib/trackParser';
import { isYouTubeMusicTrack } from '@/lib/ytmusicDetector';
import { loadApiToken } from '@/lib/apiTokenStore';
import { useLyricsColor } from './lyrics/useLyricsColor';
import { useLyricsPlayerTime } from './lyrics/useLyricsPlayerTime';

export interface LyricsState {
  currentVideoId: string | null;
  lyrics: Lyric[] | null;
  isLoading: boolean;
  status: 'idle' | 'fetching' | 'ready' | 'error';
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
  const videoId = parseYouTubeVideoId(videoUrl || '');
  const albumArt = videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : '';
  const dominantColor = useLyricsColor(albumArt);

  const [lyricsState, setLyricsState] = useState<LyricsState>({
    currentVideoId: videoId || null,
    lyrics: null,
    isLoading: Boolean(videoId),
    status: videoId ? 'fetching' : 'idle',
    isYTMusic: false,
    isFromUnison: false,
    shouldShowLyrics: false,
    albumArt,
    dominantColor,
    trackTitle: '',
    artistName: '',
    sourceLabel: '',
    syncType: 'none',
  });

  const isCurrentVideo = lyricsState.currentVideoId === (videoId || null);

  // Synchronize song change via effect rather than synchronous render-body mutation
  useEffect(() => {
    if (lyricsState.currentVideoId === (videoId || null)) return;
    const isTopic = Boolean(channelTitle && /\s*-\s*Topic$/i.test(channelTitle.trim()));
    const initialParsed = parseTrackAndArtist(videoTitle || '', channelTitle || '');
    const rawTopicArtist = isTopic ? channelTitle!.replace(/\s*-\s*Topic$/i, '').trim() : '';
    const cleanArtist = (isGenericTopic(rawTopicArtist) ? '' : rawTopicArtist) || initialParsed.artist || '';
    const cleanTrack = isTopic ? (videoTitle || '').trim() : (initialParsed.track || videoTitle || '');
    const isEagerYTMusic = Boolean(videoId && (isTopic || isYouTubeMusicTrack(videoUrl, channelTitle, videoTitle || '')));

    setLyricsState({
      currentVideoId: videoId || null,
      lyrics: null,
      isLoading: Boolean(videoId),
      status: videoId ? 'fetching' : 'idle',
      isYTMusic: isEagerYTMusic,
      isFromUnison: false,
      shouldShowLyrics: isEagerYTMusic,
      albumArt,
      dominantColor,
      trackTitle: cleanTrack,
      artistName: cleanArtist,
      sourceLabel: '',
      syncType: 'none',
    });
  }, [videoId, videoTitle, channelTitle, videoUrl, albumArt, dominantColor, lyricsState.currentVideoId]);

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
      setLyricsState((prev) => ({
        ...prev,
        currentVideoId: null,
        lyrics: null,
        isLoading: false,
        status: 'idle',
        isYTMusic: false,
        shouldShowLyrics: false,
        trackTitle: '',
        artistName: '',
        sourceLabel: '',
        syncType: 'none',
        albumArt: '',
      }));
      return;
    }

    const isTopic = Boolean(channelTitle && /\s*-\s*Topic$/i.test(channelTitle.trim()));
    const initialParsed = parseTrackAndArtist(videoTitle || '', channelTitle || '');
    const isEagerYTMusic = isTopic || isYouTubeMusicTrack(videoUrl, channelTitle, videoTitle || '');

    if (cachedLyricsDoc) {
      if (cachedLyricsDoc.status === 'fetching') {
        setLyricsState((prev) => ({
          ...prev,
          currentVideoId: videoId,
          isLoading: true,
          status: 'fetching',
          isYTMusic: isEagerYTMusic,
          shouldShowLyrics: isEagerYTMusic,
          albumArt,
        }));
        return;
      }

      if (cachedLyricsDoc.status === 'ready' || cachedLyricsDoc.status === 'error') {
        let parsedLyrics: Lyric[] | null = null;
        let detectedSyncType: 'word' | 'line' | 'none' = (cachedLyricsDoc.syncType as any) || 'none';

        if (cachedLyricsDoc.data && cachedLyricsDoc.data !== '[]') {
          try {
            const parser = detectParser(cachedLyricsDoc.data);
            const duration = typeof playerInstance?.getDuration === 'function' ? playerInstance.getDuration() : 180;
            parsedLyrics = parser.parse(cachedLyricsDoc.data, duration * 1000);

            if (parsedLyrics && parsedLyrics.length > 0) {
              const hasWordLevel = parsedLyrics.some((l) => l.parts && l.parts.length > 0);
              detectedSyncType = hasWordLevel ? 'word' : 'line';
            }
          } catch (e) {
            console.warn('[useLyrics] Failed to parse cached lyrics data:', e);
          }
        }

        setLyricsState((prev) => ({
          ...prev,
          currentVideoId: videoId,
          lyrics: parsedLyrics,
          isLoading: false,
          status: 'ready',
          isYTMusic: isEagerYTMusic,
          isFromUnison: cachedLyricsDoc.sourceLabel === 'Unison',
          shouldShowLyrics: Boolean(parsedLyrics && parsedLyrics.length > 0) || isEagerYTMusic,
          trackTitle: cachedLyricsDoc.trackTitle || initialParsed.track || prev.trackTitle,
          artistName: cachedLyricsDoc.artistName || (isGenericTopic(initialParsed.artist) ? '' : initialParsed.artist) || prev.artistName,
          sourceLabel: cachedLyricsDoc.sourceLabel,
          syncType: detectedSyncType,
          albumArt,
        }));
      }
    }
  }, [videoId, videoUrl, videoTitle, channelTitle, cachedLyricsDoc, playerInstance, albumArt]);

  // Initiate resolveOrFetch (TV or standalone active player)
  useEffect(() => {
    if (!videoId) return;

    const canInitiateResolution = isTvMode || !roomId;
    if (!canInitiateResolution) return;

    if (cachedLyricsDoc === undefined || (cachedLyricsDoc && cachedLyricsDoc.videoId !== videoId)) return;
    if (cachedLyricsDoc && (cachedLyricsDoc.status === 'ready' || cachedLyricsDoc.status === 'error')) return;
    if (cachedLyricsDoc && cachedLyricsDoc.status === 'fetching' && Date.now() - cachedLyricsDoc.updatedAt < 30_000) {
      return;
    }

    if (isResolvingRef.current === videoId) return;
    isResolvingRef.current = videoId;

    const isTopic = Boolean(channelTitle && /\s*-\s*Topic$/i.test(channelTitle.trim()));
    const initialParsed = parseTrackAndArtist(videoTitle || '', channelTitle || '');
    const rawTopicArtist = isTopic ? channelTitle!.replace(/\s*-\s*Topic$/i, '').trim() : '';
    const cleanArtist =
      (isGenericTopic(rawTopicArtist) ? '' : rawTopicArtist) ||
      initialParsed.artist ||
      (isGenericTopic(channelTitle) ? '' : cleanArtistName(channelTitle || ''));
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

  const { seekTo, getCurrentTime } = useLyricsPlayerTime({
    playerInstance,
    customGetCurrentTime,
    customSeekTo,
  });

  return {
    ...lyricsState,
    currentVideoId: videoId || null,
    lyrics: isCurrentVideo ? lyricsState.lyrics : null,
    isLoading: isCurrentVideo ? lyricsState.isLoading : Boolean(videoId),
    status: isCurrentVideo ? lyricsState.status : (videoId ? 'fetching' : 'idle'),
    dominantColor,
    seekTo,
    getCurrentTime,
  };
}
