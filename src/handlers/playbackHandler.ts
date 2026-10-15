import { ref, update, set } from 'firebase/database';
import { database } from '@/lib/firebase';
import { RoomState, QueueItem, SearchResultItem, parseYouTubeVideoId, removeUndefinedFields } from '@/lib/roomUtils';
import { fetchVideoTitle } from '@/lib/youtube';
import { parseTrackAndArtist } from '@/lib/trackParser';
import { playNextQueueItem } from '@/handlers/queueHandler';
import { fetchAndFilterRadioQueue, getFallbackAutoplayTrack } from '@/handlers/autoplayHandler';
import { PlayedTrack } from '@/context/hooks/useAutoplayHistory';

export interface PlaybackTransitionContext {
  roomCode: string;
  getQueue: () => QueueItem[];
  getRoomState: () => RoomState | null;
  getRadioQueue: () => SearchResultItem[];
  setRadioQueue: (items: SearchResultItem[]) => void;
  history: string[];
  urlHistory: string[];
  artistHistory: string[];
  pushTrack: (title: string, channel: string) => void;
  pushUrl: (url: string) => void;
  pushArtist: (artist: string) => void;
  pushPlayedTrack: (track: PlayedTrack) => void;
  popPreviousTrack: () => PlayedTrack | null;
}

/**
 * Transitions to the preceding track in playback history.
 */
export async function transitionToPreviousPlayback(ctx: PlaybackTransitionContext): Promise<boolean> {
  const { roomCode, popPreviousTrack, pushArtist } = ctx;
  const previous = popPreviousTrack();
  if (!previous || !previous.url) {
    return false;
  }

  const parsed = parseTrackAndArtist(previous.title, previous.channelTitle || '');
  if (parsed.artist) {
    pushArtist(parsed.artist);
  }

  await update(ref(database, `rooms/${roomCode}`), {
    'state/currentlyPlaying': previous.url,
    'state/currentlyPlayingTitle': previous.title,
    'state/playback/status': 'playing',
    'state/playback/updatedAt': Date.now(),
  });
  return true;
}

/**
 * Resolves and transitions to the next track in the queue.
 * Prioritizes:
 * 1. Explicit user queue (always takes immediate precedence).
 * 2. YouTube Music Radio Queue (queued up from YTM automix algorithm).
 * 3. Built-in search fallback (when radio is exhausted or unavailable).
 */
