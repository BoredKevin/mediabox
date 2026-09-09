import React, { useState, useEffect, useRef } from 'react';
import { ref, onValue, set, update, remove, off, onDisconnect, serverTimestamp } from 'firebase/database';
import { User as FirebaseUser } from 'firebase/auth';
import { database } from '@/lib/firebase';
import { RoomState, QueueItem } from '@/lib/roomUtils';
import { useTranslation } from '@/context/LanguageContext';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { Card, Button, Badge, Tabs, TabsList, TabsTrigger, TabsContent } from '@boredkevin/ui';
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
  Settings,
  Layers,
} from 'lucide-react';

import { SearchPanel } from './panels/SearchPanel';
import { QueuePanel } from './panels/QueuePanel';
import { MembersPanel, MemberInfo } from './panels/MembersPanel';
import { NowPlayingBar } from './NowPlayingBar';
import { HostSettingsModal } from './HostSettingsModal';
import { ProfileDropdown } from './ProfileDropdown';
import { SideDrawer } from './SideDrawer';

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
  const [isTvOnline, setIsTvOnline] = useState<boolean>(true);

  // Admin & Host state
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [adminsList, setAdminsList] = useState<string[]>([]);
  const isHost = Boolean(user && roomState?.hostUid === user.uid);
  const isHostOrAdmin = isHost || isAdmin;

  // Nickname state
  const [myNickname, setMyNickname] = useState<string>('');

  // Toast system
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Volume slider state
  const [localVolume, setLocalVolume] = useState<number | null>(null);
  const [isDraggingVolume, setIsDraggingVolume] = useState<boolean>(false);

  // Fullscreen cooldown
  const [fullscreenCooldown, setFullscreenCooldown] = useState<boolean>(false);

  // Modal / Drawer state
  const [showHostSettings, setShowHostSettings] = useState<boolean>(false);
  const [showSideDrawer, setShowSideDrawer] = useState<boolean>(false);

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

  const hasConfirmedMembership = useRef(false);

  useEffect(() => {
    hasConfirmedMembership.current = false;
  }, [activeRoomCode, user?.uid]);

  // Member presence tracking via .info/connected
  useEffect(() => {
    if (!activeRoomCode || !user) return;

    const connectedRef = ref(database, '.info/connected');
    const memberOnlineRef = ref(database, `rooms/${activeRoomCode}/members/${user.uid}/online`);
    const memberLastSeenRef = ref(database, `rooms/${activeRoomCode}/members/${user.uid}/lastSeen`);

    const unsubConnected = onValue(connectedRef, (snap) => {
      if (snap.val() === true) {
        onDisconnect(memberOnlineRef).set(false);
        onDisconnect(memberLastSeenRef).set(serverTimestamp());

        update(ref(database, `rooms/${activeRoomCode}/members/${user.uid}`), {
          online: true,
          lastSeen: Date.now(),
        }).catch(() => {});
      }
    });

    return () => {
      off(connectedRef);
      onDisconnect(memberOnlineRef).cancel();
      onDisconnect(memberLastSeenRef).cancel();
    };
  }, [activeRoomCode, user]);

  // Subscribe to room updates (state, queue, members, tv)
  useEffect(() => {
    if (!activeRoomCode || !user) return;

    const stateRefNode = ref(database, `rooms/${activeRoomCode}/state`);
    const queueRefNode = ref(database, `rooms/${activeRoomCode}/queue`);
    const membersRefNode = ref(database, `rooms/${activeRoomCode}/members`);
    const tvRefNode = ref(database, `rooms/${activeRoomCode}/tv`);

    const unsubTv = onValue(tvRefNode, (snapshot) => {
      if (snapshot.exists()) {
        const tvVal = snapshot.val();
        setIsTvOnline(tvVal?.online !== false);
      } else {
        setIsTvOnline(false);
      }
    });

    const unsubState = onValue(stateRefNode, (snapshot) => {
      if (snapshot.exists()) {
        setRoomState(snapshot.val());
      } else {
        if (hasConfirmedMembership.current) {
          onLeaveRoom();
          showToast(t('toasts.roomClosedByHost'), 'error');
        }
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

        // Check if member is present in room
        if (user && membersData[user.uid]) {
          hasConfirmedMembership.current = true;
        } else if (user && !membersData[user.uid]) {
          if (hasConfirmedMembership.current) {
            onLeaveRoom();
            showToast(t('toasts.kickedByHost'), 'error', 6000);
            return;
          } else {
            update(ref(database, `rooms/${activeRoomCode}/members/${user.uid}`), {
              uid: user.uid,
              joinedAt: Date.now(),
              online: true,
              lastSeen: Date.now(),
              ...(user.displayName ? { nickname: user.displayName.slice(0, 25) } : {}),
            }).catch(() => {});
          }
        }

        const list = Object.entries(membersData).map(([uid, m]: [string, any]) => ({
          uid,
          joinedAt: m?.joinedAt || 0,
          nickname: m?.nickname || '',
          online: m?.online !== false,
          lastSeen: m?.lastSeen || 0,
        }));
        list.sort((a, b) => a.joinedAt - b.joinedAt);

        setMembersList(list);
        setMemberCount(list.filter((m) => m.online).length);

        const myRecord = list.find((m) => m.uid === user.uid);
        if (myRecord) {
          if (myRecord.nickname) {
            setMyNickname(myRecord.nickname);
          } else if (!myRecord.nickname && user.displayName) {
            const autoNick = user.displayName.slice(0, 25);
            update(ref(database, `rooms/${activeRoomCode}/members/${user.uid}`), {
              nickname: autoNick,
            }).catch(() => {});
            setMyNickname(autoNick);
          }
        }
      } else {
        if (hasConfirmedMembership.current) {
          onLeaveRoom();
          showToast(t('toasts.roomCleared'), 'error');
        }
      }
    });

    return () => {
      off(stateRefNode);
      off(queueRefNode);
      off(membersRefNode);
      off(tvRefNode);
    };
  }, [activeRoomCode, user, onLeaveRoom, t]);

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

  const handleSaveNickname = async (name: string) => {
    if (!activeRoomCode || !user) return;
    const cleanName = name.trim().slice(0, 25);

    try {
      await update(ref(database, `rooms/${activeRoomCode}/members/${user.uid}`), {
        nickname: cleanName || null,
      });
      setMyNickname(cleanName);
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

  const handleRemoveQueueItem = async (itemId: string, itemAddedBy?: string) => {
    const isMyEntry = Boolean(user && itemAddedBy === user.uid);
    if (!isMyEntry && !isHostOrAdmin) {
      showToast(t('toasts.controlsLockedByAdmin'), 'error');
      return;
    }

    try {
      if (isHostOrAdmin && !isMyEntry) {
        await sendCommand('forceRemoveFromQueue', { itemId });
      } else {
        await sendCommand('removeFromQueue', { itemId });
      }
    } catch (err: any) {
      console.error('Failed to remove item from queue:', err);
      showToast(t('toasts.commandFailed'), 'error');
    }
  };

  const handleKickMember = async (targetUid: string) => {
    if (!isHostOrAdmin || targetUid === user?.uid) return;
    if (confirm(t('remote.kickMemberConfirm'))) {
      try {
        await sendCommand('kickMember', { targetUid, purgeQueue: true });
      } catch (err: any) {
        console.error('Failed to kick member:', err);
        showToast(t('toasts.commandFailed'), 'error');
      }
    }
  };

  const handleMoveQueueItem = (index: number, direction: 'up' | 'down') => {
    if (!isHostOrAdmin) return;
    const newQueue = [...queue];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newQueue.length) return;

    const temp = newQueue[index];
    newQueue[index] = newQueue[targetIndex];
    newQueue[targetIndex] = temp;

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
    <div className="relative z-10 flex flex-col h-screen overflow-hidden bg-background text-foreground">
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

      {/* Header Bar: 2 lines on mobile, 1 line on desktop */}
      <header className="px-3 py-2.5 sm:px-6 sm:py-3 border-b border-border bg-card/90 backdrop-blur-md flex flex-col lg:flex-row lg:h-16 lg:items-center lg:justify-between gap-2 lg:gap-4 flex-shrink-0">
        {/* Mobile Line 1 / Desktop Left: Room Badge & Info */}
        <div className="flex items-center justify-between lg:justify-start gap-2.5 sm:gap-3 w-full lg:w-auto">
          <div className="flex items-center gap-2 sm:gap-2.5">
            <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              {t('watchParty.roomBadge')}
            </span>
            <span className="font-mono text-base sm:text-lg font-bold tracking-widest text-primary">
              {activeRoomCode}
            </span>

            {/* Role badge */}
            {isAdmin ? (
              <Badge
                variant="outline"
                className="h-5 px-1.5 py-0 inline-flex items-center gap-1 text-[9px] font-mono font-bold uppercase leading-none rounded-none bg-purple-950/60 text-purple-300 border-purple-800/80"
              >
                <Shield className="w-2.5 h-2.5 text-purple-400" />
                <span>{t('remote.adminBadge')}</span>
              </Badge>
            ) : isHost ? (
              <Badge
                variant="default"
                className="h-5 px-1.5 py-0 inline-flex items-center gap-1 text-[9px] font-mono font-bold uppercase leading-none rounded-none"
              >
                <Crown className="w-2.5 h-2.5" />
                <span>{t('remote.hostBadge')}</span>
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="h-5 px-1.5 py-0 inline-flex items-center gap-1 text-[9px] font-mono font-bold uppercase leading-none rounded-none text-muted-foreground border-border"
              >
                <span>{t('remote.memberBadge')}</span>
              </Badge>
            )}

            {/* TV Online / Offline status badge */}
            {isTvOnline ? (
              <Badge
                variant="success"
                className="h-5 px-1.5 py-0 inline-flex items-center gap-1 text-[9px] font-mono font-bold uppercase leading-none rounded-none"
                title={t('remote.tvOnlineBadge')}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>{t('remote.tvOnlineBadge')}</span>
              </Badge>
            ) : (
              <Badge
                variant="destructive"
                className="h-5 px-1.5 py-0 inline-flex items-center gap-1 text-[9px] font-mono font-bold uppercase leading-none rounded-none"
                title={t('remote.tvOfflineBadge')}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                <span>{t('remote.tvOfflineBadge')}</span>
              </Badge>
            )}

            {/* Locked status */}
            {roomState?.isLocked && (
              <Badge
                variant="warning"
                className="h-5 px-1.5 py-0 inline-flex items-center gap-1 text-[9px] font-mono font-bold uppercase leading-none rounded-none bg-amber-500/15 text-amber-300 border-amber-500/50"
              >
                <Lock className="w-2.5 h-2.5 text-amber-400" />
                <span>Locked</span>
              </Badge>
            )}
          </div>

          {/* Mobile Drawer Trigger for Queue & Members (anchored to top-right of mobile header) */}
          <button
            onClick={() => setShowSideDrawer(true)}
            className="lg:hidden flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-bold bg-muted/40 border border-border hover:border-primary/50 transition-colors cursor-pointer text-foreground"
            title={t('remote.queueDrawerTitle')}
          >
            <Users className="w-3.5 h-3.5 text-primary" />
            <span>{memberCount}</span>
          </button>
        </div>

        {/* Mobile Line 2 / Desktop Right: Profile & Settings on left, i18n & Logout on right */}
        <div className="flex items-center justify-between w-full lg:w-auto border-t border-border/40 lg:border-t-0 pt-2.5 lg:pt-0 gap-2">
          {/* Left: User Profile & Host/Admin Room Settings */}
          <div className="flex items-center gap-2">
            <ProfileDropdown
              user={user}
              myNickname={myNickname}
              isHost={isHost}
              isAdmin={isAdmin}
              onLogout={onLogout}
              onGoogleSignIn={onGoogleSignIn}
              onSaveNickname={handleSaveNickname}
            />

            {isHostOrAdmin && (
              <Button
                variant="outline"
                size="icon"
                onClick={() => setShowHostSettings(true)}
                title={t('remote.hostSettings')}
                className="h-11 w-11 text-muted-foreground hover:text-primary hover:border-primary/60 cursor-pointer"
              >
                <Settings className="w-4 h-4" />
              </Button>
            )}
          </div>

          {/* Right: Language Switcher, Desktop Member Count & Logout */}
          <div className="flex items-center gap-2">
            {/* Desktop Members Count Badge */}
            <div className="hidden lg:flex items-center gap-1.5 px-3 h-11 text-xs font-mono bg-muted/20 border border-border text-foreground">
              <Users className="w-3.5 h-3.5 text-primary" />
              <span>{memberCount}</span>
            </div>

            <LanguageSwitcher className="relative static" hideOnFullscreen={false} />

            <Button
              variant="outline"
              size="icon"
              onClick={onLeaveRoom}
              title={t('remote.leaveRoomBtn')}
              className="h-11 w-11 text-muted-foreground hover:text-destructive hover:border-destructive transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 min-h-0 p-3 sm:p-5 md:p-6 pb-36 sm:pb-40 overflow-hidden">
        <div className="max-w-[1800px] w-full mx-auto h-full flex flex-col">
          {/* Desktop Two-Column Layout (>= 1024px / lg) */}
          <div className="hidden lg:grid lg:grid-cols-[60fr_40fr] xl:grid-cols-[63fr_37fr] lg:gap-6 h-full min-h-0">
            {/* Left Column: Search & URL Queue Input */}
            <Card cornerLines className="h-full flex flex-col p-5 bg-card border-border overflow-hidden">
              <div className="flex-1 min-h-0 overflow-y-auto pr-2">
                <SearchPanel
                  roomCode={activeRoomCode}
                  roomState={roomState}
                  user={user}
                  isHostOrAdmin={isHostOrAdmin}
                  sendCommand={sendCommand}
                  showToast={showToast}
                  embedded
                  onOpenHostSettings={() => setShowHostSettings(true)}
                />
              </div>
            </Card>

            {/* Right Column: Tabbed Queue & Members */}
            <Card cornerLines className="h-full flex flex-col p-5 bg-card border-border overflow-hidden">
              <Tabs defaultValue="queue" className="h-full flex flex-col min-h-0">
                <TabsList className="grid w-full grid-cols-2 mb-4 flex-shrink-0">
                  <TabsTrigger value="queue" className="text-xs uppercase font-bold tracking-wider">
                    {t('remote.activeQueueTab')} ({queue.length})
                  </TabsTrigger>
                  <TabsTrigger value="members" className="text-xs uppercase font-bold tracking-wider">
                    {t('remote.activeMembersTab')} ({membersList.length})
                  </TabsTrigger>
                </TabsList>

                <TabsContent
                  value="queue"
                  className="flex-1 min-h-0 overflow-hidden flex flex-col mt-0 data-[state=inactive]:hidden"
                >
                  <QueuePanel
                    queue={queue}
                    user={user}
                    isHostOrAdmin={isHostOrAdmin}
                    membersList={membersList}
                    onRemoveItem={handleRemoveQueueItem}
                    onMoveItem={handleMoveQueueItem}
                    embedded
                  />
                </TabsContent>

                <TabsContent
                  value="members"
                  className="flex-1 min-h-0 overflow-hidden flex flex-col mt-0 data-[state=inactive]:hidden"
                >
                  <MembersPanel
                    membersList={membersList}
                    adminsList={adminsList}
                    hostUid={roomState?.hostUid}
                    user={user}
                    isHostOrAdmin={isHostOrAdmin}
                    queue={queue}
                    onKickMember={handleKickMember}
                    onRemoveQueueItem={handleRemoveQueueItem}
                    embedded
                  />
                </TabsContent>
              </Tabs>
            </Card>
          </div>

          {/* Mobile / Tablet View (< 1024px / < lg) */}
          <div className="lg:hidden h-full flex flex-col min-h-0">
            {/* Quick Queue Summary Bar */}
            <div className="flex items-center justify-between p-2.5 px-3 mb-3 bg-card border border-border flex-shrink-0">
              <div className="flex items-center gap-2 text-xs">
                <span className="text-muted-foreground uppercase font-mono">
                  {t('remote.upcomingQueue')}:
                </span>
                <span className="font-mono text-primary font-bold">{queue.length} items</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                chamfer="top-right"
                onClick={() => setShowSideDrawer(true)}
                className="h-7 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5"
              >
                <Layers className="w-3.5 h-3.5 text-primary" />
                <span>{t('remote.queueDrawerTitle')}</span>
              </Button>
            </div>

            {/* Scrollable Search & Add Panel */}
            <div className="flex-1 min-h-0 overflow-y-auto pr-1">
              <Card cornerLines className="p-4 bg-card border-border flex flex-col mb-4">
                <SearchPanel
                  roomCode={activeRoomCode}
                  roomState={roomState}
                  user={user}
                  isHostOrAdmin={isHostOrAdmin}
                  sendCommand={sendCommand}
                  showToast={showToast}
                  embedded
                  onOpenHostSettings={() => setShowHostSettings(true)}
                />
              </Card>
            </div>
          </div>
        </div>
      </main>

      {/* Sticky Bottom Now Playing Bar */}
      <NowPlayingBar
        roomState={roomState}
        isHostOrAdmin={isHostOrAdmin}
        sendCommand={sendCommand}
        displayVolume={displayVolume}
        handleVolumeValueChange={handleVolumeValueChange}
        handleVolumeValueCommit={handleVolumeValueCommit}
        fullscreenCooldown={fullscreenCooldown}
        handleToggleFullscreenClick={handleToggleFullscreenClick}
      />

      {/* Host / Admin Settings Dialog */}
      <HostSettingsModal
        open={showHostSettings}
        onOpenChange={setShowHostSettings}
        roomCode={activeRoomCode}
        roomState={roomState}
        isAdmin={isAdmin}
        queueLength={queue.length}
        sendCommand={sendCommand}
        handleClearQueueAdmin={handleClearQueueAdmin}
        handleToggleRoomLockAdmin={handleToggleRoomLockAdmin}
        showToast={showToast}
      />

      {/* Mobile Queue & Members Side Drawer */}
      <SideDrawer
        open={showSideDrawer}
        onClose={() => setShowSideDrawer(false)}
        queue={queue}
        user={user}
        isHostOrAdmin={isHostOrAdmin}
        membersList={membersList}
        adminsList={adminsList}
        hostUid={roomState?.hostUid}
        onRemoveQueueItem={handleRemoveQueueItem}
        onMoveQueueItem={handleMoveQueueItem}
        onKickMember={handleKickMember}
      />
    </div>
  );
};

export default RoomScreen;
