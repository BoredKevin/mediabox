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
  addToQueue: (
    url: string,
    title?: string,
    metadata?: { channelTitle?: string; durationSeconds?: number; thumbnailUrl?: string }
  ) => Promise<void>;
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
  toggleHostPin: () => Promise<void>;
  adminTransferHost: (newHostUid: string) => Promise<void>;
  toggleLockPlaybackControls: () => Promise<void>;
  requestPlaybackApproval: () => Promise<void>;
  toggleApproveMember: (targetUid: string) => Promise<void>;
  approveAllMembers: (memberUids: string[]) => Promise<void>;
  revokeAllApprovedMembers: () => Promise<void>;
  startRadio: () => Promise<void>;
  addRadioTrackToQueue: (trackId: string) => Promise<void>;
  deleteRadioTrack: (trackId: string) => Promise<void>;
  beamTokenToTv: (token: string) => Promise<void>;
  updateSettings: (settings: {
    lyricsOffsetMs?: number;
    lyricsWordSync?: boolean;
    preferMusicVideos?: boolean;
    lockPlaybackControls?: boolean;
  }) => Promise<void>;
}

interface UseRemoteActionsProps {
  room: any;
  effectiveUid: string;
  isHostOrAdmin: boolean;
  canControlPlayback?: boolean;
  myNickname: string;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export function useRemoteActions({
  room,
  effectiveUid,
  isHostOrAdmin,
  canControlPlayback = true,
  myNickname,
  showToast,
}: UseRemoteActionsProps): RemoteActions {
  const { t } = useTranslation();

  const claimHostMutation = useMutation(api.rooms.claimHost);
  const toggleHostPinMutation = useMutation(api.rooms.toggleHostPin);
  const adminTransferHostMutation = useMutation(api.rooms.adminTransferHost);
  const toggleLockPlaybackControlsMutation = useMutation(api.rooms.toggleLockPlaybackControls);
  const requestPlaybackApprovalMutation = useMutation(api.rooms.requestPlaybackApproval);
  const toggleApproveMemberMutation = useMutation(api.rooms.toggleApproveMember);
  const approveAllMembersMutation = useMutation(api.rooms.approveAllMembers);
  const revokeAllApprovedMembersMutation = useMutation(api.rooms.revokeAllApprovedMembers);
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
  const addRadioTrackToQueueMutation = useMutation(api.playback.addRadioTrackToQueue);
  const deleteRadioTrackMutation = useMutation(api.playback.deleteRadioTrack);

  return useMemo<RemoteActions>(() => {
    const checkLocked = () => {
      if (room?.isLocked && !isHostOrAdmin) {
        showToast(t('toasts.controlsLockedByAdmin'), 'error');
        return false;
      }
      return true;
    };

    const checkPlaybackLocked = () => {
      if (!canControlPlayback) {
        showToast(t('remote.playbackLockedToast') || 'Playback controls are locked to approved members', 'error');
        return false;
      }
      return true;
    };

    return {
      togglePlayPause: async () => {
        if (!room?._id || !checkPlaybackLocked()) return;
        await togglePlayPauseMutation({ roomId: room._id, callerUid: effectiveUid });
      },

      nextTrack: async () => {
        if (!room?._id || !checkPlaybackLocked()) return;
        await nextTrackMutation({ roomId: room._id, callerUid: effectiveUid });
      },

      previousTrack: async () => {
        if (!room?._id || !checkPlaybackLocked()) return;
        await previousTrackMutation({ roomId: room._id, callerUid: effectiveUid });
      },

      setVolume: async (volume: number) => {
        if (!room?._id || !checkPlaybackLocked()) return;
        await setVolumeMutation({ roomId: room._id, volume, callerUid: effectiveUid });
      },

      seek: async (positionMs: number) => {
        if (!room?._id || !checkPlaybackLocked()) return;
        await seekMutation({ roomId: room._id, positionMs, callerUid: effectiveUid });
      },

      addToQueue: async (
        url: string,
        title?: string,
        metadata?: { channelTitle?: string; durationSeconds?: number; thumbnailUrl?: string }
      ) => {
        if (!room?._id || !checkLocked()) return;
        let finalTitle = title;
        let finalChannel = metadata?.channelTitle;
        let finalThumb = metadata?.thumbnailUrl;
        if (!finalTitle || !finalChannel || !finalThumb) {
          const ytId = parseYouTubeVideoId(url);
          if (ytId) {
            const info = await fetchVideoTitle(`https://www.youtube.com/watch?v=${ytId}`);
            if (!finalTitle) finalTitle = info.title || 'Untitled Track';
            if (!finalChannel) finalChannel = info.channelTitle;
            if (!finalThumb) finalThumb = info.thumbnailUrl;
          }
        }
        await addQueueMutation({
          roomId: room._id,
          url,
          title: finalTitle || 'Untitled Track',
          addedBy: effectiveUid,
          addedByName: myNickname || 'Guest',
          channelTitle: finalChannel,
          durationSeconds: metadata?.durationSeconds,
          thumbnailUrl: finalThumb,
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
        if (!room?._id || !checkPlaybackLocked()) return;
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

      toggleHostPin: async () => {
        if (!room?._id) return;
        try {
          await toggleHostPinMutation({
            roomId: room._id,
            callerUid: effectiveUid,
          });
        } catch (err: any) {
          showToast(err.message || 'Failed to toggle host pin', 'error');
        }
      },

      adminTransferHost: async (newHostUid: string) => {
        if (!room?._id) return;
        try {
          await adminTransferHostMutation({
            roomId: room._id,
            callerUid: effectiveUid,
            newHostUid,
          });
          showToast(t('remote.hostTransferredToast') || 'Host transferred successfully', 'success');
        } catch (err: any) {
          showToast(err.message || 'Failed to transfer host', 'error');
        }
      },

      toggleLockPlaybackControls: async () => {
        if (!room?._id || !isHostOrAdmin) return;
        try {
          await toggleLockPlaybackControlsMutation({
            roomId: room._id,
            callerUid: effectiveUid,
          });
        } catch (err: any) {
          showToast(err.message || 'Failed to toggle playback lock', 'error');
        }
      },

      requestPlaybackApproval: async () => {
        if (!room?._id) return;
        try {
          await requestPlaybackApprovalMutation({
            roomId: room._id,
            callerUid: effectiveUid,
          });
          showToast(t('remote.requestSentToast') || 'Approval request sent to host', 'info');
        } catch (err: any) {
          showToast(err.message || 'Failed to request playback control', 'error');
        }
      },

      toggleApproveMember: async (targetUid: string) => {
        if (!room?._id || !isHostOrAdmin) return;
        try {
          await toggleApproveMemberMutation({
            roomId: room._id,
            callerUid: effectiveUid,
            targetUid,
          });
        } catch (err: any) {
          showToast(err.message || 'Failed to update member approval', 'error');
        }
      },

      approveAllMembers: async (memberUids: string[]) => {
        if (!room?._id || !isHostOrAdmin) return;
        try {
          await approveAllMembersMutation({
            roomId: room._id,
            callerUid: effectiveUid,
            memberUids,
          });
          showToast(t('remote.allMembersApprovedToast') || 'All members approved', 'success');
        } catch (err: any) {
          showToast(err.message || 'Failed to approve all members', 'error');
        }
      },

      revokeAllApprovedMembers: async () => {
        if (!room?._id || !isHostOrAdmin) return;
        try {
          await revokeAllApprovedMembersMutation({
            roomId: room._id,
            callerUid: effectiveUid,
          });
          showToast(t('remote.allApprovalsRevokedToast') || 'All approvals revoked', 'info');
        } catch (err: any) {
          showToast(err.message || 'Failed to revoke approvals', 'error');
        }
      },

      startRadio: async () => {
        if (!room?._id || !checkLocked()) return;
        const apiToken = loadApiToken();
        await fetchAndPlayNextRadioAction({
          roomId: room._id,
          apiToken: apiToken || undefined,
        });
      },

      addRadioTrackToQueue: async (trackId: string) => {
        if (!room?._id || !checkLocked()) return;
        await addRadioTrackToQueueMutation({
          roomId: room._id,
          trackId,
          callerUid: effectiveUid,
          callerName: myNickname || 'Guest',
        });
      },

      deleteRadioTrack: async (trackId: string) => {
        if (!room?._id || !checkLocked()) return;
        await deleteRadioTrackMutation({
          roomId: room._id,
          trackId,
          callerUid: effectiveUid,
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
    canControlPlayback,
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
    toggleHostPinMutation,
    adminTransferHostMutation,
    toggleLockPlaybackControlsMutation,
    requestPlaybackApprovalMutation,
    toggleApproveMemberMutation,
    approveAllMembersMutation,
    revokeAllApprovedMembersMutation,
    fetchAndPlayNextRadioAction,
    addRadioTrackToQueueMutation,
    deleteRadioTrackMutation,
    beamTokenToTvMutation,
    updateSettingsMutation,
  ]);
}
