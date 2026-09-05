// ==========================================================================
// LIKHĀ CAFÉ - LIVE ORDER PROGRESS & TV QUEUE DISPLAY BOARD SCRIPT
// ==========================================================================

import { db, collection, query, where, orderBy, onSnapshot } from './firebase-config.js';

let soundEnabled = true;
let audioCtx = null;
let previousReadyOrderIds = new Set();
let isFirstLoad = true;

// DOM Elements
const preparingGrid = document.getElementById('preparingGrid');
const readyGrid = document.getElementById('readyGrid');
const prepCountBadge = document.getElementById('prepCountBadge');
const readyCountBadge = document.getElementById('readyCountBadge');
const boardClockTime = document.getElementById('boardClockTime');
const toggleSoundBtn = document.getElementById('toggleSoundBtn');
const soundIcon = document.getElementById('soundIcon');
const soundLabel = document.getElementById('soundLabel');
const toggleFullscreenBtn = document.getElementById('toggleFullscreenBtn');

// Init
document.addEventListener('DOMContentLoaded', () => {
  initClock();
  setupControls();
  subscribeToLiveQueue();
});

// ---------- Live Digital Clock ----------
function initClock() {
  function update() {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
    if (boardClockTime) boardClockTime.textContent = timeStr;
  }
  update();
  setInterval(update, 1000);
}

// ---------- Audio Chime Generator (Web Audio API) ----------
function initAudio() {
  if (!audioCtx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) {
      audioCtx = new AudioContext();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

function playCafeChime() {
  if (!soundEnabled) return;
  try {
    initAudio();
    if (!audioCtx) return;

    const now = audioCtx.currentTime;

    // Pleasant 2-note Cafe Service Chime: D5 (587.33Hz) -> A5 (880Hz)
    const notes = [
      { freq: 587.33, start: now, duration: 0.35 },
      { freq: 880.00, start: now + 0.18, duration: 0.7 }
    ];

    notes.forEach(note => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(note.freq, note.start);

      gain.gain.setValueAtTime(0, note.start);
      gain.gain.linearRampToValueAtTime(0.3, note.start + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, note.start + note.duration);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start(note.start);
      osc.stop(note.start + note.duration);
    });

    console.log('🔔 Cafe audio chime played for Ready order!');
  } catch (e) {
    console.warn('Audio chime playback error:', e);
  }
}

// ---------- Realtime Live Queue Subscription ----------
function subscribeToLiveQueue() {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const q = query(
      collection(db, 'orders'),
      where('createdAt', '>=', today),
      orderBy('createdAt', 'desc')
    );

    onSnapshot(q, (snapshot) => {
      const allOrders = [];
      snapshot.forEach(docSnap => {
        allOrders.push({ id: docSnap.id, ...docSnap.data() });
      });

      processAndRenderQueue(allOrders);
    }, (error) => {
      console.warn('Live Queue Firestore error, falling back to all orders listener:', error.message);
      // Fallback: query without where clause in case of index requirements
      const fallbackQuery = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
      onSnapshot(fallbackQuery, (snapshot) => {
        const allOrders = [];
        snapshot.forEach(docSnap => {
          allOrders.push({ id: docSnap.id, ...docSnap.data() });
        });
        processAndRenderQueue(allOrders);
      });
    });
  } catch (err) {
    console.error('Error in subscribeToLiveQueue:', err);
  }
}

function processAndRenderQueue(orders) {
  // Only display orders in Preparing if they have been paid and marked 'Preparing' by staff
  const preparingOrders = orders.filter(o => o.status === 'Preparing');
  const readyOrders = orders.filter(o => o.status === 'Ready' || o.status === 'Serving');

  // Detect newly ready orders to trigger chime sound!
  const currentReadyIds = new Set(readyOrders.map(o => o.id));
  if (!isFirstLoad) {
    let hasNewReadyOrder = false;
    currentReadyIds.forEach(id => {
      if (!previousReadyOrderIds.has(id)) {
        hasNewReadyOrder = true;
      }
    });

    if (hasNewReadyOrder) {
      playCafeChime();
    }
  } else {
    isFirstLoad = false;
  }
  previousReadyOrderIds = currentReadyIds;

  // Render Preparing column
  renderPreparingColumn(preparingOrders);

  // Render Ready column
  renderReadyColumn(readyOrders);
}

