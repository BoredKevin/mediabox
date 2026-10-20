import { useMemo } from 'react';
import { useMutation, useAction } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import { Id } from '../../../../convex/_generated/dataModel';
import { parseYouTubeVideoId } from '@/lib/roomUtils';
import { fetchVideoTitle } from '@/lib/youtube';
import { useTranslation } from '@/context/LanguageContext';
import { loadApiToken } from '@/lib/apiTokenStore';

export interface RemoteActions {
  togglePlayPause: () => Promise<void>;
  nextTrack: () => Promise<void>;
  previousTrack: () => Promise<void>;
  setVolume: (volume: number) => Promise<void>;
  seek: (positionMs: number) => Promise<void>;
  addToQueue: (url: string, title?: string) => Promise<void>;
  removeFromQueue: (queueId: string) => Promise<void>;
  reorderQueue: (orderedIds: string[]) => Promise<void>;
  clearQueue: () => Promise<void>;
  purgeMemberTracks: (targetUid: string) => Promise<void>;
  toggleLock: () => Promise<void>;
  toggleAutoplay: () => Promise<void>;
  toggleCountdown: () => Promise<void>;
  toggleFullscreen: () => Promise<void>;
  toggleFullscreenQr: () => Promise<void>;
  claimHost: () => Promise<void>;
  startRadio: () => Promise<void>;
  beamTokenToTv: (token: string) => Promise<void>;
  updateSettings: (settings: {
    lyricsOffsetMs?: number;
    lyricsWordSync?: boolean;
    preferMusicVideos?: boolean;
  }) => Promise<void>;
}

