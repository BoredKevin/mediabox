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

export interface DeviceUser {
  uid: string;
  displayName: string;
  photoURL?: string;
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
 * Generates a cryptographically strong random secret.
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
 * Returns the current DeviceUser representation for the browser session.
 */
export const getDeviceUser = (): DeviceUser => {
  const creds = getOrCreateDeviceCredentials();
  return {
    uid: creds.uuid,
    displayName: getStoredNickname() || 'Guest',
  };
};

/**
 * Resolves persistent device user session.
 */
export const ensureDeviceAuth = async (): Promise<DeviceUser> => {
  return getDeviceUser();
};

export const isGoogleUser = (_user: DeviceUser | null): boolean => false;

export const isDeviceUser = (user: DeviceUser | null): boolean => Boolean(user?.uid);

export const logoutUser = async (): Promise<DeviceUser> => {
  return getDeviceUser();
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
