'use strict';

/* ---------- DOM ---------- */
const screen = document.querySelector('.tv-screen');
const osd = screen.querySelector('.osd');
const tvImg = document.getElementById('tv-image');
const mapAreas = document.querySelectorAll('map[name="tvmap"] area[data-action]');

/* ---------- State ---------- */
let isPoweredOn = false;
let apiReady = false;
let pendingRender = false;
// ---------- Auto-skip near end ----------
const NEAR_END_SECONDS = 5;      // how close to the end triggers auto-skip
const END_CHECK_MS = 1000;       // how often to check time remaining
const nearEndSkipped = {};       // videoId -> boolean (prevents repeated triggers)
``
const PLAYBACK_KEY = 'channelProgress:v1';
const CHANNEL_KEY = 'lastChannelIndex:v1';

let progress = {};
try {
  progress = JSON.parse(localStorage.getItem(PLAYBACK_KEY) || '{}');
} catch {
  progress = {};
}

let currentChannelIndex = 0;
try {
  const savedIndex = Number(localStorage.getItem(CHANNEL_KEY));
  if (Number.isInteger(savedIndex)) currentChannelIndex = savedIndex;
} catch {}

/* ---------- Channels ---------- */
const channels = [
  { name: 'Žinios', youtubeId: 'qUOwmUH5B6g' },
  { name: 'Laidos', youtubeId: '7Wyj9NMopn8' },
  { name: 'Reklamos', youtubeId: 'gdfAPI7-l_c' },
  { name: 'Reklamos', youtubeId: 'Y2g0FwfrU3Q' },
  { name: 'Laidos', youtubeId: 'eCBCLz2ZOBk' },
  { name: 'Laidos', youtubeId: 'Nq2eshZiqDc' },
  { name: 'Laidos', youtubeId: 'oahmoasR9X4' },
  { name: 'Laidos', youtubeId: 'kRYPHyD0UAg' },
];

/* ---------- Static Noise ---------- */
const staticVideo = document.createElement('video');
staticVideo.className = 'tv-static';
staticVideo.src = 'static.mp4';
staticVideo.loop = true;
staticVideo.muted = false;     // keep your original intent (may be blocked until user interacts)
staticVideo.playsInline = true;
staticVideo.preload = 'auto';
screen.appendChild(staticVideo);

function playStatic(durationMs = 550) {
  staticVideo.currentTime = 0;
  staticVideo.style.opacity = '1';
  staticVideo.play?.().catch(() => {});
  setTimeout(() => {
    staticVideo.style.opacity = '0';
    staticVideo.pause?.();
  }, durationMs);
}

/* ---------- OSD ---------- */
let osdTimer = null;
function showOSD(text, ms = 1200) {
  if (!osd) return;
  osd.textContent = text;
  osd.classList.add('show');
  if (osdTimer) clearTimeout(osdTimer);
  osdTimer = setTimeout(() => osd.classList.remove('show'), ms);
}

/* ---------- YouTube API Ready ---------- */
window.onYouTubeIframeAPIReady = function () {
  apiReady = true;
  if (pendingRender && isPoweredOn) {
    renderChannel();
    pendingRender = false;
  }
};

// In case API is already available
if (window.YT && typeof window.YT.Player === 'function') {
  window.onYouTubeIframeAPIReady();
}

/* ---------- Player & Progress Tracking ---------- */
const players = {};
const trackIntervals = {};

function startProgressTracking(videoId, player) {
  stopProgressTracking(videoId);
  trackIntervals[videoId] = setInterval(() => {
    try {
      const t = player.getCurrentTime?.();
      if (typeof t === 'number' && isFinite(t)) {
        progress[videoId] = t;
        localStorage.setItem(PLAYBACK_KEY, JSON.stringify(progress));
      }
    } catch {}
  }, 2000);
}

function stopProgressTracking(videoId) {
  if (trackIntervals[videoId]) {
    clearInterval(trackIntervals[videoId]);
    delete trackIntervals[videoId];
  }
}

function stopAllTracking() {
  Object.keys(trackIntervals).forEach(stopProgressTracking);
  stopAllEndChecks();
}

const endCheckIntervals = {};

function stopEndCheck(videoId) {
  if (endCheckIntervals[videoId]) {
    clearInterval(endCheckIntervals[videoId]);
    delete endCheckIntervals[videoId];
  }
}

