import { useCallback } from 'react';

interface UseLyricsPlayerTimeProps {
  playerInstance?: any;
  customGetCurrentTime?: () => number;
  customSeekTo?: (seconds: number) => void;
}

export function useLyricsPlayerTime({
  playerInstance,
  customGetCurrentTime,
  customSeekTo,
}: UseLyricsPlayerTimeProps) {
  const seekTo = useCallback(
    (seconds: number) => {
      if (customSeekTo) {
        customSeekTo(seconds);
      } else if (playerInstance && typeof playerInstance.seekTo === 'function') {
        playerInstance.seekTo(seconds, true);
      }
    },
    [playerInstance, customSeekTo]
  );

  const getCurrentTime = useCallback((): number => {
    if (customGetCurrentTime) {
      return customGetCurrentTime();
    }
    if (playerInstance && typeof playerInstance.getCurrentTime === 'function') {
      return playerInstance.getCurrentTime();
    }
    return 0;
  }, [playerInstance, customGetCurrentTime]);

  return { seekTo, getCurrentTime };
}
