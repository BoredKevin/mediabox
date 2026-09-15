import { ref, get, set, update, remove } from 'firebase/database';
import { database } from '@/lib/firebase';
import { SearchSettings, SearchResultItem, removeUndefinedFields } from '@/lib/roomUtils';
import { searchYTMusic, searchYouTube } from '@/lib/ytmusicSearch';
import { loadProxyConfig, isProxyConfigured } from '@/lib/proxyConfig';

export interface SearchRequestData {
  requestedBy: string;
  query: string;
  createdAt: number;
}

/**
 * Handles YouTube search requests mediated through the TV room host.
 * Checks per-user rate limits, routes query to Innertube proxy (searchYTMusic or searchYouTube),
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

    // 2. Check proxy configuration
    const proxyCfg = loadProxyConfig();
    if (!isProxyConfigured(proxyCfg)) {
      await set(ref(database, `rooms/${roomCode}/searchResults/${reqId}`), {
        results: [],
        error: 'MediaBox YouTube API is not configured on the TV.',
        respondedAt: Date.now(),
      });
      await remove(ref(database, `rooms/${roomCode}/searchRequests/${reqId}`));
      return;
    }

    // 3. Perform search via Innertube proxy
    let results: SearchResultItem[] | null = null;
    let errorMessage: string | null = null;

    try {
      const preferMusic = searchConfig.preferMusicVideos ?? true;
      results = preferMusic
        ? await searchYTMusic(req.query)
        : await searchYouTube(req.query);

      const maxResults = searchConfig.maxResults || 25;
      if (results && results.length > maxResults) {
        results = results.slice(0, maxResults);
      }
    } catch (err: any) {
      console.error('[TV Host] Error executing YouTube search via proxy:', err);
      errorMessage = err.message || 'YouTube search failed.';
    }

    // 4. Write result for client
    await set(
      ref(database, `rooms/${roomCode}/searchResults/${reqId}`),
      removeUndefinedFields({
        results: results || [],
        error: errorMessage,
        respondedAt: Date.now(),
      })
    );

    // 5. Delete request
    await remove(ref(database, `rooms/${roomCode}/searchRequests/${reqId}`));

    // 6. Clean up stale search results (> 60s)
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