function stopAllEndChecks() {
  Object.keys(endCheckIntervals).forEach(stopEndCheck);
}
function startNearEndCheck(videoId, player) {
  stopEndCheck(videoId);
  nearEndSkipped[videoId] = false;

  endCheckIntervals[videoId] = setInterval(() => {
    if (!isPoweredOn) return;

    try {
      const t = player.getCurrentTime?.();
      const d = player.getDuration?.();

      // duration can be 0/NaN briefly during load
      if (typeof t !== 'number' || typeof d !== 'number' || !isFinite(t) || !isFinite(d) || d <= 0) {
        return;
      }

      const remaining = d - t;

      // If we're near the end and haven't already skipped for this video
      if (!nearEndSkipped[videoId] && remaining <= NEAR_END_SECONDS && remaining > 0.1) {
        nearEndSkipped[videoId] = true;

        // Mark this channel as "ended" so next time it starts from beginning
        progress[videoId] = 0;
        localStorage.setItem(PLAYBACK_KEY, JSON.stringify(progress));

        // Skip to next channel + static effect
        nextChannel(true);
        playStatic(600);
      }
    } catch {
      // ignore
    }
  }, END_CHECK_MS);
}
/* ---------- Rendering ---------- */
function clearCurrentFrame() {
  screen.querySelector('.yt-wrapper')?.remove();
}

function renderChannel() {
  clearCurrentFrame();
  if (!isPoweredOn) return;

  if (!apiReady) {
    pendingRender = true;
    return;
  }

  const { youtubeId, name } = channels[currentChannelIndex];
nearEndSkipped[youtubeId] = false;
  stopAllTracking();

  const wrapper = document.createElement('div');
  wrapper.className = 'yt-wrapper';

  const frameContainer = document.createElement('div');
  frameContainer.className = 'yt-frame-container';

  const target = document.createElement('div');
  target.id = `yt-player-${youtubeId}`;

  frameContainer.appendChild(target);
  wrapper.appendChild(frameContainer);
  screen.appendChild(wrapper);

  const player = new YT.Player(target.id, {
    videoId: youtubeId,
    playerVars: {
      autoplay: 1,
      mute: 0,
      controls: 0,
      modestbranding: 1,
      rel: 0,
      playsinline: 1,
      enablejsapi: 1,
      origin: window.location.origin,
      playlist: youtubeId,
    },
    events: {
      onReady: (e) => {
  const saved = progress[youtubeId] || 0;

  // If ended previously, saved will be 0 so it starts from beginning.
  if (saved > 1) e.target.seekTo(saved, true);
  else e.target.seekTo(0, true);

  e.target.playVideo();
  startProgressTracking(youtubeId, e.target);

  // NEW: start near-end auto skip checks
  startNearEndCheck(youtubeId, e.target);
},
      onStateChange: (e) => {
  if (e.data === YT.PlayerState.PLAYING) {
    startProgressTracking(youtubeId, e.target);
    startNearEndCheck(youtubeId, e.target);
  } else if (e.data === YT.PlayerState.PAUSED) {
    stopProgressTracking(youtubeId);
  } else if (e.data === YT.PlayerState.ENDED) {
    // Mark video as ended => next time channel is selected, it plays from start
    progress[youtubeId] = 0;
    localStorage.setItem(PLAYBACK_KEY, JSON.stringify(progress));

    stopProgressTracking(youtubeId);
    stopEndCheck(youtubeId);

    // Optional: also jump immediately to next channel on true end
    // (near-end skip usually catches it, but this is a fallback)
    nextChannel(true);
    playStatic(600);
  }
},

      onError: () => {
        // If a video is blocked, skip forward silently
        nextChannel(true);
      },
    },
  });

  players[youtubeId] = player;
  localStorage.setItem(CHANNEL_KEY, String(currentChannelIndex));
  showOSD(`📺 ${name}`);
}

/* ---------- Controls ---------- */
function nextChannel(silent = false) {
  if (!isPoweredOn) return;
  currentChannelIndex = (currentChannelIndex + 1) % channels.length;
  renderChannel();
  if (!silent) playStatic(600);
}

function previousChannel() {
  if (!isPoweredOn) return;
  currentChannelIndex = (currentChannelIndex - 1 + channels.length) % channels.length;
  renderChannel();
  playStatic(600);
}

function powerOn() {
  if (isPoweredOn) return;
  isPoweredOn = true;
  renderChannel();
  playStatic(800);
  showOSD('TV ON');
}

function powerOff() {
  if (!isPoweredOn) return;
  isPoweredOn = false;
  stopAllTracking();
  clearCurrentFrame();
  showOSD('TV OFF');
}

