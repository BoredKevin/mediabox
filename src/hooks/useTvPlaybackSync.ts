import { useEffect, useRef, useCallback } from 'react';

interface UseTvPlaybackSyncOptions {
  roomCode: string | null;
  playerInstance: any;
  isPlaying: boolean;
  currentlyPlaying?: string | null;
  playbackPositionMs?: number;
  playbackUpdatedAt?: number;
  seekSeq?: number;
  onSyncCheckpoint?: (positionMs: number, durationMs?: number) => void;
}

/**
 * TV Host Playback Synchronizer (Master-Observer).
 *
 * Key Principles:
 * 1. The TV is the physical player and single source of truth for audio/video playback.
 * 2. The TV NEVER seeks to match server dead-reckoned time (eliminates self-seek echo loops).
 * 3. The TV ONLY seeks when a remote user scrubs, identified by a monotonic seekSeq change (Trap 1 safe).
 * 4. Normal linear playback uses dead-reckoning on remotes with a light 5000ms background heartbeat.
 * 5. Track completion is handled 100% by native YT.PlayerState.ENDED (0) without fragile polling watchdogs.
 */
export function useTvPlaybackSync({
  roomCode,
  playerInstance,
  isPlaying,
  currentlyPlaying,
  playbackPositionMs,
  seekSeq,
  onSyncCheckpoint,
}: UseTvPlaybackSyncOptions) {
  // Trap 1: Latch the first defined seekSeq on mount/resolution without seeking
  const lastHandledSeekSeqRef = useRef<number | null>(null);
  const prevVideoRef = useRef<string | null | undefined>(currentlyPlaying);

  // Reset seekSeq latch when currentlyPlaying changes (new song)
  useEffect(() => {
    if (currentlyPlaying && currentlyPlaying !== prevVideoRef.current) {
      prevVideoRef.current = currentlyPlaying;
      // Re-latch seekSeq for new song
      lastHandledSeekSeqRef.current = seekSeq ?? null;
    }
  }, [currentlyPlaying, seekSeq]);

  // Handle explicit remote user seeks via monotonic seekSeq
  useEffect(() => {
    if (seekSeq === undefined) return;

    // First time receiving roomState from Convex: latch the value, do NOT seek
    if (lastHandledSeekSeqRef.current === null) {
      lastHandledSeekSeqRef.current = seekSeq;
      return;
    }

    // Subsequent increments from explicit remote scrub: execute seek on TV player
    if (seekSeq !== lastHandledSeekSeqRef.current) {
      lastHandledSeekSeqRef.current = seekSeq;
      if (playerInstance && typeof playerInstance.seekTo === 'function') {
        const targetSec = Math.max(0, (playbackPositionMs || 0) / 1000);
        try {
          playerInstance.seekTo(targetSec, true);
        } catch (e) {
          console.warn('[PlaybackSync] seekTo error:', e);
        }
      }
    }
  }, [seekSeq, playbackPositionMs, playerInstance]);

  const syncPlaybackState = useCallback(
    (forcedPositionMs?: number) => {
      if (!roomCode || !playerInstance || typeof onSyncCheckpoint !== 'function') return;

      let posMs = 0;
      let durMs = 0;
      if (typeof forcedPositionMs === 'number') {
        posMs = Math.max(0, forcedPositionMs);
      } else if (typeof playerInstance.getCurrentTime === 'function') {
        try {
          const sec = playerInstance.getCurrentTime();
          posMs = Math.max(0, Math.round(sec * 1000));
          if (typeof playerInstance.getDuration === 'function') {
            durMs = Math.max(0, Math.round(playerInstance.getDuration() * 1000));
          }
        } catch (e) {
          console.warn('[PlaybackSync] Failed to getCurrentTime:', e);
        }
      }

      onSyncCheckpoint(posMs, durMs > 0 ? durMs : undefined);
    },
    [roomCode, playerInstance, onSyncCheckpoint]
  );

  // Sync state on pause transition to immediately freeze server dead-reckoning
  const prevPlayingRef = useRef<boolean>(isPlaying);
  useEffect(() => {
    if (prevPlayingRef.current !== isPlaying) {
      prevPlayingRef.current = isPlaying;
      if (!isPlaying) {
        syncPlaybackState();
      }
    }
  }, [isPlaying, syncPlaybackState]);

  // Light periodic heartbeat (every 5 seconds) during active playback:
  // Keeps remote clients tightly synced without spamming postMessage IPC or database writes
  useEffect(() => {
    if (!roomCode || !playerInstance || !isPlaying) return;

    const interval = setInterval(() => {
      if (typeof playerInstance.getCurrentTime !== 'function') return;
      try {
        const sec = playerInstance.getCurrentTime();
        const posMs = Math.max(0, Math.round(sec * 1000));
        let durMs: number | undefined;
        if (typeof playerInstance.getDuration === 'function') {
          durMs = Math.max(0, Math.round(playerInstance.getDuration() * 1000));
        }
        if (onSyncCheckpoint) {
          onSyncCheckpoint(posMs, durMs);
        }
      } catch (e) {
        // Ignore transient IPC error
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [roomCode, playerInstance, isPlaying, onSyncCheckpoint]);

  return { syncPlaybackState };
}
