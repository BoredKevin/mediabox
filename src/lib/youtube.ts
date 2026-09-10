export { parseYouTubeVideoId } from './roomUtils';
import { parseYouTubeVideoId } from './roomUtils';
import { loadKeys, pickKey, incrementUsage, markKeyExhausted, loadSearchConfig } from './apiKeyStore';

export interface SearchResultItem {
  id: string;
  title: string;
  channelTitle: string;
  thumbnail: string;
  url: string;
}

export interface VideoInfo {
  title?: string;
  channelTitle?: string;
  thumbnailUrl?: string;
}

/**
 * Resolves video title and metadata using YouTube's free, zero-config oEmbed API endpoint.
 * Requires NO API key!
 */
export const fetchVideoTitle = async (videoUrlOrId: string): Promise<VideoInfo> => {
  const videoId = parseYouTubeVideoId(videoUrlOrId) || videoUrlOrId;
  if (!videoId) return {};

  const fullUrl = `https://www.youtube.com/watch?v=${videoId}`;
  try {
    const res = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(fullUrl)}&format=json`);
    if (res.ok) {
      const data = await res.json();
      return {
        title: data.title,
        channelTitle: data.author_name,
        thumbnailUrl: data.thumbnail_url,
      };
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
 * Searches YouTube videos using the official YouTube Data API v3 endpoint with an explicit API key.
 * Used by the TV room host as mediator.
 */
export const searchYouTubeWithKey = async (
  query: string,
  apiKey: string,
  maxResults: number = 25
): Promise<SearchResultItem[]> => {
  const cleanQuery = query.trim();
  if (!cleanQuery) return [];

  const count = Math.max(1, Math.min(50, maxResults));
  const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=${count}&q=${encodeURIComponent(
    cleanQuery
  )}&key=${apiKey.trim()}`;

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

  return results;
};

/**
 * Searches YouTube videos using the official YouTube Data API v3 endpoint.
 * Prioritizes active keys configured by the host in Room Settings (apiKeyStore),
 * supporting key rotation and fallback to VITE_YOUTUBE_API_KEY.
 */
export const searchYouTubeVideos = async (
  query: string
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
        const results = await searchYouTubeWithKey(query, keyRecord.key, maxResults);
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
        const results = await searchYouTubeWithKey(query, envKey, maxResults);
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
