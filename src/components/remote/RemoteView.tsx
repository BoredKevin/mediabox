import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { User as FirebaseUser, onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { convex } from '@/lib/convex';
import { api } from '../../../convex/_generated/api';
import {
  ensureDeviceAuth,
  getOrCreateDeviceCredentials,
  signInWithGoogle,
  logoutUser,
  getStoredNickname,
  saveStoredNickname,
  getStoredRemoteRoomCode,
  saveStoredRemoteRoomCode,
} from '@/lib/deviceAuth';
import { useTranslation } from '@/context/LanguageContext';

import { JoinScreen } from './JoinScreen';
import { RoomScreen } from './RoomScreen';

export const RemoteView: React.FC = () => {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialRoom = searchParams.get('room') || getStoredRemoteRoomCode() || '';

  const [user, setUser] = useState<FirebaseUser | null>(() => {
    const creds = getOrCreateDeviceCredentials();
    return (auth.currentUser || {
      uid: creds.uuid,
      displayName: getStoredNickname() || 'Guest',
    }) as any;
  });
  const [inputCode, setInputCode] = useState(initialRoom);
  const [activeRoomCode, setActiveRoomCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Keep refs to avoid stale closures
  const activeRoomCodeRef = useRef(activeRoomCode);
  activeRoomCodeRef.current = activeRoomCode;
  const inputCodeRef = useRef(inputCode);
  inputCodeRef.current = inputCode;
  const userRef = useRef(user);
  userRef.current = user;

  // Track room codes that have already been auto-joined to prevent infinite rejoin loops on exit
  const lastAutoJoinedRoomRef = useRef<string | null>(null);

  // Background non-blocking auth sync
  useEffect(() => {
    let isCancelled = false;
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (isCancelled) return;
      if (currentUser) {
        setUser(currentUser);
      }
    });
    ensureDeviceAuth()
      .then((u) => {
        if (!isCancelled && u) setUser(u);
      })
      .catch(() => {});
    return () => {
      isCancelled = true;
      unsubscribe();
    };
  }, []);

  const handleJoinRoom = useCallback(
    async (codeToJoin: string, authUser?: FirebaseUser) => {
      const cleanCode = codeToJoin.trim();
      if (cleanCode.length !== 6) return;

      setLoading(true);

      try {
        const u = authUser || userRef.current || user || {
          uid: getOrCreateDeviceCredentials().uuid,
          displayName: getStoredNickname() || 'Guest',
        };
        setUser(u as any);

        const room = await convex.query(api.rooms.getRoom, { code: cleanCode });
        if (!room) {
          setLoading(false);
          alert('Watch Together room not found or session has ended.');
          return;
        }

        saveStoredRemoteRoomCode(cleanCode);
        lastAutoJoinedRoomRef.current = cleanCode;
        setActiveRoomCode(cleanCode);
        setSearchParams({ room: cleanCode }, { replace: true });
      } catch (err: any) {
        console.error('Error joining room:', err);
      } finally {
        setLoading(false);
      }
    },
    [setSearchParams, user]
  );

  // Auto-join if room code parameter present in URL (only once per unique room code)
  useEffect(() => {
    const roomParam = searchParams.get('room');
    if (roomParam && roomParam !== lastAutoJoinedRoomRef.current && !activeRoomCode) {
      lastAutoJoinedRoomRef.current = roomParam;
      handleJoinRoom(roomParam, user || undefined);
    }
  }, [user, searchParams, activeRoomCode, handleJoinRoom]);

  const handleGoogleSignIn = async (codeOverride?: string) => {
    setLoading(true);
    try {
      const u = await signInWithGoogle();
      setUser(u);

      const code = (
        codeOverride ||
        inputCodeRef.current ||
        initialRoom ||
        activeRoomCodeRef.current ||
        searchParams.get('room') ||
        ''
      ).trim();

      if (code.length === 6) {
        await handleJoinRoom(code, u);
      }
    } catch (err: any) {
      console.error('Google Sign In Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      setLoading(true);
      const deviceUser = await logoutUser();
      setUser(deviceUser);

      const currentCode = activeRoomCodeRef.current;
      if (currentCode) {
        await handleJoinRoom(currentCode, deviceUser);
      }
    } catch (err: any) {
      console.error('Logout error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLeaveRoom = useCallback(async () => {
    const currentRoom = activeRoomCodeRef.current;
    const currentUser = userRef.current;

    // Prevent auto-join effect from immediately re-entering the room just exited
    lastAutoJoinedRoomRef.current = currentRoom;

    saveStoredRemoteRoomCode(null);
    setActiveRoomCode(null);
    setInputCode('');
    setSearchParams({}, { replace: true });
  }, [setSearchParams]);

  return (
    <div className="min-h-screen bg-background text-foreground font-sans relative">
      {/* Background Ambience */}
      <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/5 via-background to-background" />

      {!activeRoomCode ? (
        <JoinScreen
          inputCode={inputCode}
          setInputCode={setInputCode}
          onJoin={handleJoinRoom}
          loading={loading}
        />
      ) : (
        <RoomScreen
          activeRoomCode={activeRoomCode}
          user={user}
          onLeaveRoom={handleLeaveRoom}
          onGoogleSignIn={handleGoogleSignIn}
          onLogout={handleLogout}
        />
      )}
    </div>
  );
};
