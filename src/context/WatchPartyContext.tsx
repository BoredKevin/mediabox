import React, { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import { useSafePresence } from '@/hooks/useSafePresence';
import {
  DeviceUser,
  getDeviceUser,
  getOrCreateDeviceCredentials,
  getStoredTvRoomCode,
  saveStoredTvRoomCode,
} from '@/lib/deviceAuth';
import {
  RoomState,
  QueueItem,
  SearchSettings,
} from '@/lib/roomUtils';
import { getEffectiveSearchSettings } from '@/lib/apiKeyStore';
import { useWatchPartyActions } from './watchparty/useWatchPartyActions';

interface WatchPartyContextType {
  user: DeviceUser | null;
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
  handlePlayQueueItem: (queueId: string) => Promise<void>;
  canGoPrevious: boolean;
  handleRemoveQueueItem: (itemId: string) => Promise<void>;
  showSettingsModal: boolean;
  setShowSettingsModal: (show: boolean) => void;
  showSearchModal: boolean;
  setShowSearchModal: (show: boolean) => void;
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
  const [user] = useState<DeviceUser | null>(() => getDeviceUser());
  const [roomCode, setRoomCode] = useState<string | null>(() => getStoredTvRoomCode());
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
  const [showSearchModal, setShowSearchModal] = useState<boolean>(false);
  const [creating, setCreating] = useState<boolean>(false);
  const [showQrModal, setShowQrModal] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [muted, setMuted] = useState<boolean>(false);
  const [searchSettings, setSearchSettings] = useState<SearchSettings>(() => getEffectiveSearchSettings());

  const playerInstanceRef = useRef<any>(null);
  const createdRoomCodeRef = useRef<string | null>(null);

  const registerPlayerInstance = useCallback((instance: any) => {
    playerInstanceRef.current = instance;
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

  // Clear stale room code if query returns null
  useEffect(() => {
    if (roomCode && room) {
      if (createdRoomCodeRef.current === roomCode) {
        createdRoomCodeRef.current = null;
      }
    } else if (roomCode && room === null) {
      if (createdRoomCodeRef.current === roomCode) return;
      saveStoredTvRoomCode(null);
      setRoomCode(null);
    }
  }, [roomCode, room]);

  // TV Presence via safe presence hook
  const tvUserId = room?.tvUid || creds.uuid;
  const presenceList = useSafePresence(roomCode, tvUserId, 10000);

  const memberCount = useMemo(() => {
    if (!roomCode) return 0;
    if (!presenceList || presenceList.length === 0) return 1;
    return Math.max(1, presenceList.length);
  }, [roomCode, presenceList]);

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

  const remoteUrl = roomCode
    ? `${window.location.origin}/join?room=${roomCode}`
    : `${window.location.origin}/join`;

  const actions = useWatchPartyActions({
    room,
    creds,
    playerInstanceRef,
    createdRoomCodeRef,
    setCreating,
    setRoomCode,
    setShowQrModal,
    setSearchSettings,
    remoteUrl,
    setCopiedLink,
  });

  // Auto-play next track if player is idle and queue has pending songs
  useEffect(() => {
    if (
      room?._id &&
      !room.currentlyPlaying &&
      rawQueue &&
      rawQueue.length > 0 &&
      !actions.isTransitioningRef.current
    ) {
      actions.isTransitioningRef.current = true;
      actions.nextTrackMutation({ roomId: room._id })
        .catch((e) => console.error('[WatchParty] Auto-play next error:', e))
        .finally(() => {
          setTimeout(() => {
            actions.isTransitioningRef.current = false;
          }, 500);
        });
    }
  }, [room?._id, room?.currentlyPlaying, rawQueue, actions]);

  const handleClearAllRateLimits = useCallback(async () => {
    // Managed via Convex
  }, []);

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
        showSearchModal,
        setShowSearchModal,
        muted,
        setMuted,
        copiedLink,
        remoteUrl,
        handleCreateRoom: actions.handleCreateRoom,
        handleEndRoom: actions.handleEndRoom,
        handleTogglePlayPause: actions.handleTogglePlayPause,
        handlePlayNextInQueue: actions.handlePlayNextInQueue,
        handlePlayPreviousTrack: actions.handlePlayPreviousTrack,
        handlePlayQueueItem: actions.handlePlayQueueItem,
        canGoPrevious: Boolean(room && room.playedHistory && room.playedHistory.length > 0),
        handleRemoveQueueItem: actions.handleRemoveQueueItem,
        handleAddUrlHost: actions.handleAddUrlHost,
        handleToggleFullscreen: actions.handleToggleFullscreen,
        handleToggleRoomLock: actions.handleToggleRoomLock,
        handleToggleAutoplay: actions.handleToggleAutoplay,
        handleToggleCountdown: actions.handleToggleCountdown,
        handleSetLyricsOffset: actions.handleSetLyricsOffset,
        handleSetLyricsWordSync: actions.handleSetLyricsWordSync,
        handleAdjustVolume: actions.handleAdjustVolume,
        copyRemoteLink: actions.copyRemoteLink,
        searchSettings,
        handleUpdateSearchSettings: actions.handleUpdateSearchSettings,
        handleClearAllRateLimits,
        handleStartRadioFromCurrent: actions.handleStartRadioFromCurrent,
        registerPlayerInstance,
        handleSyncPlaybackCheckpoint: actions.handleSyncPlaybackCheckpoint,
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
