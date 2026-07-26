import React, { useState, useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { ref, onValue, set, update, remove, off } from 'firebase/database';
import { User } from 'firebase/auth';
import { ensureAnonymousAuth, database } from '@/lib/firebase';
import { createRoomAtomic, RoomState, QueueItem, parseYouTubeVideoId } from '@/lib/roomUtils';
import { YouTubePlayer } from '@/components/YouTubePlayer';
import { Card } from '@/components/ui/card';
import { Tv, QrCode, Users, Play, Pause, SkipForward, Volume2, VolumeX, X, Plus, Copy, Check, Trash2, Loader2, ExternalLink, Smartphone } from 'lucide-react';

export const MediaBox: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [memberCount, setMemberCount] = useState<number>(0);

  const [creating, setCreating] = useState<boolean>(false);
  const [showQrModal, setShowQrModal] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [manualUrlInput, setManualUrlInput] = useState<string>('');

  const [muted, setMuted] = useState<boolean>(false);

  // Keep refs to latest roomState and queue to avoid stale closures in listeners
  const roomStateRef = useRef<RoomState | null>(null);
  useEffect(() => {
    roomStateRef.current = roomState;
  }, [roomState]);

  const queueRefState = useRef<QueueItem[]>([]);
  useEffect(() => {
    queueRefState.current = queue;
  }, [queue]);

  // Authenticate anonymously on mount
  useEffect(() => {
    ensureAnonymousAuth()
      .then((u) => setUser(u))
      .catch((err) => console.error('Auth error in MediaBox:', err));
  }, []);

  // Subscribe to room nodes when roomCode is active
  useEffect(() => {
    if (!roomCode || !user) return;

    const stateRef = ref(database, `rooms/${roomCode}/state`);
    const queueRef = ref(database, `rooms/${roomCode}/queue`);
    const membersRef = ref(database, `rooms/${roomCode}/members`);

    // 1. Subscribe to shared state
    const unsubState = onValue(stateRef, (snapshot) => {
      if (snapshot.exists()) {
        setRoomState(snapshot.val());
      }
    });

    // 2. Subscribe to queue
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

    // 3. Subscribe to members to process incoming commands and track count
    const unsubMembers = onValue(membersRef, (snapshot) => {
      if (!snapshot.exists()) {
        setMemberCount(0);
        return;
      }

      const membersData = snapshot.val();
      setMemberCount(Object.keys(membersData).length);

      // Process any pending commands from members
      Object.entries(membersData).forEach(([memberUid, member]: [string, any]) => {
        if (member && member.command) {
          processMemberCommand(memberUid, member.command);
        }
      });
    });

    return () => {
      off(stateRef);
      off(queueRef);
      off(membersRef);
    };
  }, [roomCode, user]);

  const handleCreateRoom = async () => {
    setCreating(true);
    try {
      const u = user || (await ensureAnonymousAuth());
      setUser(u);

      const code = await createRoomAtomic(u.uid);
      setRoomCode(code);
    } catch (err: any) {
      console.error('Error creating room:', err);
      alert('Failed to create Watch Together room: ' + err.message);
    } finally {
      setCreating(false);
    }
  };

  const processMemberCommand = async (memberUid: string, command: any) => {
    if (!roomCode || !command || !command.type) return;

    const { type, payload } = command;

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
          const currentPlaying = roomStateRef.current?.currentlyPlaying;

          // If no video is currently playing, set currentlyPlaying directly
          if (!currentPlaying) {
            await update(ref(database, `rooms/${roomCode}/state`), {
              currentlyPlaying: videoUrl,
            });
            await update(ref(database, `rooms/${roomCode}/state/playback`), {
              status: 'playing',
              updatedAt: Date.now(),
            });
          } else {
            // Push to queue node
            const queueKey = `${Date.now()}_${memberUid.substring(0, 4)}`;
            const newQueueRef = ref(database, `rooms/${roomCode}/queue/${queueKey}`);
            await set(newQueueRef, {
              url: videoUrl,
              addedBy: memberUid,
              addedAt: Date.now(),
            });
          }
        }
      }
    } catch (err) {
      console.error('[TV Host] Error executing member command:', err);
    } finally {
      // Clean up / delete processed command node
      try {
        const commandRef = ref(database, `rooms/${roomCode}/members/${memberUid}/command`);
        await remove(commandRef);
      } catch (err) {
        console.error('[TV Host] Failed to clear command node:', err);
      }
    }
  };

  const handlePlayNextInQueue = async () => {
    if (!roomCode) return;

    const currentQueue = queueRefState.current;
    if (currentQueue && currentQueue.length > 0) {
      const nextItem = currentQueue[0];
      console.log('[TV Host] Video finished. Playing next item in queue:', nextItem.url);
      // Update currently playing video
      await update(ref(database, `rooms/${roomCode}/state`), {
        currentlyPlaying: nextItem.url,
      });
      await update(ref(database, `rooms/${roomCode}/state/playback`), {
        status: 'playing',
        updatedAt: Date.now(),
      });
      // Remove item from queue
      await remove(ref(database, `rooms/${roomCode}/queue/${nextItem.id}`));
    } else {
      console.log('[TV Host] Video finished. Queue is empty.');
      await update(ref(database, `rooms/${roomCode}/state`), {
        currentlyPlaying: '',
      });
      await update(ref(database, `rooms/${roomCode}/state/playback`), {
        status: 'paused',
        updatedAt: Date.now(),
      });
    }
  };

  const handleTogglePlayPause = async () => {
    if (!roomCode || !roomState) return;
    const newStatus = roomState.playback?.status === 'playing' ? 'paused' : 'playing';
    await update(ref(database, `rooms/${roomCode}/state/playback`), {
      status: newStatus,
      updatedAt: Date.now(),
    });
  };

  const handleRemoveQueueItem = async (itemId: string) => {
    if (!roomCode) return;
    await remove(ref(database, `rooms/${roomCode}/queue/${itemId}`));
  };

  const handleAddUrlHost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualUrlInput.trim() || !roomCode) return;

    const ytId = parseYouTubeVideoId(manualUrlInput.trim());
    if (!ytId) {
      alert('Please enter a valid YouTube video link.');
      return;
    }

    const videoUrl = `https://www.youtube.com/watch?v=${ytId}`;
    if (!roomState?.currentlyPlaying) {
      await update(ref(database, `rooms/${roomCode}/state`), {
        currentlyPlaying: videoUrl,
      });
      await update(ref(database, `rooms/${roomCode}/state/playback`), {
        status: 'playing',
        updatedAt: Date.now(),
      });
    } else {
      const queueKey = `${Date.now()}_host`;
      const newQueueRef = ref(database, `rooms/${roomCode}/queue/${queueKey}`);
      await set(newQueueRef, {
        url: videoUrl,
        addedBy: 'host',
        addedAt: Date.now(),
      });
    }
    setManualUrlInput('');
  };

  const handleEndRoom = async () => {
    if (!roomCode) return;
    if (confirm('Are you sure you want to end this Watch Together session?')) {
      await remove(ref(database, `rooms/${roomCode}`));
      setRoomCode(null);
      setRoomState(null);
      setQueue([]);
    }
  };

  const remoteUrl = roomCode ? `${window.location.origin}/#/join?room=${roomCode}` : `${window.location.origin}/#/join`;

  const copyRemoteLink = () => {
    navigator.clipboard.writeText(remoteUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  // Render initial "Create Room" state if no active room
  if (!roomCode) {
    return (
      <Card className="aspect-video w-full p-6 overflow-hidden rounded-none border border-slate-800 bg-surface flex flex-col items-center justify-center text-center gap-4 relative group">
        <div className="p-4 bg-[#00c8d4]/10 border border-[#00c8d4]/30 rounded-none mb-1 group-hover:scale-105 transition-transform">
          <Tv className="w-10 h-10 text-[#00c8d4]" />
        </div>
        <div>
          <h2 className="text-xl font-bold tracking-wider text-slate-100 uppercase">MediaBox Watch Together</h2>
          <p className="text-xs text-slate-400 max-w-sm mt-1">
            Host a synchronized YouTube room. Scan QR code or enter 6-digit PIN on mobile to control playback.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={handleCreateRoom}
            disabled={creating}
            className="px-6 py-3 bg-[#00c8d4] hover:bg-[#00b0bd] text-slate-950 font-bold uppercase tracking-wider text-xs transition-all disabled:opacity-50 flex items-center gap-2 shadow-[0_0_20px_rgba(0,200,212,0.25)]"
          >
            {creating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Creating Room...</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-slate-950" />
                <span>Create Watch Party Room</span>
              </>
            )}
          </button>

          <a
            href={remoteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-3 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 transition-colors"
          >
            <Smartphone className="w-4 h-4 text-[#00c8d4]" />
            <span>Open Remote Control UI</span>
            <ExternalLink className="w-3 h-3 text-slate-500" />
          </a>
        </div>
      </Card>
    );
  }

  const isPlaying = roomState?.playback?.status === 'playing';
  const volume = roomState?.playback?.volume ?? 80;

  return (
    <Card className="aspect-video w-full p-0 overflow-hidden rounded-none border border-slate-800 bg-slate-950 flex flex-col relative">
      {/* Top Controls Overlay */}
      <div className="absolute top-0 left-0 right-0 z-20 bg-gradient-to-b from-slate-950/90 to-transparent p-3 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 bg-slate-900/90 border border-slate-800 font-mono text-[#00c8d4] font-bold tracking-widest text-sm flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#00c8d4] animate-ping" />
            ROOM: {roomCode}
          </span>
          <button
            onClick={() => setShowQrModal(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-900/90 hover:bg-slate-800 border border-slate-800 text-slate-200 transition-colors"
          >
            <QrCode className="w-3.5 h-3.5 text-[#00c8d4]" />
            <span>QR Code</span>
          </button>
          <a
            href={remoteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 px-2.5 py-1 bg-slate-900/90 hover:bg-slate-800 border border-slate-800 text-slate-300 transition-colors"
            title="Open Remote Control in a new tab"
          >
            <Smartphone className="w-3.5 h-3.5 text-[#00c8d4]" />
            <span>Open Remote</span>
            <ExternalLink className="w-3 h-3 text-slate-500" />
          </a>
        </div>

        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 px-2.5 py-1 bg-slate-900/90 border border-slate-800 text-slate-300">
            <Users className="w-3.5 h-3.5 text-[#00c8d4]" />
            <span className="font-mono">{memberCount}</span>
          </span>
          <button
            onClick={handleEndRoom}
            className="px-2 py-1 bg-red-950/80 hover:bg-red-900 border border-red-800/80 text-red-200 text-xs font-semibold uppercase tracking-wider transition-colors"
          >
            End Room
          </button>
        </div>
      </div>

      {/* Main Video Player */}
      <div className="flex-1 w-full bg-black relative flex items-center justify-center overflow-hidden">
        {roomState?.currentlyPlaying ? (
          <YouTubePlayer
            url={roomState.currentlyPlaying}
            isPlaying={isPlaying}
            volume={volume}
            muted={muted}
            onEnded={handlePlayNextInQueue}
          />
        ) : (
          <div className="text-center p-6 flex flex-col items-center gap-3">
            <Tv className="w-12 h-12 text-slate-700 animate-pulse" />
            <p className="text-slate-400 text-sm font-mono">No video playing. Add a YouTube URL or submit from remote!</p>
          </div>
        )}
      </div>

      {/* Bottom Bar Player Controls */}
      <div className="bg-slate-950 border-t border-slate-800 p-2.5 flex items-center justify-between gap-3 text-xs z-20">
        <div className="flex items-center gap-2">
          <button
            onClick={handleTogglePlayPause}
            className="p-2 bg-[#00c8d4] hover:bg-[#00b0bd] text-slate-950 transition-colors"
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <Pause className="w-4 h-4 fill-slate-950" /> : <Play className="w-4 h-4 fill-slate-950" />}
          </button>

          <button
            onClick={handlePlayNextInQueue}
            className="p-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 transition-colors"
            title="Skip to next in queue"
          >
            <SkipForward className="w-4 h-4" />
          </button>

          <button
            onClick={() => setMuted(!muted)}
            className="p-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 transition-colors"
          >
            {muted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-[#00c8d4]" />}
          </button>
        </div>

        {/* Quick Add URL form on TV */}
        <form onSubmit={handleAddUrlHost} className="flex-1 flex gap-2 max-w-xs">
          <input
            type="url"
            value={manualUrlInput}
            onChange={(e) => setManualUrlInput(e.target.value)}
            placeholder="Add YT URL to queue..."
            className="flex-1 px-2.5 py-1 bg-slate-900 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-[#00c8d4]"
          />
          <button type="submit" className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700">
            <Plus className="w-4 h-4" />
          </button>
        </form>

        {/* Queue badge count */}
        <div className="text-slate-400 font-mono text-[11px] flex items-center gap-2">
          <span>Queue ({queue.length})</span>
        </div>
      </div>

      {/* Queue Drawer / List preview if queue has items */}
      {queue.length > 0 && (
        <div className="bg-slate-900 border-t border-slate-800 p-2 max-h-24 overflow-y-auto flex flex-col gap-1 z-20">
          {queue.map((item, idx) => (
            <div key={item.id} className="flex items-center justify-between text-[11px] font-mono text-slate-300 px-2 py-1 bg-slate-950 border border-slate-800">
              <span className="truncate flex-1">
                <strong className="text-[#00c8d4]">#{idx + 1}</strong> {item.url}
              </span>
              <button
                onClick={() => handleRemoveQueueItem(item.id)}
                className="text-slate-500 hover:text-red-400 ml-2"
                title="Remove"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* QR Code Overlay Modal */}
      {showQrModal && (
        <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md z-30 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 p-6 max-w-sm w-full flex flex-col items-center gap-4 relative">
            <button
              onClick={() => setShowQrModal(false)}
              className="absolute top-3 right-3 p-1 text-slate-400 hover:text-slate-100"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-100">Scan to Remote Control</h3>

            <div className="p-3 bg-white border-4 border-[#00c8d4]">
              <QRCodeSVG value={remoteUrl} size={160} level="M" />
            </div>

            <div className="text-center flex flex-col gap-1 w-full">
              <span className="text-xs text-slate-400">Or enter 6-digit PIN:</span>
              <span className="font-mono text-3xl font-bold tracking-[0.2em] text-[#00c8d4]">{roomCode}</span>
            </div>

            <div className="flex flex-col gap-2 w-full">
              <a
                href={remoteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-2 bg-[#00c8d4] hover:bg-[#00b0bd] text-slate-950 font-bold uppercase tracking-wider text-xs flex items-center justify-center gap-2 transition-colors"
              >
                <Smartphone className="w-4 h-4" />
                <span>Open Remote in New Tab</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>

              <button
                onClick={copyRemoteLink}
                className="w-full py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs text-slate-200 flex items-center justify-center gap-2 transition-colors"
              >
                {copiedLink ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-[#00c8d4]" />}
                <span>{copiedLink ? 'Link Copied!' : 'Copy Remote Link'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
};
