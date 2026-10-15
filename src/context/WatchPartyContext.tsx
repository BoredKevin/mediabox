import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { User } from 'firebase/auth';
import { ref, update, remove } from 'firebase/database';
import { ensureAnonymousAuth, database } from '@/lib/firebase';
import {
  createRoomAtomic,
  RoomState,
  QueueItem,
  parseYouTubeVideoId,
  SearchSettings,
  removeUndefinedFields,
} from '@/lib/roomUtils';
import { fetchVideoTitle } from '@/lib/youtube';
import { saveSearchConfig, getEffectiveSearchSettings } from '@/lib/apiKeyStore';
import { removeQueueItem, addToQueue } from '@/handlers/queueHandler';
import { processMemberCommand, CommandHandlerContext } from '@/handlers/commandHandler';
import { processSearchRequest } from '@/handlers/searchProxyHandler';
import { transitionToNextPlayback } from '@/handlers/playbackHandler';
import {
  togglePlayPause,
  toggleFullscreen,
  toggleRoomLock,
  toggleAutoplay,
  toggleCountdown,
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
  const isTransitioningRef = useRef<boolean>(false);

  // Auto-close QR code popup after 30 seconds
  useEffect(() => {
    if (showQrModal) {
      const timer = setTimeout(() => setShowQrModal(false), 30000);
      return () => clearTimeout(timer);
    }
  }, [showQrModal]);

  // Authenticate anonymously on mount.
  // Room ID persistence is completely disabled to prevent security rule and auth mismatch issues.
  useEffect(() => {
    try {
      localStorage.removeItem('mediabox_tv_room_code');
    } catch {
      // Ignore storage errors in restricted contexts
    }

    ensureAnonymousAuth()
      .then((u) => setUser(u))
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
        history: historyRef.current,
        urlHistory: urlHistoryRef.current,
        artistHistory: artistHistoryRef.current,
        pushTrack,
        pushUrl,
        pushArtist,
      });
    } catch (err) {
      console.error('[WatchParty] Error transitioning to next track:', err);
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
      const u = user || (await ensureAnonymousAuth());
      setUser(u);

      const effectiveSettings = getEffectiveSearchSettings();
      setSearchSettings(effectiveSettings);
      searchSettingsRef.current = effectiveSettings;

      const code = await createRoomAtomic(u.uid, effectiveSettings);
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
