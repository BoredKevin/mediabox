import { parseYouTubeVideoId, SearchResultItem } from './roomUtils';
import { loadKeys, pickKey, incrementUsage, markKeyExhausted, loadSearchConfig } from './apiKeyStore';

export { parseYouTubeVideoId };
export type { SearchResultItem };

export interface VideoInfo {
  title?: string;
  channelTitle?: string;
  thumbnailUrl?: string;
}

interface CachedVideoInfo {
  data: VideoInfo;
  fetchedAt: number;
}

const OEMBED_CACHE_TTL_MS = 30 * 60 * 1000;
const oembedCache = new Map<string, CachedVideoInfo>();

/**
 * Resolves video title and metadata using YouTube's free, zero-config oEmbed API endpoint.
 * Requires NO API key! Uses an in-memory cache (30 min TTL) to avoid redundant network requests.
 */
export const fetchVideoTitle = async (videoUrlOrId: string): Promise<VideoInfo> => {
  const videoId = parseYouTubeVideoId(videoUrlOrId) || videoUrlOrId;
  if (!videoId) return {};

  const cached = oembedCache.get(videoId);
  if (cached && Date.now() - cached.fetchedAt < OEMBED_CACHE_TTL_MS) {
    return cached.data;
  }

  const fullUrl = `https://www.youtube.com/watch?v=${videoId}`;
  try {
    const res = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(fullUrl)}&format=json`);
    if (res.ok) {
      const data = await res.json();
      const info: VideoInfo = {
        title: data.title,
        channelTitle: data.author_name,
        thumbnailUrl: data.thumbnail_url,
      };
      oembedCache.set(videoId, { data: info, fetchedAt: Date.now() });
      return info;
    }
  } catch (err) {
    console.warn('[YouTube Resolver] oEmbed title resolution failed:', err);
  }
  return {};
};

export class YouTubeQuotaExceededError extends Error {
  constructor(message = 'Daily YouTube API search quota exceeded') {
    super(message);
    this.name = 'YouTubeQuotaExceededError';
  }
}

export const decodeHtmlEntities = (text: string): string => {
  if (!text) return '';
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
};

/**
 * Parses an ISO 8601 duration string (e.g. "PT3M45S", "PT1H2M30S") into total seconds.
 */
export const parseIsoDuration = (duration: string): number => {
  if (!duration) return 0;
  const match = duration.match(/P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/i);
  if (!match) return 0;
  const days = parseInt(match[1] || '0', 10);
  const hours = parseInt(match[2] || '0', 10);
  const minutes = parseInt(match[3] || '0', 10);
  const seconds = parseInt(match[4] || '0', 10);
  return days * 86400 + hours * 3600 + minutes * 60 + seconds;
};

export interface YouTubeSearchOptions {
  videoCategoryId?: string;
}

/**
 * Searches YouTube videos using the official YouTube Data API v3 endpoint with an explicit API key.
 * Used by the TV room host as mediator.
 * Automatically fetches video duration details in a single batch call (1 quota unit).
 */
export const searchYouTubeWithKey = async (
  query: string,
  apiKey: string,
  maxResults: number = 25,
  options?: YouTubeSearchOptions
): Promise<SearchResultItem[]> => {
  const cleanQuery = query.trim();
  if (!cleanQuery) return [];

  const count = Math.max(1, Math.min(50, maxResults));
  let searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=${count}&q=${encodeURIComponent(
    cleanQuery
  )}&key=${apiKey.trim()}`;

  if (options?.videoCategoryId) {
    searchUrl += `&videoCategoryId=${encodeURIComponent(options.videoCategoryId)}`;
  }

  const res = await fetch(searchUrl);
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    const reason = errData?.error?.errors?.[0]?.reason;
    if (res.status === 403 || reason === 'quotaExceeded') {
      throw new YouTubeQuotaExceededError();
    }
    const msg = errData?.error?.message || `YouTube API returned status ${res.status}`;
    throw new Error(msg);
  }

  const data = await res.json();
  const results: SearchResultItem[] = (data.items || [])
    .map((item: any) => ({
      id: item.id?.videoId || '',
      title: decodeHtmlEntities(item.snippet?.title || 'Untitled Video'),
      channelTitle: decodeHtmlEntities(item.snippet?.channelTitle || 'YouTube Channel'),
      thumbnail:
        item.snippet?.thumbnails?.high?.url ||
        item.snippet?.thumbnails?.medium?.url ||
        item.snippet?.thumbnails?.default?.url ||
        '',
      url: `https://www.youtube.com/watch?v=${item.id?.videoId}`,
    }))
    .filter((item: SearchResultItem) => Boolean(item.id));

  // Batch enrich video durations using videos.list endpoint (costs only 1 quota unit)
  if (results.length > 0) {
    try {
      const videoIds = results.map((r) => r.id).filter(Boolean).join(',');
      const videosUrl = `https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${videoIds}&key=${apiKey.trim()}`;
      const vRes = await fetch(videosUrl);
      if (vRes.ok) {
        const vData = await vRes.json();
        const durationMap = new Map<string, number>();
        for (const vItem of vData.items || []) {
          if (vItem.id && vItem.contentDetails?.duration) {
            durationMap.set(vItem.id, parseIsoDuration(vItem.contentDetails.duration));
          }
        }
        for (const item of results) {
          if (durationMap.has(item.id)) {
            item.durationSeconds = durationMap.get(item.id);
          }
        }
      }
    } catch (vErr) {
      console.warn('[YouTube API] Failed to fetch video durations (non-fatal):', vErr);
    }
  }

  return results;
};

