import { useEffect, useRef } from 'react';

interface UseTvPlaybackSyncOptions {
  roomCode: string | null;
  playerInstance: any;
  isPlaying: boolean;
  currentlyPlaying?: string | null;
  playbackPositionMs?: number;
  playbackUpdatedAt?: number;
  onSyncCheckpoint?: (positionMs: number, durationMs?: number) => void;
}

/**
 * TV Host Playback Synchronizer.
 * Broadcasts the YouTube player's playback timestamp to Convex ONLY when seeked or changed.
 * Features:
 * 1. Only writes to Convex on track change, play/pause state change, or manual TV seeks (> 2s drift).
 * 2. Zero database writes during normal linear playback: clients sync via dead-reckoning from positionMs + (now - updatedAt).
 * 3. Bidirectional loop prevention: tracks remote seek timestamps to avoid echo-back writes.
 */
export function useTvPlaybackSync({
  roomCode,
  playerInstance,
  isPlaying,
  currentlyPlaying,
  playbackPositionMs,
  playbackUpdatedAt,
  onSyncCheckpoint,
}: UseTvPlaybackSyncOptions) {
  const lastReportedRef = useRef<{ positionMs: number; updatedAt: number }>({
    positionMs: 0,
    updatedAt: 0,
  });
  const localAnchorRef = useRef<{ positionMs: number; localTime: number }>({
    positionMs: 0,
    localTime: performance.now(),
  });
  const prevPlayingRef = useRef<boolean>(isPlaying);
  const prevVideoRef = useRef<string | null | undefined>(currentlyPlaying);

  // Sync internal reference when Convex updatedAt updates from a remote seek or server event
  useEffect(() => {
    if (playbackUpdatedAt && playbackUpdatedAt !== lastReportedRef.current.updatedAt) {
      lastReportedRef.current = {
        positionMs: playbackPositionMs ?? 0,
        updatedAt: playbackUpdatedAt,
      };
      localAnchorRef.current = {
        positionMs: playbackPositionMs ?? 0,
        localTime: performance.now(),
      };
    }
  }, [playbackPositionMs, playbackUpdatedAt]);

  const syncPlaybackState = (forcedPositionMs?: number) => {
    if (!roomCode || !playerInstance) return;

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

    const now = Date.now();
    lastReportedRef.current = { positionMs: posMs, updatedAt: now };
    localAnchorRef.current = { positionMs: posMs, localTime: performance.now() };

    if (onSyncCheckpoint) {
      onSyncCheckpoint(posMs, durMs);
    }
  };

  // Immediate sync on play / pause transition:
  // When pausing (!isPlaying): immediately freeze current position into Convex.
  // When resuming (isPlaying): do NOT emit immediate checkpoint because the YouTube iframe
  // is still unpausing/buffering and reporting a stale/lagging time.
  useEffect(() => {
    if (prevPlayingRef.current !== isPlaying) {
      prevPlayingRef.current = isPlaying;
      if (!isPlaying) {
        syncPlaybackState();
      } else {
        localAnchorRef.current = {
          positionMs: playbackPositionMs ?? 0,
          localTime: performance.now(),
        };
      }
    }
  }, [isPlaying, roomCode, playerInstance, playbackPositionMs]);

  // Reset & broadcast initial state when currentlyPlaying changes
  useEffect(() => {
    if (currentlyPlaying && currentlyPlaying !== prevVideoRef.current) {
      prevVideoRef.current = currentlyPlaying;
      const now = Date.now();
      lastReportedRef.current = { positionMs: 0, updatedAt: now };
      localAnchorRef.current = { positionMs: 0, localTime: performance.now() };

      // Allow the player time to cue / load the new video, then sync duration and actual time
      const timer = setTimeout(() => {
        if (playerInstance && typeof playerInstance.getDuration === 'function') {
          const durMs = Math.max(0, Math.round(playerInstance.getDuration() * 1000));
          const curSec = typeof playerInstance.getCurrentTime === 'function' ? playerInstance.getCurrentTime() : 0;
          const curMs = Math.max(0, Math.round(curSec * 1000));
          if (durMs > 0 && onSyncCheckpoint) {
            onSyncCheckpoint(curMs, durMs);
          }
        }
      }, 1500);

      return () => clearTimeout(timer);
    }
  }, [currentlyPlaying, playerInstance, onSyncCheckpoint]);

  // TV manual seek detection: checks whether player jumped relative to expected linear playback
  useEffect(() => {
    if (!roomCode || !playerInstance) return;

    const checkSeekDiscontinuity = () => {
      if (typeof playerInstance.getCurrentTime !== 'function') return;

      try {
        const currentSec = playerInstance.getCurrentTime();
        const currentMs = Math.max(0, Math.round(currentSec * 1000));
        const durSec = typeof playerInstance.getDuration === 'function' ? playerInstance.getDuration() : 0;
        const durMs = Math.max(0, Math.round(durSec * 1000));
        const now = Date.now();

        const last = lastReportedRef.current;
        const anchor = localAnchorRef.current;

        if (isPlaying) {
          // Expected position assuming linear playback from local monotonic anchor
          const localElapsedMs = Math.max(0, performance.now() - anchor.localTime);
          const expectedMs = anchor.positionMs + localElapsedMs;
          const driftMs = Math.abs(currentMs - expectedMs);

          // Significant jump (> 2000ms): manual seek on TV controls / scrub bar
          if (driftMs >= 2000) {
            lastReportedRef.current = { positionMs: currentMs, updatedAt: now };
            localAnchorRef.current = { positionMs: currentMs, localTime: performance.now() };
            if (onSyncCheckpoint) {
              onSyncCheckpoint(currentMs, durMs);
            }
          }
        } else {
          // Paused state: if player time changed by > 500ms (user scrubbed while paused)
          const pausedDiff = Math.abs(currentMs - last.positionMs);
          if (pausedDiff >= 500) {
            lastReportedRef.current = { positionMs: currentMs, updatedAt: now };
            localAnchorRef.current = { positionMs: currentMs, localTime: performance.now() };
            if (onSyncCheckpoint) {
              onSyncCheckpoint(currentMs, durMs);
            }
          }
        }
      } catch (e) {
        console.warn('[PlaybackSync] checkSeekDiscontinuity error:', e);
      }
    };

    // Fast check every 500ms for manual seeks (NO writes unless seek discontinuity is detected)
    const checkInterval = setInterval(checkSeekDiscontinuity, 500);

    return () => {
      clearInterval(checkInterval);
    };
  }, [roomCode, playerInstance, isPlaying, onSyncCheckpoint]);

  return { syncPlaybackState };
}
