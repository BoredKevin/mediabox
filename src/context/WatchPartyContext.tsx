import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { User } from 'firebase/auth';
import { ref, onValue, set, update, remove, off, get, onDisconnect, serverTimestamp } from 'firebase/database';
import { ensureAnonymousAuth, database } from '@/lib/firebase';
import {
  createRoomAtomic,
  checkRoomExists,
  RoomState,
  QueueItem,
  parseYouTubeVideoId,
  SearchSettings,
  ApiKeyRecord,
} from '@/lib/roomUtils';
import {
  fetchVideoTitle,
  searchYouTubeWithKey,
  YouTubeQuotaExceededError,
  SearchResultItem,
} from '@/lib/youtube';
import {
  loadKeys,
  addKey,
  deleteKey,
  updateKey,
  pickKey,
  incrementUsage,
  markKeyExhausted,
  resetDailyUsageIfNeeded,
  saveSearchConfig,
  getEffectiveSearchSettings,
} from '@/lib/apiKeyStore';
import { getAutoplayNextYouTubeTrack, parseTrackAndArtist } from '@/lib/lastfm';

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
  searchSettings: SearchSettings;
  handleCreateRoom: () => Promise<void>;
  handleEndRoom: () => Promise<void>;
  handleTogglePlayPause: () => Promise<void>;
  handlePlayNextInQueue: () => Promise<void>;
  handleRemoveQueueItem: (itemId: string) => Promise<void>;
  showSettingsModal: boolean;
  setShowSettingsModal: (show: boolean) => void;
  handleAddUrlHost: (url: string, explicitTitle?: string) => Promise<boolean>;
  handleToggleFullscreen: () => Promise<void>;
  handleToggleRoomLock: () => Promise<void>;
  handleToggleAutoplay: () => Promise<void>;
  handleToggleCountdown: () => Promise<void>;
  handleAdjustVolume: (volume: number) => Promise<void>;
  copyRemoteLink: () => void;
  handleUpdateSearchSettings: (patch: Partial<SearchSettings>) => Promise<void>;
  handleManageLocalKeys: (action: 'add' | 'delete' | 'update', data: any) => Promise<void>;
  handleClearAllRateLimits: () => Promise<void>;
}

const WatchPartyContext = createContext<WatchPartyContextType | undefined>(undefined);

