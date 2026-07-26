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

/**
 * Searches YouTube videos using the official YouTube Data API v3 endpoint.
 * Requires VITE_YOUTUBE_API_KEY environment variable.
 */
export const searchYouTubeVideos = async (
  query: string
): Promise<{ results: SearchResultItem[]; hasApiKey: boolean; error?: string }> => {
  const apiKey = import.meta.env.VITE_YOUTUBE_API_KEY;

  if (!apiKey) {
    return {
      results: [],
      hasApiKey: false,
      error: 'VITE_YOUTUBE_API_KEY is not set in environment variables.',
    };
  }

  const cleanQuery = query.trim();
  if (!cleanQuery) {
    return { results: [], hasApiKey: true };
  }

  try {
    const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=5&q=${encodeURIComponent(
      cleanQuery
    )}&key=${apiKey}`;

    const res = await fetch(searchUrl);
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      const reason = errData?.error?.errors?.[0]?.reason;
      if (res.status === 403 || reason === 'quotaExceeded') {
        return {
          results: [],
          hasApiKey: true,
          error: 'Daily YouTube API search quota exceeded. You can switch to the "Paste Link" tab to paste YouTube URLs directly.',
        };
      }
      const msg = errData?.error?.message || `YouTube API returned status ${res.status}`;
      return { results: [], hasApiKey: true, error: msg };
    }

    const data = await res.json();
    const results: SearchResultItem[] = (data.items || []).map((item: any) => ({
      id: item.id?.videoId || '',
      title: item.snippet?.title || 'Untitled Video',
      channelTitle: item.snippet?.channelTitle || 'YouTube Channel',
      thumbnail: item.snippet?.thumbnails?.medium?.url || item.snippet?.thumbnails?.default?.url || '',
      url: `https://www.youtube.com/watch?v=${item.id?.videoId}`,
    })).filter((item: SearchResultItem) => Boolean(item.id));

    return { results, hasApiKey: true };
  } catch (err: any) {
    console.error('[YouTube API Error]:', err);
    return { results: [], hasApiKey: true, error: err.message || 'Failed to fetch YouTube search results.' };
  }
};
