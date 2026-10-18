const STORAGE_KEY = 'mediabox_api_token';

/**
 * Loads the client's API token from persistent localStorage.
 */
export function loadApiToken(): string {
  if (typeof window === 'undefined' || !window.localStorage) {
    return '';
  }
  try {
    return (localStorage.getItem(STORAGE_KEY) || '').trim();
  } catch {
    return '';
  }
}

/**
 * Saves or deletes the client's API token in localStorage.
 */
export function saveApiToken(token: string): void {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }
  try {
    const trimmed = (token || '').trim();
    if (trimmed) {
      localStorage.setItem(STORAGE_KEY, trimmed);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch (err) {
    console.warn('[apiTokenStore] Failed to write token to localStorage:', err);
  }
}
