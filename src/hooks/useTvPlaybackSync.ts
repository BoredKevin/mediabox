import { useEffect, useRef } from 'react';
import { ref, update } from 'firebase/database';
import { database } from '@/lib/firebase';
import { getServerTime } from '@/lib/serverTime';

interface UseTvPlaybackSyncOptions {
  roomCode: string | null;
  playerInstance: any;
  isPlaying: boolean;
  currentlyPlaying?: string | null;
}

/**
 * TV Host Playback Synchronizer.
 * Broadcasts the YouTube player's real-time playback position and timestamp to Firebase RTDB.
 * Features:
 * 1. Normalized server-time timestamps to eliminate multi-device clock skew.
 * 2. Scheduled periodic heartbeat every 1.5s while playing (works even in background/hidden tab).
 * 3. High-frequency micro-drift detection: catches buffering, stutter, or lag > 300ms within 500ms.
 * 4. Buffering awareness: prevents remote dead-reckoning from advancing when YouTube is buffering.
 */
export function useTvPlaybackSync({
  roomCode,
  playerInstance,
  isPlaying,
  currentlyPlaying,
}: UseTvPlaybackSyncOptions) {
  const lastUpdatedRef = useRef<{ positionMs: number; updatedAt: number }>({
    positionMs: 0,
    updatedAt: 0,
  });
  const prevPlayingRef = useRef<boolean>(isPlaying);
  const prevVideoRef = useRef<string | null | undefined>(currentlyPlaying);

  const syncPlaybackState = (status: 'playing' | 'paused', forcedPositionMs?: number) => {
    if (!roomCode || !playerInstance) return;

    let posMs = 0;
    if (typeof forcedPositionMs === 'number') {
      posMs = Math.max(0, forcedPositionMs);
    } else if (typeof playerInstance.getCurrentTime === 'function') {
      try {
        const sec = playerInstance.getCurrentTime();
        posMs = Math.max(0, Math.round(sec * 1000));
      } catch (e) {
        console.warn('[PlaybackSync] Failed to getCurrentTime:', e);
      }
    }

    const now = getServerTime();
    lastUpdatedRef.current = { positionMs: posMs, updatedAt: now };

    update(ref(database, `rooms/${roomCode}/state/playback`), {
      status,
      positionMs: posMs,
      updatedAt: now,
    }).catch((err) => {
      console.warn('[PlaybackSync] Firebase update error:', err);
    });
  };

  // Immediate sync on play / pause transition
  useEffect(() => {
    if (prevPlayingRef.current !== isPlaying) {
      prevPlayingRef.current = isPlaying;
      if (isPlaying) {
        syncPlaybackState('playing');
      } else {
        syncPlaybackState('paused');
      }
    }
  }, [isPlaying, roomCode, playerInstance]);

  // Reset when currentlyPlaying changes
  useEffect(() => {
    if (currentlyPlaying && currentlyPlaying !== prevVideoRef.current) {
      prevVideoRef.current = currentlyPlaying;
      if (roomCode) {
        syncPlaybackState(isPlaying ? 'playing' : 'paused', 0);
      }
    }
  }, [currentlyPlaying, roomCode]);

  // Scheduled periodic resyncs & continuous drift detection while playing
  useEffect(() => {
    if (!roomCode || !playerInstance || !isPlaying) return;

    let lastHeartbeatTime = Date.now();

    const checkAndResync = () => {
      if (typeof playerInstance.getCurrentTime !== 'function') return;

      try {
        const currentSec = playerInstance.getCurrentTime();
        const currentMs = Math.max(0, Math.round(currentSec * 1000));
        const now = getServerTime();
        const nowLocal = Date.now();

        // Check if player is buffering (YT.PlayerState.BUFFERING === 3)
        let isBuffering = false;
        if (typeof playerInstance.getPlayerState === 'function') {
          try {
            isBuffering = playerInstance.getPlayerState() === 3;
          } catch (_) {}
        }

        const last = lastUpdatedRef.current;
        // Expected position assuming linear playback from last broadcast
        const expectedMs = last.positionMs + Math.max(0, now - (last.updatedAt || now));
        const driftMs = Math.abs(currentMs - expectedMs);

        const timeSinceLastHeartbeat = nowLocal - lastHeartbeatTime;
        const needsHeartbeat = timeSinceLastHeartbeat >= 1500;
        const hasDrift = driftMs >= 300 && last.positionMs > 0;

        if (needsHeartbeat || hasDrift || isBuffering) {
          lastHeartbeatTime = nowLocal;
          lastUpdatedRef.current = { positionMs: currentMs, updatedAt: now };

          update(ref(database, `rooms/${roomCode}/state/playback`), {
            status: isBuffering ? 'paused' : 'playing',
            positionMs: currentMs,
            updatedAt: now,
          }).catch((err) => console.warn('[PlaybackSync] Resync error:', err));
        }
      } catch (e) {
        console.warn('[PlaybackSync] checkAndResync error:', e);
      }
    };

    // Fast check every 500ms to immediately catch drifts or buffer events
    const driftCheckInterval = setInterval(checkAndResync, 500);

    // Immediate sync on tab/window visibility return
    const handleVisibility = () => {
      if (!document.hidden && isPlaying) {
        checkAndResync();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleVisibility);

    return () => {
      clearInterval(driftCheckInterval);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleVisibility);
    };
  }, [roomCode, playerInstance, isPlaying]);

  return { syncPlaybackState };
}
