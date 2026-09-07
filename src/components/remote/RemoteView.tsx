import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ref, get, update } from 'firebase/database';
import { User as FirebaseUser } from 'firebase/auth';
import { ensureAnonymousAuth, signInWithGoogle, logoutUser, database } from '@/lib/firebase';
import { checkRoomExists } from '@/lib/roomUtils';
import { useTranslation } from '@/context/LanguageContext';
import { ConstellationsBackground } from '@boredkevin/ui';

import { JoinScreen } from './JoinScreen';
import { RoomScreen } from './RoomScreen';

export const RemoteView: React.FC = () => {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialRoom = searchParams.get('room') || '';

  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [inputCode, setInputCode] = useState(initialRoom);
  const [activeRoomCode, setActiveRoomCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Authenticate anonymously on mount if not already logged in
  useEffect(() => {
    ensureAnonymousAuth()
      .then((u) => setUser(u))
      .catch((err) => console.error('Auth error in RemoteView:', err));
  }, []);

  // Auto-join if room code parameter present in URL
  useEffect(() => {
    if (user && initialRoom && !activeRoomCode) {
      handleJoinRoom(initialRoom);
    }
  }, [user, initialRoom]);

  const handleJoinRoom = async (codeToJoin: string) => {
    const cleanCode = codeToJoin.trim();
    if (cleanCode.length !== 6) return;

    setLoading(true);

    try {
      const u = user || (await ensureAnonymousAuth());
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

      // Write or update member node in RTDB
      const memberRef = ref(database, `rooms/${cleanCode}/members/${u.uid}`);
      const memberSnap = await get(memberRef);
      const existingData = memberSnap.exists() ? memberSnap.val() : {};

      await update(memberRef, {
        uid: u.uid,
        joinedAt: existingData.joinedAt || Date.now(),
        ...(existingData.nickname
          ? {}
          : u.displayName
          ? { nickname: u.displayName.slice(0, 25) }
          : {}),
      });

      setActiveRoomCode(cleanCode);
      setSearchParams({ room: cleanCode });
    } catch (err: any) {
      console.error('Error joining room:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      const u = await signInWithGoogle();
      setUser(u);
      if (inputCode.length === 6) {
        await handleJoinRoom(inputCode);
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

  const handleLeaveRoom = () => {
    setActiveRoomCode(null);
    setSearchParams({});
  };

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
