const STORAGE_KEY = 'mediabox_lyrics_offset_ms';
const WORD_SYNC_STORAGE_KEY = 'mediabox_lyrics_word_sync';

/**
 * Retrieves the saved lyrics synchronization offset (in milliseconds) from browser localStorage.
 * Clamped between -5000ms and +5000ms. Defaults to 0.
 */
export function getSavedLyricsOffset(): number {
  if (typeof window === 'undefined') return 0;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return 0;
    const parsed = parseInt(raw, 10);
    return Number.isFinite(parsed) ? Math.min(5000, Math.max(-5000, parsed)) : 0;
  } catch {
    return 0;
  }
}

/**
 * Persists the lyrics synchronization offset (in milliseconds) to browser localStorage.
 */
export function saveLyricsOffset(offsetMs: number): void {
  if (typeof window === 'undefined') return;
  try {
    const clamped = Math.min(5000, Math.max(-5000, Math.round(offsetMs)));
    localStorage.setItem(STORAGE_KEY, String(clamped));
  } catch {
    // Ignore storage quota or disabled storage errors
  }
}

/**
 * Retrieves the saved lyrics sync mode (word-by-word vs syllable-level).
 * Defaults to false (RichSync syllable-level sync enabled by default).
 */
export function getSavedLyricsWordSync(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const raw = localStorage.getItem(WORD_SYNC_STORAGE_KEY);
    if (raw === null) return false; // Default to RichSync enabled (word sync disabled)
    return raw === 'true';
  } catch {
    return false;
  }
}

/**
 * Persists the lyrics word sync mode toggle to browser localStorage.
 */
export function saveLyricsWordSync(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(WORD_SYNC_STORAGE_KEY, String(enabled));
  } catch {
    // Ignore storage quota or disabled storage errors
  }
}
