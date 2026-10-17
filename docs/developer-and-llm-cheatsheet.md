# Developer & LLM Operational Cheat Sheet

Welcome! Whether you are a human developer maintaining MediaBox or an AI Agent / LLM analyzing the codebase, this cheat sheet provides an immediate, dense reference of **directory paths, critical invariants, command patterns, and troubleshooting playbooks**.

---

## Tech Stack Quick Reference

| Technology | Version | Purpose in MediaBox |
| :--- | :--- | :--- |
| **React** | `^19.0.0` | Core UI library using modern functional components & hooks. |
| **TypeScript** | `^5.7.3` | Strict type definitions across models, commands, and events. |
| **Vite** | `^6.1.0` | Ultra-fast development server & production bundler. |
| **Firebase RTDB** | `^12.16.0` | Distributed realtime WebSocket event bus & room state store. |
| **Firebase Auth** | `^12.16.0` | Persistent device auth (`dev_<uuid>@mediabox.tv`) + Google OAuth. |
| **Tailwind CSS** | `^3.4.17` | Pitch-dark retro-futuristic HUD styling with custom color tokens. |
| **Radix UI** | Multiple | Accessible, unstyled primitives (Dialog, Tabs, Slider, Switch, Popover). |
| **@braccato/core**| `^1.16.6` | High-performance Web Animations API synchronized lyrics engine. |
| **youtubei.js** | `^18.0.0` | Innertube library for YouTube Music search and automix radio. |
| **Cloudflare** | Pages + Worker | Web application hosting (`pages`) + CORS proxy (`workers/ytproxy`). |

---

## Key Directory & Code Pointer Map

| What are you looking for? | File Path | Key Exports / Functions |
| :--- | :--- | :--- |
| **TV Host State & Brain** | `src/context/WatchPartyContext.tsx` | `WatchPartyProvider`, `useWatchParty()` |
| **Mobile Remote State** | `src/components/remote/hooks/useRemoteRoom.ts` | `useRemoteRoom()`, `sendCommand()` |
| **Command Processing Engine** | `src/handlers/commandHandler.ts` | `processMemberCommand()` |
| **Playback Transitions** | `src/handlers/playbackHandler.ts` | `transitionToNextPlayback()`, `transitionToPreviousPlayback()` |
| **Smart Autoplay Heuristics**| `src/handlers/autoplayHandler.ts` | `scoreAudioPurity()`, `isSameArtist()`, `isDuplicateSong()` |
| **Lyrics Resolution Cascade** | `src/lib/lyricsService.ts` | `resolveLyrics()`, `coalesceSyllablesToWords()` |
| **Braccato Lyrics Renderer** | `src/components/lyrics/BraccatoLyricsRenderer.tsx` | 22Hz tick clock, theme styles |
| **YouTube IFrame Player** | `src/components/YouTubePlayer.tsx` | Error 150/101 auto-skip, player instance reuse |
| **Device Authentication** | `src/lib/deviceAuth.ts` | `ensureDeviceAuth()`, `credentialsToEmail()` |
| **Server Time Sync** | `src/lib/serverTime.ts` | `getServerTime()`, `serverTimeOffset` |
| **Cloudflare CORS Proxy** | `workers/ytproxy/src/index.ts` | Header sanitization, BotGuard bypass |
| **Classroom Timetable** | `public/schedule.json` & `src/hooks/useSchedule.ts` | Daily period timeline & countdowns |
| **Security Rules** | `database.rules.json` | Firebase RTDB authorization logic |

---

## Critical Invariants (The "Rules of the Road")

When writing code or refactoring MediaBox, **DO NOT VIOLATE THESE RULES**:

1. **Never write to TV playback state directly from remote components.**
   - *Incorrect*: `update(ref(database, "rooms/123/state/playback"), { status: "paused" })` inside a remote button.
   - *Correct*: `sendCommand('pause')` via `useRemoteRoom.ts`. The TV Host executes the pause and writes the authoritative state.
2. **Never store API keys or proxy auth tokens in Firebase RTDB.**
   - Proxy URLs and Bearer secrets belong strictly in host-local `localStorage` (`mediabox_ytproxy_config`). They must never leak over the network to guests.
3. **Never destroy and recreate YouTube IFrame DOM nodes on track change.**
   - Always call `player.loadVideoById(videoId)`. Recreating the iframe incurs a 2–4 second blank freeze and destroys audio pipeline state.
4. **Never change the 22Hz tick throttle in `BraccatoLyricsRenderer.tsx` to 60Hz.**
   - Calling `el.currentTime` invokes synchronous `tickView()`. Throttling at `Math.abs(time - lastTime) >= 0.045` (22Hz) keeps main-thread load below 30% so Smart TV ARM processors can maintain 60 FPS compositor animations.
5. **Always use `getServerTime()` instead of `Date.now()` for shared timestamps.**
   - Local device clocks vary wildly. `getServerTime()` incorporates Firebase's server offset to guarantee single-digit millisecond synchronization.
6. **Always update `database.rules.json` when adding a new command type.**
   - If you introduce a new command (e.g. `shuffleQueue`), you must add it to the validation whitelist in `database.rules.json`, otherwise Firebase will reject the write with `Permission Denied`.

---

## Developer Workflows

### How to Add a New Remote Command
1. Add the command name to `MemberCommand['type']` in `src/lib/roomUtils.ts`.
2. Add the command name to the `.validate` rule under `members/$memberUid/command` in `database.rules.json`.
3. Implement the execution logic inside `processMemberCommand()` in `src/handlers/commandHandler.ts`.
4. Call `sendCommand('yourCommand', payload)` from the relevant UI component in `src/components/remote/`.

### How to Add a New Lyrics Provider
1. Open `src/lib/lyricsService.ts`.
2. Add your provider fetching logic inside `resolveLyrics()`.
3. Ensure parsed lyrics conform to `@braccato/parsers` `Lyric[]` format.
4. Set `syncType: 'syllable' | 'word' | 'line'`.

### How to Deploy the Application
```bash
# Deploy Frontend to Cloudflare Pages
npm run build
wrangler pages deploy dist

# Deploy Proxy Worker to Cloudflare Workers
cd workers/ytproxy
npx wrangler deploy
```

---

## Troubleshooting Playbook

### 1. "Search returns: TV not responding (timeout after 25s)"
- **Cause**: The TV Host is either closed, disconnected, has lost internet connection, or has hit a rate limit.
- **Checklist**:
  1. Verify the TV Dashboard tab is open and connected (look at the `tv/online` node in Firebase).
  2. In TV Settings -> API Keys tab, ensure the YouTube proxy is saved and marked **`PROXY CONFIGURED`**.
  3. Check Firebase console under `rooms/<room>/searchRequests` to see if requests are piling up.

### 2. "Playback restricted: Video owner has disabled playback in embedded players"
- **Cause**: YouTube error `150` or `101`.
- **Behavior**: MediaBox automatically detects this and triggers an auto-skip after 3.5 seconds.
- **Manual Override**: Click "Skip Restricted Video Now" or press Skip on the remote.

### 3. "Lyrics timing is slightly ahead or behind the singer"
- **Cause**: YouTube iframe audio buffering delays or slight differences in song mastering vs. studio album TTML.
- **Fix**: Open TV Settings -> **TV Behavior Tab** (or Host Remote settings) and adjust the **Lyrics Audio Offset** slider in steps of `+100ms` or `-100ms` until perfectly synchronized.
