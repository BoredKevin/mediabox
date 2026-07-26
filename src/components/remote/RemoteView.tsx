import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ref, onValue, set, update, remove, off } from 'firebase/database';
import { User as FirebaseUser } from 'firebase/auth';
import { ensureAnonymousAuth, database } from '@/lib/firebase';
import { checkRoomExists, RoomState, QueueItem, parseYouTubeVideoId } from '@/lib/roomUtils';
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

  // Nickname state
  const [myNickname, setMyNickname] = useState<string>('');
  const [isEditingNickname, setIsEditingNickname] = useState<boolean>(false);
  const [nicknameInput, setNicknameInput] = useState<string>('');

  const [loading, setLoading] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Host status helper
  const isHost = Boolean(user && roomState?.hostUid === user.uid);

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
        showToast('Failed to authenticate with Firebase.', 'error');
      });
  }, []);

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
        showToast('The room has been closed by the host TV.', 'error');
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
          showToast('You have been kicked from the room by the host.', 'error', 6000);
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
          showToast('The room was closed or member list cleared.', 'error');
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
  }, [activeRoomCode, user, isEditingNickname]);

  const handleJoinRoom = async (codeToJoin: string) => {
    const cleanCode = codeToJoin.trim();
    if (cleanCode.length !== 6) {
      showToast('Please enter a valid 6-digit room code.', 'error');
      return;
    }

    setLoading(true);

    try {
      const u = user || (await ensureAnonymousAuth());
      setUser(u);

      const exists = await checkRoomExists(cleanCode);
      if (!exists) {
        showToast(`Room "${cleanCode}" was not found. Please verify the code.`, 'error');
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
      showToast(`Joined Room ${cleanCode}!`, 'success');
    } catch (err: any) {
      console.error('Error joining room:', err);
      showToast(err.message || 'Error joining room.', 'error');
    } finally {
      setLoading(false);
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
      showToast(cleanName ? `Nickname set to "${cleanName}"!` : 'Nickname reset to default', 'success');
    } catch (err: any) {
      console.error('Failed to update nickname:', err);
      showToast('Failed to update nickname. Check room permissions.', 'error');
    }
  };

  const sendCommand = async (
    type: 'play' | 'pause' | 'addToQueue' | 'removeFromQueue' | 'adjustVolume' | 'forceSkip' | 'reorderQueue' | 'forceRemoveFromQueue' | 'kickMember',
    payload?: any
  ) => {
    if (!activeRoomCode || !user) return;

    try {
      const commandRefNode = ref(database, `rooms/${activeRoomCode}/members/${user.uid}/command`);
      await set(commandRefNode, {
        type,
        createdAt: Date.now(),
        payload: payload || {},
      });

      const labelMap: Record<string, string> = {
        play: 'Play command sent!',
        pause: 'Pause command sent!',
        addToQueue: 'Added video to queue!',
        removeFromQueue: 'Remove queue item command sent!',
        adjustVolume: `Volume set to ${payload?.volume}%!`,
        forceSkip: 'Skip track command sent!',
        reorderQueue: 'Queue reorder command sent!',
        forceRemoveFromQueue: 'Remove item command sent!',
        kickMember: 'Kick member command sent!',
      };
      showToast(labelMap[type] || `Sent ${type} command!`, 'success');
    } catch (err: any) {
      console.error('Failed to send command:', err);
      showToast('Failed to send command. Check room status.', 'error');
    }
  };

  const handleRemoveQueueItem = async (itemId: string, itemAddedBy?: string) => {
    if (!activeRoomCode || !user) return;
    const isMyEntry = itemAddedBy === user.uid;

    if (isHost && !isMyEntry) {
      sendCommand('forceRemoveFromQueue', { itemId });
      return;
    }

    try {
      const itemRef = ref(database, `rooms/${activeRoomCode}/queue/${itemId}`);
      await remove(itemRef);
      showToast('Removed item from queue.', 'success');
    } catch (err) {
      console.warn('Direct remove failed, sending member command:', err);
      sendCommand('removeFromQueue', { itemId });
    }
  };

  const handleKickMember = (targetUid: string) => {
    if (!isHost || targetUid === user?.uid) return;
    if (confirm('Are you sure you want to kick this member and purge their video requests?')) {
      sendCommand('kickMember', { targetUid, purgeQueue: true });
    }
  };

  const handleMoveQueueItem = (index: number, direction: 'up' | 'down') => {
    if (!isHost || queue.length <= 1) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= queue.length) return;

    const newQueue = [...queue];
    const [movedItem] = newQueue.splice(index, 1);
    newQueue.splice(targetIndex, 0, movedItem);

    const newOrderIds = newQueue.map((item) => item.id);
    sendCommand('reorderQueue', { queueOrder: newOrderIds });
  };

  const handleAddQueueSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!queueInputUrl.trim()) return;

    const ytId = parseYouTubeVideoId(queueInputUrl.trim());
    if (!ytId) {
      showToast('Please enter a valid YouTube video URL or ID.', 'error');
      return;
    }

    const fullUrl = `https://www.youtube.com/watch?v=${ytId}`;
    sendCommand('addToQueue', { url: fullUrl });
    setQueueInputUrl('');
  };

  const handleLeaveRoom = () => {
    setActiveRoomCode(null);
    setSearchParams({});
    setRoomState(null);
    setQueue([]);
    showToast('Left the room.', 'info');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans relative">
      {/* Floating Toast Notification Container (Zero Layout Shift) */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm px-4 pointer-events-none flex flex-col items-center gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto w-full flex items-center justify-between gap-3 p-3 text-xs font-semibold uppercase tracking-wider backdrop-blur-md shadow-2xl transition-all border rounded-none ${
              toast.type === 'success'
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
              className="p-1 text-slate-400 hover:text-slate-100 transition-colors"
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
          <Card className="w-full max-w-md p-6 bg-slate-900 border-slate-800 rounded-none shadow-2xl flex flex-col gap-6">
            <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
              <div className="p-3 bg-[#00c8d4]/10 rounded-none border border-[#00c8d4]/30">
                <Tv className="w-6 h-6 text-[#00c8d4]" />
              </div>
              <div>
                <h1 className="text-xl font-semibold tracking-wide text-slate-100">MediaBox Remote</h1>
                <p className="text-xs text-slate-400">Join a Watch Together room to control TV playback</p>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <label className="text-xs font-medium text-slate-300">Enter 6-Digit Room Code</label>
              <input
                type="text"
                maxLength={6}
                value={inputCode}
                onChange={(e) => setInputCode(e.target.value.replace(/\D/g, ''))}
                placeholder="e.g. 123456"
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
                    <span>Connecting...</span>
                  </>
                ) : (
                  <span>Join TV Room</span>
                )}
              </button>
            </div>
          </Card>
        </div>
      ) : (
        <div className="flex min-h-screen flex-col p-4 sm:p-6 max-w-lg mx-auto">
          {/* Header bar */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-5">
            <div className="flex items-center gap-3">
              <div className="flex flex-col">
                <span className="text-xs text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                  Connected to Room
                </span>
                <span className="font-mono text-xl font-bold text-[#00c8d4] tracking-widest">{activeRoomCode}</span>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              {isHost ? (
                <span className="flex items-center gap-1 px-2.5 py-1 bg-amber-950/80 border border-amber-500/60 text-xs font-bold text-amber-300 uppercase tracking-wider shadow-[0_0_10px_rgba(245,158,11,0.2)]">
                  <Crown className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                  Host
                </span>
              ) : (
                <span className="flex items-center gap-1 px-2.5 py-1 bg-slate-900 border border-slate-800 text-xs text-slate-400 uppercase tracking-wider">
                  Member
                </span>
              )}
              <span className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-900 border border-slate-800 text-xs text-slate-300">
                <Users className="w-3.5 h-3.5 text-[#00c8d4]" />
                {memberCount}
              </span>
              <button
                onClick={handleLeaveRoom}
                title="Leave Room"
                className="p-2 bg-slate-900 hover:bg-red-950/60 border border-slate-800 hover:border-red-800 text-slate-400 hover:text-red-300 transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Profile & Nickname Card */}
          <Card className="p-3 bg-slate-900 border-slate-800 rounded-none mb-5 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs">
              <User className="w-4 h-4 text-[#00c8d4] flex-shrink-0" />
              <span className="text-slate-400">Nickname:</span>
              {!isEditingNickname ? (
                <span className="font-mono font-bold text-slate-100">
                  {myNickname || `Guest (${user?.uid.substring(0, 4)})`}
                </span>
              ) : (
                <form onSubmit={handleSaveNickname} className="flex items-center gap-1.5">
                  <input
                    type="text"
                    maxLength={25}
                    value={nicknameInput}
                    onChange={(e) => setNicknameInput(e.target.value)}
                    placeholder="Enter nickname..."
                    className="px-2 py-1 bg-slate-950 border border-slate-700 font-mono text-xs text-slate-100 focus:outline-none focus:border-[#00c8d4] w-32 sm:w-40"
                    autoFocus
                  />
                  <button
                    type="submit"
                    className="px-2 py-1 bg-[#00c8d4] hover:bg-[#00b0bd] text-slate-950 font-bold uppercase text-[10px] tracking-wider cursor-pointer"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditingNickname(false)}
                    className="px-2 py-1 bg-slate-800 text-slate-400 hover:text-slate-200 text-[10px] cursor-pointer"
                  >
                    Cancel
                  </button>
                </form>
              )}
            </div>

            {!isEditingNickname && (
              <button
                onClick={() => {
                  setNicknameInput(myNickname);
                  setIsEditingNickname(true);
                }}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold uppercase tracking-wider flex items-center gap-1 transition-colors cursor-pointer border border-slate-700"
                title="Edit your nickname"
              >
                <Edit3 className="w-3 h-3 text-[#00c8d4]" />
                <span>Edit</span>
              </button>
            )}
          </Card>

          {/* Currently Playing Card */}
          <Card className="p-4 bg-slate-900 border-slate-800 rounded-none mb-5">
            <div className="text-xs text-slate-400 uppercase tracking-wider mb-2 flex items-center justify-between">
              <span>Now Playing on TV</span>
              <span
                className={`px-2 py-0.5 text-[10px] uppercase font-bold tracking-widest ${
                  roomState?.playback?.status === 'playing'
                    ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                    : 'bg-amber-950 text-amber-400 border border-amber-800'
                }`}
              >
                {roomState?.playback?.status === 'playing' ? 'PLAYING' : 'PAUSED'}
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
                <div className="overflow-hidden flex-1">
                  <p className="text-xs font-mono text-slate-300 truncate">{roomState.currentlyPlaying}</p>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic">No video selected</p>
            )}
          </Card>

          {/* Main Playback Controls */}
          <Card className="p-5 bg-slate-900 border-slate-800 rounded-none mb-5 flex flex-col gap-5">
            <div className="text-xs font-bold text-slate-300 uppercase tracking-wider border-b border-slate-800 pb-2 flex items-center justify-between">
              <span>Playback Controls</span>
              {isHost && <span className="text-[10px] text-amber-400 font-semibold">HOST ACTIONS ENABLED</span>}
            </div>

            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => sendCommand('play')}
                disabled={roomState?.playback?.status === 'playing'}
                className="flex-1 py-3.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-slate-950 font-bold uppercase tracking-wider text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:cursor-not-allowed"
              >
                <Play className="w-4 h-4 fill-slate-950" />
                <span>Play</span>
              </button>

              <button
                onClick={() => sendCommand('pause')}
                disabled={roomState?.playback?.status !== 'playing'}
                className="flex-1 py-3.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 font-bold uppercase tracking-wider text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:cursor-not-allowed"
              >
                <Pause className="w-4 h-4 fill-slate-950" />
                <span>Pause</span>
              </button>

              {isHost && (
                <button
                  onClick={() => sendCommand('forceSkip')}
                  className="px-4 py-3.5 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold uppercase tracking-wider text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-[0_0_10px_rgba(0,200,212,0.3)]"
                  title="Skip video on TV (Host action)"
                >
                  <SkipForward className="w-4 h-4 fill-slate-950" />
                  <span>Skip</span>
                </button>
              )}
            </div>

            {/* Volume Slider */}
            <div className="flex flex-col gap-2 pt-2 border-t border-slate-800">
              <div className="flex items-center justify-between text-xs text-slate-300">
                <span className="flex items-center gap-1.5">
                  <Volume2 className="w-4 h-4 text-[#00c8d4]" />
                  TV Volume
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
          </Card>

          {/* Add to Queue Section */}
          <Card className="p-4 bg-slate-900 border-slate-800 rounded-none mb-5">
            <div className="text-xs font-bold text-slate-300 uppercase tracking-wider border-b border-slate-800 pb-2 mb-3">
              Add YouTube Video to Queue
            </div>
            <form onSubmit={handleAddQueueSubmit} className="flex flex-col gap-3">
              <input
                type="url"
                value={queueInputUrl}
                onChange={(e) => setQueueInputUrl(e.target.value)}
                placeholder="Paste YouTube link or URL..."
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-[#00c8d4]"
              />
              <button
                type="submit"
                className="py-2.5 bg-[#00c8d4] hover:bg-[#00b0bd] text-slate-950 font-bold uppercase tracking-wider text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Submit Command to Queue</span>
              </button>
            </form>
          </Card>

          {/* Members & Per-Member Requests Section */}
          <Card className="p-4 bg-slate-900 border-slate-800 rounded-none mb-5 flex flex-col gap-4">
            <div className="text-xs font-bold text-slate-300 uppercase tracking-wider border-b border-slate-800 pb-2 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Users className="w-4 h-4 text-[#00c8d4]" />
                Room Members & Requests
              </span>
              <span className="text-slate-500 font-mono text-[11px]">{membersList.length} members</span>
            </div>

            <div className="flex flex-col gap-3">
              {membersList.map((member, mIdx) => {
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
                        {isHostUser && (
                          <span className="px-1.5 py-0.5 text-[9px] bg-amber-950 text-amber-300 border border-amber-800 font-bold uppercase">
                            Host
                          </span>
                        )}
                        {isSelf && (
                          <span className="px-1.5 py-0.5 text-[9px] bg-[#00c8d4]/10 text-[#00c8d4] border border-[#00c8d4]/30 font-bold uppercase">
                            You
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-400 font-mono">
                          {memberRequests.length} {memberRequests.length === 1 ? 'request' : 'requests'}
                        </span>
                        {isHost && !isSelf && !isHostUser && (
                          <button
                            onClick={() => handleKickMember(member.uid)}
                            className="px-2 py-1 bg-red-950/80 hover:bg-red-900 border border-red-800 text-red-300 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 transition-colors cursor-pointer"
                            title="Kick member and remove their requested videos"
                          >
                            <UserX className="w-3 h-3" />
                            <span>Kick</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Member's Requested Videos List */}
                    <div className="pl-3 border-l-2 border-slate-800 flex flex-col gap-1.5 mt-1">
                      {memberRequests.length === 0 ? (
                        <p className="text-[11px] text-slate-500 italic">No video requests in queue</p>
                      ) : (
                        memberRequests.map((req) => {
                          const overallIndex = queue.findIndex((q) => q.id === req.id) + 1;
                          return (
                            <div key={req.id} className="flex items-center justify-between text-[11px] font-mono text-slate-300 gap-2 bg-slate-900/60 p-1.5 border border-slate-800/80">
                              <div className="truncate flex items-center gap-1.5 min-w-0">
                                <span className="text-[#00c8d4] font-bold flex-shrink-0">#{overallIndex}</span>
                                <span className="truncate">{req.url}</span>
                              </div>
                              {isHost && (
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
              <span>Upcoming Queue</span>
              <span className="text-slate-500 font-mono text-[11px]">{queue.length} items</span>
            </div>
            {queue.length === 0 ? (
              <p className="text-xs text-slate-500 italic py-4 text-center">Queue is empty</p>
            ) : (
              <div className="flex flex-col gap-2 max-h-56 overflow-y-auto pr-1">
                {queue.map((item, idx) => {
                  const ytId = parseYouTubeVideoId(item.url);
                  const isMyEntry = Boolean(user && item.addedBy === user.uid);
                  const canDelete = isMyEntry || isHost;
                  const addedByMember = membersList.find((m) => m.uid === item.addedBy);
                  const addedByLabel = isMyEntry
                    ? 'You'
                    : (addedByMember?.nickname || `User (${item.addedBy?.substring(0, 4) || '?'})`);

                  return (
                    <div key={item.id || idx} className="flex items-center gap-2 p-2 bg-slate-950 border border-slate-800 text-xs">
                      <span className="font-mono text-[#00c8d4] font-bold w-5 flex-shrink-0">#{idx + 1}</span>
                      {ytId ? (
                        <img src={`https://img.youtube.com/vi/${ytId}/hqdefault.jpg`} alt="thumb" className="w-10 h-7 object-cover flex-shrink-0" />
                      ) : null}
                      <div className="truncate flex-1 flex items-center gap-1.5 font-mono text-slate-300 min-w-0">
                        <span className="truncate">{item.url}</span>
                        <span className="px-1.5 py-0.5 text-[9px] bg-[#00c8d4]/10 text-[#00c8d4] border border-[#00c8d4]/30 font-semibold uppercase flex-shrink-0">
                          {addedByLabel}
                        </span>
                      </div>

                      {/* Host Reorder Actions */}
                      {isHost && queue.length > 1 && (
                        <div className="flex items-center gap-0.5 flex-shrink-0 border-l border-slate-800 pl-1">
                          <button
                            onClick={() => handleMoveQueueItem(idx, 'up')}
                            disabled={idx === 0}
                            className="p-1 text-slate-400 hover:text-cyan-400 disabled:opacity-20 transition-colors cursor-pointer disabled:cursor-not-allowed"
                            title="Move Up"
                          >
                            <ChevronUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleMoveQueueItem(idx, 'down')}
                            disabled={idx === queue.length - 1}
                            className="p-1 text-slate-400 hover:text-cyan-400 disabled:opacity-20 transition-colors cursor-pointer disabled:cursor-not-allowed"
                            title="Move Down"
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
                          title={isHost && !isMyEntry ? "Force delete item (Host)" : "Delete your entry"}
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



