// ==========================================================================
// LIKHĀ CAFÉ - CUSTOMER SELF-ORDERING & LIVE TRACKER APPLICATION
// ==========================================================================

import { db, doc, onSnapshot } from './firebase-config.js';
import MenuService from './services/menuService.js';
import OrderService from './services/orderService.js';
import storeData from './data/storeData.js';

const menuService = new MenuService();
const orderService = new OrderService();

// App State
let allMenuItems = [];
let displayedItems = [];
let activeCategory = 'all';
let searchQuery = '';
let cart = [];
let activeOrder = null;
let orderUnsubscribe = null;
let previousCustomerStatus = null;
let custSoundEnabled = true;
let custAudioCtx = null;

// Customization State
let customizingItem = null;
let selectedSize = null;
let selectedSugar = null;
let selectedFlavor = null;
let selectedEgg = null;
let customQty = 1;

// DOM Elements
const kioskMenuView = document.getElementById('kioskMenuView');
const kioskTrackerView = document.getElementById('kioskTrackerView');
const kioskMenuGrid = document.getElementById('kioskMenuGrid');
const kioskCategoryScroll = document.getElementById('kioskCategoryScroll');
const kioskSearchInput = document.getElementById('kioskSearchInput');
const kioskFloatingCart = document.getElementById('kioskFloatingCart');
const floatingCartCount = document.getElementById('floatingCartCount');
const floatingCartTotal = document.getElementById('floatingCartTotal');
const headerCartCount = document.getElementById('headerCartCount');
const headerTrackerBtn = document.getElementById('headerTrackerBtn');

// Modals
const kioskCustomizeModal = document.getElementById('kioskCustomizeModal');
const kioskCartModal = document.getElementById('kioskCartModal');

// Init App
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  const hasActiveOrder = checkExistingActiveOrder();
  if (!hasActiveOrder) {
    initCategories();
    loadMenu();
    showMenuView();
  }
});

// Audio initialization
function initCustAudio() {
  if (!custAudioCtx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) {
      custAudioCtx = new AudioContext();
    }
  }
  if (custAudioCtx && custAudioCtx.state === 'suspended') {
    custAudioCtx.resume();
  }
}

// Play pleasant customer Ready Alarm chime
function playCustomerReadyAlarm() {
  if (!custSoundEnabled) return;
  try {
    initCustAudio();
    if (!custAudioCtx) return;

    const now = custAudioCtx.currentTime;
    // Harmonious 3-tone Arpeggio + Bell: C5 (523.25Hz) -> E5 (659.25Hz) -> G5 (783.99Hz) -> C6 (1046.5Hz)
    const notes = [
      { freq: 523.25, start: now, duration: 0.3 },
      { freq: 659.25, start: now + 0.15, duration: 0.35 },
      { freq: 783.99, start: now + 0.30, duration: 0.4 },
      { freq: 1046.50, start: now + 0.45, duration: 0.9 }
    ];

    notes.forEach(note => {
      const osc = custAudioCtx.createOscillator();
      const gain = custAudioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(note.freq, note.start);

      gain.gain.setValueAtTime(0, note.start);
      gain.gain.linearRampToValueAtTime(0.35, note.start + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, note.start + note.duration);

      osc.connect(gain);
      gain.connect(custAudioCtx.destination);

      osc.start(note.start);
      osc.stop(note.start + note.duration);
    });

    // Mobile device vibration alert if supported
    if (navigator.vibrate) {
      navigator.vibrate([300, 150, 300, 150, 500]);
    }
    console.log('🔔 Customer order Ready Alarm chime triggered!');
  } catch (err) {
    console.warn('Audio alarm playback error:', err);
  }
}

// Check if customer already has an active order in LocalStorage or URL query
function checkExistingActiveOrder() {
  const urlParams = new URLSearchParams(window.location.search);
  const orderIdFromUrl = urlParams.get('orderId');

  let savedOrder = null;
  try {
    savedOrder = JSON.parse(localStorage.getItem('likha_active_customer_order'));
  } catch (e) {
    savedOrder = null;
  }

  const targetOrderId = orderIdFromUrl || (savedOrder ? savedOrder.id : null);

  if (targetOrderId) {
    if (savedOrder && savedOrder.id === targetOrderId) {
      activeOrder = savedOrder;
    } else {
      activeOrder = { id: targetOrderId, orderNumber: targetOrderId, status: 'Pending' };
    }
    showTrackerView();
    subscribeToActiveOrder(targetOrderId);
    return true;
  } else {
    document.documentElement.classList.remove('has-active-order');
    return false;
  }
}

