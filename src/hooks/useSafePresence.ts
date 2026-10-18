import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';

export interface PresenceState {
  userId: string;
  online: boolean;
  lastDisconnected: number;
  data?: unknown;
}

const getPresenceInstanceId = (): string => {
  try {
    const key = 'mediabox_presence_instance_id';
    const stored = sessionStorage.getItem(key);
    if (stored) return stored;
    const generated = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
    sessionStorage.setItem(key, generated);
    return generated;
  } catch {
    return 'inst-' + Math.random().toString(36).substring(2, 10);
  }
};

/**
 * Resilient presence hook for Watch Together rooms.
 * - Uses persistent session IDs per browser tab (sessionStorage) to prevent ghost duplicate sessions on reloads.
 * - Only sends heartbeats when a valid 6-digit room code exists.
 * - Filters for currently online members only so offline historical sessions never clutter the UI.
 */
export function useSafePresence(
  roomCode: string | null | undefined,
  userId: string,
  interval: number = 10000
): PresenceState[] | undefined {
  const [instanceId] = useState(getPresenceInstanceId);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [roomToken, setRoomToken] = useState<string | null>(null);
  const sessionTokenRef = useRef<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const heartbeatMutation = useMutation(api.presence.heartbeat);
  const disconnectMutation = useMutation(api.presence.disconnect);

  const activeRoom = roomCode && roomCode.trim().length === 6 ? roomCode.trim() : null;
  const sessionId = useMemo(() => {
    return activeRoom ? `${instanceId}:${activeRoom}:${userId}` : null;
  }, [instanceId, activeRoom, userId]);

  useEffect(() => {
    sessionTokenRef.current = sessionToken;
  }, [sessionToken]);

  useEffect(() => {
    if (!activeRoom || !sessionId || !userId) {
      if (sessionTokenRef.current) {
        disconnectMutation({ sessionToken: sessionTokenRef.current }).catch(() => {});
        sessionTokenRef.current = null;
      }
      setSessionToken(null);
      setRoomToken(null);
      return;
    }

    let isSubscribed = true;

    const sendHeartbeat = async () => {
      try {
        const result = await heartbeatMutation({
          roomId: activeRoom,
          userId,
          sessionId,
          interval,
        });
        if (!isSubscribed) {
          disconnectMutation({ sessionToken: result.sessionToken }).catch(() => {});
          return;
        }
        setRoomToken(result.roomToken);
        setSessionToken(result.sessionToken);
      } catch (err) {
        console.warn('[useSafePresence] Heartbeat error:', err);
      }
    };

    void sendHeartbeat();

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    intervalRef.current = setInterval(sendHeartbeat, interval);

    const handleUnload = () => {
      if (sessionTokenRef.current) {
        disconnectMutation({ sessionToken: sessionTokenRef.current }).catch(() => {});
      }
    };
    window.addEventListener('beforeunload', handleUnload);

    return () => {
      isSubscribed = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      window.removeEventListener('beforeunload', handleUnload);
      if (sessionTokenRef.current) {
        disconnectMutation({ sessionToken: sessionTokenRef.current }).catch(() => {});
      }
    };
  }, [activeRoom, sessionId, userId, interval, heartbeatMutation, disconnectMutation]);

  // Query live presence for the roomToken
  const rawState = useQuery(api.presence.list, roomToken ? { roomToken } : 'skip');

  return useMemo(() => {
    if (!rawState) return undefined;
    // Filter to strictly ONLINE members (exclude historic offline sessions)
    const onlineOnly = rawState.filter((p: any) => p.online);

    // Deduplicate by userId (keeping the latest session)
    const userMap = new Map<string, PresenceState>();
    for (const item of onlineOnly) {
      userMap.set(item.userId, item);
    }

    const uniqueMembers = Array.from(userMap.values());

    return uniqueMembers.sort((a, b) => {
      if (a.userId === userId) return -1;
      if (b.userId === userId) return 1;
      return 0;
    });
  }, [rawState, userId]);
}
