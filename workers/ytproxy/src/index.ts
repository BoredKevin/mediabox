export interface Env {
  YTPROXY_SECRET?: string;
}

function getCorsHeaders(request: Request): Headers {
  const origin = request.headers.get('Origin') || '*';
  const reqHeaders = request.headers.get('Access-Control-Request-Headers') || '*';
  const headers = new Headers();
  headers.set('Access-Control-Allow-Origin', origin);
  headers.set('Access-Control-Allow-Credentials', 'true');
  headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  headers.set('Access-Control-Allow-Headers', reqHeaders);
  headers.set('Access-Control-Max-Age', '86400');
  return headers;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const corsHeaders = getCorsHeaders(request);

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      });
    }

    // Authenticate if YTPROXY_SECRET is configured
    if (env.YTPROXY_SECRET) {
      const authHeader = request.headers.get('Authorization') || '';
      const token = authHeader.replace(/^Bearer\s+/i, '').trim();
      if (!token || token !== env.YTPROXY_SECRET) {
        const errHeaders = new Headers(corsHeaders);
        errHeaders.set('Content-Type', 'application/json');
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: errHeaders,
        });
      }
    }

    const url = new URL(request.url);

    // Target host resolution
    // youtubei.js passes target host in `__host` query param or header.
    // Default to music.youtube.com for YouTube Music (WEB_REMIX).
    // Target host resolution
    // youtubei.js passes target host in `__host` query param or header.
    // Default to music.youtube.com for YouTube Music (WEB_REMIX).
    const requestedHost = url.searchParams.get('__host') || request.headers.get('__host');
    const clientName = request.headers.get('x-youtube-client-name');
    let targetHost = requestedHost || 'music.youtube.com';

    // Route Innertube YouTube Music endpoints to music.youtube.com for maximum reliability
    // But preserve www.youtube.com if requested or if client is standard YouTube Web (1)
    if (!requestedHost && clientName !== '1' && targetHost === 'www.youtube.com' && url.pathname.includes('/youtubei/')) {
      targetHost = 'music.youtube.com';
    }

    // Build the target YouTube URL
    // Remove __host param so it doesn't pollute the upstream query
    const targetUrl = new URL(request.url);
    targetUrl.protocol = 'https:';
    targetUrl.host = targetHost;
    targetUrl.port = '';
    targetUrl.searchParams.delete('__host');

    // Build upstream headers safely:
    // Do NOT forward client's Sec-Fetch-*, Sec-CH-*, CF-*, X-Forwarded-*, Authorization, Cookie, or Host!
    // Forwarding browser's `sec-fetch-site: cross-site` alongside `Origin: https://music.youtube.com`
    // triggers Google BotGuard 403 Forbidden.
    const forwardHeaders = new Headers();

    // Whitelist safe upstream headers from client / Innertube
    const allowedClientHeaders = [
      'content-type',
      'accept',
      'accept-language',
      'x-youtube-client-name',
      'x-youtube-client-version',
      'x-goog-visitor-id',
      'x-origin',
    ];

    for (const [key, value] of request.headers.entries()) {
      const lowerKey = key.toLowerCase();
      if (allowedClientHeaders.includes(lowerKey)) {
        forwardHeaders.set(key, value);
      }
    }

    // Set genuine origin and referer matching target host
    forwardHeaders.set('Origin', `https://${targetHost}`);
    forwardHeaders.set('Referer', `https://${targetHost}/`);

    // Ensure desktop Chrome User-Agent is present
    const incomingUa = request.headers.get('User-Agent');
    forwardHeaders.set(
      'User-Agent',
      incomingUa && !incomingUa.includes('Cloudflare')
        ? incomingUa
        : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'
    );

    try {
      const response = await fetch(targetUrl.toString(), {
        method: request.method,
        headers: forwardHeaders,
        body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
        redirect: 'follow',
      });

      // Clone response headers and attach CORS headers
      const responseHeaders = new Headers(response.headers);
      corsHeaders.forEach((val, key) => {
        responseHeaders.set(key, val);
      });

      // Remove compression headers so Cloudflare re-compresses correctly for client
      responseHeaders.delete('content-encoding');
      responseHeaders.delete('content-length');

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
      });
    } catch (err: any) {
      const errHeaders = new Headers(corsHeaders);
      errHeaders.set('Content-Type', 'application/json');
      return new Response(JSON.stringify({ error: 'Proxy fetch failed', message: err?.message }), {
        status: 502,
        headers: errHeaders,
      });
    }
  },
};