function renderPreparingColumn(orders) {
  if (!preparingGrid) return;
  prepCountBadge.textContent = `${orders.length} Order${orders.length === 1 ? '' : 's'}`;

  if (orders.length === 0) {
    preparingGrid.innerHTML = `
      <div class="board-empty-state">
        <i class="fas fa-mug-hot"></i>
        <p>No orders currently preparing</p>
      </div>
    `;
    return;
  }

  preparingGrid.innerHTML = orders.map(order => {
    const rawNumber = order.orderNumber || '0000';
    const shortNumber = extractShortOrderNumber(rawNumber);
    const customerName = order.customer?.name || 'Customer';
    const diningType = order.orderType || 'Dine-in';
    const tableStr = order.tableNumber ? `Table ${order.tableNumber}` : diningType;
    const itemCount = order.items ? order.items.reduce((sum, i) => sum + (i.qty || 1), 0) : 1;

    return `
      <div class="queue-card-prep" data-id="${order.id}">
        <div class="card-num">${shortNumber}</div>
        <div class="card-cust">${customerName}</div>
        <div class="card-meta">
          <span><i class="fas fa-utensils"></i> ${tableStr}</span>
          <span>${itemCount} item${itemCount === 1 ? '' : 's'}</span>
        </div>
      </div>
    `;
  }).join('');
}

function renderReadyColumn(orders) {
  if (!readyGrid) return;
  readyCountBadge.textContent = `${orders.length} Ready`;

  if (orders.length === 0) {
    readyGrid.innerHTML = `
      <div class="board-empty-state">
        <i class="fas fa-check-circle"></i>
        <p>No orders waiting for pickup</p>
      </div>
    `;
    return;
  }

  readyGrid.innerHTML = orders.map(order => {
    const rawNumber = order.orderNumber || '0000';
    const shortNumber = extractShortOrderNumber(rawNumber);
    const customerName = order.customer?.name || 'Customer';
    const diningType = order.orderType || 'Dine-in';
    const tableStr = order.tableNumber ? `Table #${order.tableNumber}` : diningType;

    return `
      <div class="queue-card-ready" data-id="${order.id}">
        <div class="card-num">${shortNumber}</div>
        <div class="card-cust">${customerName}</div>
        <div class="card-tag">
          <i class="fas fa-bell"></i> ${tableStr} • Claim Now
        </div>
      </div>
    `;
  }).join('');
}

// Format: LIKHA-20260904-0012 -> #0012 or LIKHA-0012
function extractShortOrderNumber(fullNumber) {
  if (!fullNumber) return '#0000';
  const parts = fullNumber.split('-');
  if (parts.length >= 3) {
    return `#${parts[parts.length - 1]}`;
  }
  return fullNumber;
}

// ---------- Controls & Event Listeners ----------
function setupControls() {
  // Enable audio context on any first click anywhere on screen
  document.addEventListener('click', () => {
    initAudio();
  }, { once: true });

  // Sound Toggle
  toggleSoundBtn?.addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    initAudio();
    if (soundEnabled) {
      toggleSoundBtn.classList.add('sound-active');
      soundIcon.className = 'fas fa-volume-up';
      soundLabel.textContent = 'Sound ON';
      playCafeChime();
    } else {
      toggleSoundBtn.classList.remove('sound-active');
      soundIcon.className = 'fas fa-volume-mute';
      soundLabel.textContent = 'Sound OFF';
    }
  });

  // Fullscreen Toggle
  toggleFullscreenBtn?.addEventListener('click', () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.warn('Error attempting to enable full-screen mode:', err.message);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  });
}
