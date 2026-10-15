import { ref, update } from 'firebase/database';
import { database } from '@/lib/firebase';
import { saveLyricsOffset, saveLyricsWordSync } from '@/lib/lyricsOffsetStore';

export async function togglePlayPause(roomCode: string, currentStatus?: string): Promise<void> {
  const newStatus = currentStatus === 'playing' ? 'paused' : 'playing';
  await update(ref(database, `rooms/${roomCode}/state/playback`), {
    status: newStatus,
    updatedAt: Date.now(),
  });
}

export async function toggleFullscreen(
  roomCode: string,
  isFullscreen: boolean,
  lastToggleRef: { current: number }
): Promise<void> {
  const now = Date.now();
  if (now - lastToggleRef.current < 5000) {
    return;
  }
  lastToggleRef.current = now;
  await update(ref(database, `rooms/${roomCode}/state`), {
    isFullscreen: !isFullscreen,
  });
}

export async function toggleRoomLock(roomCode: string, isLocked: boolean): Promise<void> {
  const nextIsLocked = !isLocked;
  const updates: Record<string, any> = {
    isLocked: nextIsLocked,
  };
  if (nextIsLocked) {
    updates['playback/status'] = 'paused';
    updates['playback/updatedAt'] = Date.now();
  }
  await update(ref(database, `rooms/${roomCode}/state`), updates);
}

export async function toggleAutoplay(roomCode: string, isAutoplay: boolean): Promise<void> {
  await update(ref(database, `rooms/${roomCode}/state`), {
    isAutoplay: !isAutoplay,
  });
}

export async function toggleCountdown(roomCode: string, isCountdownEnabled: boolean): Promise<void> {
  await update(ref(database, `rooms/${roomCode}/state`), {
    isCountdownEnabled: !isCountdownEnabled,
  });
}

export async function setLyricsOffset(roomCode: string, offsetMs: number): Promise<void> {
  const clamped = Math.min(5000, Math.max(-5000, Math.round(offsetMs)));
  saveLyricsOffset(clamped);
  await update(ref(database, `rooms/${roomCode}/state`), {
    lyricsOffsetMs: clamped,
  });
}

export async function setLyricsWordSync(roomCode: string, enabled: boolean): Promise<void> {
  saveLyricsWordSync(enabled);
  await update(ref(database, `rooms/${roomCode}/state`), {
    lyricsWordSync: enabled,
  });
}

