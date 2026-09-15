import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { User } from 'firebase/auth';
import { ref, update, remove, get } from 'firebase/database';
import { ensureAnonymousAuth, database } from '@/lib/firebase';
import {
  createRoomAtomic,
  checkRoomExists,
  RoomState,
  QueueItem,
  parseYouTubeVideoId,
  SearchSettings,
  removeUndefinedFields,
} from '@/lib/roomUtils';
import { fetchVideoTitle } from '@/lib/youtube';
import {
  addKey,
  deleteKey,
  updateKey,
  saveSearchConfig,
  getEffectiveSearchSettings,
} from '@/lib/apiKeyStore';
import { parseTrackAndArtist } from '@/lib/trackParser';
import { playNextQueueItem, removeQueueItem, addToQueue } from '@/handlers/queueHandler';
import { getAutoplayNextYouTubeTrack } from '@/handlers/autoplayHandler';
import { processMemberCommand, CommandHandlerContext } from '@/handlers/commandHandler';
import { processSearchRequest } from '@/handlers/searchProxyHandler';
import { useAutoplayHistory } from './hooks/useAutoplayHistory';
import { useRoomSubscriptions } from './hooks/useRoomSubscriptions';

const TV_SAVED_ROOM_KEY = 'mediabox_tv_room_code';

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
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
  const [creating, setCreating] = useState<boolean>(false);
  const [showQrModal, setShowQrModal] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [muted, setMuted] = useState<boolean>(false);

  // Search settings
  const [searchSettings, setSearchSettings] = useState<SearchSettings>(() => getEffectiveSearchSettings());
  const searchSettingsRef = useRef<SearchSettings>(searchSettings);
  useEffect(() => {
    searchSettingsRef.current = searchSettings;
  }, [searchSettings]);

  // Autoplay history management
  const {
    historyRef,
    urlHistoryRef,
    artistHistoryRef,
    pushTrack,
    pushUrl,
    pushArtist,
    clearHistory,
  } = useAutoplayHistory();

  // Execution tracking & cooldowns
  const processingRequestsRef = useRef<Set<string>>(new Set());
  const processingCommandsRef = useRef<Set<string>>(new Set());
  const lastFullscreenToggleRef = useRef<number>(0);
  const volumeDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isTransitioningRef = useRef<boolean>(false);

  // Auto-close QR code popup after 30 seconds
  useEffect(() => {
    if (showQrModal) {
      const timer = setTimeout(() => setShowQrModal(false), 30000);
      return () => clearTimeout(timer);
    }
  }, [showQrModal]);

  // Clean up debounce timer on unmount
  useEffect(() => {
    return () => {
      if (volumeDebounceTimerRef.current) {
        clearTimeout(volumeDebounceTimerRef.current);
      }
    };
  }, []);

  // Authenticate anonymously on mount and recover saved room
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

  const syncSearchSettingsToFirebase = useCallback(async () => {
    const effective = getEffectiveSearchSettings();
    setSearchSettings(effective);
    searchSettingsRef.current = effective;
    if (roomCode) {
      const updatePayload: Record<string, any> = { ...effective };
      if (!effective.proxyUrl) {
        updatePayload.proxyUrl = null;
      }
      await update(
        ref(database, `rooms/${roomCode}/state/searchSettings`),
        removeUndefinedFields(updatePayload)
      );
    }
  }, [roomCode]);

  const handleUpdateSearchSettings = useCallback(async (patch: Partial<SearchSettings>) => {
    saveSearchConfig(patch);
    await syncSearchSettingsToFirebase();
  }, [syncSearchSettingsToFirebase]);

  const handleManageLocalKeys = useCallback(async (action: 'add' | 'delete' | 'update', data: any) => {
    if (action === 'add' && data?.key) {
      addKey(data.key, data.label || '');
    } else if (action === 'delete' && data?.id) {
      deleteKey(data.id);
    } else if (action === 'update' && data?.id) {
      updateKey(data.id, data.patch);
    }
    await syncSearchSettingsToFirebase();
  }, [syncSearchSettingsToFirebase]);

  const handleClearAllRateLimits = useCallback(async () => {
    if (roomCode) {
      await remove(ref(database, `rooms/${roomCode}/searchRateLimits`));
    }
  }, [roomCode]);

  // Resolves the next song to play, prioritizing the member queue above autoplay recommendations
  const handlePlayNextInQueue = useCallback(async () => {
    if (!roomCode || isTransitioningRef.current) return;
    isTransitioningRef.current = true;

    try {
      // 1. Check queue first
      const currentQueue = queueRefState.current;
      if (currentQueue && currentQueue.length > 0) {
        const nextItem = currentQueue[0];
        if (nextItem.title) {
          const parsed = parseTrackAndArtist(nextItem.title, '');
          if (parsed.artist) {
            pushArtist(parsed.artist);
          }
        }
        await playNextQueueItem(roomCode, nextItem);
        return;
      }

      // 2. Queue empty: check if Autoplay is enabled
      if (roomStateRef.current?.isAutoplay) {
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

        // Race-condition guard: Did a member queue a song while resolving title?
        if (queueRefState.current && queueRefState.current.length > 0) {
          console.log('[TV Host] Queue item arrived during title resolution. Prioritizing queue.');
          const nextItem = queueRefState.current[0];
          if (nextItem.title) {
            const parsed = parseTrackAndArtist(nextItem.title, '');
            if (parsed.artist) {
              pushArtist(parsed.artist);
            }
          }
          await playNextQueueItem(roomCode, nextItem);
          return;
        }

        if (currentTitle) {
          pushTrack(currentTitle, channelTitle);
        }

        if (currentUrl) {
          pushUrl(currentUrl);
        }

        const preferMusicVideos = roomStateRef.current?.searchSettings?.preferMusicVideos ?? true;

        console.log(
          '[TV Host] Autoplay active. Searching for track similar to title:',
          currentTitle,
          'channel:',
          channelTitle,
          'preferMusicVideos:',
          preferMusicVideos
        );

        const nextTrack = await getAutoplayNextYouTubeTrack(
          currentTitle,
          channelTitle,
          historyRef.current,
          currentUrl,
          urlHistoryRef.current,
          preferMusicVideos,
          artistHistoryRef.current
        );

        // Race-condition guard: Queue ALWAYS wins over autoplay recommendations!
        if (queueRefState.current && queueRefState.current.length > 0) {
          console.log('[TV Host] Queue item arrived during autoplay search. Prioritizing queue over autoplay recommendation.');
          const nextItem = queueRefState.current[0];
          if (nextItem.title) {
            const parsed = parseTrackAndArtist(nextItem.title, '');
            if (parsed.artist) {
              pushArtist(parsed.artist);
            }
          }
          await playNextQueueItem(roomCode, nextItem);
          return;
        }

        if (nextTrack) {
          console.log('[TV Host] Autoplay next track resolved:', nextTrack.title, nextTrack.url, 'artist:', nextTrack.artist);
          const resolvedArtist = nextTrack.artist || parseTrackAndArtist(nextTrack.title, '').artist;
          if (resolvedArtist) {
            pushArtist(resolvedArtist);
          }
          await update(ref(database, `rooms/${roomCode}`), {
            'state/currentlyPlaying': nextTrack.url,
            'state/currentlyPlayingTitle': nextTrack.title,
            'state/playback/status': 'playing',
            'state/playback/updatedAt': Date.now(),
          });
        } else {
          // Double check queue before clearing and pausing
          if (queueRefState.current && queueRefState.current.length > 0) {
            console.log('[TV Host] Queue item arrived before clear-and-pause. Playing queue.');
            const nextItem = queueRefState.current[0];
            if (nextItem.title) {
              const parsed = parseTrackAndArtist(nextItem.title, '');
              if (parsed.artist) {
                pushArtist(parsed.artist);
              }
            }
            await playNextQueueItem(roomCode, nextItem);
            return;
          }

          console.warn('[TV Host] Autoplay found no similar tracks or YouTube results.');
          await update(ref(database, `rooms/${roomCode}`), {
            'state/currentlyPlaying': '',
            'state/currentlyPlayingTitle': '',
            'state/playback/status': 'paused',
            'state/playback/updatedAt': Date.now(),
          });
        }
      } else {
        await update(ref(database, `rooms/${roomCode}`), {
          'state/currentlyPlaying': '',
          'state/currentlyPlayingTitle': '',
          'state/playback/status': 'paused',
          'state/playback/updatedAt': Date.now(),
        });
      }
    } finally {
      setTimeout(() => {
        isTransitioningRef.current = false;
      }, 500);
    }
  }, [roomCode, pushArtist, pushTrack, pushUrl, historyRef, urlHistoryRef, artistHistoryRef]);


  // Dispatchers for remote member commands and search requests
  const onMemberCommand = useCallback(
    (memberUid: string, command: any) => {
      if (!roomCode) return;

      const ctx: CommandHandlerContext = {
        roomCode,
        roomState: roomStateRef.current,
        queue: queueRefState.current,
        hostUid: hostUidRef.current,
        tvOwnerUid: user?.uid || null,
        admins: adminsListRef.current,
        searchSettings: searchSettingsRef.current,
        lastFullscreenToggleTime: lastFullscreenToggleRef.current,
        setLastFullscreenToggleTime: (time: number) => {
          lastFullscreenToggleRef.current = time;
        },
        onPlayNextInQueue: handlePlayNextInQueue,
        onUpdateSearchSettings: handleUpdateSearchSettings,
        onClearAllRateLimits: handleClearAllRateLimits,
        onProcessSearchRequest: (reqId, req) => {
          if (!roomCode) return;
          processSearchRequest(
            reqId,
            req,
            roomCode,
            searchSettingsRef.current,
            processingRequestsRef.current,
            syncSearchSettingsToFirebase
          );
        },
      };

      processMemberCommand(memberUid, command, ctx, processingCommandsRef.current);
    },
    [roomCode, user?.uid, handlePlayNextInQueue, handleUpdateSearchSettings, handleClearAllRateLimits, syncSearchSettingsToFirebase]
  );

  const onSearchRequest = useCallback(
    (reqId: string, req: any) => {
      if (!roomCode) return;
      processSearchRequest(
        reqId,
        req,
        roomCode,
        searchSettingsRef.current,
        processingRequestsRef.current,
        syncSearchSettingsToFirebase
      );
    },
    [roomCode, syncSearchSettingsToFirebase]
  );

  // Hook for Firebase subscriptions
  const {
    roomState,
    setRoomState,
    queue,
    setQueue,
    memberCount,
    hostUidRef,
    adminsListRef,
    roomStateRef,
    queueRefState,
  } = useRoomSubscriptions({
    roomCode,
    userUid: user?.uid,
    onSearchSettingsChanged: (settings) => setSearchSettings(settings),
    onMemberCommand,
    onSearchRequest,
  });

  // Active queue watcher: if player is idle and queue has items, automatically start playing
  useEffect(() => {
    if (
      roomCode &&
      !roomState?.currentlyPlaying &&
      queue.length > 0 &&
      !isTransitioningRef.current
    ) {
      handlePlayNextInQueue();
    }
  }, [roomCode, roomState?.currentlyPlaying, queue.length, handlePlayNextInQueue]);

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
      clearHistory();
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
    await removeQueueItem(roomCode, itemId);
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

    const isActivelyPlaying =
      Boolean(roomState?.currentlyPlaying) && roomState?.playback?.status === 'playing';

    await addToQueue(
      roomCode,
      videoUrl,
      videoTitle,
      user?.uid || 'host',
      isActivelyPlaying
    );
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

    if (!roomCode) return;

    if (volumeDebounceTimerRef.current) {
      clearTimeout(volumeDebounceTimerRef.current);
    }
    volumeDebounceTimerRef.current = setTimeout(() => {
      const playbackRef = ref(database, `rooms/${roomCode}/state/playback`);
      update(playbackRef, { volume: clamped, updatedAt: Date.now() }).catch((err) =>
        console.warn('[TV Host] Debounced volume update failed:', err)
      );
    }, 150);
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