// ---------- Categories Navigation ----------
const categories = [
  { id: 'all', name: 'All Items', icon: 'fa-border-all' },
  { id: 'Coffee', name: 'Coffee', icon: 'fa-mug-hot' },
  { id: 'Non-Coffee', name: 'Non-Coffee', icon: 'fa-glass-whiskey' },
  { id: 'Matcha', name: 'Matcha', icon: 'fa-leaf' },
  { id: 'Frappe', name: 'Frappe', icon: 'fa-ice-cream' },
  { id: 'Shareables', name: 'Shareables', icon: 'fa-cookie-bite' },
  { id: 'Pasta', name: 'Pasta', icon: 'fa-utensils' },
  { id: 'Sandwiches', name: 'Sandwiches', icon: 'fa-bread-slice' },
  { id: 'Wings', name: 'Wings', icon: 'fa-drumstick-bite' },
  { id: 'Silogs', name: 'Silogs', icon: 'fa-egg' },
  { id: 'Rice Meals', name: 'Rice Meals', icon: 'fa-bowl-rice' }
];

function initCategories() {
  if (!kioskCategoryScroll) return;
  kioskCategoryScroll.innerHTML = categories.map(cat => `
    <button type="button" class="cat-pill ${cat.id === 'all' ? 'active' : ''}" data-category="${cat.id}">
      <i class="fas ${cat.icon}"></i> ${cat.name}
    </button>
  `).join('');

  kioskCategoryScroll.querySelectorAll('.cat-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      kioskCategoryScroll.querySelectorAll('.cat-pill').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeCategory = btn.dataset.category;
      filterAndRenderMenu();
    });
  });
}

// ---------- Menu Loading & Realtime Subscription ----------
function loadMenu() {
  menuService.subscribeToMenu((items) => {
    allMenuItems = items;
    filterAndRenderMenu();
  });
}

function filterAndRenderMenu() {
  displayedItems = allMenuItems.filter(item => {
    const matchesCat = activeCategory === 'all' || item.category === activeCategory;
    const matchesSearch = !searchQuery || 
      item.name.toLowerCase().includes(searchQuery) ||
      (item.description && item.description.toLowerCase().includes(searchQuery)) ||
      (item.tags && item.tags.some(t => t.toLowerCase().includes(searchQuery)));
    return matchesCat && matchesSearch;
  });

  renderMenuGrid(displayedItems);
}

