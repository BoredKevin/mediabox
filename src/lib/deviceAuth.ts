import {
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInAnonymously,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import { auth } from './firebase';

export const STORAGE_KEYS = {
  DEVICE_CREDENTIALS: 'mediabox_device_credentials',
  USER_NICKNAME: 'mediabox_user_nickname',
  TV_ROOM_CODE: 'mediabox_tv_room_code',
  LAST_REMOTE_ROOM: 'mediabox_last_remote_room',
} as const;

export interface DeviceCredentials {
  uuid: string;
  secret: string;
  createdAt: number;
}

/**
 * Reads existing device credentials from localStorage if present.
 */
export const getStoredDeviceCredentials = (): DeviceCredentials | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.DEVICE_CREDENTIALS);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.uuid === 'string' && typeof parsed.secret === 'string') {
      return parsed as DeviceCredentials;
    }
  } catch (e) {
    console.warn('[deviceAuth] Failed to parse device credentials from localStorage:', e);
  }
  return null;
};

/**
 * Generates a cryptographically strong random alphanumeric/symbol secret.
 */
const generateRandomSecret = (): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()';
  const array = new Uint8Array(24);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(array);
  } else {
    for (let i = 0; i < 24; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(array, (byte) => chars[byte % chars.length]).join('');
};

/**
 * Returns existing device credentials or creates a brand new unique UUID and secret pair.
 */
export const getOrCreateDeviceCredentials = (): DeviceCredentials => {
  const existing = getStoredDeviceCredentials();
  if (existing) return existing;

  const uuid =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : 'dev-' + Math.random().toString(36).substring(2, 10) + '-' + Date.now().toString(36);

  const secret = generateRandomSecret();

  const creds: DeviceCredentials = {
    uuid,
    secret,
    createdAt: Date.now(),
  };

  try {
    localStorage.setItem(STORAGE_KEYS.DEVICE_CREDENTIALS, JSON.stringify(creds));
  } catch (e) {
    console.warn('[deviceAuth] Failed to persist credentials to localStorage:', e);
  }

  return creds;
};

/**
 * Formats a valid internal email address derived deterministically from the device UUID.
 */
export const credentialsToEmail = (uuid: string): string => {
  const cleanUuid = uuid.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  return `dev_${cleanUuid}@mediabox.tv`;
};

/**
 * Formats a compliant password derived deterministically from the device secret.
 */
export const credentialsToPassword = (secret: string): string => {
  return `Mbx!${secret}#9`;
};

/**
 * Checks whether a user is authenticated through Google Sign-In.
 */
export const isGoogleUser = (user: User | null): boolean => {
  if (!user) return false;
  return Boolean(
    user.providerData && user.providerData.some((p) => p.providerId === 'google.com')
  );
};

/**
 * Checks whether a user is authenticated using the system-managed device account.
 */
export const isDeviceUser = (user: User | null): boolean => {
  if (!user) return false;
  return Boolean(user.email && user.email.endsWith('@mediabox.tv'));
};

/**
 * Reads persistent nickname from localStorage.
 */
export const getStoredNickname = (): string => {
  try {
    return (localStorage.getItem(STORAGE_KEYS.USER_NICKNAME) || '').trim().slice(0, 25);
  } catch {
    return '';
  }
};

/**
 * Persists nickname to localStorage.
 */
export const saveStoredNickname = (name: string): void => {
  try {
    const clean = name.trim().slice(0, 25);
    if (clean) {
      localStorage.setItem(STORAGE_KEYS.USER_NICKNAME, clean);
    } else {
      localStorage.removeItem(STORAGE_KEYS.USER_NICKNAME);
    }
  } catch (e) {
    console.warn('[deviceAuth] Failed to save nickname to localStorage:', e);
  }
};

/**
 * Reads persistent TV room code from localStorage.
 */
export const getStoredTvRoomCode = (): string | null => {
  try {
    const code = localStorage.getItem(STORAGE_KEYS.TV_ROOM_CODE);
    return code && code.trim().length === 6 ? code.trim() : null;
  } catch {
    return null;
  }
};

/**
 * Persists TV room code to localStorage.
 */
export const saveStoredTvRoomCode = (code: string | null): void => {
  try {
    if (code && code.trim().length === 6) {
      localStorage.setItem(STORAGE_KEYS.TV_ROOM_CODE, code.trim());
    } else {
      localStorage.removeItem(STORAGE_KEYS.TV_ROOM_CODE);
    }
  } catch (e) {
    console.warn('[deviceAuth] Failed to save TV room code to localStorage:', e);
  }
};

/**
 * Reads persistent last remote room code from localStorage.
 */
export const getStoredRemoteRoomCode = (): string | null => {
  try {
    const code = localStorage.getItem(STORAGE_KEYS.LAST_REMOTE_ROOM);
    return code && code.trim().length === 6 ? code.trim() : null;
  } catch {
    return null;
  }
};

/**
 * Persists last remote room code to localStorage.
 */
export const saveStoredRemoteRoomCode = (code: string | null): void => {
  try {
    if (code && code.trim().length === 6) {
      localStorage.setItem(STORAGE_KEYS.LAST_REMOTE_ROOM, code.trim());
    } else {
      localStorage.removeItem(STORAGE_KEYS.LAST_REMOTE_ROOM);
    }
  } catch (e) {
    console.warn('[deviceAuth] Failed to save remote room code to localStorage:', e);
  }
};

// Singleton in-flight promise to prevent race conditions during auth initialization
let authInitPromise: Promise<User> | null = null;

/**
 * Ensures the browser is authenticated with its persistent system-managed device account.
 * If user is already signed in (e.g. Google user or restored device user), returns that user.
 * Otherwise, signs in with the browser's device UUID credentials (or creates the user if new).
 * Gracefully falls back to anonymous auth if email/password auth encounters an unexpected issue.
 */
export const ensureDeviceAuth = (): Promise<User> => {
  if (authInitPromise) {
    return authInitPromise;
  }

  authInitPromise = (async () => {
    try {
      // 1. If currentUser is already available in memory
      if (auth.currentUser) {
        return auth.currentUser;
      }

      // 2. Wait briefly for Firebase Auth SDK to rehydrate existing persisted session
      const rehydratedUser = await new Promise<User | null>((resolve) => {
        const unsubscribe = onAuthStateChanged(
          auth,
          (user) => {
            unsubscribe();
            resolve(user);
          },
          () => {
            unsubscribe();
            resolve(null);
          }
        );
        setTimeout(() => {
          unsubscribe();
          resolve(auth.currentUser);
        }, 1200);
      });

      if (rehydratedUser) {
        return rehydratedUser;
      }

      // 3. No active user: authenticate with browser's persistent device UUID and secret
      const creds = getOrCreateDeviceCredentials();
      const email = credentialsToEmail(creds.uuid);
      const password = credentialsToPassword(creds.secret);

      try {
        const userCred = await signInWithEmailAndPassword(auth, email, password);
        return userCred.user;
      } catch (err: any) {
        // If user does not exist yet on Firebase Auth, create it
        if (
          err.code === 'auth/user-not-found' ||
          err.code === 'auth/invalid-credential' ||
          err.code === 'auth/invalid-login-credentials'
        ) {
          try {
            const newCred = await createUserWithEmailAndPassword(auth, email, password);
            return newCred.user;
          } catch (createErr: any) {
            if (createErr.code === 'auth/email-already-in-use') {
              const retryCred = await signInWithEmailAndPassword(auth, email, password);
              return retryCred.user;
            }
            throw createErr;
          }
        }
        throw err;
      }
    } catch (err) {
      console.warn(
        '[deviceAuth] Device credential auth failed, falling back to anonymous auth:',
        err
      );
      // Graceful fallback to Firebase Anonymous Auth
      const anonCred = await signInAnonymously(auth);
      return anonCred.user;
    } finally {
      authInitPromise = null;
    }
  })();

  return authInitPromise;
};

/**
 * Sign in with Google. The Google user overrides the system-managed user for the remote session.
 */
export const signInWithGoogle = async (): Promise<User> => {
  const provider = new GoogleAuthProvider();
  const result = await signInWithPopup(auth, provider);
  return result.user;
};

/**
 * Sign out of Google and automatically return to the browser's persistent device account.
 */
export const logoutUser = async (): Promise<User> => {
  await signOut(auth);
  return await ensureDeviceAuth();
};
