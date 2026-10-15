import { useState, useEffect, useRef, useCallback } from 'react';
import { ref, onValue, set, update, off, onDisconnect, serverTimestamp } from 'firebase/database';
import { User as FirebaseUser } from 'firebase/auth';
import { database } from '@/lib/firebase';
import { RoomState, QueueItem, SearchResultItem } from '@/lib/roomUtils';
import { useTranslation } from '@/context/LanguageContext';
import { MemberInfo } from '../panels/MembersPanel';

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
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [radioQueue, setRadioQueue] = useState<SearchResultItem[]>([]);
  const [memberCount, setMemberCount] = useState<number>(1);
  const [membersList, setMembersList] = useState<MemberInfo[]>([]);
  const [isTvOnline, setIsTvOnline] = useState<boolean>(true);
  const [tvUid, setTvUid] = useState<string | null>(null);

  // Admin & Host state
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [adminsList, setAdminsList] = useState<string[]>([]);
  const isHost = Boolean(user && roomState?.hostUid === user.uid);
  const isHostOrAdmin = isHost || isAdmin;

  // Nickname state
  const [myNickname, setMyNickname] = useState<string>('');
  const hasConfirmedMembership = useRef(false);

  useEffect(() => {
    hasConfirmedMembership.current = false;
  }, [activeRoomCode, user?.uid]);

  // Subscribe to RTDB admins node
  useEffect(() => {
    if (!user) return;
    const adminsRefNode = ref(database, 'admins');
    const unsubAdmins = onValue(adminsRefNode, (snapshot) => {
      if (snapshot.exists()) {
        const val = snapshot.val();
        const uids = Object.keys(val);
        setAdminsList(uids);
        setIsAdmin(uids.includes(user.uid));
      } else {
        setAdminsList([]);
        setIsAdmin(false);
      }
    });
    return () => off(adminsRefNode);
  }, [user]);

  // Member presence tracking via .info/connected
  useEffect(() => {
    if (!activeRoomCode || !user) return;

    const connectedRef = ref(database, '.info/connected');
    const memberOnlineRef = ref(database, `rooms/${activeRoomCode}/members/${user.uid}/online`);
    const memberLastSeenRef = ref(database, `rooms/${activeRoomCode}/members/${user.uid}/lastSeen`);

    const unsubConnected = onValue(connectedRef, (snap) => {
      if (snap.val() === true) {
        onDisconnect(memberOnlineRef).set(false);
        onDisconnect(memberLastSeenRef).set(serverTimestamp());

        update(ref(database, `rooms/${activeRoomCode}/members/${user.uid}`), {
          online: true,
          lastSeen: Date.now(),
        }).catch(() => {});
      }
    });

    return () => {
      off(connectedRef);
      onDisconnect(memberOnlineRef).cancel();
      onDisconnect(memberLastSeenRef).cancel();
    };
  }, [activeRoomCode, user]);

  // Subscribe to room updates (state, queue, members, tv)
  useEffect(() => {
    if (!activeRoomCode || !user) return;

    const stateRefNode = ref(database, `rooms/${activeRoomCode}/state`);
    const queueRefNode = ref(database, `rooms/${activeRoomCode}/queue`);
    const membersRefNode = ref(database, `rooms/${activeRoomCode}/members`);
    const tvRefNode = ref(database, `rooms/${activeRoomCode}/tv`);
    const radioQueueRefNode = ref(database, `rooms/${activeRoomCode}/radioQueue`);

    onValue(tvRefNode, (snapshot) => {
      if (snapshot.exists()) {
        const tvVal = snapshot.val();
        setIsTvOnline(tvVal?.online !== false);
        setTvUid(tvVal?.uid || null);
      } else {
        setIsTvOnline(false);
        setTvUid(null);
      }
    });

    onValue(radioQueueRefNode, (snapshot) => {
      if (snapshot.exists()) {
        const val = snapshot.val();
        if (Array.isArray(val)) {
          setRadioQueue(val);
        } else if (typeof val === 'object' && val !== null) {
          setRadioQueue(Object.values(val));
        } else {
          setRadioQueue([]);
        }
      } else {
        setRadioQueue([]);
      }
    });

    onValue(stateRefNode, (snapshot) => {
      if (snapshot.exists()) {
        setRoomState(snapshot.val());
      } else {
        if (hasConfirmedMembership.current) {
          onLeaveRoom();
          showToast(t('toasts.roomClosedByHost'), 'error');
        }
      }
    });

    onValue(queueRefNode, (snapshot) => {
      if (snapshot.exists()) {
        const val = snapshot.val();
        const items = Object.entries(val).map(([id, item]: [string, any]) => ({
          id,
          ...item,
        }));
        setQueue(items.sort((a, b) => (a.addedAt || 0) - (b.addedAt || 0)));
      } else {
        setQueue([]);
      }
    });

    onValue(membersRefNode, (snapshot) => {
      if (snapshot.exists()) {
        const membersData = snapshot.val();

        if (user && membersData[user.uid]) {
          hasConfirmedMembership.current = true;
        } else if (user && !membersData[user.uid]) {
          if (hasConfirmedMembership.current) {
            onLeaveRoom();
            showToast(t('toasts.kickedByHost'), 'error', 6000);
            return;
          } else {
            update(ref(database, `rooms/${activeRoomCode}/members/${user.uid}`), {
              uid: user.uid,
              joinedAt: Date.now(),
              online: true,
              lastSeen: Date.now(),
              ...(user.displayName ? { nickname: user.displayName.slice(0, 25) } : {}),
            }).catch(() => {});
          }
        }

        const list: MemberInfo[] = Object.entries(membersData).map(([uid, m]: [string, any]) => ({
          uid,
          joinedAt: m?.joinedAt || 0,
          nickname: m?.nickname || '',
          online: m?.online !== false,
          lastSeen: m?.lastSeen || 0,
        }));
        list.sort((a, b) => a.joinedAt - b.joinedAt);

        setMembersList(list);
        setMemberCount(list.filter((m) => m.online).length);

        const myRecord = list.find((m) => m.uid === user.uid);
        if (myRecord) {
          if (myRecord.nickname) {
            setMyNickname(myRecord.nickname);
          } else if (!myRecord.nickname && user.displayName) {
            const autoNick = user.displayName.slice(0, 25);
            update(ref(database, `rooms/${activeRoomCode}/members/${user.uid}`), {
              nickname: autoNick,
            }).catch(() => {});
            setMyNickname(autoNick);
          }
        }
      } else {
        if (hasConfirmedMembership.current) {
          onLeaveRoom();
          showToast(t('toasts.roomCleared'), 'error');
        }
      }
    });

    return () => {
      off(stateRefNode);
      off(queueRefNode);
      off(membersRefNode);
      off(tvRefNode);
      off(radioQueueRefNode);
    };
  }, [activeRoomCode, user, onLeaveRoom, showToast, t]);

  const sendCommand = useCallback(
    async (type: any, payload?: any) => {
      if (!activeRoomCode || !user) return;

      if (roomState?.isLocked && !isHostOrAdmin) {
        if (
          type === 'addToQueue' ||
          type === 'play' ||
          type === 'pause' ||
          type === 'adjustVolume' ||
          type === 'toggleAutoplay'
        ) {
          showToast(t('toasts.controlsLockedByAdmin'), 'error');
          return;
        }
      }

      try {
        const commandRefNode = ref(
          database,
          `rooms/${activeRoomCode}/members/${user.uid}/command`
        );
        await set(commandRefNode, {
          type,
          createdAt: Date.now(),
          payload: payload || {},
        });

        const labelMap: Record<string, string> = {
          play: t('toasts.playSent'),
          pause: t('toasts.pauseSent'),
          addToQueue: t('toasts.videoAddedQueue'),
          removeFromQueue: t('toasts.removeQueueSent'),
          adjustVolume: t('toasts.volumeSet', { vol: payload?.volume }),
          forceSkip: t('toasts.skipSent'),
          forcePrevious: t('toasts.previousSent'),
          reorderQueue: t('toasts.reorderSent'),
          forceRemoveFromQueue: t('toasts.removeQueueSent'),
          kickMember: t('toasts.kickSent'),
          toggleFullscreen: t('toasts.toggleFullscreenSent'),
          clearQueue: t('toasts.clearQueueSent'),
          setYtProxy: t('tvSettings.ytProxySavedNotice'),
          toggleRoomLock: roomState?.isLocked
            ? t('toasts.roomUnlocked')
            : t('toasts.roomLocked'),
          toggleAutoplay: roomState?.isAutoplay
            ? t('toasts.autoplayDisabled')
            : t('toasts.autoplayEnabled'),
          toggleCountdown: roomState?.isCountdownEnabled
            ? t('toasts.countdownDisabled')
            : t('toasts.countdownEnabled'),
        };
        if (type !== 'addToQueue') {
          showToast(labelMap[type] || t('toasts.commandSent', { type }), 'success');
        }
      } catch (err: any) {
        console.error('Failed to send command:', err);
        showToast(t('toasts.commandFailed'), 'error');
      }
    },
    [activeRoomCode, user, roomState?.isLocked, roomState?.isAutoplay, roomState?.isCountdownEnabled, isHostOrAdmin, showToast, t]
  );

  const handleSaveNickname = useCallback(
    async (name: string) => {
      if (!activeRoomCode || !user) return;
      const cleanName = name.trim().slice(0, 25);

      try {
        await update(ref(database, `rooms/${activeRoomCode}/members/${user.uid}`), {
          nickname: cleanName || null,
        });
        setMyNickname(cleanName);
        showToast(
          cleanName
            ? t('toasts.nicknameSet', { name: cleanName })
            : t('toasts.nicknameReset'),
          'success'
        );
      } catch (err: any) {
        console.error('Failed to update nickname:', err);
        showToast(t('toasts.nicknameFailed'), 'error');
      }
    },
    [activeRoomCode, user, showToast, t]
  );

  return {
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
    sendCommand,
    handleSaveNickname,
  };
}
