import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { User } from 'firebase/auth';
import { ref, onValue, set, update, remove, off } from 'firebase/database';
import { ensureAnonymousAuth, database } from '@/lib/firebase';
import { createRoomAtomic, RoomState, QueueItem, parseYouTubeVideoId } from '@/lib/roomUtils';
import { fetchVideoTitle } from '@/lib/youtube';
import { getAutoplayNextYouTubeTrack } from '@/lib/lastfm';

interface WatchPartyContextType {
  user: User | null;
  roomCode: string | null;
  roomState: RoomState | null;
  queue: QueueItem[];
  memberCount: number;
  creating: boolean;
  showQrModal: boolean;
  setShowQrModal: (show: boolean) => void;
  muted: boolean;
  setMuted: React.Dispatch<React.SetStateAction<boolean>>;
  copiedLink: boolean;
  remoteUrl: string;
  handleCreateRoom: () => Promise<void>;
  handleEndRoom: () => Promise<void>;
  handleTogglePlayPause: () => Promise<void>;
  handlePlayNextInQueue: () => Promise<void>;
  handleRemoveQueueItem: (itemId: string) => Promise<void>;
  handleAddUrlHost: (url: string) => Promise<boolean>;
  handleToggleFullscreen: () => Promise<void>;
  handleToggleRoomLock: () => Promise<void>;
  handleToggleAutoplay: () => Promise<void>;
  copyRemoteLink: () => void;
}

const WatchPartyContext = createContext<WatchPartyContextType | undefined>(undefined);

