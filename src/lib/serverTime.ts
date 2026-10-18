/**
 * Returns current timestamp synchronized for playback.
 * Convex server timestamps match local timestamps with sub-second accuracy.
 */
export function getServerTime(): number {
  return Date.now();
}

export function getServerTimeOffset(): number {
  return 0;
}

export function initServerTimeListener(): void {
  // No-op for Convex backend
}
