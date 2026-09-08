import { ApiKeyRecord, SearchSettings } from './roomUtils';

const STORAGE_KEY = 'mediabox_apikeys';
const RR_INDEX_KEY = 'mediabox_rr_pointer';
const CONFIG_KEY = 'mediabox_search_config';

export interface SearchConfig {
  strategy: 'roundRobin' | 'leastUsed';
  maxResults: number;
  rateLimitCount: number;
  rateLimitWindowMs: number;
  allowHostKeyManagement: boolean;
}

export const DEFAULT_SEARCH_CONFIG: SearchConfig = {
  strategy: 'roundRobin',
  maxResults: 25,
  rateLimitCount: 10,
  rateLimitWindowMs: 300000, // 5 minutes
  allowHostKeyManagement: false,
};

export const loadSearchConfig = (): SearchConfig => {
  if (typeof window === 'undefined' || !window.localStorage) return DEFAULT_SEARCH_CONFIG;
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (!raw) return DEFAULT_SEARCH_CONFIG;
    const parsed = JSON.parse(raw);
    if (!parsed.maxResults || parsed.maxResults === 5) {
      parsed.maxResults = 25;
    }
    return { ...DEFAULT_SEARCH_CONFIG, ...parsed };
  } catch (err) {
    console.error('[apiKeyStore] Failed to load search config:', err);
    return DEFAULT_SEARCH_CONFIG;
  }
};

export const saveSearchConfig = (config: Partial<SearchConfig>): SearchConfig => {
  const current = loadSearchConfig();
  const merged: SearchConfig = { ...current, ...config };
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      localStorage.setItem(CONFIG_KEY, JSON.stringify(merged));
    } catch (err) {
      console.error('[apiKeyStore] Failed to save search config:', err);
    }
  }
  return merged;
};

/**
 * Derives current SearchSettings for publishing to Firebase RTDB.
 */
export const getEffectiveSearchSettings = (): SearchSettings => {
  const keys = loadKeys();
  const enabledCount = keys.filter((k) => k.enabled && k.key.trim().length > 0).length;
  const config = loadSearchConfig();
  return {
    hasApiKeys: enabledCount > 0,
    keyCount: keys.length,
    strategy: config.strategy,
    maxResults: config.maxResults,
    rateLimitCount: config.rateLimitCount,
    rateLimitWindowMs: config.rateLimitWindowMs,
    allowHostKeyManagement: config.allowHostKeyManagement,
  };
};

/**
 * Loads API key records from localStorage.
 */
export const loadKeys = (): ApiKeyRecord[] => {
  if (typeof window === 'undefined' || !window.localStorage) return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('[apiKeyStore] Failed to load keys from localStorage:', err);
    return [];
  }
};

/**
 * Saves API key records to localStorage.
 */
export const saveKeys = (keys: ApiKeyRecord[]): void => {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(keys));
  } catch (err) {
    console.error('[apiKeyStore] Failed to save keys to localStorage:', err);
  }
};

/**
 * Masks an API key for safe display (e.g. "AIza****...zXYZ").
 */
export const getMaskedKey = (key: string): string => {
  const trimmed = key.trim();
  if (trimmed.length <= 8) {
    return '****';
  }
  const prefix = trimmed.slice(0, 4);
  const suffix = trimmed.slice(-4);
  return `${prefix}****...${suffix}`;
};

/**
 * Adds a new API key to the store.
 */
export const addKey = (key: string, label: string): ApiKeyRecord => {
  const cleanKey = key.trim();
  const cleanLabel = label.trim() || `Key ${Date.now().toString().slice(-4)}`;
  const keys = loadKeys();

  const newRecord: ApiKeyRecord = {
    id: `key_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    key: cleanKey,
    label: cleanLabel,
    enabled: true,
    usageToday: 0,
    lastResetAt: Date.now(),
    roundRobinIndex: keys.length,
  };

  keys.push(newRecord);
  saveKeys(keys);
  return newRecord;
};

/**
 * Deletes an API key from the store.
 */
export const deleteKey = (id: string): void => {
  const keys = loadKeys().filter((k) => k.id !== id);
  saveKeys(keys);
};

/**
 * Updates an API key record with patch properties.
 */
export const updateKey = (id: string, patch: Partial<ApiKeyRecord>): void => {
  const keys = loadKeys().map((k) => {
    if (k.id === id) {
      return { ...k, ...patch };
    }
    return k;
  });
  saveKeys(keys);
};

/**
 * Checks if YouTube daily quota has rolled over (midnight Pacific Time).
 * If so, resets usageToday to 0 for all keys and saves.
 */
export const resetDailyUsageIfNeeded = (): void => {
  const keys = loadKeys();
  if (keys.length === 0) return;

  const getPtDateString = (timestamp: number): string => {
    try {
      return new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Los_Angeles',
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
      }).format(new Date(timestamp));
    } catch {
      return new Date(timestamp).toDateString();
    }
  };

  const now = Date.now();
  const todayPt = getPtDateString(now);

  let modified = false;
  const updated = keys.map((k) => {
    const keyPtDate = getPtDateString(k.lastResetAt || 0);
    if (keyPtDate !== todayPt) {
      modified = true;
      return {
        ...k,
        usageToday: 0,
        lastResetAt: now,
      };
    }
    return k;
  });

  if (modified) {
    saveKeys(updated);
  }
};

/**
 * Selects an enabled key using the specified strategy ('roundRobin' or 'leastUsed').
 */
export const pickKey = (strategy: 'roundRobin' | 'leastUsed' = 'roundRobin'): ApiKeyRecord | null => {
  resetDailyUsageIfNeeded();
  const keys = loadKeys();
  const enabledKeys = keys.filter((k) => k.enabled && k.key.trim().length > 0);

  if (enabledKeys.length === 0) return null;

  if (strategy === 'leastUsed') {
    // Sort by usageToday ascending, pick the one with lowest usage
    const sorted = [...enabledKeys].sort((a, b) => (a.usageToday || 0) - (b.usageToday || 0));
    return sorted[0];
  }

  // Round robin selection
  let pointer = 0;
  try {
    const storedPointer = localStorage.getItem(RR_INDEX_KEY);
    if (storedPointer !== null) {
      pointer = parseInt(storedPointer, 10);
      if (isNaN(pointer)) pointer = 0;
    }
  } catch {
    pointer = 0;
  }

  const selected = enabledKeys[pointer % enabledKeys.length];
  const nextPointer = (pointer + 1) % enabledKeys.length;
  try {
    localStorage.setItem(RR_INDEX_KEY, nextPointer.toString());
  } catch {
    // Ignore storage write failure
  }

  return selected;
};

/**
 * Increments the daily usage counter for a given key.
 */
export const incrementUsage = (id: string): void => {
  const keys = loadKeys().map((k) => {
    if (k.id === id) {
      return { ...k, usageToday: (k.usageToday || 0) + 1 };
    }
    return k;
  });
  saveKeys(keys);
};

/**
 * Marks a key as quota exhausted (temporarily disables it).
 */
export const markKeyExhausted = (id: string): void => {
  console.warn(`[apiKeyStore] Key ${id} marked as quota exhausted, disabling.`);
  updateKey(id, { enabled: false });
};
