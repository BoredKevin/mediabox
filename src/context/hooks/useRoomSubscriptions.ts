import { useState, useEffect, useRef } from 'react';
import { ref, onValue, update, remove, off, get, onDisconnect, serverTimestamp } from 'firebase/database';
import { database } from '@/lib/firebase';
import { RoomState, QueueItem, SearchSettings } from '@/lib/roomUtils';

export interface UseRoomSubscriptionsOptions {
  roomCode: string | null;
  userUid: string | null | undefined;
  onSearchSettingsChanged?: (settings: SearchSettings) => void;
  onMemberCommand?: (memberUid: string, command: any) => void;
  onSearchRequest?: (reqId: string, req: any) => void;
}

/**
 * Manages Firebase RTDB listeners for the active room:
 * - /admins list
 * - TV presence tracking (.info/connected)
 * - /rooms/{code}/state
 * - /rooms/{code}/queue
 * - /rooms/{code}/members (and host election)
 * - /rooms/{code}/searchRequests
 * - Periodic cleanup of stale offline members
 */
export const useRoomSubscriptions = ({
  roomCode,
  userUid,
  onSearchSettingsChanged,
  onMemberCommand,
  onSearchRequest,
}: UseRoomSubscriptionsOptions) => {
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [memberCount, setMemberCount] = useState<number>(0);

  const roomStateRef = useRef<RoomState | null>(null);
  useEffect(() => {
    roomStateRef.current = roomState;
  }, [roomState]);

  const queueRefState = useRef<QueueItem[]>([]);
  useEffect(() => {
    queueRefState.current = queue;
  }, [queue]);

  const hostUidRef = useRef<string | null>(null);
  const adminsListRef = useRef<string[]>([]);

  // Keep latest callback refs to prevent listener re-attachment churn
  const onSearchSettingsChangedRef = useRef(onSearchSettingsChanged);
  useEffect(() => {
    onSearchSettingsChangedRef.current = onSearchSettingsChanged;
  }, [onSearchSettingsChanged]);

  const onMemberCommandRef = useRef(onMemberCommand);
  useEffect(() => {
    onMemberCommandRef.current = onMemberCommand;
  }, [onMemberCommand]);

  const onSearchRequestRef = useRef(onSearchRequest);
  useEffect(() => {
    onSearchRequestRef.current = onSearchRequest;
  }, [onSearchRequest]);

  // 1. Subscribe to admins list from Firebase RTDB
  useEffect(() => {
    const adminsRefNode = ref(database, 'admins');
    const unsubAdmins = onValue(adminsRefNode, (snapshot) => {
      if (snapshot.exists()) {
        adminsListRef.current = Object.keys(snapshot.val());
      } else {
        adminsListRef.current = [];
      }
    });
    return () => off(adminsRefNode);
  }, []);

  // 2. TV presence tracking via .info/connected
  useEffect(() => {
    if (!roomCode || !userUid) return;

    const connectedRef = ref(database, '.info/connected');
    const tvOnlineRef = ref(database, `rooms/${roomCode}/tv/online`);
    const tvLastSeenRef = ref(database, `rooms/${roomCode}/tv/lastSeen`);

    const unsubConnected = onValue(connectedRef, (snap) => {
      if (snap.val() === true) {
        onDisconnect(tvOnlineRef).set(false);
        onDisconnect(tvLastSeenRef).set(serverTimestamp());

        update(ref(database, `rooms/${roomCode}/tv`), {
          online: true,
          lastSeen: Date.now(),
        }).catch(() => {});
      }
    });

    const handleUnload = () => {
      update(ref(database, `rooms/${roomCode}/tv`), {
        online: false,
        lastSeen: Date.now(),
      }).catch(() => {});
    };
    window.addEventListener('beforeunload', handleUnload);

    return () => {
      window.removeEventListener('beforeunload', handleUnload);
      off(connectedRef);
      onDisconnect(tvOnlineRef).cancel();
      onDisconnect(tvLastSeenRef).cancel();
    };
  }, [roomCode, userUid]);

  // 3. Periodic garbage collection for stale offline members (> 2 hours offline with no queue items)
  useEffect(() => {
    if (!roomCode) return;

    const cleanupInterval = setInterval(() => {
      const now = Date.now();
      const membersRef = ref(database, `rooms/${roomCode}/members`);
      get(membersRef)
        .then((snap) => {
          if (!snap.exists()) return;
          const members = snap.val();
          const queuedMemberUids = new Set(queueRefState.current.map((q) => q.addedBy));

          Object.entries(members).forEach(([mUid, mVal]: [string, any]) => {
            if (
              mVal?.online === false &&
              mVal?.lastSeen &&
              now - mVal.lastSeen > 2 * 60 * 60 * 1000 &&
              !queuedMemberUids.has(mUid)
            ) {
              remove(ref(database, `rooms/${roomCode}/members/${mUid}`)).catch(() => {});
            }
          });
        })
        .catch(() => {});
    }, 15 * 60 * 1000);

    return () => clearInterval(cleanupInterval);
  }, [roomCode]);

  // 4. Main room node subscriptions
  useEffect(() => {
    if (!roomCode || !userUid) return;

    const stateRefNode = ref(database, `rooms/${roomCode}/state`);
    const queueRefNode = ref(database, `rooms/${roomCode}/queue`);
    const membersRefNode = ref(database, `rooms/${roomCode}/members`);
    const searchRequestsRefNode = ref(database, `rooms/${roomCode}/searchRequests`);

    // State listener
    const unsubState = onValue(stateRefNode, (snapshot) => {
      if (snapshot.exists()) {
        const stateVal = snapshot.val();
        setRoomState(stateVal);
        if (stateVal.hostUid) {
          hostUidRef.current = stateVal.hostUid;
        }
        if (stateVal.searchSettings && onSearchSettingsChangedRef.current) {
          onSearchSettingsChangedRef.current(stateVal.searchSettings);
        }
      }
    });

    // Queue listener
    const unsubQueue = onValue(queueRefNode, (snapshot) => {
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

    // Members & pending member commands & host election
    const unsubMembers = onValue(membersRefNode, (snapshot) => {
      if (!snapshot.exists()) {
        setMemberCount(0);
        hostUidRef.current = null;
        update(ref(database, `rooms/${roomCode}/state`), { hostUid: null });
        return;
      }

      const membersData = snapshot.val();
      const memberEntries = Object.entries(membersData).map(([uid, m]: [string, any]) => ({
        uid,
        joinedAt: m?.joinedAt || 0,
        online: m?.online !== false,
        lastSeen: m?.lastSeen || 0,
      }));

      // Online members prioritized for host election & count
      const onlineMembers = memberEntries.filter((m) => m.online);
      onlineMembers.sort((a, b) => a.joinedAt - b.joinedAt);
      memberEntries.sort((a, b) => a.joinedAt - b.joinedAt);

      const electedHostUid = onlineMembers.length > 0
        ? onlineMembers[0].uid
        : (memberEntries.length > 0 ? memberEntries[0].uid : null);

      hostUidRef.current = electedHostUid;

      if (roomStateRef.current?.hostUid !== electedHostUid && electedHostUid) {
        update(ref(database, `rooms/${roomCode}/state`), { hostUid: electedHostUid });
      }

      setMemberCount(onlineMembers.length);

      Object.entries(membersData).forEach(([memberUid, member]: [string, any]) => {
        if (member && member.command && onMemberCommandRef.current) {
          onMemberCommandRef.current(memberUid, member.command);
        }
      });
    });

    // Search requests from clients
    const unsubSearchRequests = onValue(searchRequestsRefNode, (snapshot) => {
      if (!snapshot.exists()) return;
      const requests = snapshot.val();
      const now = Date.now();
      Object.entries(requests).forEach(([reqId, req]: [string, any]) => {
        if (!req) return;
        // GC orphaned requests older than 30s
        if (req.createdAt && now - req.createdAt > 30000) {
          remove(ref(database, `rooms/${roomCode}/searchRequests/${reqId}`)).catch(() => {});
          return;
        }
        if (onSearchRequestRef.current) {
          onSearchRequestRef.current(reqId, req);
        }
      });
    });

    return () => {
      off(stateRefNode);
      off(queueRefNode);
      off(membersRefNode);
      off(searchRequestsRefNode);
    };
  }, [roomCode, userUid]);

  return {
    roomState,
    setRoomState,
    queue,
    setQueue,
    memberCount,
    hostUidRef,
    adminsListRef,
    roomStateRef,
    queueRefState,
  };
};