function togglePower() {
  isPoweredOn ? powerOff() : powerOn();
}

function unmuteCurrent() {
  if (!isPoweredOn) return;
  const { youtubeId } = channels[currentChannelIndex];
  const p = players[youtubeId];
  try { p?.unMute?.(); } catch {}
}

/* ---------- Image-map Actions ---------- */
function bindImageMapActions() {
  mapAreas.forEach((area) => {
    area.addEventListener('click', (e) => {
      e.preventDefault();

      const action = area.dataset.action;
      if (action === 'next') nextChannel();
      if (action === 'prev') previousChannel();
      if (action === 'power') togglePower();

      unmuteCurrent();
    });
  });
}

/* ---------- Responsive Image-map Coords ---------- */
/**
 * Keeps <area coords> aligned when the <img> is resized.
 * Store original coords in data-orig-coords and scale to rendered size.
 */
function setupResponsiveImageMap() {
  if (!tvImg || !mapAreas.length) return;

  // Save original coords once
  mapAreas.forEach((area) => {
    if (!area.dataset.origCoords) {
      area.dataset.origCoords = area.coords; // e.g. "x1,y1,x2,y2"
    }
  });

  const resize = () => {
    if (!tvImg.naturalWidth || !tvImg.naturalHeight) return;

    const scaleX = tvImg.clientWidth / tvImg.naturalWidth;
    const scaleY = tvImg.clientHeight / tvImg.naturalHeight;

    mapAreas.forEach((area) => {
      const orig = (area.dataset.origCoords || '').split(',').map(n => Number(n.trim()));
      if (!orig.length || orig.some(Number.isNaN)) return;

      const scaled = orig.map((val, i) => {
        // even indices are x, odd are y
        return Math.round(val * (i % 2 === 0 ? scaleX : scaleY));
      });

      area.coords = scaled.join(',');
    });
    drawHotspotOverlay(scaleX, scaleY);
  };

  if (tvImg.complete) resize();
  tvImg.addEventListener('load', resize);
  window.addEventListener('resize', resize);
}

/* ---------- Keyboard Controls (kept) ---------- */
document.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowRight') { nextChannel(); unmuteCurrent(); }
  if (e.key === 'ArrowLeft') { previousChannel(); unmuteCurrent(); }
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    togglePower();
    unmuteCurrent();
  }
});

/* Click on screen = user interaction to unmute */
screen.addEventListener('click', () => {
  unmuteCurrent();
});

/* ---------- DEBUG: Visualize <map><area> hotspots ---------- */
const DEBUG_SHOW_HOTSPOTS = false; // <-- set false to hide

let debugLayer = null;

function ensureDebugLayer() {
  if (!DEBUG_SHOW_HOTSPOTS) return null;
  if (debugLayer) return debugLayer;

  // Attach overlay to the same positioned container as the image
  const frame = document.querySelector('.tv-frame');
  debugLayer = document.createElement('div');
  debugLayer.className = 'map-debug-layer';
  frame.appendChild(debugLayer);
  return debugLayer;
}

function drawHotspotOverlay(scaleX, scaleY) {
  if (!DEBUG_SHOW_HOTSPOTS) return;
  const layer = ensureDebugLayer();
  if (!layer) return;

  layer.innerHTML = '';

  mapAreas.forEach((area) => {
    const orig = (area.dataset.origCoords || area.coords)
      .split(',')
      .map(n => Number(n.trim()));

    if (orig.length < 4 || orig.some(Number.isNaN)) return;

    // We currently use rect hotspots in index.html
    const x1 = Math.round(orig[0] * scaleX);
    const y1 = Math.round(orig[1] * scaleY);
    const x2 = Math.round(orig[2] * scaleX);
    const y2 = Math.round(orig[3] * scaleY);

    const rect = document.createElement('div');
    rect.className = 'map-debug-rect';
    rect.style.left = Math.min(x1, x2) + 'px';
    rect.style.top = Math.min(y1, y2) + 'px';
    rect.style.width = Math.abs(x2 - x1) + 'px';
    rect.style.height = Math.abs(y2 - y1) + 'px';

    const label = document.createElement('div');
    label.className = 'map-debug-label';
    label.textContent = area.dataset.action || area.title || area.ariaLabel || 'area';

    rect.appendChild(label);
    layer.appendChild(rect);
  });
}
/* Init */
bindImageMapActions();
setupResponsiveImageMap();