function renderMenuGrid(items) {
  if (!kioskMenuGrid) return;

  if (items.length === 0) {
    kioskMenuGrid.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 4rem 1rem; color: var(--brown-500);">
        <i class="fas fa-search" style="font-size: 2.5rem; color: var(--brown-300); margin-bottom: 0.75rem;"></i>
        <h3 style="color: var(--brown-800); margin-bottom: 0.25rem;">No items found</h3>
        <p style="font-size: 0.9rem;">Try searching for another favorite or pick a category above.</p>
      </div>
    `;
    return;
  }

  kioskMenuGrid.innerHTML = items.map(item => {
    const isOut = item.available === false;
    let iconClass = 'fa-mug-hot';
    if (item.category === 'Non-Coffee' || item.category === 'Matcha' || item.category === 'Frappe') iconClass = 'fa-glass-whiskey';
    if (item.category === 'Shareables' || item.category === 'Pasta' || item.category === 'Sandwiches') iconClass = 'fa-utensils';
    if (item.category === 'Wings') iconClass = 'fa-drumstick-bite';
    if (item.category === 'Silogs' || item.category === 'Rice Meals') iconClass = 'fa-bowl-rice';

    const tagBadge = item.tags && item.tags.length > 0 
      ? `<span class="kiosk-list-tag">${item.tags[0]}</span>` 
      : '';

    return `
      <div class="kiosk-list-item ${isOut ? 'out-of-stock' : ''}" data-id="${item.id}">
        <div class="kiosk-list-left">
          <div class="kiosk-list-title-row">
            <h3 class="kiosk-list-name">${item.name}</h3>
            ${tagBadge}
          </div>
          <p class="kiosk-list-desc">${item.description || (item.sizes && item.sizes.length ? item.sizes.join(' · ') : item.category)}</p>
          <div class="kiosk-list-bottom-row">
            <span class="kiosk-list-price">₱${Number(item.price).toFixed(2)}</span>
            ${isOut ? '<span class="kiosk-list-out-badge">Out of Stock</span>' : ''}
          </div>
        </div>
        <div class="kiosk-list-right">
          <div class="kiosk-list-thumb">
            ${item.imageUrl ? `<img src="${item.imageUrl}" alt="${item.name}" loading="lazy">` : `<i class="fas ${iconClass}"></i>`}
            ${!isOut ? `<button type="button" class="kiosk-add-bubble" data-id="${item.id}" title="Add to Order"><i class="fas fa-plus"></i></button>` : ''}
          </div>
        </div>
      </div>
    `;
  }).join('');

  kioskMenuGrid.querySelectorAll('.kiosk-list-item').forEach(card => {
    card.addEventListener('click', () => {
      const id = card.dataset.id;
      const item = allMenuItems.find(i => i.id === id);
      if (item && item.available !== false) {
        openItemCustomization(item);
      }
    });
  });
}

// ---------- Item Customization Modal ----------
function openItemCustomization(item) {
  customizingItem = item;
  customQty = 1;
  selectedSize = item.sizes && item.sizes.length > 0 ? item.sizes[0] : null;
  selectedSugar = item.customization?.sugar ? item.customization.sugar[0] : null;
  selectedFlavor = item.flavors && item.flavors.length > 0 ? item.flavors[0] : null;
  selectedEgg = item.eggOptions && item.eggOptions.length > 0 ? item.eggOptions[0] : null;

  document.getElementById('custModalItemName').innerHTML = `<i class="fas fa-utensils"></i> ${item.name}`;
  document.getElementById('custQtyVal').textContent = '1';
  updateCustPriceDisplay();

  const body = document.getElementById('custModalBody');
  let html = '';

  // Item banner
  html += `
    <div style="display:flex; gap:1rem; align-items:center; background:var(--brown-50); padding:0.85rem; border-radius:var(--radius); border:1px solid var(--brown-200);">
      <div style="width:64px; height:64px; border-radius:var(--radius-sm); overflow:hidden; background:var(--white); flex-shrink:0; display:flex; align-items:center; justify-content:center;">
        ${item.imageUrl ? `<img src="${item.imageUrl}" style="width:100%;height:100%;object-fit:cover;">` : `<i class="fas fa-mug-hot" style="font-size:1.5rem; color:var(--brown-400);"></i>`}
      </div>
      <div>
        <h4 style="font-size:1rem; color:var(--brown-900); font-weight:700;">${item.name}</h4>
        <p style="font-size:0.82rem; color:var(--brown-600);">${item.description || item.category}</p>
        <span style="font-weight:800; font-family:var(--font-mono); color:var(--brown-900);">₱${Number(item.price).toFixed(2)}</span>
      </div>
    </div>
  `;

  // Sizes
  if (item.sizes && item.sizes.length > 1) {
    html += `
      <div class="form-group">
        <div class="opt-group-label"><i class="fas fa-expand-alt"></i> Choice of Size</div>
        <div class="pill-options-row" id="custSizesRow">
          ${item.sizes.map((s, idx) => `
            <div class="opt-pill ${idx === 0 ? 'active' : ''}" data-size="${s}">${s}</div>
          `).join('')}
        </div>
      </div>
    `;
  }

  // Sugar Level
  if (item.customization && item.customization.sugar && item.customization.sugar.length > 0) {
    html += `
      <div class="form-group">
        <div class="opt-group-label"><i class="fas fa-cubes"></i> Sugar Level</div>
        <div class="pill-options-row" id="custSugarRow">
          ${item.customization.sugar.map((s, idx) => `
            <div class="opt-pill ${idx === 0 ? 'active' : ''}" data-sugar="${s}">${s}</div>
          `).join('')}
        </div>
      </div>
    `;
  }

  // Wings Flavors
  if (item.flavors && item.flavors.length > 0) {
    html += `
      <div class="form-group">
        <div class="opt-group-label"><i class="fas fa-drumstick-bite"></i> Wing Flavor</div>
        <div class="pill-options-row" id="custFlavorRow">
          ${item.flavors.map((f, idx) => `
            <div class="opt-pill ${idx === 0 ? 'active' : ''}" data-flavor="${f}">${f}</div>
          `).join('')}
        </div>
      </div>
    `;
  }

  // Egg Style
  if (item.eggOptions && item.eggOptions.length > 0) {
    html += `
      <div class="form-group">
        <div class="opt-group-label"><i class="fas fa-egg"></i> Egg Preparation</div>
        <div class="pill-options-row" id="custEggRow">
          ${item.eggOptions.map((e, idx) => `
            <div class="opt-pill ${idx === 0 ? 'active' : ''}" data-egg="${e}">${e}</div>
          `).join('')}
        </div>
      </div>
    `;
  }

  // Special Notes
  html += `
    <div class="form-group">
      <div class="opt-group-label"><i class="fas fa-sticky-note"></i> Item Request (Optional)</div>
      <input type="text" id="custItemNotes" placeholder="e.g. Extra hot, separate sauce..." class="form-input" style="width:100%; padding:0.65rem 0.85rem; border-radius:var(--radius); border:1.5px solid var(--brown-200); font-size:0.88rem;">
    </div>
  `;

  body.innerHTML = html;

  // Add event listeners on pill rows
  setupCustPills('#custSizesRow .opt-pill', (val) => selectedSize = val);
  setupCustPills('#custSugarRow .opt-pill', (val) => selectedSugar = val);
  setupCustPills('#custFlavorRow .opt-pill', (val) => selectedFlavor = val);
  setupCustPills('#custEggRow .opt-pill', (val) => selectedEgg = val);

  kioskCustomizeModal.classList.add('open');
}

function setupCustPills(selector, callback) {
  document.querySelectorAll(selector).forEach(pill => {
    pill.addEventListener('click', () => {
      pill.parentElement.querySelectorAll('.opt-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      callback(pill.dataset.size || pill.dataset.sugar || pill.dataset.flavor || pill.dataset.egg);
      updateCustPriceDisplay();
    });
  });
}

function updateCustPriceDisplay() {
  if (!customizingItem) return;
  const unitPrice = customizingItem.price || 0;
  const total = unitPrice * customQty;
  document.getElementById('custModalPrice').textContent = `₱${total.toFixed(2)}`;
}

// Add customized item to Cart
function addCustomizedItemToCart() {
  if (!customizingItem) return;

  const notes = document.getElementById('custItemNotes')?.value?.trim() || '';

  const cartItem = {
    cartId: `kiosk-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    id: customizingItem.id,
    name: customizingItem.name,
    category: customizingItem.category,
    price: customizingItem.price,
    qty: customQty,
    size: selectedSize,
    sugar: selectedSugar,
    flavor: selectedFlavor,
    eggOption: selectedEgg,
    notes,
    imageUrl: customizingItem.imageUrl || null
  };

  cart.push(cartItem);
  kioskCustomizeModal.classList.remove('open');
  showKioskToast(`Added ${customQty}x ${customizingItem.name} to order!`);
  updateCartUI();
}