export const WatchPartyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [memberCount, setMemberCount] = useState<number>(0);

  const [creating, setCreating] = useState<boolean>(false);
  const [showQrModal, setShowQrModal] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [muted, setMuted] = useState<boolean>(false);

  // Search settings state & refs
  const [searchSettings, setSearchSettings] = useState<SearchSettings>(() => getEffectiveSearchSettings());
  const searchSettingsRef = useRef<SearchSettings>(searchSettings);
  useEffect(() => {
    searchSettingsRef.current = searchSettings;
  }, [searchSettings]);

  const processingRequestsRef = useRef<Set<string>>(new Set());

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
  const recentAutoplayUrlHistoryRef = useRef<string[]>([]);

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

  const TV_SAVED_ROOM_KEY = 'mediabox_tv_room_code';

  // Authenticate anonymously on mount and attempt room recovery on reload
  useEffect(() => {
    ensureAnonymousAuth()
      .then(async (u) => {
        setUser(u);
        const savedCode = localStorage.getItem(TV_SAVED_ROOM_KEY);
        if (savedCode && savedCode.length === 6) {
          try {
            const exists = await checkRoomExists(savedCode);
            if (exists) {
              const tvUidSnap = await get(ref(database, `rooms/${savedCode}/tv/uid`));
              if (tvUidSnap.exists() && tvUidSnap.val() === u.uid) {
                setRoomCode(savedCode);
              } else {
                localStorage.removeItem(TV_SAVED_ROOM_KEY);
              }
            } else {
              localStorage.removeItem(TV_SAVED_ROOM_KEY);
            }
          } catch (err) {
            console.warn('Error checking saved room code:', err);
          }
        }
      })
      .catch((err) => console.error('Auth error in WatchPartyContext:', err));
  }, []);

  // TV presence tracking via .info/connected
  useEffect(() => {
    if (!roomCode || !user) return;

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

    // Mark offline on tab unload
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
  }, [roomCode, user]);

  // Periodic garbage collection for stale offline members (> 2 hours offline with no queue items)
  useEffect(() => {
    if (!roomCode) return;

    const cleanupInterval = setInterval(() => {
      const now = Date.now();
      const membersRef = ref(database, `rooms/${roomCode}/members`);
      get(membersRef).then((snap) => {
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
      }).catch(() => {});
    }, 15 * 60 * 1000);

    return () => clearInterval(cleanupInterval);
  }, [roomCode]);

  // Subscribe to room nodes when roomCode is active
  useEffect(() => {
    if (!roomCode || !user) return;

    const stateRefNode = ref(database, `rooms/${roomCode}/state`);
    const queueRefNode = ref(database, `rooms/${roomCode}/queue`);
    const membersRefNode = ref(database, `rooms/${roomCode}/members`);
    const searchRequestsRefNode = ref(database, `rooms/${roomCode}/searchRequests`);

    // 1. Shared state
    const unsubState = onValue(stateRefNode, (snapshot) => {
      if (snapshot.exists()) {
        const stateVal = snapshot.val();
        setRoomState(stateVal);
        if (stateVal.hostUid) {
          hostUidRef.current = stateVal.hostUid;
        }
        if (stateVal.searchSettings) {
          setSearchSettings(stateVal.searchSettings);
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
        if (member && member.command) {
          processMemberCommand(memberUid, member.command);
        }
      });
    });

    // 4. Search requests from clients
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
        processSearchRequest(reqId, req);
      });
    });

    return () => {
      off(stateRefNode);
      off(queueRefNode);
      off(membersRefNode);
      off(searchRequestsRefNode);
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
      } else if (type === 'toggleCountdown') {
        const nextCountdown = !roomStateRef.current?.isCountdownEnabled;
        await update(ref(database, `rooms/${roomCode}/state`), {
          isCountdownEnabled: nextCountdown,
        });
      } else if (type === 'searchYouTube' && payload && payload.query) {
        const reqId = `${memberUid}_${Date.now()}`;
        processSearchRequest(reqId, {
          requestedBy: memberUid,
          query: payload.query,
          createdAt: Date.now(),
        });
      } else if (type === 'manageApiKeys' && payload) {
        const isHost = memberUid === hostUidRef.current;
        const allowHost = roomStateRef.current?.searchSettings?.allowHostKeyManagement;
        if ((isHost && allowHost) || isAuthorized) {
          const {
            action,
            keyId,
            key,
            label,
            enabled,
            strategy,
            maxResults,
            rateLimitCount,
            rateLimitWindowMs,
            allowHostKeyManagement,
          } = payload;
          if (action === 'add' && key) {
            addKey(key, label || '');
          } else if (action === 'delete' && keyId) {
            deleteKey(keyId);
          } else if (action === 'update' && keyId) {
            updateKey(keyId, {
              ...(label !== undefined ? { label } : {}),
              ...(enabled !== undefined ? { enabled } : {}),
            });
          } else if (action === 'setStrategy' && strategy) {
            saveSearchConfig({ strategy });
          } else if (action === 'setMaxResults' && typeof maxResults === 'number') {
            saveSearchConfig({ maxResults });
          } else if (action === 'setRateLimit') {
            saveSearchConfig({
              ...(typeof rateLimitCount === 'number' ? { rateLimitCount } : {}),
              ...(typeof rateLimitWindowMs === 'number' ? { rateLimitWindowMs } : {}),
            });
          } else if (action === 'setAllowHost' && typeof allowHostKeyManagement === 'boolean') {
            saveSearchConfig({ allowHostKeyManagement });
          }
          await syncSearchSettingsToFirebase();
        } else {
          console.warn('[TV Host] Unauthorized manageApiKeys command from member:', memberUid);
        }
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

  const syncSearchSettingsToFirebase = async () => {
    const effective = getEffectiveSearchSettings();
    setSearchSettings(effective);
    searchSettingsRef.current = effective;
    if (roomCode) {
      await update(ref(database, `rooms/${roomCode}/state/searchSettings`), effective);
    }
  };

  const processSearchRequest = async (
    reqId: string,
    req: { requestedBy: string; query: string; createdAt: number }
  ) => {
    if (!roomCode || !req || !req.requestedBy || !req.query) return;
    if (processingRequestsRef.current.has(reqId)) return;
    processingRequestsRef.current.add(reqId);

    try {
      const uid = req.requestedBy;
      const currentConfig = searchSettingsRef.current;
      const windowMs = currentConfig.rateLimitWindowMs || 300000;
      const maxCount = currentConfig.rateLimitCount || 10;
      const now = Date.now();

      // 1. Check rate limit in RTDB
      const rateLimitRefNode = ref(database, `rooms/${roomCode}/searchRateLimits/${uid}`);
      const rateSnap = await get(rateLimitRefNode);
      let currentRate = rateSnap.exists()
        ? rateSnap.val()
        : { count: 0, windowStart: now };

      if (now - (currentRate.windowStart || 0) > windowMs) {
        // Window expired, reset
        currentRate = { count: 1, windowStart: now };
        await set(rateLimitRefNode, currentRate);
      } else {
        if (currentRate.count >= maxCount) {
          // Rate limit exceeded
          const remainingSecs = Math.ceil((windowMs - (now - currentRate.windowStart)) / 1000);
          const remainingMins = Math.ceil(remainingSecs / 60);
          await set(ref(database, `rooms/${roomCode}/searchResults/${reqId}`), {
            results: [],
            error: `Rate limit reached (${maxCount} searches / ${Math.round(windowMs / 60000)}m). Please wait ${
              remainingMins > 1 ? `${remainingMins} minutes` : `${remainingSecs}s`
            }.`,
            respondedAt: Date.now(),
          });
          await remove(ref(database, `rooms/${roomCode}/searchRequests/${reqId}`));
          return;
        }
        currentRate.count = (currentRate.count || 0) + 1;
        await update(rateLimitRefNode, { count: currentRate.count });
      }

      // 2. Perform search with key fallback
      resetDailyUsageIfNeeded();

      let results: SearchResultItem[] | null = null;
      let errorMessage: string | null = null;
      const attemptedIds = new Set<string>();

      while (results === null) {
        const activeKeys = loadKeys().filter(
          (k) => k.enabled && k.key.trim().length > 0 && !attemptedIds.has(k.id)
        );
        if (activeKeys.length === 0) {
          errorMessage =
            attemptedIds.size > 0
              ? 'All configured YouTube API keys on the TV have exceeded their daily quota.'
              : 'No active YouTube API key configured on TV.';
          break;
        }

        const strategy = currentConfig.strategy || 'roundRobin';
        const candidate = pickKey(strategy);
        const keyRecord = candidate && !attemptedIds.has(candidate.id) ? candidate : activeKeys[0];

        attemptedIds.add(keyRecord.id);

        try {
          results = await searchYouTubeWithKey(
            req.query,
            keyRecord.key,
            currentConfig.maxResults || 25
          );
          incrementUsage(keyRecord.id);
        } catch (err: any) {
          if (err instanceof YouTubeQuotaExceededError) {
            console.warn(
              `[TV Host] Quota exceeded for key ${keyRecord.id}, marking exhausted and trying next key.`
            );
            markKeyExhausted(keyRecord.id);
            syncSearchSettingsToFirebase();
          } else {
            console.error('[TV Host] Error executing YouTube search:', err);
            errorMessage = err.message || 'YouTube search failed.';
            break;
          }
        }
      }

      // 3. Write result for client
      await set(ref(database, `rooms/${roomCode}/searchResults/${reqId}`), {
        results: results || [],
        error: errorMessage,
        respondedAt: Date.now(),
      });

      // 4. Delete request
      await remove(ref(database, `rooms/${roomCode}/searchRequests/${reqId}`));

      // 5. Clean up stale search results (> 60s)
      try {
        const resultsSnap = await get(ref(database, `rooms/${roomCode}/searchResults`));
        if (resultsSnap.exists()) {
          const allRes = resultsSnap.val();
          Object.entries(allRes).forEach(([resKey, resVal]: [string, any]) => {
            if (resVal?.respondedAt && now - resVal.respondedAt > 60000) {
              remove(ref(database, `rooms/${roomCode}/searchResults/${resKey}`)).catch(() => {});
            }
          });
        }
      } catch {
        // ignore GC errors
      }
    } catch (err) {
      console.error('[TV Host] processSearchRequest failure:', err);
    } finally {
      processingRequestsRef.current.delete(reqId);
    }
  };

  const handleUpdateSearchSettings = async (patch: Partial<SearchSettings>) => {
    saveSearchConfig(patch);
    await syncSearchSettingsToFirebase();
  };

  const handleManageLocalKeys = async (action: 'add' | 'delete' | 'update', data: any) => {
    if (action === 'add' && data?.key) {
      addKey(data.key, data.label || '');
    } else if (action === 'delete' && data?.id) {
      deleteKey(data.id);
    } else if (action === 'update' && data?.id) {
      updateKey(data.id, data.patch);
    }
    await syncSearchSettingsToFirebase();
  };

  const handleClearAllRateLimits = async () => {
    if (roomCode) {
      await remove(ref(database, `rooms/${roomCode}/searchRateLimits`));
    }
  };

  const handleCreateRoom = async () => {
    setCreating(true);
    try {
      const u = user || (await ensureAnonymousAuth());
      setUser(u);

      const effectiveSettings = getEffectiveSearchSettings();
      setSearchSettings(effectiveSettings);
      searchSettingsRef.current = effectiveSettings;

      const code = await createRoomAtomic(u.uid, effectiveSettings);
      localStorage.setItem(TV_SAVED_ROOM_KEY, code);
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
      localStorage.removeItem(TV_SAVED_ROOM_KEY);
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

      const currentUrl = roomStateRef.current?.currentlyPlaying || '';

      if (currentUrl) {
        const info = await fetchVideoTitle(currentUrl);
        if (info.title && !currentTitle) {
          currentTitle = info.title;
        }
        if (info.channelTitle) {
          channelTitle = info.channelTitle;
        }
      }

      if (currentTitle) {
        const parsed = parseTrackAndArtist(currentTitle, channelTitle);
        const cleanTrackName = parsed.track || currentTitle;
        // Maintain history of clean track names and raw titles
        recentAutoplayHistoryRef.current = Array.from(
          new Set([
            cleanTrackName,
            currentTitle,
            ...recentAutoplayHistoryRef.current,
          ])
        ).slice(0, 20);
      }

      if (currentUrl) {
        // Maintain history of last 15 URLs
        recentAutoplayUrlHistoryRef.current = [
          currentUrl,
          ...recentAutoplayUrlHistoryRef.current.filter((u) => u !== currentUrl),
        ].slice(0, 15);
      }

      console.log('[TV Host] Autoplay active. Searching for track similar to title:', currentTitle, 'channel:', channelTitle);
      const nextTrack = await getAutoplayNextYouTubeTrack(
        currentTitle,
        channelTitle,
        recentAutoplayHistoryRef.current,
        currentUrl,
        recentAutoplayUrlHistoryRef.current
      );

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

  const handleAddUrlHost = async (urlInput: string, explicitTitle?: string): Promise<boolean> => {
    if (!urlInput.trim() || !roomCode) return false;

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

  const handleToggleCountdown = async () => {
    if (!roomCode) return;
    const nextCountdown = !roomStateRef.current?.isCountdownEnabled;
    await update(ref(database, `rooms/${roomCode}/state`), {
      isCountdownEnabled: nextCountdown,
    });
  };

  const handleAdjustVolume = async (newVol: number) => {
    const clamped = Math.min(100, Math.max(0, Math.round(newVol)));
    setRoomState((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        playback: {
          ...(prev.playback || { status: 'paused', progress: 0 }),
          volume: clamped,
        },
      };
    });
    if (roomCode) {
      const playbackRef = ref(database, `rooms/${roomCode}/state/playback`);
      await update(playbackRef, { volume: clamped, updatedAt: Date.now() });
    }
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
        showSettingsModal,
        setShowSettingsModal,
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
        handleToggleCountdown,
        handleAdjustVolume,
        copyRemoteLink,
        searchSettings,
        handleUpdateSearchSettings,
        handleManageLocalKeys,
        handleClearAllRateLimits,
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
