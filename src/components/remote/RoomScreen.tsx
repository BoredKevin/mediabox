import React, { useState, useEffect } from 'react';
import { ref, onValue, set, update, remove, off } from 'firebase/database';
import { User as FirebaseUser } from 'firebase/auth';
import { database } from '@/lib/firebase';
import { RoomState, QueueItem, parseYouTubeVideoId } from '@/lib/roomUtils';
import { useTranslation } from '@/context/LanguageContext';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { Card, Button, Input, Badge } from '@boredkevin/ui';
import {
  Users,
  LogOut,
  CheckCircle2,
  AlertCircle,
  Tv,
  X,
  Shield,
  Crown,
  Lock,
  User,
  Edit3,
} from 'lucide-react';

import { SearchPanel } from './panels/SearchPanel';
import { QueuePanel } from './panels/QueuePanel';
import { ControlsPanel } from './panels/ControlsPanel';
import { MembersPanel, MemberInfo } from './panels/MembersPanel';

interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

interface RoomScreenProps {
  activeRoomCode: string;
  user: FirebaseUser | null;
  onLeaveRoom: () => void;
  onGoogleSignIn: () => Promise<void>;
  onLogout: () => Promise<void>;
}

export const RoomScreen: React.FC<RoomScreenProps> = ({
  activeRoomCode,
  user,
  onLeaveRoom,
  onGoogleSignIn,
  onLogout,
}) => {
  const { t } = useTranslation();

  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [memberCount, setMemberCount] = useState<number>(1);
  const [membersList, setMembersList] = useState<MemberInfo[]>([]);

  // Admin & Host state
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [adminsList, setAdminsList] = useState<string[]>([]);
  const isHost = Boolean(user && roomState?.hostUid === user.uid);
  const isHostOrAdmin = isHost || isAdmin;

  // Nickname state
  const [myNickname, setMyNickname] = useState<string>('');
  const [isEditingNickname, setIsEditingNickname] = useState<boolean>(false);
  const [nicknameInput, setNicknameInput] = useState<string>('');

  // Toast system
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Volume slider state
  const [localVolume, setLocalVolume] = useState<number | null>(null);
  const [isDraggingVolume, setIsDraggingVolume] = useState<boolean>(false);

  // Fullscreen cooldown
  const [fullscreenCooldown, setFullscreenCooldown] = useState<boolean>(false);

  // QR Code & Join link
  const [showQrCode, setShowQrCode] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);

  const displayVolume =
    isDraggingVolume && localVolume !== null
      ? localVolume
      : localVolume ?? roomState?.playback?.volume ?? 80;

  useEffect(() => {
    if (!isDraggingVolume && roomState?.playback?.volume !== undefined) {
      setLocalVolume(roomState.playback.volume);
    }
  }, [roomState?.playback?.volume, isDraggingVolume]);

  const showToast = (
    message: string,
    type: 'success' | 'error' | 'info' = 'info',
    duration = 3000
  ) => {
    const id = `${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Subscribe to RTDB admins node
  useEffect(() => {
    if (!user) return;
    const adminsRefNode = ref(database, 'admins');
    const unsubAdmins = onValue(adminsRefNode, (snapshot) => {
      if (snapshot.exists()) {
        const val = snapshot.val();
        const uids = Object.keys(val);
        setAdminsList(uids);
        setIsAdmin(uids.includes(user.uid));
      } else {
        setAdminsList([]);
        setIsAdmin(false);
      }
    });
    return () => off(adminsRefNode);
  }, [user]);

  // Subscribe to room updates (state, queue, members)
  useEffect(() => {
    if (!activeRoomCode || !user) return;

    const stateRefNode = ref(database, `rooms/${activeRoomCode}/state`);
    const queueRefNode = ref(database, `rooms/${activeRoomCode}/queue`);
    const membersRefNode = ref(database, `rooms/${activeRoomCode}/members`);

    const unsubState = onValue(stateRefNode, (snapshot) => {
      if (snapshot.exists()) {
        setRoomState(snapshot.val());
      } else {
        onLeaveRoom();
        showToast(t('toasts.roomClosedByHost'), 'error');
      }
    });

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

    const unsubMembers = onValue(membersRefNode, (snapshot) => {
      if (snapshot.exists()) {
        const membersData = snapshot.val();
        // Check if kicked
        if (user && !membersData[user.uid]) {
          onLeaveRoom();
          showToast(t('toasts.kickedByHost'), 'error', 6000);
          return;
        }

        const list = Object.entries(membersData).map(([uid, m]: [string, any]) => ({
          uid,
          joinedAt: m?.joinedAt || 0,
          nickname: m?.nickname || '',
        }));
        list.sort((a, b) => a.joinedAt - b.joinedAt);

        setMembersList(list);
        setMemberCount(list.length);

        const myRecord = list.find((m) => m.uid === user.uid);
        if (myRecord) {
          if (myRecord.nickname && !isEditingNickname) {
            setMyNickname(myRecord.nickname);
          } else if (!myRecord.nickname && user.displayName) {
            // Auto-populate nickname from Google displayName
            const autoNick = user.displayName.slice(0, 25);
            update(ref(database, `rooms/${activeRoomCode}/members/${user.uid}`), {
              nickname: autoNick,
            }).catch(() => {});
            setMyNickname(autoNick);
          }
        }
      } else {
        onLeaveRoom();
        showToast(t('toasts.roomCleared'), 'error');
      }
    });

    return () => {
      off(stateRefNode);
      off(queueRefNode);
      off(membersRefNode);
    };
  }, [activeRoomCode, user, isEditingNickname, onLeaveRoom, t]);

  const sendCommand = async (type: any, payload?: any) => {
    if (!activeRoomCode || !user) return;

    if (roomState?.isLocked && !isHostOrAdmin) {
      if (
        type === 'addToQueue' ||
        type === 'play' ||
        type === 'pause' ||
        type === 'adjustVolume' ||
        type === 'toggleAutoplay'
      ) {
        showToast(t('toasts.controlsLockedByAdmin'), 'error');
        return;
      }
    }

    try {
      const commandRefNode = ref(
        database,
        `rooms/${activeRoomCode}/members/${user.uid}/command`
      );
      await set(commandRefNode, {
        type,
        createdAt: Date.now(),
        payload: payload || {},
      });

      const labelMap: Record<string, string> = {
        play: t('toasts.playSent'),
        pause: t('toasts.pauseSent'),
        addToQueue: t('toasts.videoAddedQueue'),
        removeFromQueue: t('toasts.removeQueueSent'),
        adjustVolume: t('toasts.volumeSet', { vol: payload?.volume }),
        forceSkip: t('toasts.skipSent'),
        reorderQueue: t('toasts.reorderSent'),
        forceRemoveFromQueue: t('toasts.removeQueueSent'),
        kickMember: t('toasts.kickSent'),
        toggleFullscreen: t('toasts.toggleFullscreenSent'),
        clearQueue: t('toasts.clearQueueSent'),
        toggleRoomLock: roomState?.isLocked
          ? t('toasts.roomUnlocked')
          : t('toasts.roomLocked'),
        toggleAutoplay: roomState?.isAutoplay
          ? t('toasts.autoplayDisabled')
          : t('toasts.autoplayEnabled'),
        toggleCountdown: roomState?.isCountdownEnabled
          ? t('toasts.countdownDisabled')
          : t('toasts.countdownEnabled'),
      };
      showToast(labelMap[type] || t('toasts.commandSent', { type }), 'success');
    } catch (err: any) {
      console.error('Failed to send command:', err);
      showToast(t('toasts.commandFailed'), 'error');
    }
  };

  const handleSaveNickname = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!activeRoomCode || !user) return;
    const cleanName = nicknameInput.trim().slice(0, 25);

    try {
      await update(ref(database, `rooms/${activeRoomCode}/members/${user.uid}`), {
        nickname: cleanName || null,
      });
      setMyNickname(cleanName);
      setIsEditingNickname(false);
      showToast(
        cleanName
          ? t('toasts.nicknameSet', { name: cleanName })
          : t('toasts.nicknameReset'),
        'success'
      );
    } catch (err: any) {
      console.error('Failed to update nickname:', err);
      showToast(t('toasts.nicknameFailed'), 'error');
    }
  };

  const handleVolumeValueChange = (val: number[]) => {
    setLocalVolume(val[0]);
    setIsDraggingVolume(true);
  };

  const handleVolumeValueCommit = (val: number[]) => {
    const newVol = val[0];
    setLocalVolume(newVol);
    sendCommand('adjustVolume', { volume: newVol });
    setIsDraggingVolume(false);
  };

  const handleToggleFullscreenClick = () => {
    if (fullscreenCooldown) {
      showToast(t('toasts.fullscreenCooldown'), 'info');
      return;
    }
    sendCommand('toggleFullscreen');
    setFullscreenCooldown(true);
    setTimeout(() => {
      setFullscreenCooldown(false);
    }, 5000);
  };

  const handleCopyJoinLink = () => {
    if (!activeRoomCode) return;
    const joinUrl = `${window.location.origin}/#/join?room=${activeRoomCode}`;
    navigator.clipboard.writeText(joinUrl);
    setCopiedLink(true);
    showToast(t('remote.linkCopied'), 'success');
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleRemoveQueueItem = async (itemId: string, itemAddedBy?: string) => {
    if (!activeRoomCode || !user) return;
    const isMyEntry = itemAddedBy === user.uid;

    if (isHostOrAdmin && !isMyEntry) {
      sendCommand('forceRemoveFromQueue', { itemId });
      return;
    }

    try {
      const itemRef = ref(database, `rooms/${activeRoomCode}/queue/${itemId}`);
      await remove(itemRef);
      showToast(t('toasts.itemRemoved'), 'success');
    } catch {
      sendCommand('removeFromQueue', { itemId });
    }
  };

  const handleKickMember = (targetUid: string) => {
    if (!isHostOrAdmin || targetUid === user?.uid) return;
    if (confirm(t('remote.kickMemberConfirm'))) {
      sendCommand('kickMember', { targetUid, purgeQueue: true });
    }
  };

  const handleMoveQueueItem = (index: number, direction: 'up' | 'down') => {
    if (!isHostOrAdmin || queue.length <= 1) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= queue.length) return;

    const newQueue = [...queue];
    const [movedItem] = newQueue.splice(index, 1);
    newQueue.splice(targetIndex, 0, movedItem);

    const newOrderIds = newQueue.map((item) => item.id);
    sendCommand('reorderQueue', { queueOrder: newOrderIds });
  };

  const handleClearQueueAdmin = () => {
    if (!isHostOrAdmin) return;
    if (confirm(t('remote.clearQueueConfirm'))) {
      sendCommand('clearQueue');
    }
  };

  const handleToggleRoomLockAdmin = () => {
    if (!isHostOrAdmin) return;
    sendCommand('toggleRoomLock');
  };

  return (
    <div className="relative z-10 flex min-h-screen flex-col p-4 sm:p-6 max-w-lg mx-auto">
      {/* Floating Toast Notification Container */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm px-4 pointer-events-none flex flex-col items-center gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto w-full flex items-center justify-between gap-3 p-3 text-xs font-semibold uppercase tracking-wider backdrop-blur-md shadow-2xl transition-all border ${
              toast.type === 'success'
                ? 'bg-card/95 border-primary text-primary shadow-[0_0_15px_rgba(0,200,212,0.3)]'
                : toast.type === 'error'
                ? 'bg-card/95 border-destructive text-destructive shadow-[0_0_15px_rgba(239,68,68,0.3)]'
                : 'bg-card/95 border-border text-foreground'
            }`}
          >
            <div className="flex items-center gap-2 truncate">
              {toast.type === 'success' && (
                <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-primary" />
              )}
              {toast.type === 'error' && (
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-destructive" />
              )}
              {toast.type === 'info' && (
                <Tv className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
              )}
              <span className="truncate">{toast.message}</span>
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="p-1 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              title="Dismiss"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      {/* Header bar */}
      <div className="flex items-center justify-between border-b border-border pb-4 mb-5 gap-2">
        <div className="flex items-center gap-3">
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
              {t('remote.connectedToRoom')}
            </span>
            <span className="font-mono text-xl font-bold text-primary tracking-widest">
              {activeRoomCode}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <LanguageSwitcher />

          {isAdmin ? (
            <Badge
              variant="outline"
              className="flex items-center gap-1 px-2.5 py-1 bg-purple-950/90 border-purple-500/70 text-xs font-bold text-purple-300 uppercase tracking-wider shadow-[0_0_12px_rgba(168,85,247,0.4)] rounded-none"
            >
              <Shield className="w-3.5 h-3.5 text-purple-400 fill-purple-400" />
              {t('remote.adminBadge')}
            </Badge>
          ) : isHost ? (
            <Badge
              variant="outline"
              className="flex items-center gap-1 px-2.5 py-1 bg-amber-950/80 border-amber-500/60 text-xs font-bold text-amber-300 uppercase tracking-wider shadow-[0_0_10px_rgba(245,158,11,0.2)] rounded-none"
            >
              <Crown className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
              {t('remote.hostBadge')}
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="flex items-center gap-1 px-2.5 py-1 bg-card border-border text-xs text-muted-foreground uppercase tracking-wider rounded-none"
            >
              {t('remote.memberBadge')}
            </Badge>
          )}

          {roomState?.isLocked && (
            <Badge
              variant="destructive"
              className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold uppercase tracking-wider rounded-none"
            >
              <Lock className="w-3 h-3" />
            </Badge>
          )}

          <Badge
            variant="outline"
            className="flex items-center gap-1.5 px-2.5 py-1 bg-card border-border text-xs text-foreground rounded-none"
          >
            <Users className="w-3.5 h-3.5 text-primary" />
            {memberCount}
          </Badge>

          <Button
            variant="outline"
            size="icon"
            onClick={onLeaveRoom}
            title={t('remote.leaveRoomBtn')}
            className="h-9 w-9 text-muted-foreground hover:text-destructive hover:border-destructive transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Profile & Google Auth Card */}
      <Card cornerLines className="p-4 bg-card border-border mb-5 flex flex-col gap-3">
        <div className="flex items-center justify-between border-b border-border pb-2">
          <div className="flex items-center gap-2 text-xs font-bold text-foreground uppercase tracking-wider">
            <User className="w-4 h-4 text-primary" />
            {t('remote.accountProfile')}
          </div>

          {user?.isAnonymous === false ? (
            <button
              onClick={onLogout}
              className="text-[10px] font-semibold text-muted-foreground hover:text-destructive uppercase tracking-wider transition-colors flex items-center gap-1 cursor-pointer"
            >
              <LogOut className="w-3 h-3" />
              {t('remote.signOut')}
            </button>
          ) : (
            <Button
              variant="outline"
              chamfer="top-right"
              onClick={onGoogleSignIn}
              className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider h-auto flex items-center gap-1.5"
            >
              <svg className="w-3 h-3" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Sign in with Google</span>
            </Button>
          )}
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {user?.photoURL ? (
              <img
                src={user.photoURL}
                alt="Avatar"
                className="w-8 h-8 rounded-full border border-border"
              />
            ) : (
              <div className="w-8 h-8 bg-muted border border-border flex items-center justify-center text-muted-foreground font-bold text-xs">
                {(myNickname || 'G')[0].toUpperCase()}
              </div>
            )}
            <div className="flex flex-col">
              <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                {user?.displayName || myNickname || `Guest (${user?.uid.substring(0, 4)})`}
                {isAdmin && (
                  <Shield className="w-3.5 h-3.5 text-purple-400 fill-purple-400" />
                )}
              </span>
              <span className="text-[10px] text-muted-foreground font-mono">
                {user?.email || `UID: ${user?.uid.substring(0, 8)}...`}
              </span>
            </div>
          </div>

          {!isEditingNickname ? (
            <Button
              variant="outline"
              size="sm"
              chamfer="top-right"
              onClick={() => {
                setNicknameInput(myNickname);
                setIsEditingNickname(true);
              }}
              className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider flex items-center gap-1 h-auto"
              title="Edit your nickname"
            >
              <Edit3 className="w-3 h-3 text-primary" />
              <span>{t('remote.editNickname')}</span>
            </Button>
          ) : null}
        </div>

        {isEditingNickname && (
          <form
            onSubmit={handleSaveNickname}
            className="flex items-center gap-2 pt-2 border-t border-border"
          >
            <div className="flex-1">
              <Input
                type="text"
                maxLength={25}
                chamfer="dual"
                value={nicknameInput}
                onChange={(e) => setNicknameInput(e.target.value)}
                placeholder={t('remote.enterNicknamePlaceholder')}
                className="font-mono text-xs"
                autoFocus
              />
            </div>
            <Button
              type="submit"
              variant="cyber"
              chamfer="dual"
              className="px-3 py-1 text-[10px] font-bold uppercase h-9"
            >
              {t('remote.saveBtn')}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsEditingNickname(false)}
              className="px-2.5 py-1 text-muted-foreground hover:text-foreground text-[10px] h-9"
            >
              {t('remote.cancelBtn')}
            </Button>
          </form>
        )}
      </Card>

      {/* Currently Playing Card */}
      <Card cornerLines className="p-4 bg-card border-border mb-5">
        <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2 flex items-center justify-between">
          <span>{t('remote.nowPlayingTv')}</span>
          <Badge
            variant={roomState?.playback?.status === 'playing' ? 'success' : 'secondary'}
            className="px-2 py-0.5 text-[10px] uppercase font-bold tracking-widest rounded-none"
          >
            {roomState?.playback?.status === 'playing'
              ? t('remote.playingStatus')
              : t('remote.pausedStatus')}
          </Badge>
        </div>
        {roomState?.currentlyPlaying ? (
          <div className="flex gap-3 items-center">
            {parseYouTubeVideoId(roomState.currentlyPlaying) ? (
              <img
                src={`https://img.youtube.com/vi/${parseYouTubeVideoId(
                  roomState.currentlyPlaying
                )}/hqdefault.jpg`}
                alt="Video thumbnail"
                className="w-20 h-14 object-cover border border-border"
              />
            ) : null}
            <div className="overflow-hidden flex-1 flex flex-col min-w-0">
              {roomState?.currentlyPlayingTitle ? (
                <p className="text-xs font-bold text-foreground truncate font-sans mb-0.5">
                  {roomState.currentlyPlayingTitle}
                </p>
              ) : null}
              <p className="text-[11px] font-mono text-primary truncate">
                {roomState.currentlyPlaying}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground italic">
            {t('remote.noVideoSelected')}
          </p>
        )}
      </Card>

      {/* 1. Main Controls Panel */}
      <ControlsPanel
        roomCode={activeRoomCode}
        roomState={roomState}
        isHostOrAdmin={isHostOrAdmin}
        isAdmin={isAdmin}
        queueLength={queue.length}
        sendCommand={sendCommand}
        displayVolume={displayVolume}
        handleVolumeValueChange={handleVolumeValueChange}
        handleVolumeValueCommit={handleVolumeValueCommit}
        handleClearQueueAdmin={handleClearQueueAdmin}
        handleToggleRoomLockAdmin={handleToggleRoomLockAdmin}
        fullscreenCooldown={fullscreenCooldown}
        handleToggleFullscreenClick={handleToggleFullscreenClick}
        showQrCode={showQrCode}
        setShowQrCode={setShowQrCode}
        copiedLink={copiedLink}
        handleCopyJoinLink={handleCopyJoinLink}
      />

      {/* 2. Search & URL Input Panel */}
      <SearchPanel
        roomCode={activeRoomCode}
        roomState={roomState}
        user={user}
        isHostOrAdmin={isHostOrAdmin}
        sendCommand={sendCommand}
        showToast={showToast}
      />

      {/* 3. Members & Requests Panel */}
      <MembersPanel
        membersList={membersList}
        adminsList={adminsList}
        hostUid={roomState?.hostUid}
        user={user}
        isHostOrAdmin={isHostOrAdmin}
        queue={queue}
        onKickMember={handleKickMember}
        onRemoveQueueItem={handleRemoveQueueItem}
      />

      {/* 4. Upcoming Queue Panel */}
      <QueuePanel
        queue={queue}
        user={user}
        isHostOrAdmin={isHostOrAdmin}
        membersList={membersList}
        onRemoveItem={handleRemoveQueueItem}
        onMoveItem={handleMoveQueueItem}
      />
    </div>
  );
};
