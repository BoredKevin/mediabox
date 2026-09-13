export interface YTProxyConfig {
  proxyUrl: string;
  proxyToken: string;
}

const PROXY_CONFIG_KEY = 'mediabox_ytproxy_config';

export function loadProxyConfig(): YTProxyConfig {
  try {
    const raw = localStorage.getItem(PROXY_CONFIG_KEY);
    if (!raw) return { proxyUrl: '', proxyToken: '' };
    const parsed = JSON.parse(raw);
    return {
      proxyUrl: typeof parsed.proxyUrl === 'string' ? parsed.proxyUrl.trim() : '',
      proxyToken: typeof parsed.proxyToken === 'string' ? parsed.proxyToken.trim() : '',
    };
  } catch {
    return { proxyUrl: '', proxyToken: '' };
  }
}

export function saveProxyConfig(config: YTProxyConfig): void {
  try {
    localStorage.setItem(
      PROXY_CONFIG_KEY,
      JSON.stringify({
        proxyUrl: config.proxyUrl.trim(),
        proxyToken: config.proxyToken.trim(),
      })
    );
  } catch (err) {
    console.error('[proxyConfig] Failed to save proxy config to localStorage', err);
  }
}

export function isProxyConfigured(config?: YTProxyConfig): boolean {
  const cfg = config ?? loadProxyConfig();
  return Boolean(cfg.proxyUrl && cfg.proxyUrl.length > 0);
}
