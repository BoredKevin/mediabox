import React, { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { User } from 'firebase/auth';
import { useQuery, useMutation, useAction } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import { useSafePresence } from '@/hooks/useSafePresence';
import {
  ensureDeviceAuth,
  getOrCreateDeviceCredentials,
  getStoredTvRoomCode,
  saveStoredTvRoomCode,
} from '@/lib/deviceAuth';
import {
  RoomState,
  QueueItem,
  SearchResultItem,
  parseYouTubeVideoId,
  SearchSettings,
} from '@/lib/roomUtils';
import { fetchVideoTitle } from '@/lib/youtube';
import { saveSearchConfig, getEffectiveSearchSettings } from '@/lib/apiKeyStore';
import {
  getSavedLyricsOffset,
  getSavedLyricsWordSync,
  saveLyricsOffset,
  saveLyricsWordSync,
} from '@/lib/lyricsOffsetStore';
import { loadApiToken } from '@/lib/apiTokenStore';

interface WatchPartyContextType {
  user: User | null;
  roomCode: string | null;
  roomId: Id<'rooms'> | null;
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
  handleSyncPlaybackCheckpoint?: (positionMs: number, durationMs?: number) => Promise<void>;
}

const WatchPartyContext = createContext<WatchPartyContextType | undefined>(undefined);

export const WatchPartyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const creds = useMemo(() => getOrCreateDeviceCredentials(), []);
  const [user, setUser] = useState<User | null>(() => {
    const c = getOrCreateDeviceCredentials();
    return {
      uid: c.uuid,
      email: `dev_${c.uuid.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()}@mediabox.tv`,
      displayName: 'TV Host',
    } as any;
  });
  const [roomCode, setRoomCode] = useState<string | null>(() => getStoredTvRoomCode());
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
  const [creating, setCreating] = useState<boolean>(false);
  const [showQrModal, setShowQrModal] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [muted, setMuted] = useState<boolean>(false);

  // Search settings
  const [searchSettings, setSearchSettings] = useState<SearchSettings>(() => getEffectiveSearchSettings());

  // Track transitions to prevent double-skips
  const isTransitioningRef = useRef<boolean>(false);
  const playerInstanceRef = useRef<any>(null);

  const registerPlayerInstance = useCallback((instance: any) => {
    playerInstanceRef.current = instance;
  }, []);

  // Background non-blocking device auth
  useEffect(() => {
    let isCancelled = false;
    ensureDeviceAuth()
      .then((u) => {
        if (!isCancelled && u) setUser(u);
      })
      .catch((err) => console.warn('[WatchPartyContext] Optional background auth notice:', err));
    return () => {
      isCancelled = true;
    };
  }, []);

  // Auto-close QR code modal after 30 seconds
  useEffect(() => {
    if (showQrModal) {
      const timer = setTimeout(() => setShowQrModal(false), 30000);
      return () => clearTimeout(timer);
    }
  }, [showQrModal]);

  // Convex Subscriptions
  const room = useQuery(api.rooms.getRoom, roomCode ? { code: roomCode } : 'skip');
  const rawQueue = useQuery(
    api.queue.getQueue,
    room?._id ? { roomId: room._id } : 'skip'
  );

  // Track newly created room to prevent query lag from clearing it
  const createdRoomCodeRef = useRef<string | null>(null);

  // Clear stale room code if query returns null (session ended or invalid code)
  useEffect(() => {
    if (roomCode && room) {
      if (createdRoomCodeRef.current === roomCode) {
        createdRoomCodeRef.current = null;
      }
    } else if (roomCode && room === null) {
      if (createdRoomCodeRef.current === roomCode) {
        // Query has not propagated yet for the room we just created; ignore
        return;
      }
      console.log(`[WatchPartyContext] Room ${roomCode} no longer exists. Clearing saved session.`);
      saveStoredTvRoomCode(null);
      setRoomCode(null);
    }
  }, [roomCode, room]);

  // TV Presence via resilient safe presence hook
  const tvUserId = room?.tvUid || creds.uuid;
  const presenceList = useSafePresence(
    roomCode,
    tvUserId,
    10000
  );

  const memberCount = useMemo(() => {
    if (!roomCode) return 0;
    if (!presenceList || presenceList.length === 0) return 1;
    return Math.max(1, presenceList.length);
  }, [roomCode, presenceList]);

  // Convex Mutations & Actions
  const createRoomMutation = useMutation(api.rooms.create);
  const endRoomMutation = useMutation(api.rooms.endRoom);
  const togglePlayPauseMutation = useMutation(api.playback.togglePlayPause);
  const nextTrackMutation = useMutation(api.playback.nextTrack);
  const previousTrackMutation = useMutation(api.playback.previousTrack);
  const syncPositionCheckpointMutation = useMutation(api.playback.syncPositionCheckpoint);
  const setVolumeMutation = useMutation(api.playback.setVolume);
  const addQueueMutation = useMutation(api.queue.add);
  const removeQueueMutation = useMutation(api.queue.remove);
  const toggleFullscreenMutation = useMutation(api.rooms.toggleFullscreen);
  const toggleLockMutation = useMutation(api.rooms.toggleLock);
  const toggleAutoplayMutation = useMutation(api.rooms.toggleAutoplay);
  const toggleCountdownMutation = useMutation(api.rooms.toggleCountdown);
  const updateSettingsMutation = useMutation(api.rooms.updateSettings);
  const fetchAndPlayNextRadioAction = useAction(api.youtube.fetchAndPlayNextRadio);

  // Map Convex room to RoomState
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
      searchSettings: {
        maxResults: searchSettings.maxResults,
        rateLimitCount: searchSettings.rateLimitCount,
        rateLimitWindowMs: searchSettings.rateLimitWindowMs,
        preferMusicVideos: room.preferMusicVideos,
      },
    };
  }, [room, searchSettings]);

  // Map Convex queue to QueueItem[]
  const queue: QueueItem[] = useMemo(() => {
    if (!rawQueue) return [];
    return rawQueue.map((item: any) => ({
      id: item._id,
      url: item.url,
      title: item.title,
      addedBy: item.addedBy,
      addedAt: item.createdAt,
    }));
  }, [rawQueue]);

  // Auto-play next track if player is idle and queue has pending songs
  useEffect(() => {
    if (
      room?._id &&
      !room.currentlyPlaying &&
      rawQueue &&
      rawQueue.length > 0 &&
      !isTransitioningRef.current
    ) {
      isTransitioningRef.current = true;
      nextTrackMutation({ roomId: room._id })
        .catch((e) => console.error('[WatchParty] Auto-play next error:', e))
        .finally(() => {
          setTimeout(() => {
            isTransitioningRef.current = false;
          }, 500);
        });
    }
  }, [room?._id, room?.currentlyPlaying, rawQueue, nextTrackMutation]);

  const handleCreateRoom = useCallback(async () => {
    setCreating(true);
    try {
      const deviceCreds = getOrCreateDeviceCredentials();
      const hostId = deviceCreds.uuid;

      const effectiveSettings = getEffectiveSearchSettings();
      setSearchSettings(effectiveSettings);

      const result = await createRoomMutation({
        hostUid: hostId,
        tvUid: hostId,
        tvUuid: deviceCreds.uuid,
        preferMusicVideos: effectiveSettings.preferMusicVideos,
        lyricsOffsetMs: getSavedLyricsOffset(),
        lyricsWordSync: getSavedLyricsWordSync(),
      });

      createdRoomCodeRef.current = result.code;
      setRoomCode(result.code);
      saveStoredTvRoomCode(result.code);
    } catch (err: any) {
      console.error('[WatchParty] Error creating room in Convex:', err);
      alert('Failed to create Watch Together room: ' + err.message);
    } finally {
      setCreating(false);
    }
  }, [user?.uid, createRoomMutation]);

  const handleEndRoom = useCallback(async () => {
    if (!room?._id) return;
    if (confirm('Are you sure you want to end this Watch Together session?')) {
      const callerId = user?.uid || creds.uuid;
      await endRoomMutation({ roomId: room._id, callerUid: callerId });
      saveStoredTvRoomCode(null);
      setRoomCode(null);
      setShowQrModal(false);
    }
  }, [room?._id, user?.uid, creds.uuid, endRoomMutation]);

  const handleTogglePlayPause = useCallback(async () => {
    if (!room?._id) return;
    let posMs: number | undefined;
    if (playerInstanceRef.current && typeof playerInstanceRef.current.getCurrentTime === 'function') {
      try {
        posMs = Math.max(0, Math.round(playerInstanceRef.current.getCurrentTime() * 1000));
      } catch (_) {}
    }
    await togglePlayPauseMutation({
      roomId: room._id,
      positionMs: posMs,
    });
  }, [room?._id, togglePlayPauseMutation]);

  const handlePlayNextInQueue = useCallback(async () => {
    if (!room?._id || isTransitioningRef.current) return;
    isTransitioningRef.current = true;
    try {
      await nextTrackMutation({ roomId: room._id });
    } catch (err) {
      console.error('[WatchParty] Error transitioning to next track:', err);
    } finally {
      setTimeout(() => {
        isTransitioningRef.current = false;
      }, 500);
    }
  }, [room?._id, nextTrackMutation]);

  const handlePlayPreviousTrack = useCallback(async (): Promise<boolean> => {
    if (!room?._id || isTransitioningRef.current) return false;
    isTransitioningRef.current = true;
    try {
      await previousTrackMutation({ roomId: room._id });
      return true;
    } catch (err) {
      console.error('[WatchParty] Error transitioning to previous track:', err);
      return false;
    } finally {
      setTimeout(() => {
        isTransitioningRef.current = false;
      }, 500);
    }
  }, [room?._id, previousTrackMutation]);

  const handleRemoveQueueItem = useCallback(
    async (itemId: string) => {
      if (!room?._id) return;
      const callerId = room?.tvUid || creds.uuid;
      await removeQueueMutation({
        queueId: itemId as Id<'queue'>,
        callerUid: callerId,
      });
    },
    [room?._id, room?.tvUid, user?.uid, creds.uuid, removeQueueMutation]
  );

  const handleAddUrlHost = useCallback(
    async (urlInput: string, explicitTitle?: string): Promise<boolean> => {
      if (!urlInput.trim() || !room?._id) return false;

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

      const callerId = room?.tvUid || creds.uuid;
      await addQueueMutation({
        roomId: room._id,
        url: videoUrl,
        title: videoTitle,
        addedBy: callerId,
        addedByName: 'TV Host',
      });
      return true;
    },
    [room?._id, room?.tvUid, user?.uid, creds.uuid, addQueueMutation]
  );

  const handleToggleFullscreen = useCallback(async () => {
    if (!room?._id) return;
    await toggleFullscreenMutation({ roomId: room._id });
  }, [room?._id, toggleFullscreenMutation]);

  const handleToggleRoomLock = useCallback(async () => {
    if (!room?._id) return;
    const callerId = room?.tvUid || creds.uuid;
    await toggleLockMutation({ roomId: room._id, callerUid: callerId });
  }, [room?._id, room?.tvUid, user?.uid, creds.uuid, toggleLockMutation]);

  const handleToggleAutoplay = useCallback(async () => {
    if (!room?._id) return;
    const callerId = room?.tvUid || creds.uuid;
    await toggleAutoplayMutation({ roomId: room._id, callerUid: callerId });
  }, [room?._id, room?.tvUid, user?.uid, creds.uuid, toggleAutoplayMutation]);

  const handleToggleCountdown = useCallback(async () => {
    if (!room?._id) return;
    const callerId = room?.tvUid || creds.uuid;
    await toggleCountdownMutation({ roomId: room._id, callerUid: callerId });
  }, [room?._id, room?.tvUid, user?.uid, creds.uuid, toggleCountdownMutation]);

  const handleSetLyricsOffset = useCallback(
    async (offsetMs: number) => {
      const clamped = Math.min(5000, Math.max(-5000, Math.round(offsetMs)));
      saveLyricsOffset(clamped);
      if (!room?._id) return;
      const callerId = room?.tvUid || creds.uuid;
      await updateSettingsMutation({
        roomId: room._id,
        callerUid: callerId,
        settings: { lyricsOffsetMs: clamped },
      });
    },
    [room?._id, room?.tvUid, user?.uid, creds.uuid, updateSettingsMutation]
  );

  const handleSetLyricsWordSync = useCallback(
    async (enabled: boolean) => {
      saveLyricsWordSync(enabled);
      if (!room?._id) return;
      const callerId = room?.tvUid || creds.uuid;
      await updateSettingsMutation({
        roomId: room._id,
        callerUid: callerId,
        settings: { lyricsWordSync: enabled },
      });
    },
    [room?._id, room?.tvUid, user?.uid, creds.uuid, updateSettingsMutation]
  );

  const handleAdjustVolume = useCallback(
    async (volume: number) => {
      if (!room?._id) return;
      await setVolumeMutation({ roomId: room._id, volume });
    },
    [room?._id, setVolumeMutation]
  );

  const handleSyncPlaybackCheckpoint = useCallback(
    async (positionMs: number, durationMs?: number) => {
      if (!room?._id) return;
      try {
        await syncPositionCheckpointMutation({
          roomId: room._id,
          positionMs,
          durationMs,
        });
      } catch (e) {
        // Ignore background transient network errors
      }
    },
    [room?._id, syncPositionCheckpointMutation]
  );

  const handleStartRadioFromCurrent = useCallback(async () => {
    if (!room?._id) return;
    try {
      const apiToken = loadApiToken();
      await fetchAndPlayNextRadioAction({
        roomId: room._id,
        apiToken: apiToken || undefined,
      });
    } catch (err) {
      console.error('[WatchParty] Failed to start radio:', err);
    }
  }, [room?._id, fetchAndPlayNextRadioAction]);

  const handleUpdateSearchSettings = useCallback(
    async (patch: Partial<SearchSettings>) => {
      saveSearchConfig(patch);
      const effective = getEffectiveSearchSettings();
      setSearchSettings(effective);
      if (room?._id) {
        const callerId = room?.tvUid || creds.uuid;
        await updateSettingsMutation({
          roomId: room._id,
          callerUid: callerId,
          settings: {
            preferMusicVideos: effective.preferMusicVideos,
          },
        });
      }
    },
    [room?._id, room?.tvUid, user?.uid, creds.uuid, updateSettingsMutation]
  );

  const handleClearAllRateLimits = useCallback(async () => {
    // Rate limits and Turnstile are managed via Convex actions
  }, []);

  const remoteUrl = roomCode
    ? `${window.location.origin}/join?room=${roomCode}`
    : `${window.location.origin}/join`;

  const copyRemoteLink = useCallback(() => {
    navigator.clipboard.writeText(remoteUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  }, [remoteUrl]);

  return (
    <WatchPartyContext.Provider
      value={{
        user,
        roomCode,
        roomId: room?._id || null,
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
        canGoPrevious: Boolean(room && room.playedHistory && room.playedHistory.length > 0),
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
        handleSyncPlaybackCheckpoint,
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
