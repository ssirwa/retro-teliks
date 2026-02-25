# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Retro Teliks** is a static, no-build vanilla HTML/CSS/JS web app that simulates a retro CRT television. It plays Lithuanian YouTube videos as "channels" and uses a clickable HTML image map on `tv.png` to simulate physical TV buttons (Power, CH▲, CH▼, VOL+, VOL-).

Open `index.html` directly in a browser — there is no build step, no package manager, no bundler.

## Architecture

### File Roles
- `index.html` — TV shell: loads YouTube IFrame API script, defines the `<img usemap>` TV image and `<map><area>` button hotspots, and contains the `.tv-screen` overlay div where content is injected.
- `main.js` — All runtime logic (no external libraries beyond YouTube IFrame API).
- `style.css` — TV layout and visual effects.
- `tv.png` — The TV bezel/body image; must be an `<img>` (not a CSS background) for `<map>` to work.
- `static.mp4` — Short static-noise clip played on channel change and power on/off.

### Core Concepts in `main.js`

**Channels** — Defined as a plain array of `{ name, youtubeId }` objects at the top of `main.js`. To add/remove channels, edit this array.

**YouTube IFrame API** — Loaded asynchronously. `window.onYouTubeIframeAPIReady` sets `apiReady = true`. If power is toggled before the API loads, `pendingRender = true` defers `renderChannel()` until ready.

**Player lifecycle** — `renderChannel()` removes any existing `.yt-wrapper`, creates a new one, and instantiates a `YT.Player`. Players are stored in `players[videoId]`.

**Progress persistence** — Playback positions are saved to `localStorage` under `channelProgress:v1` every 2 seconds via `startProgressTracking()`. The last-viewed channel index is saved under `lastChannelIndex:v1`. On revisiting a channel, `seekTo(savedTime)` resumes playback.

**Near-end auto-skip** — `startNearEndCheck()` polls every 1 s; when ≤ 5 s remain it resets progress to 0 and calls `nextChannel(true)` with a static flash. `nearEndSkipped[videoId]` prevents double-firing.

**Volume** — `currentVolume` (0–100, default 80) is persisted under `tvVolume:v1`. `volUp()` / `volDown()` step by `VOLUME_STEP` (10%), call `applyVolume(player)` on the active player, and show a block-bar OSD. Volume is also applied in `onReady` so each newly loaded player starts at the saved level.

**Responsive image map** — `setupResponsiveImageMap()` stores original pixel coords in `data-orig-coords` and rescales `area.coords` on every window resize relative to `tvImg.naturalWidth/Height`.

**Debug mode** — Set `DEBUG_SHOW_HOTSPOTS = true` in `main.js` to render visible rectangles over all `<area>` hotspots (useful when repositioning buttons after changing `tv.png`).

### CSS Layout

The `.tv-frame` is `position: relative`; the `.tv-screen` is `position: absolute` positioned over the drawn screen area of `tv.png` using percentage/pixel values:

```css
left: 27.95%;
top: 9%;
width: 532px;
height: 362px;
```

Adjust these four values when the TV image changes. The YouTube iframe is placed inside `.yt-frame-container` which is `width: 300%; left: -100%` to center-crop a 16:9 video into the 4:3 CRT screen.

### Controls
| Input | Action |
|---|---|
| Click Power area | `togglePower()` |
| Click CH▲ area | `nextChannel()` |
| Click CH▼ area | `previousChannel()` |
| `ArrowRight` | `nextChannel()` |
| `ArrowLeft` | `previousChannel()` |
| `Enter` / `Space` | `togglePower()` |
| Click screen | `unmuteCurrent()` (handles autoplay mute policy) |
| Click VOL+ area | `volUp()` |
| Click VOL- area | `volDown()` |
| `ArrowUp` | `volUp()` |
| `ArrowDown` | `volDown()` |

### Key Constants (top of `main.js`)
- `NEAR_END_SECONDS = 5` — how many seconds from end triggers auto-skip
- `END_CHECK_MS = 1000` — polling interval for near-end check
- `VOLUME_STEP = 10` — percent change per VOL+/VOL- press
- `PLAYBACK_KEY` / `CHANNEL_KEY` / `VOLUME_KEY` — localStorage key names (versioned)
