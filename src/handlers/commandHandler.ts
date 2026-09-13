import { ref, update, remove } from 'firebase/database';
import { database } from '@/lib/firebase';
import { RoomState, QueueItem, SearchSettings, parseYouTubeVideoId } from '@/lib/roomUtils';
import { fetchVideoTitle } from '@/lib/youtube';
import { getRoomPermissions } from './permissionsHandler';
import {
  addToQueue,
  removeQueueItem,
  clearQueue,
  reorderQueue,
  purgeMemberQueueItems,
} from './queueHandler';
import { addKey, deleteKey, updateKey, saveSearchConfig } from '@/lib/apiKeyStore';

export interface CommandHandlerContext {
  roomCode: string;
  roomState: RoomState | null;
  queue: QueueItem[];
  hostUid: string | null;
  tvOwnerUid: string | null;
  admins: string[];
  searchSettings: SearchSettings;
  lastFullscreenToggleTime: number;
  setLastFullscreenToggleTime: (time: number) => void;
  onPlayNextInQueue: () => Promise<void>;
  onUpdateSearchSettings: (patch: Partial<SearchSettings>) => Promise<void>;
  onClearAllRateLimits: () => Promise<void>;
  onProcessSearchRequest: (reqId: string, req: { requestedBy: string; query: string; createdAt: number }) => void;
}

/**
 * Processes remote commands sent by room members.
 * Verifies authorization, updates RTDB state, and removes the command node upon completion.
 */
export const processMemberCommand = async (
  memberUid: string,
  command: any,
  ctx: CommandHandlerContext,
  processingCommands?: Set<string>
): Promise<void> => {
  const { roomCode, roomState, queue, hostUid, tvOwnerUid, admins } = ctx;
  if (!roomCode || !command || !command.type) return;

  const commandKey = `${memberUid}:${command.createdAt || command.type}`;
  if (processingCommands?.has(commandKey)) return;
  processingCommands?.add(commandKey);

  const { type, payload } = command;
  const permissions = getRoomPermissions(memberUid, hostUid, tvOwnerUid, admins);

  // Reject commands if room controls are locked by admin and user is not authorized
  if (roomState?.isLocked && !permissions.isAuthorized) {
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
        let videoTitle = payload.title || '';
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
          memberUid,
          isActivelyPlaying
        );
      }
    } else if (type === 'removeFromQueue' && payload && payload.itemId) {
      const queueItem = queue.find((item) => item.id === payload.itemId);
      if (queueItem && (queueItem.addedBy === memberUid || permissions.isAuthorized)) {
        await removeQueueItem(roomCode, payload.itemId);
      }
    } else if (type === 'forceSkip') {
      if (permissions.isAuthorized) {
        await ctx.onPlayNextInQueue();
      } else {
        console.warn('[TV Host] Rejected forceSkip command from non-authorized member:', memberUid);
      }
    } else if (type === 'forceRemoveFromQueue' && payload && payload.itemId) {
      if (permissions.isAuthorized) {
        await removeQueueItem(roomCode, payload.itemId);
      } else {
        console.warn('[TV Host] Rejected forceRemoveFromQueue command from non-authorized member:', memberUid);
      }
    } else if (type === 'reorderQueue' && payload && Array.isArray(payload.queueOrder)) {
      if (permissions.isAuthorized) {
        await reorderQueue(roomCode, payload.queueOrder);
      } else {
        console.warn('[TV Host] Rejected reorderQueue command from non-authorized member:', memberUid);
      }
    } else if (type === 'kickMember' && payload && payload.targetUid) {
      if (permissions.isAuthorized) {
        const targetUid = payload.targetUid;
        await remove(ref(database, `rooms/${roomCode}/members/${targetUid}`));

        if (payload.purgeQueue !== false) {
          await purgeMemberQueueItems(roomCode, queue, targetUid);
        }
      } else {
        console.warn('[TV Host] Rejected kickMember command from non-authorized member:', memberUid);
      }
    } else if (type === 'toggleFullscreen') {
      const now = Date.now();
      if (now - ctx.lastFullscreenToggleTime < 5000) {
        console.warn('[TV Host] Cooldown active (5s) for toggleFullscreen command from member:', memberUid);
      } else {
        ctx.setLastFullscreenToggleTime(now);
        await update(ref(database, `rooms/${roomCode}/state`), {
          isFullscreen: !roomState?.isFullscreen,
        });
      }
    } else if (type === 'clearQueue') {
      if (permissions.isAuthorized) {
        await clearQueue(roomCode);
      } else {
        console.warn('[TV Host] Rejected clearQueue command from non-authorized member:', memberUid);
      }
    } else if (type === 'toggleRoomLock') {
      if (permissions.isAuthorized) {
        const nextIsLocked = !roomState?.isLocked;
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
      await update(ref(database, `rooms/${roomCode}/state`), {
        isAutoplay: !roomState?.isAutoplay,
      });
    } else if (type === 'toggleCountdown') {
      await update(ref(database, `rooms/${roomCode}/state`), {
        isCountdownEnabled: !roomState?.isCountdownEnabled,
      });
    } else if (type === 'togglePreferMusicVideos') {
      if (permissions.isAdmin || permissions.isTvOwner || permissions.isHost) {
        const currentVal = roomState?.searchSettings?.preferMusicVideos ?? true;
        await ctx.onUpdateSearchSettings({ preferMusicVideos: !currentVal });
      } else {
        console.warn('[TV Host] Unauthorized togglePreferMusicVideos command from member:', memberUid);
      }
    } else if (type === 'searchYouTube' && payload && payload.query) {
      const reqId = `${memberUid}_${Date.now()}`;
      ctx.onProcessSearchRequest(reqId, {
        requestedBy: memberUid,
        query: payload.query,
        createdAt: Date.now(),
      });
    } else if (type === 'manageApiKeys' && payload) {
      const allowHost = roomState?.searchSettings?.allowHostKeyManagement ?? true;
      if (permissions.isAdmin || permissions.isTvOwner || (permissions.isHost && allowHost)) {
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
          preferMusicVideos,
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
        } else if (action === 'setPreferMusicVideos' && typeof preferMusicVideos === 'boolean') {
          saveSearchConfig({ preferMusicVideos });
        } else if (action === 'clearRateLimits') {
          await ctx.onClearAllRateLimits();
        }
        await ctx.onUpdateSearchSettings({});
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
    processingCommands?.delete(commandKey);
  }
};
