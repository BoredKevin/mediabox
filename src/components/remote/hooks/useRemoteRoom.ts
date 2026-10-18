import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { User as FirebaseUser } from 'firebase/auth';
import { useQuery, useMutation, useAction } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import { Id } from '../../../../convex/_generated/dataModel';
import { useSafePresence } from '@/hooks/useSafePresence';
import { RoomState, QueueItem, SearchResultItem } from '@/lib/roomUtils';
import { getStoredNickname, saveStoredNickname, getOrCreateDeviceCredentials } from '@/lib/deviceAuth';
import { useTranslation } from '@/context/LanguageContext';
import { MemberInfo } from '../panels/MembersPanel';
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
  claimHost: () => Promise<void>;
  startRadio: () => Promise<void>;
  beamTokenToTv: (token: string) => Promise<void>;
  updateSettings: (settings: {
    lyricsOffsetMs?: number;
    lyricsWordSync?: boolean;
    preferMusicVideos?: boolean;
  }) => Promise<void>;
}

interface UseRemoteRoomProps {
  activeRoomCode: string;
  user: FirebaseUser | null;
  onLeaveRoom: () => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info', duration?: number) => void;
}

export function useRemoteRoom({
  activeRoomCode,
  user,
  onLeaveRoom,
  showToast,
}: UseRemoteRoomProps) {
  const { t } = useTranslation();
  const [myNickname, setMyNickname] = useState<string>(() => getStoredNickname());
  const hasConfirmedMembership = useRef(false);

  useEffect(() => {
    hasConfirmedMembership.current = false;
  }, [activeRoomCode, user?.uid]);

  // Convex Subscriptions
  const room = useQuery(
    api.rooms.getRoom,
    activeRoomCode ? { code: activeRoomCode } : 'skip'
  );
  const rawQueue = useQuery(
    api.queue.getQueue,
    room?._id ? { roomId: room._id } : 'skip'
  );
  const rawRadio = useQuery(
    api.playback.getRadioQueue,
    room?._id ? { roomId: room._id } : 'skip'
  );

  const effectiveUid = useMemo(() => {
    return user?.uid || getOrCreateDeviceCredentials().uuid;
  }, [user?.uid]);

  // Admin status check
  const adminsQuery = useQuery(api.admins.list);
  const isAdminQuery = useQuery(
    api.admins.isAdmin,
    effectiveUid ? { uid: effectiveUid } : 'skip'
  );

  const adminsList = useMemo(() => {
    return adminsQuery ? adminsQuery.map((a: any) => a.uid) : [];
  }, [adminsQuery]);
  const isAdmin = Boolean(isAdminQuery);

  const isHost = Boolean(room?.hostUid && room.hostUid === effectiveUid);
  const isHostOrAdmin = isHost || isAdmin;
  const tvUid = room?.tvUid || null;

  // Track room closure
  useEffect(() => {
    if (room) {
      hasConfirmedMembership.current = true;
    } else if (room === null && hasConfirmedMembership.current) {
      onLeaveRoom();
      showToast(t('toasts.roomClosedByHost'), 'error');
    }
  }, [room, onLeaveRoom, showToast, t]);

  // Presence via resilient safe presence hook
  const presenceList = useSafePresence(
    activeRoomCode,
    effectiveUid,
    10000
  );

  const isTvOnline = useMemo(() => {
    if (presenceList && room?.tvUid) {
      return presenceList.some((p) => p.userId === room.tvUid && p.online);
    }
    return Boolean(room?.tvOnline);
  }, [presenceList, room?.tvUid, room?.tvOnline]);

  const membersList: MemberInfo[] = useMemo(() => {
    const list: MemberInfo[] = [];

    // Always represent the TV display itself as a member
    if (room?.tvUid) {
      list.push({
        uid: room.tvUid,
        nickname: 'Mediabox TV',
        online: isTvOnline,
        joinedAt: 0,
        lastSeen: Date.now(),
        isTv: true,
      });
    }

    // Add online remote members (excluding the TV UID)
    if (presenceList) {
      for (const p of presenceList) {
        if (p.userId === room?.tvUid) continue;
        const isMe = p.userId === effectiveUid;
        const customNick = (p.data as any)?.nickname;
        const nickname = customNick || (isMe ? myNickname || 'You' : 'Guest');
        list.push({
          uid: p.userId,
          nickname,
          online: true,
          joinedAt: p.lastDisconnected || 0,
          lastSeen: Date.now(),
          isTv: false,
        });
      }
    }

    return list;
  }, [presenceList, room?.tvUid, isTvOnline, effectiveUid, myNickname]);

  const memberCount = useMemo(() => {
    return Math.max(1, membersList.filter((m) => m.online !== false).length);
  }, [membersList]);

  // Map Convex Room to RoomState
  const roomState: RoomState | null = useMemo(() => {
    if (!room) return null;
    return {
      currentlyPlaying: room.currentlyPlaying,
      currentlyPlayingTitle: room.currentlyPlayingTitle,
      playback: room.playback,
      hostUid: room.hostUid,
      isFullscreen: room.isFullscreen,
      isLocked: room.isLocked,
      isAutoplay: room.isAutoplay,
      isCountdownEnabled: room.isCountdownEnabled,
      lyricsOffsetMs: room.lyricsOffsetMs,
      lyricsWordSync: room.lyricsWordSync,
      tvOnline: room.tvOnline,
      roomId: room._id,
      searchSettings: {
        maxResults: 20,
        rateLimitCount: 15,
        rateLimitWindowMs: 60000,
        preferMusicVideos: room.preferMusicVideos,
      },
    };
  }, [room]);

  // Map Convex Queue to QueueItem[]
  const queue: QueueItem[] = useMemo(() => {
    if (!rawQueue) return [];
    return rawQueue.map((item: any) => ({
      id: item._id,
      url: item.url,
      title: item.title,
      addedBy: item.addedBy,
      addedByName: item.addedByName,
      addedAt: item.createdAt,
    }));
  }, [rawQueue]);

  // Map Convex Radio Queue to SearchResultItem[]
  const radioQueue: SearchResultItem[] = useMemo(() => {
    if (!rawRadio) return [];
    return rawRadio.map((item: any) => ({
      id: item.id,
      url: item.url,
      title: item.title,
      channelTitle: item.channelTitle,
      durationSeconds: item.durationSeconds,
      thumbnail: item.thumbnailUrl || '',
    }));
  }, [rawRadio]);

  // Convex Mutations & Actions
  const joinRoomMutation = useMutation(api.rooms.joinRoom);
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
  const updateSettingsMutation = useMutation(api.rooms.updateSettings);
  const beamTokenToTvMutation = useMutation(api.rooms.beamTokenToTv);
  const updateRoomUserMutation = useMutation(api.presence.updateRoomUser);
  const fetchAndPlayNextRadioAction = useAction(api.youtube.fetchAndPlayNextRadio);

  // Auto-join room and auto-claim host if room is held only by the TV display
  useEffect(() => {
    if (room?._id && effectiveUid) {
      joinRoomMutation({ roomId: room._id, callerUid: effectiveUid }).catch((e) => {
        console.warn('[useRemoteRoom] joinRoom error:', e);
      });
    }
  }, [room?._id, effectiveUid, joinRoomMutation]);

  // Strongly-typed direct Convex actions
  const actions: RemoteActions = useMemo(() => {
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
        if (!room?._id) return;
        await nextTrackMutation({ roomId: room._id });
      },
      previousTrack: async () => {
        if (!room?._id) return;
        await previousTrackMutation({ roomId: room._id, forcePrevious: true });
      },
      setVolume: async (volume: number) => {
        if (!room?._id || !checkLocked()) return;
        await setVolumeMutation({ roomId: room._id, volume });
      },
      seek: async (positionMs: number) => {
        if (!room?._id) return;
        await seekMutation({ roomId: room._id, positionMs });
      },
      addToQueue: async (url: string, title?: string) => {
        if (!room?._id || !checkLocked()) return;
        await addQueueMutation({
          roomId: room._id,
          url,
          title: title || '',
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
        if (!room?._id) return;
        await reorderQueueMutation({
          roomId: room._id,
          orderedIds: orderedIds as Id<'queue'>[],
          callerUid: effectiveUid,
        });
      },
      clearQueue: async () => {
        if (!room?._id) return;
        await clearQueueMutation({
          roomId: room._id,
          callerUid: effectiveUid,
        });
      },
      purgeMemberTracks: async (targetUid: string) => {
        if (!room?._id) return;
        await purgeMemberTracksMutation({
          roomId: room._id,
          targetUid,
          callerUid: effectiveUid,
        });
      },
      toggleLock: async () => {
        if (!room?._id) return;
        await toggleLockMutation({ roomId: room._id, callerUid: effectiveUid });
      },
      toggleAutoplay: async () => {
        if (!room?._id || !checkLocked()) return;
        await toggleAutoplayMutation({ roomId: room._id, callerUid: effectiveUid });
      },
      toggleCountdown: async () => {
        if (!room?._id) return;
        await toggleCountdownMutation({ roomId: room._id, callerUid: effectiveUid });
      },
      toggleFullscreen: async () => {
        if (!room?._id) return;
        await toggleFullscreenMutation({ roomId: room._id });
      },
      claimHost: async () => {
        if (!room?._id) return;
        await claimHostMutation({ roomId: room._id, callerUid: effectiveUid });
      },
      startRadio: async () => {
        if (!room?._id || !checkLocked()) return;
        const apiToken = loadApiToken();
        await fetchAndPlayNextRadioAction({
          roomId: room._id,
          apiToken: apiToken || undefined,
        });
      },
      updateSettings: async (settings) => {
        if (!room?._id) return;
        await updateSettingsMutation({
          roomId: room._id,
          callerUid: effectiveUid,
          settings,
        });
      },
      beamTokenToTv: async (token: string) => {
        if (!room?._id) return;
        await beamTokenToTvMutation({
          roomId: room._id,
          callerUid: effectiveUid,
          token,
        });
      },
    };
  }, [
    room?._id,
    room?.isLocked,
    isHostOrAdmin,
    effectiveUid,
    myNickname,
    showToast,
    t,
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
    claimHostMutation,
    fetchAndPlayNextRadioAction,
    updateSettingsMutation,
    beamTokenToTvMutation,
  ]);

  const handleSaveNickname = useCallback(
    async (name: string) => {
      const cleanName = name.trim().slice(0, 25);
      setMyNickname(cleanName);
      saveStoredNickname(cleanName);
      try {
        if (activeRoomCode) {
          await updateRoomUserMutation({
            roomId: activeRoomCode,
            userId: effectiveUid,
            data: { nickname: cleanName },
          });
        }
        showToast(
          cleanName
            ? t('toasts.nicknameSet', { name: cleanName })
            : t('toasts.nicknameReset'),
          'success'
        );
      } catch (err: any) {
        console.warn('Failed to update nickname in presence:', err);
      }
    },
    [activeRoomCode, effectiveUid, updateRoomUserMutation, showToast, t]
  );

  return {
    roomId: room?._id || null,
    effectiveUid,
    roomState,
    queue,
    radioQueue,
    memberCount,
    membersList,
    isTvOnline,
    tvUid,
    isAdmin,
    adminsList,
    isHost,
    isHostOrAdmin,
    myNickname,
    actions,
    handleSaveNickname,
  };
}
