import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { User } from 'firebase/auth';
import { ref, update, remove, get } from 'firebase/database';
import { database } from '@/lib/firebase';
import { getServerTime } from '@/lib/serverTime';
import {
  ensureDeviceAuth,
  getStoredTvRoomCode,
  saveStoredTvRoomCode,
} from '@/lib/deviceAuth';
import {
  createRoomAtomic,
  RoomState,
  QueueItem,
  SearchResultItem,
  parseYouTubeVideoId,
  SearchSettings,
  removeUndefinedFields,
} from '@/lib/roomUtils';
import { fetchVideoTitle } from '@/lib/youtube';
import { saveSearchConfig, getEffectiveSearchSettings } from '@/lib/apiKeyStore';
import { removeQueueItem, addToQueue } from '@/handlers/queueHandler';
import { processMemberCommand, CommandHandlerContext } from '@/handlers/commandHandler';
import { processSearchRequest } from '@/handlers/searchProxyHandler';
import { transitionToNextPlayback, transitionToPreviousPlayback } from '@/handlers/playbackHandler';
import { fetchAndFilterRadioQueue } from '@/handlers/autoplayHandler';
import {
  togglePlayPause,
  toggleFullscreen,
  toggleRoomLock,
  toggleAutoplay,
  toggleCountdown,
  setLyricsOffset,
  setLyricsWordSync,
} from '@/handlers/roomActions';
import { useAutoplayHistory } from './hooks/useAutoplayHistory';
import { useRoomSubscriptions } from './hooks/useRoomSubscriptions';
import { useDebouncedVolume } from '@/hooks/useDebouncedVolume';

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
  handlePlayPreviousTrack: () => Promise<boolean>;
  canGoPrevious: boolean;
  handleRemoveQueueItem: (itemId: string) => Promise<void>;
  showSettingsModal: boolean;
  setShowSettingsModal: (show: boolean) => void;
  handleAddUrlHost: (url: string, explicitTitle?: string) => Promise<boolean>;
  handleToggleFullscreen: () => Promise<void>;
  handleToggleRoomLock: () => Promise<void>;
  handleToggleAutoplay: () => Promise<void>;
  handleToggleCountdown: () => Promise<void>;
  handleSetLyricsOffset: (offsetMs: number) => Promise<void>;
  handleSetLyricsWordSync: (enabled: boolean) => Promise<void>;
  handleAdjustVolume: (volume: number) => Promise<void>;
  copyRemoteLink: () => void;
  handleUpdateSearchSettings: (patch: Partial<SearchSettings>) => Promise<void>;
  handleClearAllRateLimits: () => Promise<void>;
  handleStartRadioFromCurrent: () => Promise<void>;
  registerPlayerInstance?: (instance: any) => void;
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
    playedTracksRef,
    pushTrack,
    pushUrl,
    pushArtist,
    pushPlayedTrack,
    popPreviousTrack,
    clearHistory,
  } = useAutoplayHistory();

  const radioQueueRef = useRef<SearchResultItem[]>([]);
  const lastPreviousClickRef = useRef<number>(0);

  // Execution tracking & cooldowns
  const processingRequestsRef = useRef<Set<string>>(new Set());
  const processingCommandsRef = useRef<Set<string>>(new Set());
  const lastFullscreenToggleRef = useRef<number>(0);
  const isTransitioningRef = useRef<boolean>(false);
  const playerInstanceRef = useRef<any>(null);

  const registerPlayerInstance = useCallback((instance: any) => {
    playerInstanceRef.current = instance;
  }, []);

  // Auto-close QR code popup after 30 seconds
  useEffect(() => {
    if (showQrModal) {
      const timer = setTimeout(() => setShowQrModal(false), 30000);
      return () => clearTimeout(timer);
    }
  }, [showQrModal]);

  // Authenticate with persistent device credentials on mount and restore room session if active
  useEffect(() => {
    let isCancelled = false;

    ensureDeviceAuth()
      .then(async (u) => {
        if (isCancelled) return;
        setUser(u);

        // Attempt to restore persistent TV room code
        const savedCode = getStoredTvRoomCode();
        if (savedCode) {
          try {
            const roomSnap = await get(ref(database, `rooms/${savedCode}/tv`));
            if (roomSnap.exists()) {
              const tvData = roomSnap.val();
              // Verify room ownership matches this device's persistent UID
              if (tvData?.uid === u.uid) {
                console.log(`[WatchPartyContext] Reconnected to persistent TV room: ${savedCode}`);
                if (!isCancelled) {
                  setRoomCode(savedCode);
                }
                return;
              }
            }
            // Room no longer exists or belongs to another TV/device: clear invalid code
            saveStoredTvRoomCode(null);
          } catch (err) {
            console.warn('[WatchPartyContext] Failed to restore saved TV room:', err);
            saveStoredTvRoomCode(null);
          }
        }
      })
      .catch((err) => console.error('Auth error in WatchPartyContext:', err));

    return () => {
      isCancelled = true;
    };
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
      await transitionToNextPlayback({
        roomCode,
        getQueue: () => queueRefState.current,
        getRoomState: () => roomStateRef.current,
        getRadioQueue: () => radioQueueRef.current,
        setRadioQueue: (items) => {
          radioQueueRef.current = items;
        },
        history: historyRef.current,
        urlHistory: urlHistoryRef.current,
        artistHistory: artistHistoryRef.current,
        pushTrack,
        pushUrl,
        pushArtist,
        pushPlayedTrack,
        popPreviousTrack,
      });
    } catch (err) {
      console.error('[WatchParty] Error transitioning to next track:', err);
    } finally {
      setTimeout(() => {
        isTransitioningRef.current = false;
      }, 500);
    }
  }, [roomCode, pushArtist, pushTrack, pushUrl, pushPlayedTrack, popPreviousTrack, historyRef, urlHistoryRef, artistHistoryRef]);

  // Resolves previous song playback or restarts current track from 0
  const handlePlayPreviousTrack = useCallback(async (): Promise<boolean> => {
    if (!roomCode || isTransitioningRef.current) return false;

    const now = Date.now();
    const playbackUpdatedAt = roomStateRef.current?.playback?.updatedAt || 0;
    const timeSinceStart = now - playbackUpdatedAt;
    const timeSinceLastClick = now - lastPreviousClickRef.current;
    lastPreviousClickRef.current = now;

    // If track has played for > 3s and this is a single click, restart track from 0:00
    if (timeSinceStart > 3000 && timeSinceLastClick > 1500) {
      await update(ref(database, `rooms/${roomCode}/state/playback`), {
        positionMs: 0,
        status: 'playing',
        updatedAt: now,
      });
      return true;
    }

    isTransitioningRef.current = true;
    try {
      const transitioned = await transitionToPreviousPlayback({
        roomCode,
        getQueue: () => queueRefState.current,
        getRoomState: () => roomStateRef.current,
        getRadioQueue: () => radioQueueRef.current,
        setRadioQueue: (items) => {
          radioQueueRef.current = items;
        },
        history: historyRef.current,
        urlHistory: urlHistoryRef.current,
        artistHistory: artistHistoryRef.current,
        pushTrack,
        pushUrl,
        pushArtist,
        pushPlayedTrack,
        popPreviousTrack,
      });

      if (!transitioned) {
        // Fallback: restart current track from beginning
        await update(ref(database, `rooms/${roomCode}/state/playback`), {
          positionMs: 0,
          status: 'playing',
          updatedAt: now,
        });
      }
      return true;
    } catch (err) {
      console.error('[WatchParty] Error transitioning to previous track:', err);
      return false;
    } finally {
      setTimeout(() => {
        isTransitioningRef.current = false;
      }, 500);
    }
  }, [roomCode, pushArtist, pushTrack, pushUrl, pushPlayedTrack, popPreviousTrack]);

  // Starts a fresh YTM radio queue seeded by currently playing YouTube track
  const handleStartRadioFromCurrent = useCallback(async () => {
    if (!roomCode) return;
    const currentUrl = roomStateRef.current?.currentlyPlaying;
    const seedVideoId = currentUrl ? parseYouTubeVideoId(currentUrl) : null;
    if (!seedVideoId) {
      console.warn('[WatchParty] Cannot start radio: No currently playing YouTube video.');
      return;
    }

    try {
      console.log(`[WatchParty] Starting fresh YTM Radio queue from seed: ${seedVideoId}`);
      const preferMusicVideos = roomStateRef.current?.searchSettings?.preferMusicVideos ?? true;
      const excludedVideoIds = new Set<string>([seedVideoId]);
      for (const u of urlHistoryRef.current) {
        const vId = parseYouTubeVideoId(u);
        if (vId) excludedVideoIds.add(vId);
      }

      const freshTracks = await fetchAndFilterRadioQueue(
        seedVideoId,
        excludedVideoIds,
        historyRef.current,
        artistHistoryRef.current,
        preferMusicVideos
      );

      radioQueueRef.current = freshTracks;
      await update(ref(database, `rooms/${roomCode}`), {
        radioQueue: removeUndefinedFields(freshTracks),
        'state/isAutoplay': true,
        updatedAt: Date.now(),
      });
      console.log(`[WatchParty] Fresh YTM Radio queue loaded (${freshTracks.length} tracks).`);
    } catch (err) {
      console.error('[WatchParty] Failed to start fresh radio from current track:', err);
    }
  }, [roomCode, urlHistoryRef, historyRef, artistHistoryRef]);

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
        onPlayPreviousTrack: handlePlayPreviousTrack,
        onUpdateSearchSettings: handleUpdateSearchSettings,
        onClearAllRateLimits: handleClearAllRateLimits,
        onStartRadioFromCurrent: handleStartRadioFromCurrent,
        onSeek: async (positionMs: number) => {
          if (playerInstanceRef.current && typeof playerInstanceRef.current.seekTo === 'function') {
            try {
              playerInstanceRef.current.seekTo(positionMs / 1000, true);
            } catch (err) {
              console.warn('[WatchParty] onSeek playerInstance error:', err);
            }
          }
          if (roomCode) {
            await update(ref(database, `rooms/${roomCode}/state/playback`), {
              positionMs,
              updatedAt: getServerTime(),
            });
          }
        },
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
    [roomCode, user?.uid, handlePlayNextInQueue, handlePlayPreviousTrack, handleUpdateSearchSettings, handleClearAllRateLimits, syncSearchSettingsToFirebase]
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

  // Debounced volume adjustment
  const { handleAdjustVolume } = useDebouncedVolume(roomCode, setRoomState);

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
      const u = user || (await ensureDeviceAuth());
      setUser(u);

      const effectiveSettings = getEffectiveSearchSettings();
      setSearchSettings(effectiveSettings);
      searchSettingsRef.current = effectiveSettings;

      const code = await createRoomAtomic(u.uid, effectiveSettings);
      setRoomCode(code);
      saveStoredTvRoomCode(code);
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
      saveStoredTvRoomCode(null);
      setRoomCode(null);
      setRoomState(null);
      setQueue([]);
      radioQueueRef.current = [];
      setShowQrModal(false);
      clearHistory();
    }
  };

  const handleTogglePlayPause = async () => {
    if (!roomCode || !roomState) return;
    await togglePlayPause(roomCode, roomState.playback?.status);
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
    ? `${window.location.origin}/join?room=${roomCode}`
    : `${window.location.origin}/join`;

  const copyRemoteLink = () => {
    navigator.clipboard.writeText(remoteUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleToggleFullscreen = async () => {
    if (!roomCode) return;
    await toggleFullscreen(roomCode, Boolean(roomStateRef.current?.isFullscreen), lastFullscreenToggleRef);
  };

  const handleToggleRoomLock = async () => {
    if (!roomCode || !roomStateRef.current) return;
    await toggleRoomLock(roomCode, Boolean(roomStateRef.current.isLocked));
  };

  const handleToggleAutoplay = async () => {
    if (!roomCode) return;
    await toggleAutoplay(roomCode, Boolean(roomStateRef.current?.isAutoplay));
  };

  const handleToggleCountdown = async () => {
    if (!roomCode) return;
    await toggleCountdown(roomCode, Boolean(roomStateRef.current?.isCountdownEnabled));
  };

  const handleSetLyricsOffset = async (offsetMs: number) => {
    if (!roomCode) return;
    await setLyricsOffset(roomCode, offsetMs);
  };

  const handleSetLyricsWordSync = async (enabled: boolean) => {
    if (!roomCode) return;
    await setLyricsWordSync(roomCode, enabled);
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
        handlePlayPreviousTrack,
        canGoPrevious: playedTracksRef.current.length > 0,
        handleRemoveQueueItem,
        handleAddUrlHost,
        handleToggleFullscreen,
        handleToggleRoomLock,
        handleToggleAutoplay,
        handleToggleCountdown,
        handleSetLyricsOffset,
        handleSetLyricsWordSync,
        handleAdjustVolume,
        copyRemoteLink,
        searchSettings,
        handleUpdateSearchSettings,
        handleClearAllRateLimits,
        handleStartRadioFromCurrent,
        registerPlayerInstance,
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
