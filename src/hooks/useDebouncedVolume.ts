import { useRef, useEffect, useCallback } from 'react';
import { ref, update } from 'firebase/database';
import { database } from '@/lib/firebase';
import { RoomState } from '@/lib/roomUtils';

export function useDebouncedVolume(
  roomCode: string | null,
  setRoomState: React.Dispatch<React.SetStateAction<RoomState | null>>
) {
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const handleAdjustVolume = useCallback(
    async (newVol: number) => {
      const clamped = Math.min(100, Math.max(0, Math.round(newVol)));
      setRoomState((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          playback: {
            ...(prev.playback || { status: 'paused', progress: 0 }),
            volume: clamped,
          },
        };
      });

      if (!roomCode) return;

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = setTimeout(() => {
        const playbackRef = ref(database, `rooms/${roomCode}/state/playback`);
        update(playbackRef, { volume: clamped, updatedAt: Date.now() }).catch((err) =>
          console.warn('[TV Host] Debounced volume update failed:', err)
        );
      }, 150);
    },
    [roomCode, setRoomState]
  );

  return { handleAdjustVolume };
}
