import { ref, get, set, update, remove } from 'firebase/database';
import { database } from '@/lib/firebase';
import { SearchSettings } from '@/lib/roomUtils';
import { searchYouTubeWithKey, YouTubeQuotaExceededError, SearchResultItem } from '@/lib/youtube';
import {
  loadKeys,
  pickKey,
  incrementUsage,
  markKeyExhausted,
  resetDailyUsageIfNeeded,
} from '@/lib/apiKeyStore';

export interface SearchRequestData {
  requestedBy: string;
  query: string;
  createdAt: number;
}

/**
 * Handles YouTube search requests mediated through the TV room host.
 * Checks per-user rate limits, balances across local API keys, handles quota failures,
 * and writes responses back to Firebase RTDB.
 */
export const processSearchRequest = async (
  reqId: string,
  req: SearchRequestData,
  roomCode: string,
  searchConfig: SearchSettings,
  processingRequests: Set<string>,
  onSyncSettings?: () => Promise<void>
): Promise<void> => {
  if (!roomCode || !req || !req.requestedBy || !req.query) return;
  if (processingRequests.has(reqId)) return;
  processingRequests.add(reqId);

  try {
    const uid = req.requestedBy;
    const windowMs = searchConfig.rateLimitWindowMs || 300000;
    const maxCount = searchConfig.rateLimitCount || 10;
    const now = Date.now();

    // 1. Check rate limit in RTDB
    const rateLimitRefNode = ref(database, `rooms/${roomCode}/searchRateLimits/${uid}`);
    const rateSnap = await get(rateLimitRefNode);
    let currentRate = rateSnap.exists()
      ? rateSnap.val()
      : { count: 0, windowStart: now };

    if (now - (currentRate.windowStart || 0) > windowMs) {
      // Window expired, reset
      currentRate = { count: 1, windowStart: now };
      await set(rateLimitRefNode, currentRate);
    } else {
      if (currentRate.count >= maxCount) {
        // Rate limit exceeded
        const remainingSecs = Math.ceil((windowMs - (now - currentRate.windowStart)) / 1000);
        const remainingMins = Math.ceil(remainingSecs / 60);
        await set(ref(database, `rooms/${roomCode}/searchResults/${reqId}`), {
          results: [],
          error: `Rate limit reached (${maxCount} searches / ${Math.round(windowMs / 60000)}m). Please wait ${
            remainingMins > 1 ? `${remainingMins} minutes` : `${remainingSecs}s`
          }.`,
          respondedAt: Date.now(),
        });
        await remove(ref(database, `rooms/${roomCode}/searchRequests/${reqId}`));
        return;
      }
      currentRate.count = (currentRate.count || 0) + 1;
      await update(rateLimitRefNode, { count: currentRate.count });
    }

    // 2. Perform search with key fallback
    resetDailyUsageIfNeeded();

    let results: SearchResultItem[] | null = null;
    let errorMessage: string | null = null;
    const attemptedIds = new Set<string>();

    while (results === null) {
      const activeKeys = loadKeys().filter(
        (k) => k.enabled && k.key.trim().length > 0 && !attemptedIds.has(k.id)
      );
      if (activeKeys.length === 0) {
        errorMessage =
          attemptedIds.size > 0
            ? 'All configured YouTube API keys on the TV have exceeded their daily quota.'
            : 'No active YouTube API key configured on TV.';
        break;
      }

      const strategy = searchConfig.strategy || 'roundRobin';
      const candidate = pickKey(strategy);
      const keyRecord = candidate && !attemptedIds.has(candidate.id) ? candidate : activeKeys[0];

      attemptedIds.add(keyRecord.id);

      try {
        results = await searchYouTubeWithKey(
          req.query,
          keyRecord.key,
          searchConfig.maxResults || 25
        );
        incrementUsage(keyRecord.id);
      } catch (err: any) {
        if (err instanceof YouTubeQuotaExceededError) {
          console.warn(
            `[TV Host] Quota exceeded for key ${keyRecord.id}, marking exhausted and trying next key.`
          );
          markKeyExhausted(keyRecord.id);
          if (onSyncSettings) {
            await onSyncSettings();
          }
        } else {
          console.error('[TV Host] Error executing YouTube search:', err);
          errorMessage = err.message || 'YouTube search failed.';
          break;
        }
      }
    }

    // 3. Write result for client
    await set(ref(database, `rooms/${roomCode}/searchResults/${reqId}`), {
      results: results || [],
      error: errorMessage,
      respondedAt: Date.now(),
    });

    // 4. Delete request
    await remove(ref(database, `rooms/${roomCode}/searchRequests/${reqId}`));

    // 5. Clean up stale search results (> 60s)
    try {
      const resultsSnap = await get(ref(database, `rooms/${roomCode}/searchResults`));
      if (resultsSnap.exists()) {
        const allRes = resultsSnap.val();
        Object.entries(allRes).forEach(([resKey, resVal]: [string, any]) => {
          if (resVal?.respondedAt && now - resVal.respondedAt > 60000) {
            remove(ref(database, `rooms/${roomCode}/searchResults/${resKey}`)).catch(() => {});
          }
        });
      }
    } catch {
      // ignore GC errors
    }
  } catch (err) {
    console.error('[TV Host] processSearchRequest failure:', err);
  } finally {
    processingRequests.delete(reqId);
  }
};
