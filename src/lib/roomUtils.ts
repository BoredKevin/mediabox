export interface PlaybackState {
  status: 'playing' | 'paused' | 'loading';
  positionMs: number;
  durationMs?: number;
  volume: number;
  updatedAt: number;
  seekSeq?: number;
}

export interface SearchSettings {
  maxResults: number;
  rateLimitCount: number;
  rateLimitWindowMs: number;
  preferMusicVideos?: boolean;
}

export interface RoomState {
  roomId?: string;
  currentlyPlaying: string;
  currentlyPlayingTitle?: string;
  playback: PlaybackState;
  hostUid?: string;
  isFullscreen?: boolean;
  showFullscreenQr?: boolean;
  isLocked?: boolean;
  isAutoplay?: boolean;
  isCountdownEnabled?: boolean;
  searchSettings?: SearchSettings;
  lyricsOffsetMs?: number;
  lyricsWordSync?: boolean;
  preferMusicVideos?: boolean;
  tvOnline?: boolean;
}

export interface QueueItem {
  id: string;
  url: string;
  addedBy: string;
  addedByName?: string;
  addedAt: number;
  title?: string;
  channelTitle?: string;
  durationSeconds?: number;
  thumbnailUrl?: string;
}

export interface SearchResultItem {
  id: string;
  title: string;
  channelTitle: string;
  thumbnail: string;
  url: string;
  durationSeconds?: number;
}

export const generateRoomCode = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
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

/**
 * Calculates current playback position in seconds via dead-reckoning.
 * When playing: (positionMs + elapsed since updatedAt) / 1000
 * When paused: positionMs / 1000
 */
export const calculatePlaybackCurrentTimeSec = (playback?: PlaybackState | null): number => {
  if (!playback) return 0;
  const baseSec = (playback.positionMs || 0) / 1000;
  if (playback.status === 'playing') {
    const now = Date.now();
    const elapsedSec = Math.max(0, (now - (playback.updatedAt || now)) / 1000);
    const totalSec = baseSec + elapsedSec;
    if (typeof playback.durationMs === 'number' && playback.durationMs > 0) {
      return Math.min(totalSec, playback.durationMs / 1000);
    }
    return totalSec;
  }
  return baseSec;
};

