import { ref, update, remove, set } from 'firebase/database';
import { database } from '@/lib/firebase';
import { QueueItem } from '@/lib/roomUtils';

/**
 * Updates room state to play the next item in queue, and removes it from the queue.
 */
export const playNextQueueItem = async (roomCode: string, item: QueueItem): Promise<void> => {
  if (!roomCode || !item) return;

  await update(ref(database, `rooms/${roomCode}/state`), {
    currentlyPlaying: item.url,
    currentlyPlayingTitle: item.title || '',
  });
  await update(ref(database, `rooms/${roomCode}/state/playback`), {
    status: 'playing',
    updatedAt: Date.now(),
  });
  await remove(ref(database, `rooms/${roomCode}/queue/${item.id}`));
};

/**
 * Removes a specific queue item by its ID.
 */
export const removeQueueItem = async (roomCode: string, itemId: string): Promise<void> => {
  if (!roomCode || !itemId) return;
  await remove(ref(database, `rooms/${roomCode}/queue/${itemId}`));
};

/**
 * Clears all items from the room's queue.
 */
export const clearQueue = async (roomCode: string): Promise<void> => {
  if (!roomCode) return;
  await remove(ref(database, `rooms/${roomCode}/queue`));
};

/**
 * Reorders the queue by updating addedAt timestamps sequentially based on queueOrder.
 */
export const reorderQueue = async (roomCode: string, queueOrder: string[]): Promise<void> => {
  if (!roomCode || !Array.isArray(queueOrder) || queueOrder.length === 0) return;

  const baseTime = Date.now();
  const updates: Record<string, any> = {};
  queueOrder.forEach((itemId, index) => {
    updates[`${itemId}/addedAt`] = baseTime + index * 1000;
  });

  if (Object.keys(updates).length > 0) {
    await update(ref(database, `rooms/${roomCode}/queue`), updates);
  }
};

/**
 * Adds a video to the queue or immediately starts playing it if nothing is currently playing.
 */
export const addToQueue = async (
  roomCode: string,
  videoUrl: string,
  videoTitle: string,
  addedBy: string,
  isCurrentlyPlaying: boolean
): Promise<void> => {
  if (!roomCode || !videoUrl) return;

  if (!isCurrentlyPlaying) {
    await update(ref(database, `rooms/${roomCode}/state`), {
      currentlyPlaying: videoUrl,
      currentlyPlayingTitle: videoTitle,
    });
    await update(ref(database, `rooms/${roomCode}/state/playback`), {
      status: 'playing',
      updatedAt: Date.now(),
    });
  } else {
    const queueKey = `${Date.now()}_${addedBy.substring(0, 4)}`;
    const newQueueRefNode = ref(database, `rooms/${roomCode}/queue/${queueKey}`);
    await set(newQueueRefNode, {
      url: videoUrl,
      title: videoTitle,
      addedBy,
      addedAt: Date.now(),
    });
  }
};

/**
 * Removes all queue items submitted by a specific member.
 */
export const purgeMemberQueueItems = async (
  roomCode: string,
  queue: QueueItem[],
  targetUid: string
): Promise<void> => {
  if (!roomCode || !queue || !targetUid) return;
  const memberQueueItems = queue.filter((item) => item.addedBy === targetUid);
  for (const item of memberQueueItems) {
    await remove(ref(database, `rooms/${roomCode}/queue/${item.id}`));
  }
};