/**
 * Searches YouTube videos using the official YouTube Data API v3 endpoint.
 * Prioritizes active keys configured by the host in Room Settings (apiKeyStore),
 * supporting key rotation and fallback to VITE_YOUTUBE_API_KEY.
 */
export const searchYouTubeVideos = async (
  query: string,
  options?: YouTubeSearchOptions
): Promise<{ results: SearchResultItem[]; hasApiKey: boolean; error?: string }> => {
  const config = loadSearchConfig();
  const maxResults = config.maxResults || 25;
  const attemptedIds = new Set<string>();

  while (true) {
    const activeKeys = loadKeys().filter((k) => k.enabled && k.key.trim().length > 0);
    const unattemptedKeys = activeKeys.filter((k) => !attemptedIds.has(k.id));

    if (unattemptedKeys.length > 0) {
      const candidate = pickKey(config.strategy);
      const keyRecord = candidate && !attemptedIds.has(candidate.id) ? candidate : unattemptedKeys[0];
      attemptedIds.add(keyRecord.id);

      try {
        const results = await searchYouTubeWithKey(query, keyRecord.key, maxResults, options);
        incrementUsage(keyRecord.id);
        return { results, hasApiKey: true };
      } catch (err: any) {
        if (err instanceof YouTubeQuotaExceededError) {
          console.warn(`[YouTube API] Quota exceeded for key ${keyRecord.id}, marking exhausted and trying next key.`);
          markKeyExhausted(keyRecord.id);
          continue;
        }
        console.error('[YouTube API Error]:', err);
        return {
          results: [],
          hasApiKey: true,
          error: err.message || 'YouTube search failed.',
        };
      }
    }

    // Fallback to environment variable if no active keys remain
    const envKey = (import.meta as any).env?.VITE_YOUTUBE_API_KEY;
    if (envKey && !attemptedIds.has('env')) {
      attemptedIds.add('env');
      try {
        const results = await searchYouTubeWithKey(query, envKey, maxResults, options);
        return { results, hasApiKey: true };
      } catch (err: any) {
        if (err instanceof YouTubeQuotaExceededError) {
          console.warn('[YouTube API] Quota exceeded for VITE_YOUTUBE_API_KEY.');
          return {
            results: [],
            hasApiKey: true,
            error: 'Daily YouTube API search quota exceeded.',
          };
        }
        console.error('[YouTube API Error]:', err);
        return {
          results: [],
          hasApiKey: true,
          error: err.message || 'YouTube search failed.',
        };
      }
    }

    // No keys available
    const totalStored = loadKeys().length;
    const hasAnyConfiguredKey = totalStored > 0 || Boolean(envKey);
    console.warn('[YouTube API] No active YouTube API keys available for search.');
    return {
      results: [],
      hasApiKey: hasAnyConfiguredKey,
      error: hasAnyConfiguredKey
        ? 'All configured YouTube API keys have exceeded their daily quota.'
        : 'No YouTube API key configured. Please add an API key in Room Settings.',
    };
  }
};
