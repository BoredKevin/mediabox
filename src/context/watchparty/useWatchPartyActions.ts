import { useCallback, useRef } from 'react';
import { useMutation, useAction } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { Id } from '../../../convex/_generated/dataModel';
import {
  DeviceCredentials,
  getOrCreateDeviceCredentials,
  saveStoredTvRoomCode,
} from '@/lib/deviceAuth';
import {
  parseYouTubeVideoId,
  SearchSettings,
} from '@/lib/roomUtils';
import { fetchVideoTitle } from '@/lib/youtube';
import { saveSearchConfig, getEffectiveSearchSettings } from '@/lib/apiKeyStore';
import {
  getSavedLyricsOffset,
  getSavedLyricsWordSync,
  saveLyricsOffset,
  saveLyricsWordSync,
} from '@/lib/lyricsOffsetStore';
import { loadApiToken } from '@/lib/apiTokenStore';

interface UseWatchPartyActionsProps {
  room: any;
  creds: DeviceCredentials;
  playerInstanceRef: React.RefObject<any>;
  createdRoomCodeRef: React.MutableRefObject<string | null>;
  setCreating: (creating: boolean) => void;
  setRoomCode: (code: string | null) => void;
  setShowQrModal: (show: boolean) => void;
  setSearchSettings: (settings: SearchSettings) => void;
  remoteUrl: string;
  setCopiedLink: (copied: boolean) => void;
}

