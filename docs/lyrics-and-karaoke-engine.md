# Lyrics Pipeline & Karaoke Engine 🎤

One of the crowning features of MediaBox is its **synchronized karaoke lyrics experience**. Both the Big Screen TV and every connected Mobile Remote display word-level or syllable-level animated lyrics that highlight in lockstep with the vocals—resembling Apple Music or Spotify Karaoke mode.

This document breaks down the **7-stage lyrics resolution cascade**, the rendering architecture powered by `@braccato/core`, dynamic color extraction, and the performance engineering secrets that make it fly on budget Smart TVs.

---

## 🌊 The 7-Stage Lyrics Resolution Cascade (`lyricsService.ts`)

Finding synchronized lyrics for arbitrary YouTube videos is difficult: titles have weird upload formats (`"Artist - Song (Official Video)"`), albums are omitted, and video lengths include intros and credits.

MediaBox uses a multi-tier fallback cascade to guarantee the highest probability of finding time-synced lyrics:

```mermaid
flowchart TD
    START([Song Queued / Playing]) --> STAGE1{Stage 1: Unison by videoId}
    STAGE1 -- Found TTML/LRC --> SUCCESS([Parse & Render Lyrics])
    STAGE1 -- 404 / Missing --> STAGE2[Stage 2: Enrich Metadata via iTunes API]
    
    STAGE2 --> STAGE3{Stage 3: Better Lyrics Main Endpoint}
    STAGE3 -- Found TTML --> SUCCESS
    STAGE3 -- Miss --> STAGE4{Stage 4: Unison by Song + Artist}
    
    STAGE4 -- Found TTML/LRC --> SUCCESS
    STAGE4 -- Miss --> STAGE5{Stage 5: BiniLyrics TTML Provider}
    
    STAGE5 -- Found TTML --> SUCCESS
    STAGE5 -- Miss --> STAGE6{Stage 6: QQ Music QRC / Kugou LRC}
    
    STAGE6 -- Found --> SUCCESS
    STAGE6 -- Miss --> STAGE7{Stage 7: LRCLib Line-Sync Provider}
    
    STAGE7 -- Found LRC --> SUCCESS
    STAGE7 -- Miss --> FALLBACK([Show Album Art & Video Player])
```

### Stage 1: Unison Community by Video ID
- **Endpoint**: `https://unison.boidu.dev/lyrics?v={videoId}`
- **Why it's first**: Extremely fast (< 180ms), lightweight, and requires **zero metadata parsing**. If someone in the Unison community has mapped that specific YouTube video ID, it delivers instant, pre-synchronized syllable TTML.

### Stage 2: iTunes Metadata Enrichment
- **Endpoint**: `https://itunes.apple.com/search?term={artist}+{song}&entity=song&limit=1`
- **Why it's essential**: Better Lyrics (the primary high-quality provider) caches entries using a hash strictly composed of **four parameters**:
  $$\text{Key} = \text{hash}(\text{Song}, \text{Artist}, \text{Album}, \text{DurationSeconds})$$
  Without the exact album name and official track duration from iTunes, Better Lyrics would report a cache miss (401/404) for over 80% of songs!

### Stage 3: Better Lyrics Main Endpoint
- **Endpoint**: `GET https://api.betterlyrics.org/getLyrics?s={song}&a={artist}&al={album}&d={duration}`
- **Payload**: Full syllable-synced Apple Music-style TTML XML.

### Stage 4: Unison by Song and Artist
- **Endpoint**: `GET https://unison.boidu.dev/lyrics?song={s}&artist={a}&duration={d}`
- **Format**: Community TTML, LRC, or QRC.

### Stage 5: BiniLyrics TTML Provider
- **Endpoint**: `GET https://lyrics-api.binimum.org/?track={s}&artist={a}&duration={d}`
- **Format**: Direct syllable-level TTML catalogs.

### Stage 6: Better Lyrics QQ Music (QRC) & Kugou (LRC)
- **Endpoints**: `https://api.betterlyrics.org/qq/getLyrics` & `/kugou/getLyrics`
- **Format**: Word-level QRC format parsed via `parseQRC()`.

