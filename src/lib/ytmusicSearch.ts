import { Innertube } from 'youtubei.js';
import { loadProxyConfig, isProxyConfigured } from './proxyConfig';
import type { SearchResultItem } from './roomUtils';

let _yt: Innertube | null = null;
let _ytProxyUrl: string = '';
let _ytProxyToken: string = '';

/**
 * Creates a custom fetch function that routes all InnerTube requests
 * through our Cloudflare Worker CORS proxy with Bearer auth.
 */
function makeFetch(proxyUrl: string, proxyToken: string) {
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    let originalUrlString: string;
    if (typeof input === 'string') {
      originalUrlString = input;
    } else if (input instanceof URL) {
      originalUrlString = input.toString();
    } else if (typeof input === 'object' && input !== null && 'url' in input) {
      originalUrlString = (input as Request).url;
    } else {
      originalUrlString = String(input);
    }

    const parsed = new URL(originalUrlString);
    // Always target music.youtube.com for YouTube Music (WEB_REMIX) requests
    const targetHost = 'music.youtube.com';

    // Construct proxied URL: baseProxy + pathname + search
    let baseProxy = proxyUrl.trim().replace(/\/+$/, '');
    if (!/^https?:\/\//i.test(baseProxy)) {
      baseProxy = `https://${baseProxy}`;
    }

    const proxiedUrl = new URL(`${baseProxy}${parsed.pathname}${parsed.search}`);
    proxiedUrl.searchParams.set('__host', targetHost);

    // Build headers
    const headers = new Headers(init?.headers);
    if (typeof input === 'object' && input !== null && 'headers' in input) {
      const inputHeaders = (input as Request).headers;
      if (inputHeaders && typeof inputHeaders.forEach === 'function') {
        inputHeaders.forEach((val, key) => {
          if (!headers.has(key)) headers.set(key, val);
        });
      }
    }

    if (proxyToken) {
      headers.set('Authorization', `Bearer ${proxyToken}`);
    }
    headers.set('__host', targetHost);

    const method =
      init?.method ||
      (typeof input === 'object' && input !== null && 'method' in input
        ? (input as Request).method
        : 'GET');
    const body =
      init?.body !== undefined
        ? init.body
        : typeof input === 'object' && input !== null && 'body' in input
          ? (input as Request).body
          : undefined;

    return fetch(proxiedUrl.toString(), {
      ...init,
      method,
      body,
      headers,
      credentials: 'omit',
    });
  };
}

/**
 * Returns a cached Innertube singleton configured with the TV host's proxy settings.
 * Reconstructs instance if proxy URL or token changes.
 */
async function getInnertube(proxyUrl: string, proxyToken: string): Promise<Innertube> {
  if (_yt && _ytProxyUrl === proxyUrl && _ytProxyToken === proxyToken) {
    return _yt;
  }
  _ytProxyUrl = proxyUrl;
  _ytProxyToken = proxyToken;
  _yt = await Innertube.create({
    generate_session_locally: true,
    retrieve_player: false,
    retrieve_innertube_config: false,
    fetch: makeFetch(proxyUrl, proxyToken),
  });
  return _yt;
}

/**
 * Search YouTube Music songs via Innertube + CORS proxy.
 * Results are strictly music tracks, filtered to exclude Shorts (< 60s) and long mixes (> 12m).
 */
export async function searchYTMusic(query: string): Promise<SearchResultItem[]> {
  const config = loadProxyConfig();
  if (!isProxyConfigured(config)) {
    throw new Error('YTMusic proxy is not configured');
  }

  const yt = await getInnertube(config.proxyUrl, config.proxyToken);

  console.log(`[YTMusic] Searching for: "${query}" via proxy`);
  let result: any;
  try {
    result = await yt.music.search(query, { type: 'song' });
  } catch (err) {
    // Invalidate cached instance on error so subsequent attempts start fresh
    _yt = null;
    throw err;
  }

  const rawItems: any[] = [];
  if (result.songs?.contents && result.songs.contents.length > 0) {
    rawItems.push(...result.songs.contents);
  } else if (result.contents) {
    for (const shelf of result.contents) {
      if ('contents' in shelf && Array.isArray((shelf as any).contents)) {
        rawItems.push(...(shelf as any).contents);
      }
    }
  }

  const searchResults: SearchResultItem[] = [];

  for (const item of rawItems) {
    const id = item.id || item.endpoint?.payload?.videoId;
    if (!id || typeof id !== 'string') continue;

    // Shorts & long mixes exclusion: filter out tracks under 60 seconds or over 12 minutes
    const durationSeconds = item.duration?.seconds;
    if (typeof durationSeconds === 'number' && (durationSeconds < 60 || durationSeconds > 720)) {
      continue;
    }

    // Exclude podcasts and non-music content
    if (item.item_type && item.item_type !== 'song' && item.item_type !== 'video') {
      continue;
    }

    const title = typeof item.title === 'string' ? item.title : item.title?.text || '';
    if (!title) continue;

    let channelTitle = '';
    if (Array.isArray(item.artists) && item.artists.length > 0 && item.artists[0]?.name) {
      channelTitle = item.artists[0].name;
    } else if (item.author?.name) {
      channelTitle = item.author.name;
    }

    let thumbnail = '';
    if (Array.isArray(item.thumbnails) && item.thumbnails.length > 0) {
      thumbnail = item.thumbnails[item.thumbnails.length - 1]?.url || item.thumbnails[0]?.url || '';
    } else if (item.thumbnail?.contents && item.thumbnail.contents.length > 0) {
      thumbnail = item.thumbnail.contents[0]?.url || '';
    }

    searchResults.push({
      id,
      title,
      channelTitle,
      thumbnail,
      url: `https://www.youtube.com/watch?v=${id}`,
      durationSeconds: typeof durationSeconds === 'number' ? durationSeconds : undefined,
    });
  }

  console.log(`[YTMusic] Found ${searchResults.length} valid tracks (filtered 60s-720s)`);
  return searchResults;
}