// ---------- Cart Management ----------
function updateCartUI() {
  const totalQty = cart.reduce((sum, item) => sum + item.qty, 0);
  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
  // Declared prices are VAT-inclusive: total equals subtotal
  const grandTotal = subtotal;

  if (headerCartCount) headerCartCount.textContent = totalQty;
  if (floatingCartCount) floatingCartCount.textContent = totalQty;
  if (floatingCartTotal) floatingCartTotal.textContent = `₱${grandTotal.toFixed(2)}`;

  if (totalQty > 0) {
    kioskFloatingCart.classList.add('visible');
  } else {
    kioskFloatingCart.classList.remove('visible');
    kioskCartModal.classList.remove('open');
  }
}

function openCartModal() {
  if (cart.length === 0) {
    showKioskToast('Your cart is currently empty.');
    return;
  }
  renderCartModalItems();
  kioskCartModal.classList.add('open');
}

function renderCartModalItems() {
  const container = document.getElementById('cartItemsListContainer');
  if (!container) return;

  let subtotal = 0;

  container.innerHTML = cart.map((item, index) => {
    const itemTotal = item.price * item.qty;
    subtotal += itemTotal;

    const details = [];
    if (item.size) details.push(item.size);
    if (item.sugar) details.push(`Sugar: ${item.sugar}`);
    if (item.flavor) details.push(`Flavor: ${item.flavor}`);
    if (item.eggOption) details.push(`Egg: ${item.eggOption}`);
    if (item.notes) details.push(`"${item.notes}"`);

    return `
      <div class="cart-item-row">
        <div class="cart-item-details">
          <h4>${item.qty}x ${item.name}</h4>
          ${details.length > 0 ? `<p>${details.join(' • ')}</p>` : ''}
        </div>
        <div class="cart-item-right">
          <span class="cart-item-price">₱${itemTotal.toFixed(2)}</span>
          <button type="button" class="btn-cart-remove" data-index="${index}" title="Remove">
            <i class="fas fa-trash-alt"></i>
          </button>
        </div>
      </div>
    `;
  }).join('');

  // Declared prices are VAT-inclusive: calculate included VAT without adding on top
  const taxRate = storeData.taxRate || 0.12;
  const tax = subtotal > 0 ? (subtotal - (subtotal / (1 + taxRate))) : 0;
  const total = subtotal;

  document.getElementById('cartModalSubtotal').textContent = `₱${subtotal.toFixed(2)}`;
  document.getElementById('cartModalTax').textContent = `₱${tax.toFixed(2)}`;
  document.getElementById('cartModalTotal').textContent = `₱${total.toFixed(2)}`;

  container.querySelectorAll('.btn-cart-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.index);
      cart.splice(idx, 1);
      updateCartUI();
      renderCartModalItems();
    });
  });
}

