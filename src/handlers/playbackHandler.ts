import { ref, update } from 'firebase/database';
import { database } from '@/lib/firebase';
import { RoomState, QueueItem } from '@/lib/roomUtils';
import { fetchVideoTitle } from '@/lib/youtube';
import { parseTrackAndArtist } from '@/lib/trackParser';
import { playNextQueueItem } from '@/handlers/queueHandler';
import { getAutoplayNextYouTubeTrack } from '@/handlers/autoplayHandler';

export interface PlaybackTransitionContext {
  roomCode: string;
  getQueue: () => QueueItem[];
  getRoomState: () => RoomState | null;
  history: string[];
  urlHistory: string[];
  artistHistory: string[];
  pushTrack: (title: string, channel: string) => void;
  pushUrl: (url: string) => void;
  pushArtist: (artist: string) => void;
}

/**
 * Resolves and transitions to the next track in the queue,
 * prioritizing the member queue over autoplay recommendations.
 */
export async function transitionToNextPlayback(ctx: PlaybackTransitionContext): Promise<void> {
  const {
    roomCode,
    getQueue,
    getRoomState,
    history,
    urlHistory,
    artistHistory,
    pushTrack,
    pushUrl,
    pushArtist,
  } = ctx;

  // Helper to play an item from queue and push its artist
  const playQueueItem = async (item: QueueItem) => {
    if (item.title) {
      const parsed = parseTrackAndArtist(item.title, '');
      if (parsed.artist) {
        pushArtist(parsed.artist);
      }
    }
    await playNextQueueItem(roomCode, item);
  };

  // 1. Check queue first
  const currentQueue = getQueue();
  if (currentQueue && currentQueue.length > 0) {
    await playQueueItem(currentQueue[0]);
    return;
  }

  const roomState = getRoomState();

  // 2. Queue empty: check if Autoplay is enabled
  if (roomState?.isAutoplay) {
    let currentTitle = roomState?.currentlyPlayingTitle || '';
    let channelTitle = '';
    const currentUrl = roomState?.currentlyPlaying || '';

    if (currentUrl) {
      const info = await fetchVideoTitle(currentUrl);
      if (info.title && !currentTitle) {
        currentTitle = info.title;
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

    if (currentTitle) {
      pushTrack(currentTitle, channelTitle);
    }
    if (currentUrl) {
      pushUrl(currentUrl);
    }

    const preferMusicVideos = roomState?.searchSettings?.preferMusicVideos ?? true;

    const nextTrack = await getAutoplayNextYouTubeTrack(
      currentTitle,
      channelTitle,
      history,
      currentUrl,
      urlHistory,
      preferMusicVideos,
      artistHistory
    );

    // Race-condition guard: Queue ALWAYS wins over autoplay recommendations!
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
