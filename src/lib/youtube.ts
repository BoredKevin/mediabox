import { parseYouTubeVideoId, SearchResultItem } from './roomUtils';

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
