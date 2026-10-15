# Handoff: Diagnosing & Resolving Word-Filling Stutters in Karaoke Lyrics

**Status**: Documented for Future Investigation  
**Component**: `src/components/lyrics/BraccatoLyricsRenderer.tsx`, `src/lib/lyricsService.ts`, `@braccato/core` (`engine.js`)  
**Context**: During playback at 8.9× CPU slowdown (emulating LG webOS Smart TV ARM hardware), the active word fill (karaoke swipe/mask progress) stutters or micro-jumps inside the word itself.

---

## 1. Problem Description

While line-level scrolling and frame rates have stabilized at 58–60 FPS with word-synced coalescing and 22Hz tick throttling, a micro-stutter/jump is observable **within the interior of an individual word as it is being highlighted (filled)**. 

Instead of a perfectly fluid linear left-to-right wipe across the characters of the active word, the highlight progress exhibits:
- Discrete micro-jumps (filling a cluster of characters, pausing for ~100ms, then snapping forward).
- Occasional visual restarts or backward hitches mid-word.

---

## 2. In-Depth Root Cause Hypotheses

### Hypothesis 1: 250ms YouTube IFrame Clock Jitter & `drift-reset` Restarts

- **Mechanism in Code**:
  - In `BraccatoLyricsRenderer.tsx`, `samplePlayerTime` queries `player.getCurrentTime()` via `setInterval` every **250ms**.
  - In `getInterpolatedTime()`, local elapsed time is calculated as:
    $$\text{time} = \text{lastSampledRawTime} + (\text{performance.now()} - \text{lastSampleTimestamp}) \times 0.001$$
  - YouTube's iframe media pipeline does not report time with microsecond accuracy; `player.getCurrentTime()` updates in discrete steps of **100ms to 250ms** depending on video buffer frames.
  - When the 250ms sample arrives, if YouTube's reported position lags slightly behind our local `performance.now()` projection (e.g. projection reached $14.22\text{s}$, but YouTube reports $14.12\text{s}$ due to an iframe render delay), the clock **steps backwards by 100ms**.
- **Impact on `@braccato/core` (`engine.js:2407–2415`)**:
  ```javascript
  if (lineData.isAnimating &&
      usedNativeTimingSampleForDrift &&
      Math.abs(lineData.accumulatedOffsetMs) > ANIMATION_TIMING_RESET_THRESHOLD_MS &&
      isPlaying) {
      logAnimationTiming(engine, "drift-reset", lineData, index, nativeTimingSample, currentTime, lineData.accumulatedOffsetMs);
      resetLineAnimationState(lineData);
  }
  ```
  `ANIMATION_TIMING_RESET_THRESHOLD_MS` is hardcoded to **100ms**! When the jitter causes `accumulatedOffsetMs` to cross 100ms, Braccato immediately aborts the active word's Web Animation, tears it down, and starts a fresh animation (`resetLineAnimationState`). To the viewer, the word fill appears to **hitch, stutter, or snap backward**.

---

### Hypothesis 2: Syllable Merging vs. Linear Letter Mask Disconnect

- **Mechanism in Code**:
  - In `lyricsService.ts`, `coalesceSyllablesToWords()` combines syllables into words:
    $$\text{duration} = (\text{lastPart.startTime} + \text{lastPart.duration}) - \text{firstPart.startTime}$$
  - In human singing, vowels and syllables are sung with highly variable, non-linear lengths. For example, in the word *"Never"*, the syllable `"Nev-"` might be sustained for **800ms**, followed by a fast **150ms** release on `"-er "`.
  - When merged into a single word with `duration: 950ms`, Braccato's internal letter-sweeping engine (`planLetterMaskSweep`) assumes uniform phoneme distribution across all letters (`N-e-v-e-r`), allocating $\frac{950}{5} = 190\text{ms}$ per letter.
  - As a result, the highlight moves at an artificial uniform rate that does not match the singer's vocal pacing, causing words with long sustained vowels to appear as if they "rush" through the start and "stall" or jump at the end.

---

### Hypothesis 3: Multi-Track Letter Sweeping (`planLetterMaskSweep`) Overhead

