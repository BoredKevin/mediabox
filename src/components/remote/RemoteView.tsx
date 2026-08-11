import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { ref, onValue, set, update, remove, off } from 'firebase/database';
import { User as FirebaseUser } from 'firebase/auth';
import { ensureAnonymousAuth, signInWithGoogle, logoutUser, database } from '@/lib/firebase';
import { checkRoomExists, RoomState, QueueItem, parseYouTubeVideoId } from '@/lib/roomUtils';
import { searchYouTubeVideos, fetchVideoTitle, SearchResultItem } from '@/lib/youtube';
import { useTranslation } from '@/context/LanguageContext';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { Card } from '@/components/ui/card';
import {
  Play,
  Pause,
  Volume2,
  Plus,
  Tv,
  Users,
  LogOut,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  Trash2,
  Crown,
  SkipForward,
  ChevronUp,
  ChevronDown,
  User,
  UserX,
  Edit3,
  Maximize,
  Minimize,
  Shield,
  ShieldAlert,
  Lock,
  Unlock,
  Search,
  QrCode,
  Copy,
  Check,
  Sparkles,
  Timer,
} from 'lucide-react';

interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

interface MemberInfo {
  uid: string;
  joinedAt: number;
  nickname?: string;
}

export const RemoteView: React.FC = () => {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialRoom = searchParams.get('room') || '';

  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [inputCode, setInputCode] = useState(initialRoom);
  const [activeRoomCode, setActiveRoomCode] = useState<string | null>(null);
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [memberCount, setMemberCount] = useState<number>(1);
  const [membersList, setMembersList] = useState<MemberInfo[]>([]);
  const [queueInputUrl, setQueueInputUrl] = useState('');

  // Search & Video Input Tab state
  const [inputTab, setInputTab] = useState<'search' | 'url'>('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResultItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [hasApiKey, setHasApiKey] = useState<boolean>(true);

  // Admin state
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [adminsList, setAdminsList] = useState<string[]>([]);

  // Nickname state
  const [myNickname, setMyNickname] = useState<string>('');
  const [isEditingNickname, setIsEditingNickname] = useState<boolean>(false);
  const [nicknameInput, setNicknameInput] = useState<string>('');

  const [loading, setLoading] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // QR Code & Join Link state
  const [showQrCode, setShowQrCode] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);

  // Host & Admin status helpers
  const isHost = Boolean(user && roomState?.hostUid === user.uid);
  const isHostOrAdmin = isHost || isAdmin;

  const handleCopyJoinLink = () => {
    if (!activeRoomCode) return;
    const joinUrl = `${window.location.origin}/#/join?room=${activeRoomCode}`;
    navigator.clipboard.writeText(joinUrl);
    setCopiedLink(true);
    showToast(t('remote.linkCopied'), 'success');
    setTimeout(() => setCopiedLink(false), 2000);
  };

  // Slider drag states for volume control
  const [localVolume, setLocalVolume] = useState<number | null>(null);
  const [isDraggingVolume, setIsDraggingVolume] = useState<boolean>(false);

  const displayVolume = isDraggingVolume && localVolume !== null
    ? localVolume
    : (localVolume ?? roomState?.playback?.volume ?? 80);

  // Sync local volume with incoming room state when not dragging
  useEffect(() => {
    if (!isDraggingVolume && roomState?.playback?.volume !== undefined) {
      setLocalVolume(roomState.playback.volume);
    }
  }, [roomState?.playback?.volume, isDraggingVolume]);

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalVolume(Number(e.target.value));
    setIsDraggingVolume(true);
  };

  const handleVolumeCommit = () => {
    if (localVolume !== null && isDraggingVolume) {
      sendCommand('adjustVolume', { volume: localVolume });
    }
    setIsDraggingVolume(false);
  };

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info', duration = 3000) => {
    const id = `${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Authenticate anonymously on mount
  useEffect(() => {
    ensureAnonymousAuth()
      .then((u) => setUser(u))
      .catch((err) => {
        console.error('Auth error:', err);
        showToast(t('toasts.authFailed'), 'error');
      });
  }, []);

  // Subscribe to RTDB admins node to verify admin status
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

  // Auto-join if room code parameter present in URL
  useEffect(() => {
    if (user && initialRoom && !activeRoomCode) {
      handleJoinRoom(initialRoom);
    }
  }, [user, initialRoom]);

  // Subscribe to room updates when activeRoomCode changes
  useEffect(() => {
    if (!activeRoomCode || !user) return;

    const stateRefNode = ref(database, `rooms/${activeRoomCode}/state`);
    const queueRefNode = ref(database, `rooms/${activeRoomCode}/queue`);
    const membersRefNode = ref(database, `rooms/${activeRoomCode}/members`);

    const unsubState = onValue(stateRefNode, (snapshot) => {
      if (snapshot.exists()) {
        setRoomState(snapshot.val());
      } else {
        // Room no longer exists
        setActiveRoomCode(null);
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
        // Check if current member was kicked
        if (user && !membersData[user.uid]) {
          setActiveRoomCode(null);
          setSearchParams({});
          setMembersList([]);
          setMemberCount(0);
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

        // Sync my nickname from RTDB if present and not editing
        const myRecord = list.find((m) => m.uid === user.uid);
        if (myRecord && myRecord.nickname && !isEditingNickname) {
          setMyNickname(myRecord.nickname);
        }
      } else {
        if (user && activeRoomCode) {
          setActiveRoomCode(null);
          setSearchParams({});
          showToast(t('toasts.roomCleared'), 'error');
        }
        setMembersList([]);
        setMemberCount(0);
      }
    });

    return () => {
      off(stateRefNode);
      off(queueRefNode);
      off(membersRefNode);
    };
  }, [activeRoomCode, user, isEditingNickname, t]);

  const handleJoinRoom = async (codeToJoin: string) => {
    const cleanCode = codeToJoin.trim();
    if (cleanCode.length !== 6) {
      showToast(t('toasts.validPinRequired'), 'error');
      return;
    }

    setLoading(true);

    try {
      const u = user || (await ensureAnonymousAuth());
      setUser(u);

      const exists = await checkRoomExists(cleanCode);
      if (!exists) {
        showToast(t('toasts.roomNotFound', { code: cleanCode }), 'error');
        setLoading(false);
        return;
      }

      // Write member node (preserving existing nickname if present)
      const memberRef = ref(database, `rooms/${cleanCode}/members/${u.uid}`);
      await update(memberRef, {
        uid: u.uid,
        joinedAt: Date.now(),
      });

      setActiveRoomCode(cleanCode);
      setSearchParams({ room: cleanCode });
      showToast(t('toasts.joinedRoom', { code: cleanCode }), 'success');
    } catch (err: any) {
      console.error('Error joining room:', err);
      showToast(err.message || t('toasts.commandFailed'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      const u = await signInWithGoogle();
      setUser(u);
      showToast(t('toasts.signedInAs', { name: u.displayName || u.email || 'Google User' }), 'success');
    } catch (err: any) {
      console.error('Google Sign In Error:', err);
      showToast(err.message || 'Google Sign In failed.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logoutUser();
      const anon = await ensureAnonymousAuth();
      setUser(anon);
      showToast(t('toasts.signedOutGoogle'), 'info');
    } catch (err: any) {
      console.error('Logout error:', err);
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
      showToast(cleanName ? t('toasts.nicknameSet', { name: cleanName }) : t('toasts.nicknameReset'), 'success');
    } catch (err: any) {
      console.error('Failed to update nickname:', err);
      showToast(t('toasts.nicknameFailed'), 'error');
    }
  };

  // Cooldown state for fullscreen toggle
  const [fullscreenCooldown, setFullscreenCooldown] = useState<boolean>(false);

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

  const sendCommand = async (
    type: 'play' | 'pause' | 'addToQueue' | 'removeFromQueue' | 'adjustVolume' | 'forceSkip' | 'reorderQueue' | 'forceRemoveFromQueue' | 'kickMember' | 'toggleFullscreen' | 'clearQueue' | 'toggleRoomLock' | 'toggleAutoplay' | 'toggleCountdown',
    payload?: any
  ) => {
    if (!activeRoomCode || !user) return;

    if (roomState?.isLocked && !isHostOrAdmin) {
      if (type === 'addToQueue' || type === 'play' || type === 'pause' || type === 'adjustVolume' || type === 'toggleAutoplay') {
        showToast(t('toasts.controlsLockedByAdmin'), 'error');
        return;
      }
    }

    try {
      const commandRefNode = ref(database, `rooms/${activeRoomCode}/members/${user.uid}/command`);
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
        toggleRoomLock: roomState?.isLocked ? t('toasts.roomUnlocked') : t('toasts.roomLocked'),
        toggleAutoplay: roomState?.isAutoplay ? t('toasts.autoplayDisabled') : t('toasts.autoplayEnabled'),
        toggleCountdown: roomState?.isCountdownEnabled ? t('toasts.countdownDisabled') : t('toasts.countdownEnabled'),
      };
      showToast(labelMap[type] || t('toasts.commandSent', { type }), 'success');
    } catch (err: any) {
      console.error('Failed to send command:', err);
      showToast(t('toasts.commandFailed'), 'error');
    }
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
    } catch (err) {
      console.warn('Direct remove failed, sending member command:', err);
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

  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setSearchError(null);

    const res = await searchYouTubeVideos(searchQuery.trim());
    setHasApiKey(res.hasApiKey);
    setSearchResults(res.results);
    if (res.error) {
      setSearchError(res.error);
    }
    setIsSearching(false);
  };

  const handleAddSearchResult = (result: SearchResultItem) => {
    if (roomState?.isLocked && !isHostOrAdmin) {
      showToast(t('toasts.controlsLockedByAdmin'), 'error');
      return;
    }
    sendCommand('addToQueue', { url: result.url, title: result.title });
    showToast(t('toasts.videoAddedQueue'), 'success');
  };

  const handleAddQueueSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!queueInputUrl.trim()) return;

    if (roomState?.isLocked && !isHostOrAdmin) {
      showToast(t('toasts.controlsLockedByAdmin'), 'error');
      return;
    }

    const ytId = parseYouTubeVideoId(queueInputUrl.trim());
    if (!ytId) {
      showToast(t('toasts.enterValidUrl'), 'error');
      return;
    }

    const fullUrl = `https://www.youtube.com/watch?v=${ytId}`;
    const info = await fetchVideoTitle(fullUrl);
    sendCommand('addToQueue', { url: fullUrl, title: info.title });
    setQueueInputUrl('');
  };

  const handleLeaveRoom = () => {
    setActiveRoomCode(null);
    setSearchParams({});
    setRoomState(null);
    setQueue([]);
    showToast(t('toasts.leftRoom'), 'info');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans relative">
      {/* Floating Toast Notification Container (Zero Layout Shift) */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm px-4 pointer-events-none flex flex-col items-center gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto w-full flex items-center justify-between gap-3 p-3 text-xs font-semibold uppercase tracking-wider backdrop-blur-md shadow-2xl transition-all border rounded-none ${toast.type === 'success'
                ? 'bg-slate-900/95 border-[#00c8d4] text-[#00c8d4] shadow-[0_0_15px_rgba(0,200,212,0.3)]'
                : toast.type === 'error'
                  ? 'bg-slate-900/95 border-red-500 text-red-300 shadow-[0_0_15px_rgba(239,68,68,0.3)]'
                  : 'bg-slate-900/95 border-slate-700 text-slate-200'
              }`}
          >
            <div className="flex items-center gap-2 truncate">
              {toast.type === 'success' && <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-[#00c8d4]" />}
              {toast.type === 'error' && <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-400" />}
              {toast.type === 'info' && <Tv className="w-4 h-4 flex-shrink-0 text-slate-400" />}
              <span className="truncate">{toast.message}</span>
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="p-1 text-slate-400 hover:text-slate-100 transition-colors cursor-pointer"
              title="Dismiss"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      {/* Render Room Code Input Screen if not connected to a room */}
      {!activeRoomCode ? (
        <div className="flex min-h-screen items-center justify-center p-4">
          <Card className="w-full max-w-md p-6 bg-slate-900 border-slate-800 rounded-none shadow-2xl flex flex-col gap-6 relative">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-[#00c8d4]/10 rounded-none border border-[#00c8d4]/30">
                  <Tv className="w-6 h-6 text-[#00c8d4]" />
                </div>
                <div>
                  <h1 className="text-xl font-semibold tracking-wide text-slate-100">{t('remote.title')}</h1>
                  <p className="text-xs text-slate-400">{t('remote.subtitle')}</p>
                </div>
              </div>
              <LanguageSwitcher />
            </div>

            <div className="flex flex-col gap-3">
              <label className="text-xs font-medium text-slate-300">{t('remote.connectDesc')}</label>
              <input
                type="text"
                maxLength={6}
                value={inputCode}
                onChange={(e) => setInputCode(e.target.value.replace(/\D/g, ''))}
                placeholder={t('remote.enterPinPlaceholder')}
                className="w-full px-4 py-3 bg-slate-950 border border-slate-700 text-center font-mono text-2xl tracking-[0.3em] text-[#00c8d4] placeholder-slate-600 focus:outline-none focus:border-[#00c8d4]"
              />
              <button
                onClick={() => handleJoinRoom(inputCode)}
                disabled={loading || inputCode.length !== 6}
                className="w-full mt-2 py-3 bg-[#00c8d4] hover:bg-[#00b0bd] text-slate-950 font-bold uppercase tracking-wider text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{t('remote.connecting')}</span>
                  </>
                ) : (
                  <span>{t('remote.joinRoomBtn')}</span>
                )}
              </button>
            </div>
          </Card>
        </div>
      ) : (
        <div className="flex min-h-screen flex-col p-4 sm:p-6 max-w-lg mx-auto">
          {/* Header bar */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-5 gap-2">
            <div className="flex items-center gap-3">
              <div className="flex flex-col">
                <span className="text-xs text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                  {t('remote.connectedToRoom')}
                </span>
                <span className="font-mono text-xl font-bold text-[#00c8d4] tracking-widest">{activeRoomCode}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap justify-end">
              <LanguageSwitcher />

              {isAdmin ? (
                <span className="flex items-center gap-1 px-2.5 py-1 bg-purple-950/90 border border-purple-500/70 text-xs font-bold text-purple-300 uppercase tracking-wider shadow-[0_0_12px_rgba(168,85,247,0.4)]">
                  <Shield className="w-3.5 h-3.5 text-purple-400 fill-purple-400" />
                  {t('remote.adminBadge')}
                </span>
              ) : isHost ? (
                <span className="flex items-center gap-1 px-2.5 py-1 bg-amber-950/80 border border-amber-500/60 text-xs font-bold text-amber-300 uppercase tracking-wider shadow-[0_0_10px_rgba(245,158,11,0.2)]">
                  <Crown className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                  {t('remote.hostBadge')}
                </span>
              ) : (
                <span className="flex items-center gap-1 px-2.5 py-1 bg-slate-900 border border-slate-800 text-xs text-slate-400 uppercase tracking-wider">
                  {t('remote.memberBadge')}
                </span>
              )}
              {roomState?.isLocked && (
                <span className="flex items-center gap-1 px-2 py-1 bg-red-950/80 border border-red-800 text-[10px] font-bold text-red-400 uppercase tracking-wider">
                  <Lock className="w-3 h-3" />
                </span>
              )}
              <span className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-900 border border-slate-800 text-xs text-slate-300">
                <Users className="w-3.5 h-3.5 text-[#00c8d4]" />
                {memberCount}
              </span>
              <button
                onClick={handleLeaveRoom}
                title={t('remote.leaveRoomBtn')}
                className="p-2 bg-slate-900 hover:bg-red-950/60 border border-slate-800 hover:border-red-800 text-slate-400 hover:text-red-300 transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Profile & Google Auth Card */}
          <Card className="p-4 bg-slate-900 border-slate-800 rounded-none mb-5 flex flex-col gap-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-200 uppercase tracking-wider">
                <User className="w-4 h-4 text-[#00c8d4]" />
                {t('remote.accountProfile')}
              </div>

              {user?.isAnonymous === false ? (
                <button
                  onClick={handleLogout}
                  className="text-[10px] font-semibold text-slate-400 hover:text-red-400 uppercase tracking-wider transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <LogOut className="w-3 h-3" />
                  {t('remote.signOut')}
                </button>
              ) : (
                <button
                  onClick={handleGoogleSignIn}
                  className="px-2.5 py-1 bg-slate-950 hover:bg-slate-800 border border-slate-700 hover:border-[#00c8d4] text-slate-100 text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer shadow-md"
                >
                  <svg className="w-3 h-3" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                  </svg>
                  <span>{t('remote.signInWithGoogle')}</span>
                </button>
              )}
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {user?.photoURL ? (
                  <img src={user.photoURL} alt="Avatar" className="w-8 h-8 rounded-full border border-slate-700" />
                ) : (
                  <div className="w-8 h-8 bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 font-bold text-xs">
                    {(myNickname || 'G')[0].toUpperCase()}
                  </div>
                )}
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                    {user?.displayName || myNickname || `Guest (${user?.uid.substring(0, 4)})`}
                    {isAdmin && <Shield className="w-3.5 h-3.5 text-purple-400 fill-purple-400" />}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">{user?.email || `UID: ${user?.uid.substring(0, 8)}...`}</span>
                </div>
              </div>

              {!isEditingNickname ? (
                <button
                  onClick={() => {
                    setNicknameInput(myNickname);
                    setIsEditingNickname(true);
                  }}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-semibold uppercase tracking-wider flex items-center gap-1 transition-colors cursor-pointer border border-slate-700"
                  title="Edit your nickname"
                >
                  <Edit3 className="w-3 h-3 text-[#00c8d4]" />
                  <span>{t('remote.editNickname')}</span>
                </button>
              ) : null}
            </div>

            {isEditingNickname && (
              <form onSubmit={handleSaveNickname} className="flex items-center gap-2 pt-2 border-t border-slate-800">
                <input
                  type="text"
                  maxLength={25}
                  value={nicknameInput}
                  onChange={(e) => setNicknameInput(e.target.value)}
                  placeholder={t('remote.enterNicknamePlaceholder')}
                  className="flex-1 px-3 py-1.5 bg-slate-950 border border-slate-700 font-mono text-xs text-slate-100 focus:outline-none focus:border-[#00c8d4]"
                  autoFocus
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-[#00c8d4] hover:bg-[#00b0bd] text-slate-950 font-bold uppercase text-[10px] tracking-wider cursor-pointer"
                >
                  {t('remote.saveBtn')}
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditingNickname(false)}
                  className="px-2.5 py-1.5 bg-slate-800 text-slate-400 hover:text-slate-200 text-[10px] cursor-pointer"
                >
                  {t('remote.cancelBtn')}
                </button>
              </form>
            )}
          </Card>

          {/* Admin / Host Control Panel */}
          {isHostOrAdmin && (
            <Card className="p-4 bg-slate-900 border-purple-900/50 rounded-none mb-5 flex flex-col gap-3 shadow-[0_0_15px_rgba(168,85,247,0.1)]">
              <div className="text-xs font-bold text-purple-300 uppercase tracking-wider border-b border-purple-900/40 pb-2 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-purple-400" />
                  {isAdmin ? t('remote.adminOverridePanel') : t('remote.hostManagementPanel')}
                </span>
                <span className="text-[10px] text-purple-400/80 font-mono">{t('remote.overrideActive')}</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button
                  onClick={handleClearQueueAdmin}
                  disabled={queue.length === 0}
                  className="py-2.5 bg-red-950/80 hover:bg-red-900 disabled:opacity-40 border border-red-800 text-red-200 font-bold uppercase text-xs tracking-wider flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:cursor-not-allowed"
                  title="Clear all videos in the queue"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{t('remote.clearQueueBtn')} ({queue.length})</span>
                </button>

                <button
                  onClick={handleToggleRoomLockAdmin}
                  className={`py-2.5 border font-bold uppercase text-xs tracking-wider flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${roomState?.isLocked
                      ? 'bg-amber-950/90 border-amber-600 text-amber-300 shadow-[0_0_10px_rgba(245,158,11,0.2)]'
                      : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300'
                    }`}
                  title="Lock/Unlock room controls for regular members"
                >
                  {roomState?.isLocked ? (
                    <>
                      <Lock className="w-3.5 h-3.5 text-amber-400" />
                      <span>{t('remote.unlockRoomBtn')}</span>
                    </>
                  ) : (
                    <>
                      <Unlock className="w-3.5 h-3.5 text-slate-400" />
                      <span>{t('remote.lockRoomBtn')}</span>
                    </>
                  )}
                </button>

                <button
                  onClick={() => sendCommand('toggleCountdown')}
                  className={`py-2.5 border font-bold uppercase text-xs tracking-wider flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${roomState?.isCountdownEnabled
                      ? 'bg-cyan-950/90 border-[#00c8d4] text-[#00c8d4] shadow-[0_0_10px_rgba(0,200,212,0.3)]'
                      : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300'
                    }`}
                  title="Toggle 10-Second Countdown on TV"
                >
                  <Timer className="w-3.5 h-3.5" />
                  <span>{roomState?.isCountdownEnabled ? t('remote.countdownOn') : t('remote.countdownOff')}</span>
                </button>
              </div>
            </Card>
          )}

          {/* Currently Playing Card */}
          <Card className="p-4 bg-slate-900 border-slate-800 rounded-none mb-5">
            <div className="text-xs text-slate-400 uppercase tracking-wider mb-2 flex items-center justify-between">
              <span>{t('remote.nowPlayingTv')}</span>
              <span
                className={`px-2 py-0.5 text-[10px] uppercase font-bold tracking-widest ${roomState?.playback?.status === 'playing'
                    ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                    : 'bg-amber-950 text-amber-400 border border-amber-800'
                  }`}
              >
                {roomState?.playback?.status === 'playing' ? t('remote.playingStatus') : t('remote.pausedStatus')}
              </span>
            </div>
            {roomState?.currentlyPlaying ? (
              <div className="flex gap-3 items-center">
                {parseYouTubeVideoId(roomState.currentlyPlaying) ? (
                  <img
                    src={`https://img.youtube.com/vi/${parseYouTubeVideoId(roomState.currentlyPlaying)}/hqdefault.jpg`}
                    alt="Video thumbnail"
                    className="w-20 h-14 object-cover border border-slate-800"
                  />
                ) : null}
                <div className="overflow-hidden flex-1 flex flex-col min-w-0">
                  {roomState?.currentlyPlayingTitle ? (
                    <p className="text-xs font-bold text-slate-100 truncate font-sans mb-0.5">{roomState.currentlyPlayingTitle}</p>
                  ) : null}
                  <p className="text-[11px] font-mono text-[#00c8d4] truncate">{roomState.currentlyPlaying}</p>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic">{t('remote.noVideoSelected')}</p>
            )}
          </Card>

          {/* Main Playback Controls */}
          <Card className="p-5 bg-slate-900 border-slate-800 rounded-none mb-5 flex flex-col gap-5">
            <div className="text-xs font-bold text-slate-300 uppercase tracking-wider border-b border-slate-800 pb-2 flex items-center justify-between">
              <span>{t('remote.playbackControls')}</span>
              {isHostOrAdmin && <span className="text-[10px] text-amber-400 font-semibold">{t('remote.privilegedOverrideActive')}</span>}
            </div>

            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => sendCommand('play')}
                disabled={roomState?.playback?.status === 'playing' || (Boolean(roomState?.isLocked) && !isHostOrAdmin)}
                className="flex-1 py-3.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-slate-950 font-bold uppercase tracking-wider text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:cursor-not-allowed"
              >
                <Play className="w-4 h-4 fill-slate-950" />
                <span>{t('watchParty.playBtn')}</span>
              </button>

              <button
                onClick={() => sendCommand('pause')}
                disabled={roomState?.playback?.status !== 'playing' || (Boolean(roomState?.isLocked) && !isHostOrAdmin)}
                className="flex-1 py-3.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 font-bold uppercase tracking-wider text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:cursor-not-allowed"
              >
                <Pause className="w-4 h-4 fill-slate-950" />
                <span>{t('watchParty.pauseBtn')}</span>
              </button>

              {isHostOrAdmin && (
                <button
                  onClick={() => sendCommand('forceSkip')}
                  className="px-4 py-3.5 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold uppercase tracking-wider text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-[0_0_10px_rgba(0,200,212,0.3)]"
                  title="Skip video on TV (Privileged action)"
                >
                  <SkipForward className="w-4 h-4 fill-slate-950" />
                  <span>{t('watchParty.skipNextBtn')}</span>
                </button>
              )}
            </div>

            {/* Volume Slider */}
            <div className="flex flex-col gap-2 pt-2 border-t border-slate-800">
              <div className="flex items-center justify-between text-xs text-slate-300">
                <span className="flex items-center gap-1.5">
                  <Volume2 className="w-4 h-4 text-[#00c8d4]" />
                  {t('remote.tvVolume')}
                </span>
                <span className="font-mono text-[#00c8d4] font-bold">{displayVolume}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={displayVolume}
                onChange={handleVolumeChange}
                onPointerUp={handleVolumeCommit}
                onTouchEnd={handleVolumeCommit}
                onMouseUp={handleVolumeCommit}
                className="w-full accent-[#00c8d4] bg-slate-950 cursor-pointer h-2 rounded-none"
              />
            </div>

            {/* Autoplay Toggle Row */}
            <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
              <span className="text-xs text-slate-300 flex items-center gap-1.5 font-medium">
                <Sparkles className={`w-4 h-4 ${roomState?.isAutoplay ? 'text-purple-400 animate-pulse' : 'text-slate-400'}`} />
                {t('remote.autoplayMode')}
              </span>
              <button
                onClick={() => sendCommand('toggleAutoplay')}
                disabled={Boolean(roomState?.isLocked) && !isHostOrAdmin}
                className={`px-3 py-1.5 border text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${roomState?.isAutoplay
                    ? 'bg-purple-950/80 border-purple-500 text-purple-300 shadow-[0_0_10px_rgba(168,85,247,0.3)]'
                    : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
                  }`}
                title="Toggle Autoplay mode via Last.fm recommendation"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{roomState?.isAutoplay ? t('remote.autoplayOn') : t('remote.autoplayOff')}</span>
              </button>
            </div>

            {/* Fullscreen Toggle Row for All Members */}
            <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
              <span className="text-xs text-slate-300 flex items-center gap-1.5 font-medium">
                {roomState?.isFullscreen ? (
                  <Minimize className="w-4 h-4 text-[#00c8d4]" />
                ) : (
                  <Maximize className="w-4 h-4 text-slate-400" />
                )}
                {t('remote.tvDisplayMode')}
              </span>
              <button
                onClick={handleToggleFullscreenClick}
                disabled={fullscreenCooldown}
                className={`px-3 py-1.5 border text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer disabled:cursor-not-allowed ${roomState?.isFullscreen
                    ? 'bg-cyan-950/80 border-[#00c8d4] text-[#00c8d4] shadow-[0_0_10px_rgba(0,200,212,0.3)]'
                    : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
                  }`}
                title="Toggle TV Fullscreen (5s cooldown)"
              >
                {roomState?.isFullscreen ? (
                  <>
                    <Minimize className="w-3.5 h-3.5" />
                    <span>{t('remote.exitFullscreen')}</span>
                  </>
                ) : (
                  <>
                    <Maximize className="w-3.5 h-3.5 text-[#00c8d4]" />
                    <span>{t('remote.fullscreenTv')}</span>
                  </>
                )}
              </button>
            </div>

            {/* Show Join Link QR Code Row */}
            <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
              <span className="text-xs text-slate-300 flex items-center gap-1.5 font-medium">
                <QrCode className="w-4 h-4 text-[#00c8d4]" />
                {t('remote.joinQrCode')}
              </span>
              <button
                onClick={() => setShowQrCode((prev) => !prev)}
                className={`px-3 py-1.5 border text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer ${
                  showQrCode
                    ? 'bg-[#00c8d4] text-slate-950 border-[#00c8d4] shadow-[0_0_10px_rgba(0,200,212,0.3)]'
                    : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
                }`}
                title="Toggle Join Link QR Code"
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>{showQrCode ? t('remote.hideQrCode') : t('remote.showQrCode')}</span>
              </button>
            </div>

            {/* Join Link QR Code Panel */}
            {showQrCode && (
              <div className="pt-2 border-t border-slate-800 flex flex-col items-center gap-3 p-4 bg-slate-950 text-center transition-all animate-fadeIn">
                <p className="text-xs text-slate-400 font-medium">{t('remote.scanToJoin')}</p>
                <div className="p-3 bg-white border-4 border-[#00c8d4] shadow-[0_0_15px_rgba(0,200,212,0.2)]">
                  <QRCodeSVG value={`${window.location.origin}/#/join?room=${activeRoomCode}`} size={160} level="M" />
                </div>
                <div className="flex flex-col items-center gap-1.5 w-full">
                  <span className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold">{t('watchParty.roomBadge')}</span>
                  <span className="font-mono text-2xl font-bold tracking-[0.2em] text-[#00c8d4]">{activeRoomCode}</span>
                </div>
                <button
                  onClick={handleCopyJoinLink}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer w-full justify-center"
                >
                  {copiedLink ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">{t('remote.linkCopied')}</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-[#00c8d4]" />
                      <span>{t('remote.copyJoinLink')}</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </Card>

          {/* Add to Queue / Search YouTube Section */}
          <Card className="p-4 bg-slate-900 border-slate-800 rounded-none mb-5 flex flex-col gap-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setInputTab('search')}
                  className={`px-3 py-1 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer border ${
                    inputTab === 'search'
                      ? 'bg-[#00c8d4]/10 text-[#00c8d4] border-[#00c8d4]/50'
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                  }`}
                >
                  <Search className="w-3.5 h-3.5" />
                  <span>{t('remote.searchYoutubeTab')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setInputTab('url')}
                  className={`px-3 py-1 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer border ${
                    inputTab === 'url'
                      ? 'bg-[#00c8d4]/10 text-[#00c8d4] border-[#00c8d4]/50'
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                  }`}
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{t('remote.pasteLinkTab')}</span>
                </button>
              </div>

              {roomState?.isLocked && !isHostOrAdmin && (
                <span className="text-[10px] text-amber-400 flex items-center gap-1 font-semibold">
                  <Lock className="w-3 h-3" /> Locked
                </span>
              )}
            </div>

            {inputTab === 'search' ? (
              <div className="flex flex-col gap-3">
                <form onSubmit={handleSearchSubmit} className="flex gap-2">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    disabled={Boolean(roomState?.isLocked) && !isHostOrAdmin}
                    placeholder={roomState?.isLocked && !isHostOrAdmin ? t('remote.searchQueueLocked') : t('remote.searchPlaceholder')}
                    className="flex-1 px-3 py-2 bg-slate-950 border border-slate-700 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-[#00c8d4] disabled:opacity-40"
                  />
                  <button
                    type="submit"
                    disabled={isSearching || (Boolean(roomState?.isLocked) && !isHostOrAdmin)}
                    className="px-4 py-2 bg-[#00c8d4] hover:bg-[#00b0bd] text-slate-950 font-bold uppercase text-xs tracking-wider flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {isSearching ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Search className="w-4 h-4" />
                        <span>{t('remote.searchBtn')}</span>
                      </>
                    )}
                  </button>
                </form>

                {/* Info alert if API key is not configured */}
                {!hasApiKey && (
                  <div className="p-3 bg-slate-950 border border-amber-800/60 text-amber-300 text-xs flex flex-col gap-1">
                    <span className="font-bold flex items-center gap-1.5 text-amber-400">
                      <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                      {t('remote.ytKeyNeededTitle')}
                    </span>
                    <p className="text-[11px] text-amber-300/80 leading-relaxed">
                      {t('remote.ytKeyNeededDesc')}
                    </p>
                  </div>
                )}

                {searchError && (
                  <p className="text-xs text-red-400 font-mono italic p-2 bg-red-950/40 border border-red-900/50">
                    {searchError}
                  </p>
                )}

                {/* Search Results List */}
                {searchResults.length > 0 && (
                  <div className="flex flex-col gap-2 max-h-64 overflow-y-auto pr-1">
                    {searchResults.map((res) => (
                      <div key={res.id} className="flex gap-2.5 p-2 bg-slate-950 border border-slate-800 hover:border-slate-700 transition-colors items-center">
                        <img src={res.thumbnail} alt={res.title} className="w-16 h-11 object-cover border border-slate-800 flex-shrink-0" />
                        <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                          <p className="text-xs font-bold text-slate-100 truncate">{res.title}</p>
                          <p className="text-[10px] text-slate-400 font-mono truncate">{res.channelTitle}</p>
                        </div>
                        <button
                          onClick={() => handleAddSearchResult(res)}
                          disabled={Boolean(roomState?.isLocked) && !isHostOrAdmin}
                          className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-slate-950 font-bold uppercase text-[10px] tracking-wider flex items-center gap-1 transition-all cursor-pointer disabled:cursor-not-allowed flex-shrink-0 shadow-md"
                          title="Add video to queue"
                        >
                          <Plus className="w-3 h-3" />
                          <span>{t('remote.addBtn')}</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <form onSubmit={handleAddQueueSubmit} className="flex flex-col gap-3">
                <input
                  type="url"
                  value={queueInputUrl}
                  onChange={(e) => setQueueInputUrl(e.target.value)}
                  disabled={Boolean(roomState?.isLocked) && !isHostOrAdmin}
                  placeholder={roomState?.isLocked && !isHostOrAdmin ? t('remote.searchQueueLocked') : t('remote.pasteUrlPlaceholder')}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-[#00c8d4] disabled:opacity-40"
                />
                <button
                  type="submit"
                  disabled={Boolean(roomState?.isLocked) && !isHostOrAdmin}
                  className="py-2.5 bg-[#00c8d4] hover:bg-[#00b0bd] text-slate-950 font-bold uppercase tracking-wider text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Plus className="w-4 h-4" />
                  <span>{t('remote.submitVideoToQueue')}</span>
                </button>
              </form>
            )}
          </Card>

          {/* Members & Per-Member Requests Section */}
          <Card className="p-4 bg-slate-900 border-slate-800 rounded-none mb-5 flex flex-col gap-4">
            <div className="text-xs font-bold text-slate-300 uppercase tracking-wider border-b border-slate-800 pb-2 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Users className="w-4 h-4 text-[#00c8d4]" />
                {t('remote.roomMembersAndRequests')}
              </span>
              <span className="text-slate-500 font-mono text-[11px]">{t('remote.membersCount', { count: membersList.length })}</span>
            </div>

            <div className="flex flex-col gap-3">
              {membersList.map((member, mIdx) => {
                const isMemberAdmin = adminsList.includes(member.uid);
                const isHostUser = member.uid === roomState?.hostUid;
                const isSelf = member.uid === user?.uid;
                const memberRequests = queue.filter((item) => item.addedBy === member.uid);

                const displayName = member.nickname || `User #${mIdx + 1}`;

                return (
                  <div key={member.uid} className="bg-slate-950 border border-slate-800 p-3 flex flex-col gap-2">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 font-mono flex-wrap">
                        <User className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                        <span className="font-bold text-slate-100">{displayName}</span>
                        <span className="text-[10px] text-slate-500">({member.uid.substring(0, 6)})</span>
                        {isMemberAdmin && (
                          <span className="px-1.5 py-0.5 text-[9px] bg-purple-950 text-purple-300 border border-purple-800 font-bold uppercase flex items-center gap-1">
                            <Shield className="w-2.5 h-2.5 text-purple-400" /> {t('remote.adminBadge')}
                          </span>
                        )}
                        {isHostUser && !isMemberAdmin && (
                          <span className="px-1.5 py-0.5 text-[9px] bg-amber-950 text-amber-300 border border-amber-800 font-bold uppercase">
                            {t('remote.hostBadge')}
                          </span>
                        )}
                        {isSelf && (
                          <span className="px-1.5 py-0.5 text-[9px] bg-[#00c8d4]/10 text-[#00c8d4] border border-[#00c8d4]/30 font-bold uppercase">
                            {t('remote.youBadge')}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-400 font-mono">
                          {memberRequests.length} {memberRequests.length === 1 ? 'request' : 'requests'}
                        </span>
                        {isHostOrAdmin && !isSelf && !isMemberAdmin && (
                          <button
                            onClick={() => handleKickMember(member.uid)}
                            className="px-2 py-1 bg-red-950/80 hover:bg-red-900 border border-red-800 text-red-300 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 transition-colors cursor-pointer"
                            title="Kick member and remove their requested videos"
                          >
                            <UserX className="w-3 h-3" />
                            <span>{t('remote.kickMemberBtn')}</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Member's Requested Videos List */}
                    <div className="pl-3 border-l-2 border-slate-800 flex flex-col gap-1.5 mt-1">
                      {memberRequests.length === 0 ? (
                        <p className="text-[11px] text-slate-500 italic">{t('remote.noVideoRequestsInQueue')}</p>
                      ) : (
                        memberRequests.map((req) => {
                          const overallIndex = queue.findIndex((q) => q.id === req.id) + 1;
                          return (
                            <div key={req.id} className="flex items-center justify-between text-[11px] font-mono text-slate-300 gap-2 bg-slate-900/60 p-1.5 border border-slate-800/80">
                              <div className="truncate flex items-center gap-1.5 min-w-0 flex-1">
                                <span className="text-[#00c8d4] font-bold flex-shrink-0 font-mono">#{overallIndex}</span>
                                <span className="truncate font-sans font-medium text-slate-200">{req.title || req.url}</span>
                              </div>
                              {isHostOrAdmin && (
                                <button
                                  onClick={() => handleRemoveQueueItem(req.id, req.addedBy)}
                                  className="text-slate-500 hover:text-red-400 p-1 cursor-pointer flex-shrink-0"
                                  title="Delete video request"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Up Next Queue List */}
          <Card className="p-4 bg-slate-900 border-slate-800 rounded-none flex-1">
            <div className="text-xs font-bold text-slate-300 uppercase tracking-wider border-b border-slate-800 pb-2 mb-3 flex items-center justify-between">
              <span>{t('remote.upcomingQueue')}</span>
              <span className="text-slate-500 font-mono text-[11px]">{t('remote.itemsCount', { count: queue.length })}</span>
            </div>
            {queue.length === 0 ? (
              <p className="text-xs text-slate-500 italic py-4 text-center">{t('watchParty.queueEmpty')}</p>
            ) : (
              <div className="flex flex-col gap-2 max-h-56 overflow-y-auto pr-1">
                {queue.map((item, idx) => {
                  const ytId = parseYouTubeVideoId(item.url);
                  const isMyEntry = Boolean(user && item.addedBy === user.uid);
                  const canDelete = isMyEntry || isHostOrAdmin;
                  const addedByMember = membersList.find((m) => m.uid === item.addedBy);
                  const addedByLabel = isMyEntry
                    ? t('remote.youBadge')
                    : (addedByMember?.nickname || `User (${item.addedBy?.substring(0, 4) || '?'})`);

                  return (
                    <div key={item.id || idx} className="flex items-center gap-2 p-2 bg-slate-950 border border-slate-800 text-xs">
                      <span className="font-mono text-[#00c8d4] font-bold w-5 flex-shrink-0">#{idx + 1}</span>
                      {ytId ? (
                        <img src={`https://img.youtube.com/vi/${ytId}/hqdefault.jpg`} alt="thumb" className="w-10 h-7 object-cover flex-shrink-0" />
                      ) : null}
                      <div className="truncate flex-1 flex flex-col min-w-0">
                        <span className="truncate font-bold text-slate-100 font-sans">{item.title || item.url}</span>
                        {item.title ? (
                          <span className="truncate text-[10px] font-mono text-[#00c8d4]/80">{item.url}</span>
                        ) : null}
                      </div>
                      <span className="px-1.5 py-0.5 text-[9px] bg-[#00c8d4]/10 text-[#00c8d4] border border-[#00c8d4]/30 font-semibold uppercase flex-shrink-0">
                        {addedByLabel}
                      </span>

                      {/* Host & Admin Reorder Actions */}
                      {isHostOrAdmin && queue.length > 1 && (
                        <div className="flex items-center gap-0.5 flex-shrink-0 border-l border-slate-800 pl-1">
                          <button
                            onClick={() => handleMoveQueueItem(idx, 'up')}
                            disabled={idx === 0}
                            className="p-1 text-slate-400 hover:text-cyan-400 disabled:opacity-20 transition-colors cursor-pointer disabled:cursor-not-allowed"
                            title={t('remote.moveUp')}
                          >
                            <ChevronUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleMoveQueueItem(idx, 'down')}
                            disabled={idx === queue.length - 1}
                            className="p-1 text-slate-400 hover:text-cyan-400 disabled:opacity-20 transition-colors cursor-pointer disabled:cursor-not-allowed"
                            title={t('remote.moveDown')}
                          >
                            <ChevronDown className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}

                      {/* Delete Action */}
                      {canDelete && (
                        <button
                          onClick={() => handleRemoveQueueItem(item.id, item.addedBy)}
                          className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-slate-900 border border-transparent hover:border-red-900/50 transition-colors flex-shrink-0 cursor-pointer"
                          title={isHostOrAdmin && !isMyEntry ? "Force delete item (Privileged)" : "Delete your entry"}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
};
