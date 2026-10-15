import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ref, get, update, remove } from 'firebase/database';
import { User as FirebaseUser, onAuthStateChanged } from 'firebase/auth';
import { auth, database } from '@/lib/firebase';
import {
  ensureDeviceAuth,
  signInWithGoogle,
  logoutUser,
  getStoredNickname,
  saveStoredNickname,
  getStoredRemoteRoomCode,
  saveStoredRemoteRoomCode,
} from '@/lib/deviceAuth';
import { checkRoomExists } from '@/lib/roomUtils';
import { useTranslation } from '@/context/LanguageContext';

import { JoinScreen } from './JoinScreen';
import { RoomScreen } from './RoomScreen';

export const RemoteView: React.FC = () => {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialRoom = searchParams.get('room') || getStoredRemoteRoomCode() || '';

  const [user, setUser] = useState<FirebaseUser | null>(auth.currentUser);
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

  // Listen to auth state changes and ensure persistent device auth
  useEffect(() => {
    let isCancelled = false;
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (isCancelled) return;
      if (currentUser) {
        setUser(currentUser);
      } else {
        ensureDeviceAuth()
          .then((u) => {
            if (!isCancelled) setUser(u);
          })
          .catch((err) => console.error('Auth error in RemoteView:', err));
      }
    });
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
        const u = authUser || auth.currentUser || userRef.current || (await ensureDeviceAuth());
        setUser(u);

        const exists = await checkRoomExists(cleanCode);
        if (!exists) {
          setLoading(false);
          return;
        }


        // Write or update member node in RTDB BEFORE updating activeRoomCode
        const memberRef = ref(database, `rooms/${cleanCode}/members/${u.uid}`);
        const memberSnap = await get(memberRef);
        const existingData = memberSnap.exists() ? memberSnap.val() : {};

        const savedNick = getStoredNickname();
        const effectiveNick =
          existingData.nickname ||
          savedNick ||
          (u.displayName ? u.displayName.slice(0, 25) : '');

        await update(memberRef, {
          uid: u.uid,
          joinedAt: existingData.joinedAt || Date.now(),
          online: true,
          lastSeen: Date.now(),
          ...(effectiveNick ? { nickname: effectiveNick } : {}),
        });

        if (effectiveNick) {
          saveStoredNickname(effectiveNick);
        }

        saveStoredRemoteRoomCode(cleanCode);
        lastAutoJoinedRoomRef.current = cleanCode;
        setUser(u);
        setActiveRoomCode(cleanCode);
        setSearchParams({ room: cleanCode }, { replace: true });
      } catch (err: any) {
        console.error('Error joining room:', err);
      } finally {
        setLoading(false);
      }
    },
    [setSearchParams]
  );

  // Auto-join if room code parameter present in URL (only once per unique room code)
  useEffect(() => {
    const roomParam = searchParams.get('room');
    if (user && roomParam && roomParam !== lastAutoJoinedRoomRef.current && !activeRoomCode) {
      lastAutoJoinedRoomRef.current = roomParam;
      handleJoinRoom(roomParam, user);
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

    if (currentRoom && currentUser) {
      try {
        await remove(ref(database, `rooms/${currentRoom}/members/${currentUser.uid}`));
      } catch (err) {
        console.warn('Failed to remove member node on leave:', err);
      }
    }
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