- **Mechanism in Code**:
  - In `engine.js` line 883:
    ```javascript
    const highlightLetters = part.highlightLetterElements;
    if (highlightLetters && highlightLetters.length > 0) {
        const sweeps = planLetterMaskSweep(...);
        sweeps.forEach((sweep, index) => {
            target.animate(sweep.keyframes, { ... });
        });
    } else {
        // Fallback: single gradient swipe across the whole word span
        swipeAnimation = trackLyricAnimationTiming(engine, highlight.animate(activeTextGradientKeyframes(config), ...));
    }
    ```
  - If `highlightLetterElements` are populated in the DOM, Braccato creates an independent Web Animation track for **every single character** in the word (staggered mask offsets).
  - On a weak ARM CPU at 8.9× throttling, animating 6–10 simultaneous character masks per word taxes the layout engine, causing micro-frame drops between character mask boundaries.

---

### Hypothesis 4: 22Hz Tick Quantization (`0.045s`) on Line/Word State Classes

- **Mechanism in Code**:
  - In `BraccatoLyricsRenderer.tsx`, `el.currentTime` is written when:
    ```typescript
    if (Math.abs(time - lastTime) >= 0.045 || el.playing !== playing)
    ```
  - While Web Animations run on the compositor, Braccato's `updateWordStates` method relies on `el.currentTime` to toggle:
    - `.blyrics--word-upcoming`
    - `.blyrics--word-active`
    - `.blyrics--word-past`
  - Writing time at 22Hz means word state transitions can step in ~45ms discrete chunks. If a word duration is relatively short (e.g. 120ms), 45ms represents nearly 40% of the entire word's lifespan, creating a visible "stepped" transition between words.

---

## 3. Recommended Remediation Experiments (Future Tasks)

When returning to address this issue, test the following targeted solutions in order:

### Experiment 1: Monotonic Clock Smoothing with Low-Pass Exponential Filter
- **Goal**: Prevent backward clock jumps and keep clock derivative strictly positive ($dt \ge 0$).
- **Implementation**:
  ```typescript
  // In BraccatoLyricsRenderer.tsx
  const samplePlayerTime = () => {
    const raw = getCurrentTimeRef.current();
    // Low-pass filter / clamp: never allow sample to jump backward unless a manual seek occurred (>1.0s difference)
    if (Math.abs(raw - lastSampledRawTime) < 1.0) {
      lastSampledRawTime = Math.max(lastSampledRawTime, raw);
    } else {
      lastSampledRawTime = raw; // user seek
    }
    lastSampleTimestamp = performance.now();
    return lastSampledRawTime;
  };
  ```

### Experiment 2: Raise `ANIMATION_TIMING_RESET_THRESHOLD_MS` in Braccato Theme
- **Goal**: Prevent Braccato from calling `resetLineAnimationState` mid-word.
- **Implementation**:
  - Check if Braccato supports configuring `blyrics-animation-timing-reset-threshold-ms` in the theme settings, or override the drift detection tolerance so it only corrects drift at line breaks rather than mid-word.

### Experiment 3: Pure Whole-Word CSS Gradient Wipe (Single Mask)
- **Goal**: Eliminate per-letter mask sweeping (`planLetterMaskSweep`) in favor of a single smooth gradient wipe on the word span.
- **Implementation**:
  - Configure Braccato's theme or styling so words do not split into individual `highlightLetterElements`. A single CSS gradient swipe across the word span (`activeTextGradientKeyframes`) requires only **1 WAAPI animation per word** instead of $N$ character animations.

### Experiment 4: Hybrid Syllable Timing Preservation
- **Goal**: Keep word grouping in the visual DOM (fewer spans) while preserving internal syllable timestamp keyframes.
- **Implementation**:
  - Instead of a flat linear duration for the whole word, generate multi-stop keyframes for the word's highlight mask matching the exact proportional duration of each original syllable.

---

## 4. Verification Checklist for Future Investigation

- [ ] Run Chrome DevTools Performance Trace at 8.9× CPU slowdown.
- [ ] Filter console logs / DevTools timeline for `"WAAPI timing"` and `"drift-reset"`.
- [ ] Verify if `drift-reset` frequency correlates with the observed word fill jumps.
- [ ] Measure clock drift between `performance.now()` interpolation and YouTube `player.getCurrentTime()`.