interface UseRemoteActionsProps {
  room: any;
  effectiveUid: string;
  isHostOrAdmin: boolean;
  myNickname: string;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export function useRemoteActions({
  room,
  effectiveUid,
  isHostOrAdmin,
  myNickname,
  showToast,
}: UseRemoteActionsProps): RemoteActions {
  const { t } = useTranslation();

  const claimHostMutation = useMutation(api.rooms.claimHost);
  const togglePlayPauseMutation = useMutation(api.playback.togglePlayPause);
  const nextTrackMutation = useMutation(api.playback.nextTrack);
  const previousTrackMutation = useMutation(api.playback.previousTrack);
  const setVolumeMutation = useMutation(api.playback.setVolume);
  const seekMutation = useMutation(api.playback.seek);
  const addQueueMutation = useMutation(api.queue.add);
  const removeQueueMutation = useMutation(api.queue.remove);
  const reorderQueueMutation = useMutation(api.queue.reorder);
  const clearQueueMutation = useMutation(api.queue.clear);
  const purgeMemberTracksMutation = useMutation(api.queue.purgeMemberTracks);
  const toggleLockMutation = useMutation(api.rooms.toggleLock);
  const toggleAutoplayMutation = useMutation(api.rooms.toggleAutoplay);
  const toggleCountdownMutation = useMutation(api.rooms.toggleCountdown);
  const toggleFullscreenMutation = useMutation(api.rooms.toggleFullscreen);
  const toggleFullscreenQrMutation = useMutation(api.rooms.toggleFullscreenQr);
  const updateSettingsMutation = useMutation(api.rooms.updateSettings);
  const beamTokenToTvMutation = useMutation(api.rooms.beamTokenToTv);
  const fetchAndPlayNextRadioAction = useAction(api.youtube.fetchAndPlayNextRadio);

  return useMemo<RemoteActions>(() => {
    const checkLocked = () => {
      if (room?.isLocked && !isHostOrAdmin) {
        showToast(t('toasts.controlsLockedByAdmin'), 'error');
        return false;
      }
      return true;
    };

    return {
      togglePlayPause: async () => {
        if (!room?._id || !checkLocked()) return;
        await togglePlayPauseMutation({ roomId: room._id });
      },

      nextTrack: async () => {
        if (!room?._id || !checkLocked()) return;
        await nextTrackMutation({ roomId: room._id });
      },

      previousTrack: async () => {
        if (!room?._id || !checkLocked()) return;
        await previousTrackMutation({ roomId: room._id });
      },

      setVolume: async (volume: number) => {
        if (!room?._id || !checkLocked()) return;
        await setVolumeMutation({ roomId: room._id, volume });
      },

      seek: async (positionMs: number) => {
        if (!room?._id || !checkLocked()) return;
        await seekMutation({ roomId: room._id, positionMs });
      },

      addToQueue: async (url: string, title?: string) => {
        if (!room?._id || !checkLocked()) return;
        let finalTitle = title;
        if (!finalTitle) {
          const ytId = parseYouTubeVideoId(url);
          if (ytId) {
            const info = await fetchVideoTitle(`https://www.youtube.com/watch?v=${ytId}`);
            finalTitle = info.title || 'Untitled Track';
          }
        }
        await addQueueMutation({
          roomId: room._id,
          url,
          title: finalTitle || 'Untitled Track',
          addedBy: effectiveUid,
          addedByName: myNickname || 'Guest',
        });
      },

      removeFromQueue: async (queueId: string) => {
        if (!room?._id) return;
        await removeQueueMutation({
          queueId: queueId as Id<'queue'>,
          callerUid: effectiveUid,
        });
      },

      reorderQueue: async (orderedIds: string[]) => {
        if (!room?._id || !checkLocked()) return;
        await reorderQueueMutation({
          roomId: room._id,
          orderedIds: orderedIds as Id<'queue'>[],
          callerUid: effectiveUid,
        });
      },

      clearQueue: async () => {
        if (!room?._id || !isHostOrAdmin) return;
        await clearQueueMutation({
          roomId: room._id,
          callerUid: effectiveUid,
        });
      },

      purgeMemberTracks: async (targetUid: string) => {
        if (!room?._id || !isHostOrAdmin) return;
        await purgeMemberTracksMutation({
          roomId: room._id,
          callerUid: effectiveUid,
          targetUid,
        });
      },

      toggleLock: async () => {
        if (!room?._id || !isHostOrAdmin) return;
        await toggleLockMutation({
          roomId: room._id,
          callerUid: effectiveUid,
        });
      },

      toggleAutoplay: async () => {
        if (!room?._id || !checkLocked()) return;
        await toggleAutoplayMutation({
          roomId: room._id,
          callerUid: effectiveUid,
        });
      },

      toggleCountdown: async () => {
        if (!room?._id || !isHostOrAdmin) return;
        await toggleCountdownMutation({
          roomId: room._id,
          callerUid: effectiveUid,
        });
      },

      toggleFullscreen: async () => {
        if (!room?._id) return;
        await toggleFullscreenMutation({ roomId: room._id });
      },

      toggleFullscreenQr: async () => {
        if (!room?._id || !isHostOrAdmin) return;
        await toggleFullscreenQrMutation({
          roomId: room._id,
          callerUid: effectiveUid,
        });
      },

      claimHost: async () => {
        if (!room?._id) return;
        await claimHostMutation({
          roomId: room._id,
          callerUid: effectiveUid,
        });
      },

      startRadio: async () => {
        if (!room?._id || !checkLocked()) return;
        const apiToken = loadApiToken();
        await fetchAndPlayNextRadioAction({
          roomId: room._id,
          apiToken: apiToken || undefined,
        });
      },

      beamTokenToTv: async (token: string) => {
        if (!room?._id || !isHostOrAdmin) return;
        await beamTokenToTvMutation({
          roomId: room._id,
          callerUid: effectiveUid,
          token,
        });
      },

      updateSettings: async (settings) => {
        if (!room?._id || !isHostOrAdmin) return;
        await updateSettingsMutation({
          roomId: room._id,
          callerUid: effectiveUid,
          settings,
        });
      },
    };
  }, [
    room,
    isHostOrAdmin,
    effectiveUid,
    myNickname,
    t,
    showToast,
    togglePlayPauseMutation,
    nextTrackMutation,
    previousTrackMutation,
    setVolumeMutation,
    seekMutation,
    addQueueMutation,
    removeQueueMutation,
    reorderQueueMutation,
    clearQueueMutation,
    purgeMemberTracksMutation,
    toggleLockMutation,
    toggleAutoplayMutation,
    toggleCountdownMutation,
    toggleFullscreenMutation,
    toggleFullscreenQrMutation,
    claimHostMutation,
    fetchAndPlayNextRadioAction,
    beamTokenToTvMutation,
    updateSettingsMutation,
  ]);
}