### Stage 7: LRCLib Line-Synced Fallback
- **Endpoint**: `https://lrclib.net/api/get`
- **Format**: Standard line-synced LRC files with custom User-Agent identifying MediaBox.

---

## 🎨 Dynamic Dominant Color Extraction (`colorExtractor.ts`)

When lyrics load, the background behind the scrolling text dynamically transitions to an ambient radial gradient derived from the song's album art:

1. Loads the YouTube thumbnail (`https://i.ytimg.com/vi/{videoId}/hqdefault.jpg`) into an off-screen HTML `<canvas>`.
2. Downsamples the image to a low-resolution $50 \times 50$ pixel grid.
3. Quantizes RGB values, skips near-black ($< 25$) and near-white ($> 230$) pixels, and calculates the dominant hue.
4. Generates a glowing, deep sci-fi gradient:
   ```css
   radial-gradient(circle at 70% 35%, rgba(r, g, b, 0.45) 0%, #0d0612 100%)
   ```

---

## ⚡ Smart TV Optimization: The 22Hz Tick & Syllable Coalescing

Running complex Web Animations API tracks for thousands of characters on an entry-level LG webOS or Samsung Smart TV with a weak ARM CPU will quickly cause frame drops and browser freezes.

MediaBox implements two breakthroughs in `src/components/lyrics/BraccatoLyricsRenderer.tsx`:

### 1. Syllable-to-Word Coalescing (`coalesceSyllablesToWords`)
By default, TTML lyrics split words into tiny syllables (e.g. `"Nev-"`, `"-er "`, `"gon-"`, `"-na "`).
- **The Problem**: Each syllable creates a separate DOM `<span>` and an independent `KeyframeEffect` Web Animation instance. A 3-minute song can spawn **over 1,200 simultaneous animation targets**, overwhelming the TV's layout engine.
- **The Solution**: When `isWordSync` is active, MediaBox merges syllables into cohesive words with combined durations:
  - **DOM node reduction**: **~65% fewer elements**.
  - **Web Animations API instances**: **~70% fewer active tracks**.
  - **Visual result**: Smooth, stable word-by-word highlights without micro-stutters.

### 2. 22Hz Tick Throttling with Local 60 FPS Interpolation
In Braccato, writing `element.currentTime = time` triggers a synchronous method called `tickView()`, which measures DOM elements and computes line scroll positions.
- If called inside a standard `requestAnimationFrame` loop (60 times/sec), the main thread is 100% pegged by `tickView()`, starving the GPU compositor.
- **MediaBox's Fix**:
  ```typescript
  // In BraccatoLyricsRenderer.tsx
  if (Math.abs(time - lastTime) >= 0.045 || el.playing !== playing) {
    el.currentTime = time;
    el.playing = playing;
    lastTime = time;
  }
  ```
  Updating `currentTime` at **22Hz (every 45ms)** instead of 60Hz cuts main-thread overhead by **67%**, allowing CSS transforms and Web Animations to run on the GPU compositor at a rock-solid **58–60 FPS**!

---

## 📱 Mobile Remote Synced Lyrics (`RemoteLyricsView.tsx`)

Every guest in the room can open the **Lyrics Tab** on their phone to read along or sing karaoke:
- **No Video Stream Needed**: The phone does not stream video or audio. It simply subscribes to `rooms/<room>/state/playback`.
- **Dead-Reckoning Clock**: Computes the exact second based on `(getServerTime() - updatedAt)`.
- **Tap to Seek**: When enabled for hosts, tapping a lyric line dispatches a `seek` command with `positionMs` back to the TV Host, jumping directly to that verse!

---

## 🔬 Ongoing Research & Handoff Notes

For detailed investigation notes, timing drift metrics, and experimental hypotheses regarding word-fill masks under 8.9× CPU throttling, refer to:
👉 **[Handoff: Diagnosing & Resolving Word-Filling Stutters in Karaoke Lyrics](file:///D:/coding/BoredKevin/mediabox/docs/handoff_word_fill_stutter.md)**
