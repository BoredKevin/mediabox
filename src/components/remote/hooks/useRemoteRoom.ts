import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import { useSafePresence } from '@/hooks/useSafePresence';
import { RoomState, QueueItem, SearchResultItem } from '@/lib/roomUtils';
import {
  DeviceUser,
  getStoredNickname,
  saveStoredNickname,
  getOrCreateDeviceCredentials,
} from '@/lib/deviceAuth';
import { useTranslation } from '@/context/LanguageContext';
import { MemberInfo } from '../panels/MembersPanel';
import { useRemoteActions, RemoteActions } from './useRemoteActions';

export type { RemoteActions };

interface UseRemoteRoomProps {
  activeRoomCode: string;
  user: DeviceUser | null;
  onLeaveRoom: () => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
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

  const effectiveUid = useMemo(() => {
    return user?.uid || getOrCreateDeviceCredentials().uuid;
  }, [user?.uid]);

  useEffect(() => {
    hasConfirmedMembership.current = false;
  }, [activeRoomCode, effectiveUid]);

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
  const tvUuid = room?.tvUuid || null;

  // Track room closure
  useEffect(() => {
    if (room) {
      hasConfirmedMembership.current = true;
    } else if (room === null && hasConfirmedMembership.current) {
      onLeaveRoom();
      showToast(t('toasts.roomClosedByHost'), 'error');
    }
  }, [room, onLeaveRoom, showToast, t]);

  // Presence via safe presence hook
  const presenceList = useSafePresence(activeRoomCode, effectiveUid, 10000);

  const isTvOnline = useMemo(() => {
    if (presenceList && tvUuid) {
      return presenceList.some((p) => p.userId === tvUuid && p.online);
    }
    return Boolean(room?.tvOnline);
  }, [presenceList, tvUuid, room?.tvOnline]);

  const membersList: MemberInfo[] = useMemo(() => {
    const list: MemberInfo[] = [];

    if (tvUuid) {
      list.push({
        uid: tvUuid,
        nickname: 'Mediabox TV',
        online: isTvOnline,
        joinedAt: 0,
        lastSeen: Date.now(),
        isTv: true,
      });
    }

    if (presenceList) {
      for (const p of presenceList) {
        if (p.userId === tvUuid) continue;
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
  }, [presenceList, tvUuid, isTvOnline, effectiveUid, myNickname]);

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

  const joinRoomMutation = useMutation(api.rooms.joinRoom);
  const updateRoomUserMutation = useMutation(api.presence.updateRoomUser);

  // Auto-join room
  useEffect(() => {
    if (room?._id && effectiveUid) {
      joinRoomMutation({ roomId: room._id, callerUid: effectiveUid }).catch((e) => {
        console.warn('[useRemoteRoom] joinRoom error:', e);
      });
    }
  }, [room?._id, effectiveUid, joinRoomMutation]);

  const actions = useRemoteActions({
    room,
    effectiveUid,
    isHostOrAdmin,
    myNickname,
    showToast,
  });

  const handleSaveNickname = useCallback(
    async (newName: string) => {
      const clean = newName.trim().slice(0, 25);
      saveStoredNickname(clean);
      setMyNickname(clean);
      if (activeRoomCode && effectiveUid) {
        await updateRoomUserMutation({
          roomId: activeRoomCode,
          userId: effectiveUid,
          data: { nickname: clean },
        });
      }
    },
    [activeRoomCode, effectiveUid, updateRoomUserMutation]
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
    tvUuid,
    isAdmin,
    adminsList,
    isHost,
    isHostOrAdmin,
    myNickname,
    actions,
    handleSaveNickname,
  };
}