export function useWatchPartyActions({
  room,
  creds,
  playerInstanceRef,
  createdRoomCodeRef,
  setCreating,
  setRoomCode,
  setShowQrModal,
  setSearchSettings,
  remoteUrl,
  setCopiedLink,
}: UseWatchPartyActionsProps) {
  const isTransitioningRef = useRef<boolean>(false);

  // Convex Mutations & Actions
  const createRoomMutation = useMutation(api.rooms.create);
  const endRoomMutation = useMutation(api.rooms.endRoom);
  const togglePlayPauseMutation = useMutation(api.playback.togglePlayPause);
  const nextTrackMutation = useMutation(api.playback.nextTrack);
  const previousTrackMutation = useMutation(api.playback.previousTrack);
  const syncPositionCheckpointMutation = useMutation(api.playback.syncPositionCheckpoint);
  const setVolumeMutation = useMutation(api.playback.setVolume);
  const addQueueMutation = useMutation(api.queue.add);
  const removeQueueMutation = useMutation(api.queue.remove);
  const playQueueItemMutation = useMutation(api.playback.playQueueItem);
  const toggleFullscreenMutation = useMutation(api.rooms.toggleFullscreen);
  const toggleLockMutation = useMutation(api.rooms.toggleLock);
  const toggleAutoplayMutation = useMutation(api.rooms.toggleAutoplay);
  const toggleCountdownMutation = useMutation(api.rooms.toggleCountdown);
  const updateSettingsMutation = useMutation(api.rooms.updateSettings);
  const fetchAndPlayNextRadioAction = useAction(api.youtube.fetchAndPlayNextRadio);

  const handleCreateRoom = useCallback(async () => {
    setCreating(true);
    try {
      const deviceCreds = getOrCreateDeviceCredentials();
      const hostId = deviceCreds.uuid;

      const effectiveSettings = getEffectiveSearchSettings();
      setSearchSettings(effectiveSettings);

      const result = await createRoomMutation({
        hostUid: hostId,
        tvUid: hostId,
        tvUuid: deviceCreds.uuid,
        preferMusicVideos: effectiveSettings.preferMusicVideos,
        lyricsOffsetMs: getSavedLyricsOffset(),
        lyricsWordSync: getSavedLyricsWordSync(),
      });

      createdRoomCodeRef.current = result.code;
      setRoomCode(result.code);
      saveStoredTvRoomCode(result.code);
    } catch (err: any) {
      console.error('[WatchParty] Error creating room in Convex:', err);
      alert('Failed to create Watch Together room: ' + err.message);
    } finally {
      setCreating(false);
    }
  }, [createRoomMutation, createdRoomCodeRef, setCreating, setRoomCode, setSearchSettings]);

  const handleEndRoom = useCallback(async () => {
    if (!room?._id) return;
    if (confirm('Are you sure you want to end this Watch Together session?')) {
      const callerId = creds.uuid;
      await endRoomMutation({ roomId: room._id, callerUid: callerId });
      saveStoredTvRoomCode(null);
      setRoomCode(null);
      setShowQrModal(false);
    }
  }, [room?._id, creds.uuid, endRoomMutation, setRoomCode, setShowQrModal]);

  const handleTogglePlayPause = useCallback(async () => {
    if (!room?._id) return;
    let posMs: number | undefined;
    if (playerInstanceRef.current && typeof playerInstanceRef.current.getCurrentTime === 'function') {
      try {
        posMs = Math.max(0, Math.round(playerInstanceRef.current.getCurrentTime() * 1000));
      } catch (_) {}
    }
    await togglePlayPauseMutation({
      roomId: room._id,
      positionMs: posMs,
    });
  }, [room?._id, playerInstanceRef, togglePlayPauseMutation]);

  const handlePlayNextInQueue = useCallback(async () => {
    if (!room?._id || isTransitioningRef.current) return;
    isTransitioningRef.current = true;
    try {
      await nextTrackMutation({ roomId: room._id });
    } catch (err) {
      console.error('[WatchParty] Error transitioning to next track:', err);
    } finally {
      setTimeout(() => {
        isTransitioningRef.current = false;
      }, 500);
    }
  }, [room?._id, nextTrackMutation]);

  const handlePlayPreviousTrack = useCallback(async (): Promise<boolean> => {
    if (!room?._id || isTransitioningRef.current) return false;
    isTransitioningRef.current = true;
    try {
      await previousTrackMutation({ roomId: room._id });
      return true;
    } catch (err) {
      console.error('[WatchParty] Error transitioning to previous track:', err);
      return false;
    } finally {
      setTimeout(() => {
        isTransitioningRef.current = false;
      }, 500);
    }
  }, [room?._id, previousTrackMutation]);

  const handleRemoveQueueItem = useCallback(
    async (itemId: string) => {
      if (!room?._id) return;
      const callerId = room?.tvUid || creds.uuid;
      await removeQueueMutation({
        queueId: itemId as Id<'queue'>,
        callerUid: callerId,
      });
    },
    [room?._id, room?.tvUid, creds.uuid, removeQueueMutation]
  );

  const handlePlayQueueItem = useCallback(
    async (queueId: string) => {
      if (!room?._id || isTransitioningRef.current) return;
      isTransitioningRef.current = true;
      try {
        await playQueueItemMutation({
          roomId: room._id,
          queueId: queueId as Id<'queue'>,
        });
      } catch (err) {
        console.error('[WatchParty] Error playing queue item:', err);
      } finally {
        setTimeout(() => {
          isTransitioningRef.current = false;
        }, 500);
      }
    },
    [room?._id, playQueueItemMutation]
  );

  const handleAddUrlHost = useCallback(
    async (urlInput: string, explicitTitle?: string): Promise<boolean> => {
      if (!urlInput.trim() || !room?._id) return false;

      const ytId = parseYouTubeVideoId(urlInput.trim());
      if (!ytId) {
        alert('Please enter a valid YouTube video link.');
        return false;
      }

      const videoUrl = `https://www.youtube.com/watch?v=${ytId}`;
      let videoTitle = explicitTitle?.trim() || '';
      if (!videoTitle) {
        const info = await fetchVideoTitle(videoUrl);
        videoTitle = info.title || '';
      }

      const callerId = room?.tvUid || creds.uuid;
      await addQueueMutation({
        roomId: room._id,
        url: videoUrl,
        title: videoTitle,
        addedBy: callerId,
        addedByName: 'TV Host',
      });
      return true;
    },
    [room?._id, room?.tvUid, creds.uuid, addQueueMutation]
  );

  const handleToggleFullscreen = useCallback(async () => {
    if (!room?._id) return;
    await toggleFullscreenMutation({ roomId: room._id });
  }, [room?._id, toggleFullscreenMutation]);

  const handleToggleRoomLock = useCallback(async () => {
    if (!room?._id) return;
    const callerId = room?.tvUid || creds.uuid;
    await toggleLockMutation({ roomId: room._id, callerUid: callerId });
  }, [room?._id, room?.tvUid, creds.uuid, toggleLockMutation]);

  const handleToggleAutoplay = useCallback(async () => {
    if (!room?._id) return;
    const callerId = room?.tvUid || creds.uuid;
    await toggleAutoplayMutation({ roomId: room._id, callerUid: callerId });
  }, [room?._id, room?.tvUid, creds.uuid, toggleAutoplayMutation]);

  const handleToggleCountdown = useCallback(async () => {
    if (!room?._id) return;
    const callerId = room?.tvUid || creds.uuid;
    await toggleCountdownMutation({ roomId: room._id, callerUid: callerId });
  }, [room?._id, room?.tvUid, creds.uuid, toggleCountdownMutation]);

  const handleSetLyricsOffset = useCallback(
    async (offsetMs: number) => {
      const clamped = Math.min(5000, Math.max(-5000, Math.round(offsetMs)));
      saveLyricsOffset(clamped);
      if (!room?._id) return;
      const callerId = room?.tvUid || creds.uuid;
      await updateSettingsMutation({
        roomId: room._id,
        callerUid: callerId,
        settings: { lyricsOffsetMs: clamped },
      });
    },
    [room?._id, room?.tvUid, creds.uuid, updateSettingsMutation]
  );

  const handleSetLyricsWordSync = useCallback(
    async (enabled: boolean) => {
      saveLyricsWordSync(enabled);
      if (!room?._id) return;
      const callerId = room?.tvUid || creds.uuid;
      await updateSettingsMutation({
        roomId: room._id,
        callerUid: callerId,
        settings: { lyricsWordSync: enabled },
      });
    },
    [room?._id, room?.tvUid, creds.uuid, updateSettingsMutation]
  );

  const handleAdjustVolume = useCallback(
    async (volume: number) => {
      if (!room?._id) return;
      await setVolumeMutation({ roomId: room._id, volume });
    },
    [room?._id, setVolumeMutation]
  );

  const handleSyncPlaybackCheckpoint = useCallback(
    async (positionMs: number, durationMs?: number) => {
      if (!room?._id) return;
      try {
        await syncPositionCheckpointMutation({
          roomId: room._id,
          positionMs,
          durationMs,
        });
      } catch (e) {
        // Ignore background transient network errors
      }
    },
    [room?._id, syncPositionCheckpointMutation]
  );

  const handleStartRadioFromCurrent = useCallback(async () => {
    if (!room?._id) return;
    try {
      const apiToken = loadApiToken();
      await fetchAndPlayNextRadioAction({
        roomId: room._id,
        apiToken: apiToken || undefined,
      });
    } catch (err) {
      console.error('[WatchParty] Failed to start radio:', err);
    }
  }, [room?._id, fetchAndPlayNextRadioAction]);

  const handleUpdateSearchSettings = useCallback(
    async (patch: Partial<SearchSettings>) => {
      saveSearchConfig(patch);
      const effective = getEffectiveSearchSettings();
      setSearchSettings(effective);
      if (room?._id) {
        const callerId = room?.tvUid || creds.uuid;
        await updateSettingsMutation({
          roomId: room._id,
          callerUid: callerId,
          settings: {
            preferMusicVideos: effective.preferMusicVideos,
          },
        });
      }
    },
    [room?._id, room?.tvUid, creds.uuid, updateSettingsMutation, setSearchSettings]
  );

  const copyRemoteLink = useCallback(() => {
    navigator.clipboard.writeText(remoteUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  }, [remoteUrl, setCopiedLink]);

  return {
    handleCreateRoom,
    handleEndRoom,
    handleTogglePlayPause,
    handlePlayNextInQueue,
    handlePlayPreviousTrack,
    handlePlayQueueItem,
    handleRemoveQueueItem,
    handleAddUrlHost,
    handleToggleFullscreen,
    handleToggleRoomLock,
    handleToggleAutoplay,
    handleToggleCountdown,
    handleSetLyricsOffset,
    handleSetLyricsWordSync,
    handleAdjustVolume,
    handleSyncPlaybackCheckpoint,
    handleStartRadioFromCurrent,
    handleUpdateSearchSettings,
    copyRemoteLink,
    isTransitioningRef,
    nextTrackMutation,
  };
}