export async function transitionToNextPlayback(ctx: PlaybackTransitionContext): Promise<void> {
  const {
    roomCode,
    getQueue,
    getRoomState,
    getRadioQueue,
    setRadioQueue,
    history,
    urlHistory,
    artistHistory,
    pushTrack,
    pushUrl,
    pushArtist,
    pushPlayedTrack,
  } = ctx;

  const roomState = getRoomState();
  const currentUrl = roomState?.currentlyPlaying || '';
  const currentTitle = roomState?.currentlyPlayingTitle || '';

  // Helper to play an item from user queue and record it
  const playQueueItem = async (item: QueueItem) => {
    if (currentUrl) {
      pushPlayedTrack({
        url: currentUrl,
        title: currentTitle,
      });
    }

    if (item.title) {
      const parsed = parseTrackAndArtist(item.title, '');
      if (parsed.artist) {
        pushArtist(parsed.artist);
      }
    }
    await playNextQueueItem(roomCode, item);
  };

  // 1. User Queue ALWAYS wins over autoplay/radio recommendations
  const currentQueue = getQueue();
  if (currentQueue && currentQueue.length > 0) {
    await playQueueItem(currentQueue[0]);
    return;
  }

  // 2. Queue empty: check if Autoplay is enabled
  if (roomState?.isAutoplay) {
    let resolvedTitle = currentTitle;
    let channelTitle = '';

    if (currentUrl) {
      const info = await fetchVideoTitle(currentUrl);
      if (info.title && !resolvedTitle) {
        resolvedTitle = info.title;
      }
      if (info.channelTitle) {
        channelTitle = info.channelTitle;
      }
    }

    // Race-condition guard: Did a member queue a song while resolving title?
    const queueAfterTitle = getQueue();
    if (queueAfterTitle && queueAfterTitle.length > 0) {
      await playQueueItem(queueAfterTitle[0]);
      return;
    }

    if (resolvedTitle) {
      pushTrack(resolvedTitle, channelTitle);
    }
    if (currentUrl) {
      pushUrl(currentUrl);
      pushPlayedTrack({
        url: currentUrl,
        title: resolvedTitle,
        channelTitle,
      });
    }

    const preferMusicVideos = roomState?.searchSettings?.preferMusicVideos ?? true;
    const currentVideoId = parseYouTubeVideoId(currentUrl);

    // Build exclusion set
    const excludedVideoIds = new Set<string>();
    if (currentVideoId) excludedVideoIds.add(currentVideoId);
    for (const u of urlHistory) {
      const vId = parseYouTubeVideoId(u);
      if (vId) excludedVideoIds.add(vId);
    }

    const { artist, track: cleanCurrentTrack } = parseTrackAndArtist(resolvedTitle, channelTitle);

    let nextTrack: { url: string; title: string; artist?: string } | null = null;

    // Check existing Radio Queue first
    let activeRadioQueue = [...getRadioQueue()];

    // Discard any tracks from active radio queue that have already been played
    while (activeRadioQueue.length > 0) {
      const top = activeRadioQueue[0];
      const topId = parseYouTubeVideoId(top.url) || top.id;
      if (topId && excludedVideoIds.has(topId)) {
        activeRadioQueue.shift();
      } else {
        break;
      }
    }

    if (activeRadioQueue.length > 0) {
      // Pop the next track from the established Radio Queue
      const popped = activeRadioQueue.shift()!;
      setRadioQueue(activeRadioQueue);
      set(ref(database, `rooms/${roomCode}/radioQueue`), removeUndefinedFields(activeRadioQueue)).catch(() => {});

      const itemParsed = parseTrackAndArtist(popped.title, popped.channelTitle);
      nextTrack = {
        url: popped.url,
        title: popped.title,
        artist: itemParsed.artist || popped.channelTitle,
      };

      console.log('[Playback] Next track from active YTM Radio Queue:', nextTrack.title);

      // Background prefetch if radio queue is running low (<= 3 items)
      if (activeRadioQueue.length <= 3) {
        const nextId = parseYouTubeVideoId(popped.url) || popped.id;
        if (nextId) {
          fetchAndFilterRadioQueue(nextId, excludedVideoIds, history, artistHistory, preferMusicVideos)
            .then((freshBatch) => {
              if (freshBatch.length > 0) {
                const combined = [...getRadioQueue(), ...freshBatch].slice(0, 25);
                setRadioQueue(combined);
                set(ref(database, `rooms/${roomCode}/radioQueue`), removeUndefinedFields(combined)).catch(() => {});
              }
            })
            .catch(() => {});
        }
      }
    } else if (currentVideoId) {
      // Radio queue is empty: generate a fresh YTM radio queue from the current song
      console.log('[Playback] Generating fresh YTM Radio Queue from seed:', currentVideoId);
      const freshRadio = await fetchAndFilterRadioQueue(
        currentVideoId,
        excludedVideoIds,
        history,
        artistHistory,
        preferMusicVideos
      );

      if (freshRadio.length > 0) {
        const first = freshRadio[0];
        const remaining = freshRadio.slice(1);
        setRadioQueue(remaining);
        set(ref(database, `rooms/${roomCode}/radioQueue`), removeUndefinedFields(remaining)).catch(() => {});

        const itemParsed = parseTrackAndArtist(first.title, first.channelTitle);
        nextTrack = {
          url: first.url,
          title: first.title,
          artist: itemParsed.artist || first.channelTitle,
        };
        console.log('[Playback] Fresh YTM Radio Queue ready. Playing:', nextTrack.title);
      }
    }

    // 3. Fallback path: If YTM radio was unavailable or exhausted, use built-in search
    if (!nextTrack) {
      console.log('[Playback] Radio unavailable; using built-in search fallback');
      const historyNorms = history.map((h) => h.toLowerCase().trim());
      nextTrack = await getFallbackAutoplayTrack(
        cleanCurrentTrack,
        artist,
        excludedVideoIds,
        historyNorms,
        artistHistory,
        preferMusicVideos
      );
    }

    // Race-condition guard: Queue ALWAYS wins!
    const queueAfterAutoplay = getQueue();
    if (queueAfterAutoplay && queueAfterAutoplay.length > 0) {
      await playQueueItem(queueAfterAutoplay[0]);
      return;
    }

    if (nextTrack) {
      const resolvedArtist = nextTrack.artist || parseTrackAndArtist(nextTrack.title, '').artist;
      if (resolvedArtist) {
        pushArtist(resolvedArtist);
      }
      await update(ref(database, `rooms/${roomCode}`), {
        'state/currentlyPlaying': nextTrack.url,
        'state/currentlyPlayingTitle': nextTrack.title,
        'state/playback/status': 'playing',
        'state/playback/positionMs': 0,
        'state/playback/updatedAt': Date.now(),
      });
    } else {
      // Double check queue before clearing and pausing
      const queueBeforePause = getQueue();
      if (queueBeforePause && queueBeforePause.length > 0) {
        await playQueueItem(queueBeforePause[0]);
        return;
      }

      await update(ref(database, `rooms/${roomCode}`), {
        'state/currentlyPlaying': '',
        'state/currentlyPlayingTitle': '',
        'state/playback/status': 'paused',
        'state/playback/updatedAt': Date.now(),
      });
    }
  } else {
    // Autoplay disabled and queue empty -> pause playback
    await update(ref(database, `rooms/${roomCode}`), {
      'state/currentlyPlaying': '',
      'state/currentlyPlayingTitle': '',
      'state/playback/status': 'paused',
      'state/playback/updatedAt': Date.now(),
    });
  }
}
