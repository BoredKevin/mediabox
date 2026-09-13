# Walkthrough - YouTube Music Autoplay via Authenticated CORS Proxy

We have implemented YouTube Music search for the autoplay recommendation engine using `youtubei.js` (Innertube) and an authenticated Cloudflare Worker CORS proxy.

---

## What Was Done

### 1. Cloudflare Worker CORS Proxy (`workers/ytproxy/`)
- [wrangler.toml](file:///d:/coding/BoredKevin/mediabox/workers/ytproxy/wrangler.toml): Configured Cloudflare Worker project `mediabox-ytproxy`.
- [index.ts](file:///d:/coding/BoredKevin/mediabox/workers/ytproxy/src/index.ts):
  - Handles CORS preflight (`OPTIONS`) with `Access-Control-Allow-Origin: *`.
  - Supports optional Bearer authentication via worker secret `YTPROXY_SECRET`.
  - Resolves target host from `__host` query parameter or header (defaults to `music.youtube.com`).
  - Strips proxy-specific headers (`Authorization`, `__host`) and sets upstream `Host`, `Origin`, and `Referer` to the target host.
  - Attaches CORS headers to the upstream response and forwards it back to the client.

### 2. Local Proxy Configuration Store
- [proxyConfig.ts](file:///d:/coding/BoredKevin/mediabox/src/lib/proxyConfig.ts):
  - Stores `{ proxyUrl, proxyToken }` in host-local `localStorage` under `mediabox_ytproxy_config`.
  - Never published to Firebase RTDB or shared across room members.
  - Provides `loadProxyConfig()`, `saveProxyConfig()`, and `isProxyConfigured()`.

### 3. YouTube Music Search Module
- [ytmusicSearch.ts](file:///d:/coding/BoredKevin/mediabox/src/lib/ytmusicSearch.ts):
  - Initializes `Innertube` singleton configured with local session generation and disabled player deciphering for fast initialization.
  - Implements a custom `fetch` handler that rewrites Innertube HTTP requests to pass through the Cloudflare Worker with `__host` and `Authorization: Bearer <token>`.
  - Executes `yt.music.search(query, { type: 'song' })` to search YouTube Music.
  - **Shorts exclusion**: Filter discards any item with `duration.seconds < 60`.
  - Filters out podcasts and non-music content (`item_type in ['song', 'video']`).
  - Maps items to Mediabox standard `SearchResultItem` interface (`{ id, title, channelTitle, thumbnail, url }`).

### 4. Autoplay Handler Integration
- [autoplayHandler.ts](file:///d:/coding/BoredKevin/mediabox/src/handlers/autoplayHandler.ts):
  - Created `searchForAutoplay(query)` helper:
    1. Checks if proxy is configured via `isProxyConfigured()`.
    2. If configured, strips any trailing `" topic"` query suffix and searches YouTube Music via `searchYTMusic()`.
    3. If YTMusic returns valid tracks, uses them for candidate selection and audio purity ranking.
    4. If the proxy is unconfigured, unreachable, or returns 0 results, seamlessly falls back to `searchYouTubeVideos(query)` (YouTube Data API).
  - Replaced recommendation and fallback search loops to call `searchForAutoplay`.

### 5. Settings UI & i18n
- [en.json](file:///d:/coding/BoredKevin/mediabox/src/locales/en.json) & [id.json](file:///d:/coding/BoredKevin/mediabox/src/locales/id.json): Added localization strings for proxy configuration title, description, status badges, labels, and save notifications.
- [TvSettingsModal.tsx](file:///d:/coding/BoredKevin/mediabox/src/components/TvSettingsModal.tsx): Added proxy configuration section to the "API Keys" tab with live status badge (`PROXY CONFIGURED` / `NOT CONFIGURED`), proxy URL input, token input with 5-second reveal countdown, and save button.
- [HostSettingsModal.tsx](file:///d:/coding/BoredKevin/mediabox/src/components/remote/HostSettingsModal.tsx): Added the same proxy configuration section to the remote host modal, strictly guarded by `{isAdmin && ...}` so non-hosts cannot view or edit it.

---

## Verification Results

### TypeScript Compilation (`npx tsc --noEmit`)
```text
The command exited with code 0.
```
No type errors found.

### Production Bundle Build (`npm run build`)
```text
> mediabox@1.0.0 build
> npm run generate-licenses && tsc && vite build

Generated 283 licenses in D:\coding\BoredKevin\mediabox\src\data\licenses.json
vite v6.4.3 building for production...
✓ 2357 modules transformed.
✓ built in 24.66s
```

---

## Deployment & Setup Guide for the Cloudflare Worker

### 1. Deploy the Worker
From the terminal, navigate to the worker directory:
```bash
cd workers/ytproxy
npx wrangler deploy
```
Wrangler will output your worker URL (e.g. `https://mediabox-ytproxy.<your-subdomain>.workers.dev`).

### 2. (Optional) Set Secret Auth Token
If you want to protect your proxy from unauthorized external requests:
```bash
npx wrangler secret put YTPROXY_SECRET
```
Enter a secure secret token when prompted.

### 3. Configure in Mediabox
1. Open Mediabox TV settings or Remote Host settings (API Keys tab).
2. Under **YouTube Music CORS Proxy**:
   - **Worker Proxy URL**: Enter your worker URL (`https://mediabox-ytproxy.<subdomain>.workers.dev`).
   - **Proxy Auth Token (Bearer)**: Enter the same secret token (if configured).
3. Click **Save Proxy Settings**. The badge will change to **`PROXY CONFIGURED`**.
