import { SearchSettings } from './roomUtils';
import { loadProxyConfig, isProxyConfigured } from './proxyConfig';

const CONFIG_KEY = 'mediabox_search_config';

export interface SearchConfig {
  maxResults: number;
  rateLimitCount: number;
  rateLimitWindowMs: number;
  preferMusicVideos: boolean;
}

export const DEFAULT_SEARCH_CONFIG: SearchConfig = {
  maxResults: 25,
  rateLimitCount: 10,
  rateLimitWindowMs: 300000, // 5 minutes
  preferMusicVideos: true,
};

export const loadSearchConfig = (): SearchConfig => {
  if (typeof window === 'undefined' || !window.localStorage) return DEFAULT_SEARCH_CONFIG;
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (!raw) return DEFAULT_SEARCH_CONFIG;
    const parsed = JSON.parse(raw);
    if (!parsed.maxResults || parsed.maxResults === 5) {
      parsed.maxResults = 25;
    }
    return { ...DEFAULT_SEARCH_CONFIG, ...parsed };
  } catch (err) {
    console.error('[apiKeyStore] Failed to load search config:', err);
    return DEFAULT_SEARCH_CONFIG;
  }
};

export const saveSearchConfig = (config: Partial<SearchConfig>): SearchConfig => {
  const current = loadSearchConfig();
  const merged: SearchConfig = { ...current, ...config };
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      localStorage.setItem(CONFIG_KEY, JSON.stringify(merged));
    } catch (err) {
      console.error('[apiKeyStore] Failed to save search config:', err);
    }
  }
  return merged;
};

/**
 * Derives current SearchSettings for publishing to Firebase RTDB.
 */
export const getEffectiveSearchSettings = (): SearchSettings => {
  const config = loadSearchConfig();
  const proxyCfg = loadProxyConfig();
  return {
    maxResults: config.maxResults,
    rateLimitCount: config.rateLimitCount,
    rateLimitWindowMs: config.rateLimitWindowMs,
    preferMusicVideos: config.preferMusicVideos ?? true,
    isProxyConfigured: isProxyConfigured(proxyCfg),
    ...(proxyCfg.proxyUrl ? { proxyUrl: proxyCfg.proxyUrl } : {}),
  };
};