// ---------- Submit Self Order ----------
async function submitSelfOrder() {
  if (cart.length === 0) {
    showKioskToast('Your cart is empty.');
    return;
  }

  const customerName = document.getElementById('custCustomerName').value.trim();
  if (!customerName) {
    showKioskToast('Please enter your name to proceed.');
    document.getElementById('custCustomerName').focus();
    return;
  }

  const submitBtn = document.getElementById('submitSelfOrderBtn');
  const originalHtml = submitBtn.innerHTML;

  try {
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Submitting Order...`;

    // Dine-in vs Takeout
    const isDineIn = document.getElementById('dineInPill').classList.contains('active');
    const orderType = isDineIn ? 'Dine-in' : 'Takeout';
    
    // Table number: check typed input first, then selected pill
    let tableNumber = null;
    if (isDineIn) {
      const typedTable = document.getElementById('custTableInput')?.value.trim();
      if (typedTable) {
        tableNumber = typedTable;
      } else {
        const activeTablePill = document.querySelector('#tableSelectorPills .opt-pill.active');
        tableNumber = activeTablePill && activeTablePill.dataset.table ? activeTablePill.dataset.table : null;
      }
    }

    const orderNotes = document.getElementById('custOrderNotes')?.value.trim() || '';

    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
    // Declared prices are VAT-inclusive: VAT is not added to total
    const taxRate = storeData.taxRate || 0.12;
    const tax = subtotal > 0 ? Math.round((subtotal - (subtotal / (1 + taxRate))) * 100) / 100 : 0;
    const total = subtotal;

    const orderPayload = {
      items: cart.map(item => ({
        id: item.id,
        name: item.name,
        qty: item.qty,
        price: item.price,
        size: item.size || null,
        flavor: item.flavor || null,
        eggOption: item.eggOption || null,
        customization: item.sugar ? { sugar: item.sugar } : {},
        notes: item.notes || ''
      })),
      subtotal,
      tax,
      total,
      orderType,
      tableNumber,
      customer: {
        name: customerName
      },
      payment: {
        type: 'Unpaid (To Pay at Counter)',
        amount: total,
        change: 0,
        status: 'Unpaid'
      },
      status: 'Pending', // Pending = To Pay
      source: 'kiosk',
      staff: {
        id: 'kiosk_self_service',
        name: 'Customer Kiosk'
      },
      notes: orderNotes
    };

    const createdOrder = await orderService.createOrder(orderPayload);
    activeOrder = createdOrder;

    // Persist in localStorage
    localStorage.setItem('likha_active_customer_order', JSON.stringify({
      id: createdOrder.id,
      orderNumber: createdOrder.orderNumber,
      customerName: customerName,
      orderType,
      tableNumber,
      total,
      items: createdOrder.items,
      createdAt: new Date().toISOString()
    }));

    // Clear cart & close modal
    cart = [];
    updateCartUI();
    kioskCartModal.classList.remove('open');

    showKioskToast('Order placed successfully! Please proceed to the cashier to pay.');
    showTrackerView();
    subscribeToActiveOrder(createdOrder.id);

  } catch (error) {
    console.error('Error submitting self order:', error);
    showKioskToast('Failed to place order: ' + error.message);
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = originalHtml;
  }
}

// ---------- Live Order Status Tracker (Real-time Firestore) ----------
function subscribeToActiveOrder(orderId) {
  if (orderUnsubscribe) {
    orderUnsubscribe();
  }

  try {
    const docRef = doc(db, 'orders', orderId);
    orderUnsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const orderData = { id: docSnap.id, ...docSnap.data() };
        activeOrder = orderData;
        renderTrackerDetails(orderData);
      } else {
        console.warn('Order document not found in Firestore');
        renderTrackerDetails(activeOrder || { orderNumber: orderId, status: 'Pending' });
      }
    }, (error) => {
      console.warn('Tracker Firestore listener error:', error);
      renderTrackerDetails(activeOrder || { orderNumber: orderId, status: 'Pending' });
    });
  } catch (err) {
    console.warn('Tracker setup error:', err);
    renderTrackerDetails(activeOrder || { orderNumber: orderId, status: 'Pending' });
  }
}

function renderTrackerDetails(order) {
  if (!order) return;

  const orderNum = order.orderNumber || 'LIKHA-0000';
  document.getElementById('trackerOrderNumber').textContent = orderNum;
  document.getElementById('trackerCustomerName').textContent = order.customer?.name || 'Customer';
  document.getElementById('trackerOrderType').textContent = order.orderType || 'Dine-in';
  
  const tableInfo = order.tableNumber ? ` • Table #${order.tableNumber}` : '';
  document.getElementById('trackerTableInfo').textContent = tableInfo;

  const total = order.total || (order.items ? order.items.reduce((s, i) => s + (i.price * i.qty), 0) : 0);
  document.getElementById('trackerTotalAmount').textContent = `₱${Number(total).toFixed(2)}`;

  // Render items list
  const itemsContainer = document.getElementById('trackerItemsContainer');
  if (itemsContainer && order.items) {
    itemsContainer.innerHTML = order.items.map(item => `
      <div class="tracker-item-entry">
        <span>${item.qty}x ${item.name} ${item.size ? `(${item.size})` : ''}</span>
        <strong>₱${Number(item.price * item.qty).toFixed(2)}</strong>
      </div>
    `).join('');
  }

  // Check if status newly changed to Ready to trigger chime/alarm!
  const status = order.status || 'Pending';
  if (previousCustomerStatus && previousCustomerStatus !== status) {
    if (status === 'Ready' || status === 'Serving') {
      playCustomerReadyAlarm();
    }
  }
  previousCustomerStatus = status;

  // Update Status Stepper & Callout
  updateTrackerStatusUI(status, orderNum);
}

function updateTrackerStatusUI(status, orderNum) {
  const step1 = document.getElementById('step1Node');
  const step2 = document.getElementById('step2Node');
  const step3 = document.getElementById('step3Node');
  const step4 = document.getElementById('step4Node');
  const progressBar = document.getElementById('stepperProgressBar');

  const calloutBox = document.getElementById('statusCalloutBox');
  const calloutIcon = document.getElementById('statusCalloutIcon');
  const calloutTitle = document.getElementById('statusCalloutTitle');
  const calloutDesc = document.getElementById('statusCalloutDesc');

  // Reset classes
  [step1, step2, step3, step4].forEach(s => {
    s.classList.remove('active', 'completed');
  });
  calloutBox.className = 'status-callout-box';

  if (status === 'Pending') {
    step1.classList.add('active');
    progressBar.style.width = '15%';
    calloutBox.classList.add('status-pending');
    calloutIcon.innerHTML = `<i class="fas fa-wallet" style="color:var(--warning);"></i>`;
    calloutTitle.textContent = '1. To Pay — Proceed to Cashier';
    calloutDesc.textContent = `Please proceed to the cashier counter and present your Order Number (${orderNum}) to pay via Cash, Card, or GCash.`;
  } 
  else if (status === 'Preparing') {
    step1.classList.add('completed');
    step2.classList.add('active');
    progressBar.style.width = '48%';
    calloutBox.classList.add('status-preparing');
    calloutIcon.innerHTML = `<i class="fas fa-blender fa-spin" style="color:var(--info);"></i>`;
    calloutTitle.textContent = '2. Preparing Your Order';
    calloutDesc.textContent = `Payment confirmed! Our Baristas and Kitchen Staff are currently crafting your items fresh and delicious.`;
  }
  else if (status === 'Ready' || status === 'Serving') {
    step1.classList.add('completed');
    step2.classList.add('completed');
    step3.classList.add('active');
    progressBar.style.width = '80%';
    calloutBox.classList.add('status-ready');
    calloutIcon.innerHTML = `<i class="fas fa-bell" style="color:var(--success); animation: ring 1s infinite;"></i>`;
    calloutTitle.textContent = '3. Order Ready for Pickup! 🔔';
    calloutDesc.textContent = `Your order is ready! Please claim it at the Pickup Counter. Enjoy your Likhā Café favorites! ✨`;
  }
  else if (status === 'Completed') {
    step1.classList.add('completed');
    step2.classList.add('completed');
    step3.classList.add('completed');
    step4.classList.add('active');
    progressBar.style.width = '100%';
    calloutBox.classList.add('status-completed');
    calloutIcon.innerHTML = `<i class="fas fa-heart" style="color:var(--danger);"></i>`;
    calloutTitle.textContent = '4. Enjoy your Coffee & Food!';
    calloutDesc.textContent = `Thank you for dining at Likhā Café. Coffee · Comfort · Connection. Have a wonderful day!`;
  }
  else if (status === 'Cancelled') {
    progressBar.style.width = '0%';
    calloutBox.classList.add('status-pending');
    calloutIcon.innerHTML = `<i class="fas fa-times-circle" style="color:var(--danger);"></i>`;
    calloutTitle.textContent = 'Order Cancelled';
    calloutDesc.textContent = `This order has been cancelled. Please start a new order if needed.`;
  }
}

// View Switches
function showMenuView() {
  document.documentElement.classList.remove('has-active-order');
  if (activeOrder) {
    showTrackerView();
    return;
  }

  if (kioskTrackerView) {
    kioskTrackerView.classList.add('hidden');
    kioskTrackerView.style.display = 'none';
  }
  if (kioskMenuView) {
    kioskMenuView.classList.remove('hidden');
    kioskMenuView.style.display = 'block';
  }
  if (headerCartBtn) {
    headerCartBtn.classList.remove('hidden');
    headerCartBtn.style.display = 'flex';
  }
  if (headerTrackerBtn) {
    headerTrackerBtn.classList.add('hidden');
    headerTrackerBtn.style.display = 'none';
  }
  if (kioskFloatingCart) {
    kioskFloatingCart.style.display = '';
  }

  if (allMenuItems.length === 0) {
    initCategories();
    loadMenu();
  }

  updateCartUI();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showTrackerView() {
  document.documentElement.classList.add('has-active-order');

  if (kioskMenuView) {
    kioskMenuView.classList.add('hidden');
    kioskMenuView.style.display = 'none';
  }
  if (kioskTrackerView) {
    kioskTrackerView.classList.remove('hidden');
    kioskTrackerView.style.display = 'block';
  }
  if (headerCartBtn) {
    headerCartBtn.classList.add('hidden');
    headerCartBtn.style.display = 'none';
  }
  if (headerTrackerBtn) {
    headerTrackerBtn.classList.add('hidden');
    headerTrackerBtn.style.display = 'none';
  }
  if (kioskFloatingCart) {
    kioskFloatingCart.classList.remove('visible');
    kioskFloatingCart.style.display = 'none';
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Toast
function showKioskToast(msg) {
  const toast = document.getElementById('kioskToast');
  const msgElem = document.getElementById('kioskToastMsg');
  if (toast && msgElem) {
    msgElem.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3500);
  }
}

// ---------- Event Listeners Setup ----------
function setupEventListeners() {
  // Global audio context initialization on first interaction
  document.addEventListener('click', () => {
    initCustAudio();
  }, { once: true });

  // Sound toggle button in tracker view
  const custSoundToggleBtn = document.getElementById('custSoundToggleBtn');
  const custSoundIcon = document.getElementById('custSoundIcon');
  const custSoundLabel = document.getElementById('custSoundLabel');

  custSoundToggleBtn?.addEventListener('click', () => {
    custSoundEnabled = !custSoundEnabled;
    initCustAudio();
    if (custSoundEnabled) {
      custSoundToggleBtn.classList.add('sound-active');
      if (custSoundIcon) custSoundIcon.className = 'fas fa-bell';
      if (custSoundLabel) custSoundLabel.textContent = 'Ready Alarm ON';
      playCustomerReadyAlarm();
    } else {
      custSoundToggleBtn.classList.remove('sound-active');
      if (custSoundIcon) custSoundIcon.className = 'fas fa-bell-slash';
      if (custSoundLabel) custSoundLabel.textContent = 'Ready Alarm OFF';
    }
  });

  // Brand Header Click
  document.getElementById('brandHomeBtn')?.addEventListener('click', () => {
    if (activeOrder) {
      showKioskToast('You have an ongoing order. Click "Place New Order" below if you want to order again.');
    } else {
      showMenuView();
    }
  });

  // Header Tracker Button
  headerTrackerBtn?.addEventListener('click', showTrackerView);

  // Header & Floating Cart Open
  document.getElementById('headerCartBtn')?.addEventListener('click', openCartModal);
  document.getElementById('openCartBtn')?.addEventListener('click', openCartModal);

  // Search Input
  kioskSearchInput?.addEventListener('input', (e) => {
    searchQuery = e.target.value.toLowerCase().trim();
    filterAndRenderMenu();
  });

  // Modal Closers
  document.getElementById('closeCustModal')?.addEventListener('click', () => kioskCustomizeModal.classList.remove('open'));
  document.getElementById('closeCartModal')?.addEventListener('click', () => kioskCartModal.classList.remove('open'));
  document.getElementById('cancelCartBtn')?.addEventListener('click', () => kioskCartModal.classList.remove('open'));

  // Customization Stepper
  document.getElementById('custQtyMinus')?.addEventListener('click', () => {
    if (customQty > 1) {
      customQty--;
      document.getElementById('custQtyVal').textContent = customQty;
      updateCustPriceDisplay();
    }
  });

  document.getElementById('custQtyPlus')?.addEventListener('click', () => {
    customQty++;
    document.getElementById('custQtyVal').textContent = customQty;
    updateCustPriceDisplay();
  });

  // Add customized item confirm
  document.getElementById('confirmAddCartBtn')?.addEventListener('click', addCustomizedItemToCart);

  // Dine-in vs Takeout Pills in Cart Modal
  const dineInPill = document.getElementById('dineInPill');
  const takeoutPill = document.getElementById('takeoutPill');
  const tableGroup = document.getElementById('tableGroup');
  const custTableInput = document.getElementById('custTableInput');

  dineInPill?.addEventListener('click', () => {
    dineInPill.classList.add('active');
    takeoutPill.classList.remove('active');
    if (tableGroup) tableGroup.style.display = 'block';
  });

  takeoutPill?.addEventListener('click', () => {
    takeoutPill.classList.add('active');
    dineInPill.classList.remove('active');
    if (tableGroup) tableGroup.style.display = 'none';
  });

  // Table selector pills & input sync
  document.querySelectorAll('#tableSelectorPills .opt-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('#tableSelectorPills .opt-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      const tableVal = pill.dataset.table;
      if (custTableInput) {
        custTableInput.value = tableVal ? `Table ${tableVal}` : '';
      }
    });
  });

  custTableInput?.addEventListener('input', (e) => {
    const val = e.target.value.trim().toLowerCase();
    document.querySelectorAll('#tableSelectorPills .opt-pill').forEach(pill => {
      const pVal = pill.dataset.table;
      if (pVal && (val === pVal || val === `table ${pVal}`)) {
        pill.classList.add('active');
      } else if (!pVal && (!val || val === 'no table')) {
        pill.classList.add('active');
      } else {
        pill.classList.remove('active');
      }
    });
  });

  // Submit Self-Order
  document.getElementById('submitSelfOrderBtn')?.addEventListener('click', submitSelfOrder);

  // Place New Order / Start Over Button
  document.getElementById('startNewOrderBtn')?.addEventListener('click', () => {
    const isOngoing = activeOrder && (activeOrder.status === 'Pending' || activeOrder.status === 'Preparing');
    const msg = isOngoing
      ? 'Your current order is still ongoing. Do you want to place a new order and return to the menu?'
      : 'Start a new order? This will return to the menu items.';

    if (!isOngoing || confirm(msg)) {
      localStorage.removeItem('likha_active_customer_order');
      if (orderUnsubscribe) {
        orderUnsubscribe();
        orderUnsubscribe = null;
      }
      activeOrder = null;
      previousCustomerStatus = null;
      cart = [];
      showMenuView();
      showKioskToast('Welcome! You can now browse and place a new order.');
    }
  });
}