export const WatchPartyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [memberCount, setMemberCount] = useState<number>(0);

  const [creating, setCreating] = useState<boolean>(false);
  const [showQrModal, setShowQrModal] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [muted, setMuted] = useState<boolean>(false);

  // Auto-close QR code popup after 30 seconds
  useEffect(() => {
    if (showQrModal) {
      const timer = setTimeout(() => {
        setShowQrModal(false);
      }, 30000);
      return () => clearTimeout(timer);
    }
  }, [showQrModal]);

  // Ref tracking to avoid stale closures in listeners
  const roomStateRef = useRef<RoomState | null>(null);
  useEffect(() => {
    roomStateRef.current = roomState;
  }, [roomState]);

  const hostUidRef = useRef<string | null>(null);
  const lastFullscreenToggleRef = useRef<number>(0);
  const adminsListRef = useRef<string[]>([]);
  const recentAutoplayHistoryRef = useRef<string[]>([]);

  // Subscribe to admins list from Firebase RTDB
  useEffect(() => {
    const adminsRefNode = ref(database, 'admins');
    const unsubAdmins = onValue(adminsRefNode, (snapshot) => {
      if (snapshot.exists()) {
        const val = snapshot.val();
        adminsListRef.current = Object.keys(val);
      } else {
        adminsListRef.current = [];
      }
    });
    return () => off(adminsRefNode);
  }, []);

  const queueRefState = useRef<QueueItem[]>([]);
  useEffect(() => {
    queueRefState.current = queue;
  }, [queue]);

  // Authenticate anonymously on mount
  useEffect(() => {
    ensureAnonymousAuth()
      .then((u) => setUser(u))
      .catch((err) => console.error('Auth error in WatchPartyContext:', err));
  }, []);

  // Subscribe to room nodes when roomCode is active
  useEffect(() => {
    if (!roomCode || !user) return;

    const stateRefNode = ref(database, `rooms/${roomCode}/state`);
    const queueRefNode = ref(database, `rooms/${roomCode}/queue`);
    const membersRefNode = ref(database, `rooms/${roomCode}/members`);

    // 1. Shared state
    const unsubState = onValue(stateRefNode, (snapshot) => {
      if (snapshot.exists()) {
        const stateVal = snapshot.val();
        setRoomState(stateVal);
        if (stateVal.hostUid) {
          hostUidRef.current = stateVal.hostUid;
        }
      }
    });

    // 2. Queue
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

    // 3. Members & pending member commands & host election
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
      }));

      memberEntries.sort((a, b) => a.joinedAt - b.joinedAt);
      const electedHostUid = memberEntries.length > 0 ? memberEntries[0].uid : null;
      hostUidRef.current = electedHostUid;

      if (roomStateRef.current?.hostUid !== electedHostUid && electedHostUid) {
        update(ref(database, `rooms/${roomCode}/state`), { hostUid: electedHostUid });
      }

      setMemberCount(memberEntries.length);

      Object.entries(membersData).forEach(([memberUid, member]: [string, any]) => {
        if (member && member.command) {
          processMemberCommand(memberUid, member.command);
        }
      });
    });

    return () => {
      off(stateRefNode);
      off(queueRefNode);
      off(membersRefNode);
    };
  }, [roomCode, user]);

  const processMemberCommand = async (memberUid: string, command: any) => {
    if (!roomCode || !command || !command.type) return;

    const { type, payload } = command;
    const isAuthorized =
      memberUid === hostUidRef.current ||
      memberUid === user?.uid ||
      adminsListRef.current.includes(memberUid);

    // Reject commands if room is locked by admin and user is not authorized
    if (roomStateRef.current?.isLocked && !isAuthorized) {
      if (type === 'addToQueue' || type === 'play' || type === 'pause' || type === 'adjustVolume') {
        console.warn('[TV Host] Rejected member command because room controls are locked by admin:', type, memberUid);
        return;
      }
    }

    try {
      if (type === 'play') {
        await update(ref(database, `rooms/${roomCode}/state/playback`), {
          status: 'playing',
          updatedAt: Date.now(),
        });
      } else if (type === 'pause') {
        await update(ref(database, `rooms/${roomCode}/state/playback`), {
          status: 'paused',
          updatedAt: Date.now(),
        });
      } else if (type === 'adjustVolume' && payload && typeof payload.volume === 'number') {
        await update(ref(database, `rooms/${roomCode}/state/playback`), {
          volume: Math.min(100, Math.max(0, payload.volume)),
          updatedAt: Date.now(),
        });
      } else if (type === 'addToQueue' && payload && payload.url) {
        const ytId = parseYouTubeVideoId(payload.url);
        if (ytId) {
          const videoUrl = `https://www.youtube.com/watch?v=${ytId}`;
          const currentPlaying = roomStateRef.current?.currentlyPlaying;

          let videoTitle = payload.title || '';
          if (!videoTitle) {
            const info = await fetchVideoTitle(videoUrl);
            videoTitle = info.title || '';
          }

          if (!currentPlaying) {
            await update(ref(database, `rooms/${roomCode}/state`), {
              currentlyPlaying: videoUrl,
              currentlyPlayingTitle: videoTitle,
            });
            await update(ref(database, `rooms/${roomCode}/state/playback`), {
              status: 'playing',
              updatedAt: Date.now(),
            });
          } else {
            const queueKey = `${Date.now()}_${memberUid.substring(0, 4)}`;
            const newQueueRefNode = ref(database, `rooms/${roomCode}/queue/${queueKey}`);
            await set(newQueueRefNode, {
              url: videoUrl,
              title: videoTitle,
              addedBy: memberUid,
              addedAt: Date.now(),
            });
          }
        }
      } else if (type === 'removeFromQueue' && payload && payload.itemId) {
        const queueItem = queueRefState.current.find((item) => item.id === payload.itemId);
        if (queueItem && (queueItem.addedBy === memberUid || isAuthorized)) {
          await remove(ref(database, `rooms/${roomCode}/queue/${payload.itemId}`));
        }
      } else if (type === 'forceSkip') {
        if (isAuthorized) {
          await handlePlayNextInQueue();
        } else {
          console.warn('[TV Host] Rejected forceSkip command from non-authorized member:', memberUid);
        }
      } else if (type === 'forceRemoveFromQueue' && payload && payload.itemId) {
        if (isAuthorized) {
          await remove(ref(database, `rooms/${roomCode}/queue/${payload.itemId}`));
        } else {
          console.warn('[TV Host] Rejected forceRemoveFromQueue command from non-authorized member:', memberUid);
        }
      } else if (type === 'reorderQueue' && payload && Array.isArray(payload.queueOrder)) {
        if (isAuthorized) {
          const baseTime = Date.now();
          const updates: Record<string, any> = {};
          payload.queueOrder.forEach((itemId: string, index: number) => {
            updates[`${itemId}/addedAt`] = baseTime + index * 1000;
          });
          if (Object.keys(updates).length > 0) {
            await update(ref(database, `rooms/${roomCode}/queue`), updates);
          }
        } else {
          console.warn('[TV Host] Rejected reorderQueue command from non-authorized member:', memberUid);
        }
      } else if (type === 'kickMember' && payload && payload.targetUid) {
        if (isAuthorized) {
          const targetUid = payload.targetUid;
          await remove(ref(database, `rooms/${roomCode}/members/${targetUid}`));

          if (payload.purgeQueue !== false) {
            const memberQueueItems = queueRefState.current.filter((item) => item.addedBy === targetUid);
            for (const item of memberQueueItems) {
              await remove(ref(database, `rooms/${roomCode}/queue/${item.id}`));
            }
          }
        } else {
          console.warn('[TV Host] Rejected kickMember command from non-authorized member:', memberUid);
        }
      } else if (type === 'toggleFullscreen') {
        const now = Date.now();
        if (now - lastFullscreenToggleRef.current < 5000) {
          console.warn('[TV Host] Cooldown active (5s) for toggleFullscreen command from member:', memberUid);
        } else {
          lastFullscreenToggleRef.current = now;
          const nextFullscreen = !roomStateRef.current?.isFullscreen;
          await update(ref(database, `rooms/${roomCode}/state`), {
            isFullscreen: nextFullscreen,
          });
        }
      } else if (type === 'clearQueue') {
        if (isAuthorized) {
          await remove(ref(database, `rooms/${roomCode}/queue`));
        } else {
          console.warn('[TV Host] Rejected clearQueue command from non-authorized member:', memberUid);
        }
      } else if (type === 'toggleRoomLock') {
        if (isAuthorized) {
          const nextIsLocked = !roomStateRef.current?.isLocked;
          const updates: Record<string, any> = {
            isLocked: nextIsLocked,
          };
          if (nextIsLocked) {
            updates['playback/status'] = 'paused';
            updates['playback/updatedAt'] = Date.now();
          }
          await update(ref(database, `rooms/${roomCode}/state`), updates);
        } else {
          console.warn('[TV Host] Rejected toggleRoomLock command from non-authorized member:', memberUid);
        }
      } else if (type === 'toggleAutoplay') {
        const nextAutoplay = !roomStateRef.current?.isAutoplay;
        await update(ref(database, `rooms/${roomCode}/state`), {
          isAutoplay: nextAutoplay,
        });
      }
    } catch (err) {
      console.error('[TV Host] Error executing member command:', err);
    } finally {
      try {
        const commandRefNode = ref(database, `rooms/${roomCode}/members/${memberUid}/command`);
        await remove(commandRefNode);
      } catch (err) {
        console.error('[TV Host] Failed to clear command node:', err);
      }
    }
  };

  const handleCreateRoom = async () => {
    setCreating(true);
    try {
      const u = user || (await ensureAnonymousAuth());
      setUser(u);

      const code = await createRoomAtomic(u.uid);
      setRoomCode(code);
    } catch (err: any) {
      console.error('Error creating room:', err);
      alert('Failed to create Watch Together room: ' + err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleEndRoom = async () => {
    if (!roomCode) return;
    if (confirm('Are you sure you want to end this Watch Together session?')) {
      await remove(ref(database, `rooms/${roomCode}`));
      setRoomCode(null);
      setRoomState(null);
      setQueue([]);
      setShowQrModal(false);
    }
  };

  const handlePlayNextInQueue = async () => {
    if (!roomCode) return;

    const currentQueue = queueRefState.current;
    if (currentQueue && currentQueue.length > 0) {
      const nextItem = currentQueue[0];
      await update(ref(database, `rooms/${roomCode}/state`), {
        currentlyPlaying: nextItem.url,
        currentlyPlayingTitle: nextItem.title || '',
      });
      await update(ref(database, `rooms/${roomCode}/state/playback`), {
        status: 'playing',
        updatedAt: Date.now(),
      });
      await remove(ref(database, `rooms/${roomCode}/queue/${nextItem.id}`));
    } else if (roomStateRef.current?.isAutoplay) {
      // Queue is empty but Autoplay is enabled!
      let currentTitle = roomStateRef.current?.currentlyPlayingTitle || '';
      let channelTitle = '';

      if (roomStateRef.current?.currentlyPlaying) {
        const info = await fetchVideoTitle(roomStateRef.current.currentlyPlaying);
        if (info.title && !currentTitle) {
          currentTitle = info.title;
        }
        if (info.channelTitle) {
          channelTitle = info.channelTitle;
        }
      }

      if (currentTitle) {
        // Maintain history of last 10 tracks
        recentAutoplayHistoryRef.current = [
          currentTitle,
          ...recentAutoplayHistoryRef.current.filter((t) => t !== currentTitle),
        ].slice(0, 10);
      }

      console.log('[TV Host] Autoplay active. Searching for track similar to title:', currentTitle, 'channel:', channelTitle);
      const nextTrack = await getAutoplayNextYouTubeTrack(currentTitle, channelTitle, recentAutoplayHistoryRef.current);

      if (nextTrack) {
        console.log('[TV Host] Autoplay next track resolved:', nextTrack.title, nextTrack.url);
        await update(ref(database, `rooms/${roomCode}/state`), {
          currentlyPlaying: nextTrack.url,
          currentlyPlayingTitle: nextTrack.title,
        });
        await update(ref(database, `rooms/${roomCode}/state/playback`), {
          status: 'playing',
          updatedAt: Date.now(),
        });
      } else {
        console.warn('[TV Host] Autoplay found no similar tracks or YouTube results.');
        await update(ref(database, `rooms/${roomCode}/state`), {
          currentlyPlaying: '',
          currentlyPlayingTitle: '',
        });
        await update(ref(database, `rooms/${roomCode}/state/playback`), {
          status: 'paused',
          updatedAt: Date.now(),
        });
      }
    } else {
      await update(ref(database, `rooms/${roomCode}/state`), {
        currentlyPlaying: '',
        currentlyPlayingTitle: '',
      });
      await update(ref(database, `rooms/${roomCode}/state/playback`), {
        status: 'paused',
        updatedAt: Date.now(),
      });
    }
  };

  const handleTogglePlayPause = async () => {
    if (!roomCode || !roomState) return;
    const newStatus = roomState.playback?.status === 'playing' ? 'paused' : 'playing';
    await update(ref(database, `rooms/${roomCode}/state/playback`), {
      status: newStatus,
      updatedAt: Date.now(),
    });
  };

  const handleRemoveQueueItem = async (itemId: string) => {
    if (!roomCode) return;
    await remove(ref(database, `rooms/${roomCode}/queue/${itemId}`));
  };

  const handleAddUrlHost = async (urlInput: string): Promise<boolean> => {
    if (!urlInput.trim() || !roomCode) return false;

    const ytId = parseYouTubeVideoId(urlInput.trim());
    if (!ytId) {
      alert('Please enter a valid YouTube video link.');
      return false;
    }

    const videoUrl = `https://www.youtube.com/watch?v=${ytId}`;
    const info = await fetchVideoTitle(videoUrl);
    const videoTitle = info.title || '';

    if (!roomState?.currentlyPlaying) {
      await update(ref(database, `rooms/${roomCode}/state`), {
        currentlyPlaying: videoUrl,
        currentlyPlayingTitle: videoTitle,
      });
      await update(ref(database, `rooms/${roomCode}/state/playback`), {
        status: 'playing',
        updatedAt: Date.now(),
      });
    } else {
      const queueKey = `${Date.now()}_host`;
      const newQueueRefNode = ref(database, `rooms/${roomCode}/queue/${queueKey}`);
      await set(newQueueRefNode, {
        url: videoUrl,
        title: videoTitle,
        addedBy: user?.uid || 'host',
        addedAt: Date.now(),
      });
    }
    return true;
  };

  const remoteUrl = roomCode
    ? `${window.location.origin}/#/join?room=${roomCode}`
    : `${window.location.origin}/#/join`;

  const copyRemoteLink = () => {
    navigator.clipboard.writeText(remoteUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleToggleFullscreen = async () => {
    if (!roomCode) return;
    const now = Date.now();
    if (now - lastFullscreenToggleRef.current < 5000) {
      console.warn('[TV Host] Cooldown active (5s) for handleToggleFullscreen');
      return;
    }
    lastFullscreenToggleRef.current = now;
    const nextFullscreen = !roomStateRef.current?.isFullscreen;
    await update(ref(database, `rooms/${roomCode}/state`), {
      isFullscreen: nextFullscreen,
    });
  };

  const handleToggleRoomLock = async () => {
    if (!roomCode || !roomStateRef.current) return;
    const nextIsLocked = !roomStateRef.current.isLocked;
    const updates: Record<string, any> = {
      isLocked: nextIsLocked,
    };
    if (nextIsLocked) {
      updates['playback/status'] = 'paused';
      updates['playback/updatedAt'] = Date.now();
    }
    await update(ref(database, `rooms/${roomCode}/state`), updates);
  };

  const handleToggleAutoplay = async () => {
    if (!roomCode) return;
    const nextAutoplay = !roomStateRef.current?.isAutoplay;
    await update(ref(database, `rooms/${roomCode}/state`), {
      isAutoplay: nextAutoplay,
    });
  };

  return (
    <WatchPartyContext.Provider
      value={{
        user,
        roomCode,
        roomState,
        queue,
        memberCount,
        creating,
        showQrModal,
        setShowQrModal,
        muted,
        setMuted,
        copiedLink,
        remoteUrl,
        handleCreateRoom,
        handleEndRoom,
        handleTogglePlayPause,
        handlePlayNextInQueue,
        handleRemoveQueueItem,
        handleAddUrlHost,
        handleToggleFullscreen,
        handleToggleRoomLock,
        handleToggleAutoplay,
        copyRemoteLink,
      }}
    >
      {children}
    </WatchPartyContext.Provider>
  );
};

export const useWatchParty = (): WatchPartyContextType => {
  const context = useContext(WatchPartyContext);
  if (!context) {
    throw new Error('useWatchParty must be used within a WatchPartyProvider');
  }
  return context;
};
