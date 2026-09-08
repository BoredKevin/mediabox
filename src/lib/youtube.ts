export { parseYouTubeVideoId } from './roomUtils';
import { parseYouTubeVideoId } from './roomUtils';

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
 * @deprecated Use room-mediated search via TV host.
 */
export const searchYouTubeVideos = async (
  query: string
): Promise<{ results: SearchResultItem[]; hasApiKey: boolean; error?: string }> => {
  const apiKey = (import.meta as any).env?.VITE_YOUTUBE_API_KEY;

  if (!apiKey) {
    return {
      results: [],
      hasApiKey: false,
      error: 'VITE_YOUTUBE_API_KEY is not set in environment variables.',
    };
  }

  try {
    const results = await searchYouTubeWithKey(query, apiKey, 25);
    return { results, hasApiKey: true };
  } catch (err: any) {
    if (err instanceof YouTubeQuotaExceededError) {
      return {
        results: [],
        hasApiKey: true,
        error:
          'Daily YouTube API search quota exceeded. You can switch to the "Paste Link" tab to paste YouTube URLs directly.',
      };
    }
    console.error('[YouTube API Error]:', err);
    return {
      results: [],
      hasApiKey: true,
      error: err.message || 'Failed to fetch YouTube search results.',
    };
  }
};
