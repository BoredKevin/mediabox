import { ref, runTransaction, get } from 'firebase/database';
import { database } from './firebase';

export interface PlaybackState {
  status: 'playing' | 'paused';
  positionMs: number;
  volume: number;
  updatedAt: number;
}

export interface RoomState {
  currentlyPlaying: string;
  currentlyPlayingTitle?: string;
  playback: PlaybackState;
  hostUid?: string;
  isFullscreen?: boolean;
  isLocked?: boolean;
  isAutoplay?: boolean;
}

export interface QueueItem {
  id: string;
  url: string;
  addedBy: string;
  addedAt: number;
  title?: string;
}

export interface MemberCommand {
  type: 'play' | 'pause' | 'addToQueue' | 'removeFromQueue' | 'adjustVolume' | 'forceSkip' | 'reorderQueue' | 'forceRemoveFromQueue' | 'kickMember' | 'toggleFullscreen' | 'clearQueue' | 'toggleRoomLock' | 'toggleAutoplay';
  createdAt: number;
  payload?: {
    url?: string;
    title?: string;
    volume?: number;
    positionMs?: number;
    itemId?: string;
    queueOrder?: string[];
    targetUid?: string;
    purgeQueue?: boolean;
  };
}

export interface MemberRecord {
  uid: string;
  joinedAt: number;
  nickname?: string;
  command?: MemberCommand | null;
}

export interface RoomData {
  tv: {
    uid: string;
    createdAt: number;
  };
  state: RoomState;
  queue: Record<string, QueueItem>;
  members: Record<string, MemberRecord>;
}

export const generateRoomCode = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

export const createRoomAtomic = async (tvUid: string): Promise<string> => {
  let attempts = 0;
  const maxAttempts = 5;

  while (attempts < maxAttempts) {
    attempts++;
    const code = generateRoomCode();
    const roomRef = ref(database, `rooms/${code}`);

    const result = await runTransaction(roomRef, (currentData) => {
      if (currentData !== null) {
        // Room code already exists; abort transaction so it returns committed: false
        return;
      }
      return {
        tv: {
          uid: tvUid,
          createdAt: Date.now(),
        },
        state: {
          currentlyPlaying: '',
          playback: {
            status: 'playing',
            positionMs: 0,
            volume: 80,
            updatedAt: Date.now(),
          },
        },
        queue: {},
        members: {},
      };
    });

    if (result.committed) {
      return code;
    }
  }

  throw new Error('Failed to generate a unique room code after multiple attempts.');
};

export const checkRoomExists = async (roomCode: string): Promise<boolean> => {
  if (!roomCode || roomCode.length !== 6) return false;
  const roomRef = ref(database, `rooms/${roomCode}/tv/uid`);
  const snapshot = await get(roomRef);
  return snapshot.exists();
};

export const parseYouTubeVideoId = (url: string): string | null => {
  if (!url) return null;
  const trimmed = url.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }
  const regExp = /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([a-zA-Z0-9_-]{11})/;
  const match = trimmed.match(regExp);
  return match ? match[1] : null;
};
