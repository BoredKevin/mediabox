import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ref, get, update, remove } from 'firebase/database';
import { User as FirebaseUser, onAuthStateChanged } from 'firebase/auth';
import { auth, ensureAnonymousAuth, signInWithGoogle, logoutUser, database } from '@/lib/firebase';
import { checkRoomExists } from '@/lib/roomUtils';
import { useTranslation } from '@/context/LanguageContext';
import { ConstellationsBackground } from '@boredkevin/ui';

import { JoinScreen } from './JoinScreen';
import { RoomScreen } from './RoomScreen';

export const RemoteView: React.FC = () => {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialRoom = searchParams.get('room') || '';

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

  // Listen to auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
      } else {
        ensureAnonymousAuth()
          .then((u) => setUser(u))
          .catch((err) => console.error('Auth error in RemoteView:', err));
      }
    });
    return () => unsubscribe();
  }, []);

  const handleJoinRoom = useCallback(
    async (codeToJoin: string, authUser?: FirebaseUser) => {
      const cleanCode = codeToJoin.trim();
      if (cleanCode.length !== 6) return;

      setLoading(true);

      try {
        const u = authUser || auth.currentUser || userRef.current || (await ensureAnonymousAuth());
        setUser(u);

        const exists = await checkRoomExists(cleanCode);
        if (!exists) {
          setLoading(false);
          return;
        }

        // Check if room requires Google Sign-In
        const settingsSnap = await get(
          ref(database, `rooms/${cleanCode}/state/searchSettings`)
        );
        const roomSettings = settingsSnap.exists() ? settingsSnap.val() : null;

        if (roomSettings?.hasApiKeys && (!u || u.isAnonymous)) {
          setLoading(false);
          return;
        }

        // Write or update member node in RTDB BEFORE updating activeRoomCode
        const memberRef = ref(database, `rooms/${cleanCode}/members/${u.uid}`);
        const memberSnap = await get(memberRef);
        const existingData = memberSnap.exists() ? memberSnap.val() : {};

        await update(memberRef, {
          uid: u.uid,
          joinedAt: existingData.joinedAt || Date.now(),
          online: true,
          lastSeen: Date.now(),
          ...(existingData.nickname
            ? {}
            : u.displayName
            ? { nickname: u.displayName.slice(0, 25) }
            : {}),
        });

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
      await logoutUser();
      const anon = await ensureAnonymousAuth();
      setUser(anon);
    } catch (err: any) {
      console.error('Logout error:', err);
    }
  };

  const handleLeaveRoom = useCallback(async () => {
    const currentRoom = activeRoomCodeRef.current;
    const currentUser = userRef.current;

    // Prevent auto-join effect from immediately re-entering the room just exited
    lastAutoJoinedRoomRef.current = currentRoom;

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
      <ConstellationsBackground particleCount={25} interactive />

      {!activeRoomCode ? (
        <JoinScreen
          inputCode={inputCode}
          setInputCode={setInputCode}
          onJoin={handleJoinRoom}
          loading={loading}
          user={user}
          onGoogleSignIn={handleGoogleSignIn}
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
