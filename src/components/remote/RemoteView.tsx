import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ref, onValue, set, off } from 'firebase/database';
import { User } from 'firebase/auth';
import { ensureAnonymousAuth, database } from '@/lib/firebase';
import { checkRoomExists, RoomState, QueueItem, parseYouTubeVideoId } from '@/lib/roomUtils';
import { Card } from '@/components/ui/card';
import { Play, Pause, Volume2, Plus, Tv, Users, LogOut, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

export const RemoteView: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialRoom = searchParams.get('room') || '';

  const [user, setUser] = useState<User | null>(null);
  const [inputCode, setInputCode] = useState(initialRoom);
  const [activeRoomCode, setActiveRoomCode] = useState<string | null>(null);
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [memberCount, setMemberCount] = useState<number>(1);
  const [queueInputUrl, setQueueInputUrl] = useState('');

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  // Authenticate anonymously on mount
  useEffect(() => {
    ensureAnonymousAuth()
      .then((u) => setUser(u))
      .catch((err) => {
        console.error('Auth error:', err);
        setErrorMsg('Failed to authenticate with Firebase.');
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

    const stateRef = ref(database, `rooms/${activeRoomCode}/state`);
    const queueRef = ref(database, `rooms/${activeRoomCode}/queue`);
    const membersRef = ref(database, `rooms/${activeRoomCode}/members`);

    const unsubState = onValue(stateRef, (snapshot) => {
      if (snapshot.exists()) {
        setRoomState(snapshot.val());
      } else {
        // Room no longer exists
        setActiveRoomCode(null);
        setErrorMsg('The room has been closed by the host TV.');
      }
    });

    const unsubQueue = onValue(queueRef, (snapshot) => {
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

    const unsubMembers = onValue(membersRef, (snapshot) => {
      if (snapshot.exists()) {
        setMemberCount(Object.keys(snapshot.val()).length);
      } else {
        setMemberCount(1);
      }
    });

    return () => {
      off(stateRef);
      off(queueRef);
      off(membersRef);
    };
  }, [activeRoomCode, user]);

  const handleJoinRoom = async (codeToJoin: string) => {
    const cleanCode = codeToJoin.trim();
    if (cleanCode.length !== 6) {
      setErrorMsg('Please enter a valid 6-digit room code.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const u = user || (await ensureAnonymousAuth());
      setUser(u);

      const exists = await checkRoomExists(cleanCode);
      if (!exists) {
        setErrorMsg(`Room "${cleanCode}" was not found. Please verify the code.`);
        setLoading(false);
        return;
      }

      // Write member node
      const memberRef = ref(database, `rooms/${cleanCode}/members/${u.uid}`);
      await set(memberRef, {
        uid: u.uid,
        joinedAt: Date.now(),
        command: null,
      });

      setActiveRoomCode(cleanCode);
      setSearchParams({ room: cleanCode });
    } catch (err: any) {
      console.error('Error joining room:', err);
      setErrorMsg(err.message || 'Error joining room.');
    } finally {
      setLoading(false);
    }
  };

  const sendCommand = async (type: 'play' | 'pause' | 'addToQueue' | 'adjustVolume', payload?: any) => {
    if (!activeRoomCode || !user) return;

    try {
      const commandRef = ref(database, `rooms/${activeRoomCode}/members/${user.uid}/command`);
      await set(commandRef, {
        type,
        createdAt: Date.now(),
        payload: payload || {},
      });

      setActionFeedback(`Sent ${type} command!`);
      setTimeout(() => setActionFeedback(null), 2500);
    } catch (err: any) {
      console.error('Failed to send command:', err);
      setErrorMsg('Failed to send command. Check permissions or room status.');
    }
  };

  const handleAddQueueSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!queueInputUrl.trim()) return;

    const ytId = parseYouTubeVideoId(queueInputUrl.trim());
    if (!ytId) {
      setErrorMsg('Please enter a valid YouTube video URL or ID.');
      return;
    }

    const fullUrl = `https://www.youtube.com/watch?v=${ytId}`;
    sendCommand('addToQueue', { url: fullUrl });
    setQueueInputUrl('');
    setErrorMsg(null);
  };

  const handleLeaveRoom = () => {
    setActiveRoomCode(null);
    setSearchParams({});
    setRoomState(null);
    setQueue([]);
  };

  // Render Room Code Input Screen if not connected to a room
  if (!activeRoomCode) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4 bg-slate-950 text-slate-100 font-sans">
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

          {errorMsg && (
            <div className="flex items-center gap-2 p-3 bg-red-950/50 border border-red-800/50 text-red-300 text-xs rounded-none">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

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
              className="w-full mt-2 py-3 bg-[#00c8d4] hover:bg-[#00b0bd] text-slate-950 font-bold uppercase tracking-wider text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
    );
  }

  const isPlaying = roomState?.playback?.status === 'playing';
  const currentVolume = roomState?.playback?.volume ?? 80;
  const currentVideoId = roomState?.currentlyPlaying ? parseYouTubeVideoId(roomState.currentlyPlaying) : null;

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100 font-sans p-4 sm:p-6 max-w-lg mx-auto">
      {/* Header bar */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-5">
        <div className="flex items-center gap-3">
          <div className="flex flex-col">
            <span className="text-xs text-slate-400 uppercase tracking-widest">Connected to Room</span>
            <span className="font-mono text-xl font-bold text-[#00c8d4] tracking-widest">{activeRoomCode}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-900 border border-slate-800 text-xs text-slate-300">
            <Users className="w-3.5 h-3.5 text-[#00c8d4]" />
            {memberCount}
          </span>
          <button
            onClick={handleLeaveRoom}
            title="Leave Room"
            className="p-2 bg-slate-900 hover:bg-red-950/60 border border-slate-800 hover:border-red-800 text-slate-400 hover:text-red-300 transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Action feedback toast */}
      {actionFeedback && (
        <div className="mb-4 flex items-center gap-2 p-2.5 bg-[#00c8d4]/10 border border-[#00c8d4]/40 text-[#00c8d4] text-xs font-medium animate-fade-in">
          <CheckCircle2 className="w-4 h-4" />
          <span>{actionFeedback}</span>
        </div>
      )}

      {errorMsg && (
        <div className="mb-4 flex items-center gap-2 p-2.5 bg-red-950/50 border border-red-800/50 text-red-300 text-xs">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Currently Playing Card */}
      <Card className="p-4 bg-slate-900 border-slate-800 rounded-none mb-5">
        <div className="text-xs text-slate-400 uppercase tracking-wider mb-2 flex items-center justify-between">
          <span>Now Playing on TV</span>
          <span className={`px-2 py-0.5 text-[10px] uppercase font-bold tracking-widest ${isPlaying ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-amber-950 text-amber-400 border border-amber-800'}`}>
            {isPlaying ? 'PLAYING' : 'PAUSED'}
          </span>
        </div>
        {currentVideoId ? (
          <div className="flex gap-3 items-center">
            <img
              src={`https://img.youtube.com/vi/${currentVideoId}/hqdefault.jpg`}
              alt="Video thumbnail"
              className="w-20 h-14 object-cover border border-slate-800"
            />
            <div className="overflow-hidden flex-1">
              <p className="text-xs font-mono text-slate-300 truncate">{roomState?.currentlyPlaying}</p>
            </div>
          </div>
        ) : (
          <p className="text-xs text-slate-500 italic">No video selected</p>
        )}
      </Card>

      {/* Main Playback Controls */}
      <Card className="p-5 bg-slate-900 border-slate-800 rounded-none mb-5 flex flex-col gap-5">
        <div className="text-xs font-bold text-slate-300 uppercase tracking-wider border-b border-slate-800 pb-2">
          Playback Controls
        </div>

        <div className="flex items-center justify-center gap-4">
          <button
            onClick={() => sendCommand('play')}
            disabled={isPlaying}
            className="flex-1 py-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-slate-950 font-bold uppercase tracking-wider text-sm flex items-center justify-center gap-2 transition-all"
          >
            <Play className="w-5 h-5 fill-slate-950" />
            <span>Play</span>
          </button>

          <button
            onClick={() => sendCommand('pause')}
            disabled={!isPlaying}
            className="flex-1 py-4 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 font-bold uppercase tracking-wider text-sm flex items-center justify-center gap-2 transition-all"
          >
            <Pause className="w-5 h-5 fill-slate-950" />
            <span>Pause</span>
          </button>
        </div>

        {/* Volume Slider */}
        <div className="flex flex-col gap-2 pt-2 border-t border-slate-800">
          <div className="flex items-center justify-between text-xs text-slate-300">
            <span className="flex items-center gap-1.5">
              <Volume2 className="w-4 h-4 text-[#00c8d4]" />
              TV Volume
            </span>
            <span className="font-mono text-[#00c8d4] font-bold">{currentVolume}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={currentVolume}
            onChange={(e) => sendCommand('adjustVolume', { volume: Number(e.target.value) })}
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
            className="py-2.5 bg-[#00c8d4] hover:bg-[#00b0bd] text-slate-950 font-bold uppercase tracking-wider text-xs flex items-center justify-center gap-1.5 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Submit Command to Queue</span>
          </button>
        </form>
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
          <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-1">
            {queue.map((item, idx) => {
              const ytId = parseYouTubeVideoId(item.url);
              return (
                <div key={item.id || idx} className="flex items-center gap-2 p-2 bg-slate-950 border border-slate-800 text-xs">
                  <span className="font-mono text-[#00c8d4] font-bold w-5">#{idx + 1}</span>
                  {ytId ? (
                    <img src={`https://img.youtube.com/vi/${ytId}/hqdefault.jpg`} alt="thumb" className="w-10 h-7 object-cover" />
                  ) : null}
                  <span className="truncate flex-1 font-mono text-slate-300">{item.url}</span>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
};
