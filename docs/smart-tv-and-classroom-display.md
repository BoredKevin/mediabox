# Smart TV & Classroom Display

Beyond its jukebox capabilities, MediaBox was specifically built to serve as an **ambient classroom and lounge dashboard**. It replaces dull static clocks with an intelligent timetable, a period countdown alarm, and full compatibility with Smart TV remotes.

This document explains the **Classroom Timetable Engine**, the **10-Second Transition Countdown**, the **Smart TV hardware remote key mapping**, and the **Open-Source License compliance generator**.

---

## The Classroom Timetable Engine (`useSchedule.ts` & `ScheduleSection.tsx`)

In school classrooms or college study spaces, students want music between classes, but everyone needs to know when the current period ends and the next class begins.

### 1. Data Structure (`public/schedule.json`)
The timetable is stored in a clean JSON format keyed by Indonesian day names (`Senin`, `Selasa`, `Rabu`, `Kamis`, `Jumat`, `Sabtu`, `Minggu`):
```json
{
  "Senin": [
    { "start": "00:00", "sub": "Di Luar Jam Sekolah" },
    { "start": "07:00", "sub": "Upacara Bendera", "countdown": true },
    { "start": "07:45", "sub": "Bahasa Inggris" },
    { "start": "10:00", "sub": "Istirahat", "countdown": true },
    { "start": "10:15", "sub": "Matematika" },
    { "start": "16:10", "sub": "Pulang", "countdown": true }
  ]
}
```

### 2. Time Progression & Dynamic Calculation (`useSchedule.ts`)
Every second, `useSchedule` recalculates:
- **`current`**: The subject or event currently in session.
- **`next`**: The upcoming subject.
- **`progress`**: Percentage of the current period that has elapsed (0% to 100%).
- **`secondsToNext`**: Milliseconds and seconds remaining until the next bell.
- **`upcomingItems`**: Slice of the next 3 upcoming periods for the day.

### 3. The 5-Second Ambient Schedule Carousel (`ScheduleSection.tsx`)
When media is playing, screen space is valuable. Rather than displaying an oversized static list, `ScheduleSection.tsx` morphs into a **5-second carousel**:
- It cycles smoothly through upcoming periods with a sleek `fade-out slide-up` followed by a `fade-in slide-up` transition.
- Viewers can casually glance at the TV to see what class is next without losing sight of the music player.

---

## The 10-Second Transition Countdown Overlay (`CountdownOverlay.tsx`)

For events marked with `"countdown": true` in `schedule.json` (such as recess periods, the start of class, or dismissal):

```
+-----------------------------------------------------------+
|                                                           |
|               WARNING: NEXT PERIOD COMMENCING             |
|                                                           |
|                      [  00:07  ]                          |
|                                                           |
|                 UPACARA BENDERA (07:00)                   |
|                                                           |
+-----------------------------------------------------------+
```

1. **Auto-Trigger**: When `secondsToNext <= 10` and `isCountdownEnabled === true`, a high-visibility countdown overlay animates into view over the TV screen.
2. **Audio/Visual Pulse**: Displays big, bold numbers counting down from `10` to `0` with a pulsing red/amber border.
3. **Toggleable**: Classroom teachers or room hosts can toggle this feature on or off in the TV Settings modal (**TV Behavior Tab**).

---

## Smart TV Hardware Remote Integration (`useTvNavigation.ts`)

Operating a web browser on a Smart TV using an air-mouse or D-pad is notoriously clunky. MediaBox provides native key event mapping in `src/hooks/useTvNavigation.ts`:

### 1. Hardware Back Button Support
- **LG webOS**: Keycode `461`
- **Samsung Tizen**: Keycode `10009`
- **Standard Keyboard**: Keycode `27` (`Escape`) or `Back`
- **Behavior**:
  - If a modal (like Settings or QR Code) is open, pressing **Back** closes the modal.
  - If in Fullscreen Mode, pressing **Back** exits fullscreen cleanly back to the dual dashboard.

### 2. Media Remote Keys
- **Play**: Keycode `415`
- **Pause**: Keycode `19`
- **Play/Pause Toggle**: Keycodes `10252` and `179`
- **Next Track (Fast Forward)**: Keycode `417`
- **Previous Track (Rewind)**: Keycode `412`

### 3. The D-Pad "Air-Mouse" Jitter Suppressor
LG Magic Remotes feature a built-in gyroscope that projects a floating mouse cursor. If resting on an uneven couch or table, micro-movements trigger `:hover` CSS states all over the dashboard, causing ugly button jitter.
- **MediaBox's Fix**:
  - The moment the user touches any D-pad arrow key (Left, Right, Up, Down), `useTvNavigation` injects `.tv-dpad-mode` into `document.body`.
  - In this mode, hover pseudo-classes are disabled.
  - Hover states are only re-enabled when deliberate physical mouse movement is detected.

---

## Fullscreen / Kiosk Mode

With a single tap on the TV (or remotely from an admin's phone), MediaBox enters **Kiosk Fullscreen**:
- Hides the top navigation header, clock box, schedule cards, and footer.
- The media video or synced karaoke lyrics expand to occupy 100% of the display.
- Synchronized through `state/isFullscreen` in Firebase, allowing any host to maximize or minimize the TV from across the room.

---

## Automated License Compliance (`scripts/generate-licenses.js`)

MediaBox is released under the **CPAL-1.0** license. To comply with open-source licensing requirements when embedding hundreds of NPM dependencies (Radix UI, Firebase, Lucide, Tailwind, Braccato):

1. **Build Hook**: Running `npm run build` triggers `node scripts/generate-licenses.js`.
2. **Lockfile Traversal**: The script scans `package-lock.json` and production dependencies, pulling author names, license identifiers (MIT, Apache-2.0, BSD-3-Clause), and repository URLs.
3. **JSON Generation**: Compiles the data into `src/data/licenses.json` (over 280+ licensed modules).
4. **In-App Modal**: Accessible via the "Licenses" button in the footer (`LicensesModal.tsx`), allowing anyone to inspect third-party notices directly in the app.
