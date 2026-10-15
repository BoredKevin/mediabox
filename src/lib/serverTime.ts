import { ref, onValue } from 'firebase/database';
import { database } from './firebase';

let serverTimeOffset = 0;
let isListening = false;

export function initServerTimeListener() {
  if (isListening) return;
  isListening = true;
  try {
    const offsetRef = ref(database, '.info/serverTimeOffset');
    onValue(offsetRef, (snapshot) => {
      const val = snapshot.val();
      if (typeof val === 'number') {
        serverTimeOffset = val;
      }
    });
  } catch (e) {
    console.warn('[ServerTime] Failed to attach serverTimeOffset listener:', e);
  }
}

// Auto-initialize on import
initServerTimeListener();

/**
 * Returns current timestamp synchronized with Firebase Server Time.
 * Eliminates clock skew differences between TV and Remote mobile devices.
 */
export function getServerTime(): number {
  return Date.now() + serverTimeOffset;
}

export function getServerTimeOffset(): number {
  return serverTimeOffset;
}
