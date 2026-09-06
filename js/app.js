import AuthService from './services/authService.js';
import MenuService from './services/menuService.js';
import OrderService from './services/orderService.js';
import PrintService from './services/printService.js';
import StaffService from './services/staffService.js';
import SettingsService from './services/settingsService.js';
import storeData from './data/storeData.js';
import { menuCategories } from './data/menuData.js';

// Initialize services
const authService = new AuthService();
const menuService = new MenuService();
const orderService = new OrderService();
const printService = new PrintService();
const staffService = new StaffService();
const settingsService = new SettingsService();

// State
let currentUser = null;
let currentStoreSettings = { ...storeData };
let allMenuItems = [];
let displayedMenuItems = [];
let allStaff = [];
let currentCategory = 'all';
let searchQuery = '';
let cart = [];
let orderType = 'Dine-in';
let orders = [];
let customizingItem = null;
let customizationState = {};

// DOM Elements
const loadingScreen = document.getElementById('loadingScreen');
const loginScreen = document.getElementById('loginScreen');
const mainApp = document.getElementById('mainApp');
const menuGrid = document.getElementById('menuGrid');
const categoryFilter = document.getElementById('categoryFilter');
const cartPanel = document.getElementById('cartPanel');
const floatingCartBar = document.getElementById('floatingCartBar');

// ---------- App Initialization ----------
function initApp() {
  console.log('☕ Likhā Café POS Starting (Pure Firestore Mode)...');
  
  // Render category pills
  renderCategoryPills();
  
  // Setup all event listeners
  setupEventListeners();

  // Safety fallback: if Firebase connection takes time, don't keep user stuck on loading screen
  const loadingTimeout = setTimeout(() => {
    hideLoading();
    if (!currentUser) {
      // Check localStorage before showing login — there may be a persisted session
      try {
        const storedStaff = localStorage.getItem('likha_staffData');
        if (storedStaff) {
          currentUser = JSON.parse(storedStaff);
          showMainApp();
          loadMenu();
          initOrders();
          loadStaff();
          updateStaffInfo();
          return;
        }
      } catch (e) {
        console.warn('Loading timeout localStorage check notice:', e);
      }
      showLogin();
    }
  }, 1200);

  // Settings subscription
  try {
    settingsService.subscribeToSettings((settings) => {
      currentStoreSettings = settings;
      updateStoreSettingsUI();
    });
  } catch (e) {
    console.warn('Settings subscription notice:', e);
  }

  // Auth observer
  try {
    authService.onAuthStateChange((user) => {
      clearTimeout(loadingTimeout);
      if (user) {
        currentUser = user;
        showMainApp();
        loadMenu();
        initOrders();
        loadStaff();
        updateStaffInfo();
      } else {
        showLogin();
      }
      hideLoading();
    });
  } catch (err) {
    console.error('Auth observer error:', err);
    clearTimeout(loadingTimeout);
    showLogin();
    hideLoading();
  }

  // Start real-time clock
  updateClock();
  setInterval(updateClock, 1000);
}

// Immediate check for module script execution
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

// ---------- UI Screen Switching ----------
function hideLoading() {
  const el = document.getElementById('loadingScreen') || loadingScreen;
  if (el) {
    el.classList.add('hidden');
    el.style.display = 'none';
  }
}

function showLogin() {
  hideLoading();
  const lScreen = document.getElementById('loginScreen') || loginScreen;
  const mApp = document.getElementById('mainApp') || mainApp;
  if (lScreen) {
    lScreen.classList.remove('hidden');
    lScreen.style.display = 'flex';
  }
  if (mApp) {
    mApp.classList.add('hidden');
    mApp.style.display = 'none';
  }
}

function getInitialPageForUser(user) {
  const params = new URLSearchParams(window.location.search);
  const requestedView = params.get('view');
  const path = window.location.pathname.toLowerCase();
  const role = user?.role || 'cashier';

  // If user is kitchen role, go directly to live orders
  if (role === 'kitchen') {
    return 'orders';
  }

  // If admin/manager explicitly accessed admin view
  if ((role === 'admin' || role === 'manager') && (requestedView === 'admin' || path.includes('admin'))) {
    return 'admin';
  }

  return 'menu';
}

function switchPage(page) {
  const role = currentUser?.role || 'cashier';
  if ((role === 'cashier' || role === 'kitchen') && (page === 'admin' || page === 'analytics')) {
    showToast('Access restricted: Cashier role can only access Menu and Orders.', 'error');
    page = role === 'kitchen' ? 'orders' : 'menu';
  }

  document.querySelectorAll('.nav-item').forEach(n => {
    if (n.dataset.page === page) {
      n.classList.add('active');
    } else {
      n.classList.remove('active');
    }
  });

  document.querySelectorAll('.page').forEach(p => {
    p.classList.remove('active');
    p.style.display = 'none';
  });

  const targetPage = document.getElementById(`${page}Page`);
  if (targetPage) {
    targetPage.classList.add('active');
    targetPage.style.display = 'flex';
  }

  if (page === 'orders') renderOrdersList();
  if (page === 'admin') {
    renderAdminMenuList(allMenuItems);
    renderStaffList();
    updateStoreSettingsUI();
  }
  if (page === 'analytics') updateAnalytics();
}

function showMainApp(initialPage) {
  hideLoading();
  const lScreen = document.getElementById('loginScreen') || loginScreen;
  const mApp = document.getElementById('mainApp') || mainApp;
  if (lScreen) {
    lScreen.classList.add('hidden');
    lScreen.style.display = 'none';
  }
  if (mApp) {
    mApp.classList.remove('hidden');
    mApp.style.display = 'flex';
  }
  const targetPage = initialPage || getInitialPageForUser(currentUser);
  switchPage(targetPage);
}

function updateClock() {
  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-PH', { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: true 
  });
  const timeEl = document.getElementById('currentTime');
  if (timeEl) timeEl.textContent = timeStr;
}

function updateStaffInfo() {
  const nameEl = document.getElementById('staffName');
  const role = currentUser?.role || 'cashier';

  if (nameEl && currentUser) {
    nameEl.innerHTML = `
      <span>${currentUser.name || 'Staff'}</span>
      <span class="staff-role-badge ${role}" style="margin-left: 0.35rem; font-size: 0.68rem; padding: 2px 7px;">${role}</span>
    `;
  }

  // Role-Based Navigation Access Control
  const adminNav = document.querySelector('.nav-item[data-page="admin"]');
  const analyticsNav = document.querySelector('.nav-item[data-page="analytics"]');

  if (role === 'cashier' || role === 'kitchen') {
    if (adminNav) adminNav.style.display = 'none';
    if (analyticsNav) analyticsNav.style.display = 'none';
  } else {
    // Admin / Manager
    if (adminNav) adminNav.style.display = 'flex';
    if (analyticsNav) analyticsNav.style.display = 'flex';
  }
}

function updateStoreSettingsUI() {
  const s = currentStoreSettings;
  const setStoreName = document.getElementById('settingStoreName');
  const setTagline = document.getElementById('settingTagline');
  const setLocation = document.getElementById('settingLocation');
  const setContact = document.getElementById('settingContact');
  const setEmail = document.getElementById('settingEmail');
  const setSocial = document.getElementById('settingSocial');
  const setTax = document.getElementById('settingTaxRate');
  const setTakeoutTax = document.getElementById('settingTakeoutTaxRate');
  const setFooter = document.getElementById('settingReceiptFooter');
  const setHours = document.getElementById('settingHours');

  if (setStoreName) setStoreName.value = s.name || '';
  if (setTagline) setTagline.value = s.tagline || '';
  if (setLocation) setLocation.value = s.location || '';
  if (setContact) setContact.value = s.contact || '';
  if (setEmail) setEmail.value = s.email || '';
  if (setSocial) setSocial.value = s.social || '';
  if (setTax) setTax.value = s.taxRate !== undefined ? (s.taxRate * 100) : 12;
  if (setTakeoutTax) setTakeoutTax.value = s.takeoutTaxRate !== undefined ? (s.takeoutTaxRate * 100) : 5;
  if (setFooter) setFooter.value = s.receipt?.footer || s.receiptFooter || '';
  if (setHours) setHours.value = s.hoursDisplay || 'Tue-Sun, 10:00 AM - 2:00 AM';

  const vatP = document.getElementById('summaryVatPercent');
  const takeP = document.getElementById('summaryTakeoutTaxPercent');
  if (vatP) vatP.textContent = s.taxRate !== undefined ? (s.taxRate * 100).toFixed(0) : '12';
  if (takeP) takeP.textContent = s.takeoutTaxRate !== undefined ? (s.takeoutTaxRate * 100).toFixed(0) : '5';
}

// ---------- Toast Notification ----------
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  let icon = 'fa-info-circle';
  if (type === 'success') icon = 'fa-check-circle';
  if (type === 'error') icon = 'fa-exclamation-circle';

  toast.innerHTML = `
    <i class="fas ${icon}"></i>
    <span>${message}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 300);
  }, 2800);
}

// ---------- Category Filter Pills ----------
function renderCategoryPills() {
  if (!categoryFilter) return;

  categoryFilter.innerHTML = menuCategories.map(cat => `
    <button type="button" class="category-pill ${cat.id === currentCategory ? 'active' : ''}" data-cat="${cat.id}">
      <i class="fas ${cat.icon}"></i>
      <span>${cat.name}</span>
    </button>
  `).join('');

  categoryFilter.querySelectorAll('.category-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      categoryFilter.querySelectorAll('.category-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      currentCategory = pill.dataset.cat;
      filterAndRenderMenu();
    });
  });
}

// ---------- Menu Loading & Rendering ----------
function loadMenu() {
  menuService.subscribeToMenu((items) => {
    allMenuItems = items;
    filterAndRenderMenu();
    renderAdminMenuList(items);
  });
}

function filterAndRenderMenu() {
  let filtered = [...allMenuItems];

  if (currentCategory !== 'all') {
    filtered = filtered.filter(item => item.category === currentCategory);
  }

  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase().trim();
    filtered = filtered.filter(item => 
      item.name.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q) ||
      (item.tags && item.tags.some(t => t.toLowerCase().includes(q))) ||
      (item.description && item.description.toLowerCase().includes(q))
    );
  }

  displayedMenuItems = filtered;
  renderMenuGrid(displayedMenuItems);
}

function renderMenuGrid(items) {
  if (!menuGrid) return;

  if (items.length === 0) {
    menuGrid.innerHTML = `
      <div class="empty-menu" style="grid-column: 1/-1; text-align: center; padding: 3rem; color: var(--brown-500);">
        <i class="fas fa-search" style="font-size: 2.5rem; margin-bottom: 0.75rem; color: var(--brown-300);"></i>
        <h3>No menu items found</h3>
        <p>Try searching something else or switch categories</p>
      </div>
    `;
    return;
  }

  menuGrid.innerHTML = items.map(item => {
    const isOut = item.available === false;
    const tagBadges = item.tags && item.tags.length > 0 
      ? `<div class="tag-badges">${item.tags.map(t => `<span class="badge ${t.toLowerCase().replace(/\s+/g, '-')}">${t}</span>`).join('')}</div>`
      : '';

    let iconClass = 'fa-mug-hot';
    if (item.category === 'Non-Coffee' || item.category === 'Matcha' || item.category === 'Frappe') iconClass = 'fa-glass-whiskey';
    if (item.category === 'Shareables' || item.category === 'Pasta' || item.category === 'Sandwiches') iconClass = 'fa-utensils';
    if (item.category === 'Wings') iconClass = 'fa-drumstick-bite';
    if (item.category === 'Silogs' || item.category === 'Rice Meals') iconClass = 'fa-bowl-rice';

    return `
      <div class="menu-card ${isOut ? 'unavailable' : ''}" data-id="${item.id}">
        <div class="item-image">
          ${item.imageUrl ? `<img src="${item.imageUrl}" alt="${item.name}">` : `<i class="fas ${iconClass}"></i>`}
        </div>
        ${isOut ? '<span class="badge unavailable">Out of Stock</span>' : tagBadges}
        <div class="item-name" title="${item.name}">${item.name}</div>
        <div class="item-desc">${item.description || (item.sizes && item.sizes.length ? item.sizes.join(', ') : item.category)}</div>
        <div class="item-bottom">
          <span class="item-price">₱${Number(item.price).toFixed(2)}</span>
          <button class="add-btn" data-id="${item.id}" ${isOut ? 'disabled' : ''}>+</button>
        </div>
      </div>
    `;
  }).join('');

  menuGrid.querySelectorAll('.menu-card').forEach(card => {
    card.addEventListener('click', () => {
      const id = card.dataset.id;
      const item = allMenuItems.find(i => i.id === id);
      if (item && item.available !== false) handleItemSelection(item);
    });
  });
}

// ---------- Item Selection & Customization Modal with Quantity Stepper ----------
function handleItemSelection(item) {
  openCustomizationModal(item);
}

function openCustomizationModal(item) {
  customizingItem = item;
  customizationState = {
    qty: 1,
    size: item.sizes && item.sizes.length > 0 ? item.sizes[0] : null,
    flavor: item.flavors && item.flavors.length > 0 ? item.flavors[0] : null,
    eggOption: item.eggOptions && item.eggOptions.length > 0 ? item.eggOptions[0] : null,
    milk: item.customization?.milk ? item.customization.milk[0] : null,
    sugar: item.customization?.sugar ? (item.customization.sugar.includes('Regular') ? 'Regular' : item.customization.sugar[0]) : null
  };

  const nameEl = document.getElementById('customizeItemName');
  const bodyEl = document.getElementById('customizeBody');

  if (nameEl) nameEl.innerHTML = `<i class="fas fa-sliders-h"></i> ${item.name} <span style="font-size:0.95rem;color:var(--brown-600);font-weight:700;">(₱${item.price.toFixed(2)})</span>`;

  let html = '';

  // 1. Sizes (Hot / Iced)
  if (item.sizes && item.sizes.length > 1) {
    html += `
      <div class="option-group">
        <div class="option-group-title"><i class="fas fa-temperature-high"></i> Temperature / Size</div>
        <div class="option-pills" data-option="size">
          ${item.sizes.map(size => `
            <button type="button" class="option-pill-btn ${size === customizationState.size ? 'active' : ''}" data-val="${size}">
              ${size === 'Hot' ? '🔥 Hot' : '🧊 Iced'}
            </button>
          `).join('')}
        </div>
      </div>
    `;
  }

  // 2. Wing Flavors
  if (item.flavors && item.flavors.length > 0) {
    html += `
      <div class="option-group">
        <div class="option-group-title"><i class="fas fa-drumstick-bite"></i> Wing Flavor</div>
        <div class="option-pills" data-option="flavor">
          ${item.flavors.map(flavor => `
            <button type="button" class="option-pill-btn ${flavor === customizationState.flavor ? 'active' : ''}" data-val="${flavor}">
              ${flavor}
            </button>
          `).join('')}
        </div>
      </div>
    `;
  }

  // 3. Egg Options
  if (item.eggOptions && item.eggOptions.length > 0) {
    html += `
      <div class="option-group">
        <div class="option-group-title"><i class="fas fa-egg"></i> Egg Style</div>
        <div class="option-pills" data-option="eggOption">
          ${item.eggOptions.map(egg => `
            <button type="button" class="option-pill-btn ${egg === customizationState.eggOption ? 'active' : ''}" data-val="${egg}">
              ${egg}
            </button>
          `).join('')}
        </div>
      </div>
    `;
  }

  // 4. Milk Choice
  if (item.customization?.milk && item.customization.milk.length > 0) {
    html += `
      <div class="option-group">
        <div class="option-group-title"><i class="fas fa-cow"></i> Milk Choice</div>
        <div class="option-pills" data-option="milk">
          ${item.customization.milk.map(milk => `
            <button type="button" class="option-pill-btn ${milk === customizationState.milk ? 'active' : ''}" data-val="${milk}">
              ${milk} Milk
            </button>
          `).join('')}
        </div>
      </div>
    `;
  }

  // 5. Sugar Level
  if (item.customization?.sugar && item.customization.sugar.length > 0) {
    html += `
      <div class="option-group">
        <div class="option-group-title"><i class="fas fa-cubes"></i> Sugar Level</div>
        <div class="option-pills" data-option="sugar">
          ${item.customization.sugar.map(sugar => `
            <button type="button" class="option-pill-btn ${sugar === customizationState.sugar ? 'active' : ''}" data-val="${sugar}">
              ${sugar}
            </button>
          `).join('')}
        </div>
      </div>
    `;
  }

  // 6. Quantity Stepper (+ -)
  html += `
    <div class="modal-qty-group">
      <div class="option-group-title" style="font-weight:700;color:var(--brown-800);"><i class="fas fa-calculator"></i> Quantity to Order</div>
      <div class="modal-qty-controls">
        <button type="button" class="modal-qty-btn" id="modalQtyMinus">−</button>
        <span class="modal-qty-val" id="modalQtyVal">1</span>
        <button type="button" class="modal-qty-btn" id="modalQtyPlus">+</button>
        <span class="modal-item-subtotal" id="modalItemSubtotal">₱${item.price.toFixed(2)}</span>
      </div>
    </div>
  `;

  if (bodyEl) {
    bodyEl.innerHTML = html;

    // Option pills
    bodyEl.querySelectorAll('.option-pills').forEach(group => {
      const optionKey = group.dataset.option;
      group.querySelectorAll('.option-pill-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          group.querySelectorAll('.option-pill-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          customizationState[optionKey] = btn.dataset.val;
        });
      });
    });

    // Quantity stepper controls
    const qtyValEl = bodyEl.querySelector('#modalQtyVal');
    const subtotalEl = bodyEl.querySelector('#modalItemSubtotal');
    const minusBtn = bodyEl.querySelector('#modalQtyMinus');
    const plusBtn = bodyEl.querySelector('#modalQtyPlus');

    const updateQtyDisplay = () => {
      if (qtyValEl) qtyValEl.textContent = customizationState.qty;
      if (subtotalEl) subtotalEl.textContent = `₱${(item.price * customizationState.qty).toFixed(2)}`;
    };

    if (minusBtn) {
      minusBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (customizationState.qty > 1) {
          customizationState.qty -= 1;
          updateQtyDisplay();
        }
      });
    }

    if (plusBtn) {
      plusBtn.addEventListener('click', (e) => {
        e.preventDefault();
        customizationState.qty += 1;
        updateQtyDisplay();
      });
    }
  }

  openModal('customizeModal');
}

function closeCustomizationModal() {
  closeModal('customizeModal');
  customizingItem = null;
}

function confirmCustomization() {
  if (!customizingItem) return;

  const qty = customizationState.qty || 1;

  addToCart({
    ...customizingItem,
    size: customizationState.size,
    flavor: customizationState.flavor,
    eggOption: customizationState.eggOption,
    customization: {
      milk: customizationState.milk,
      sugar: customizationState.sugar
    }
  }, qty);

  closeCustomizationModal();
}

// ---------- Cart Functions ----------
function getCartItemKey(item) {
  return [
    item.id,
    item.size || '',
    item.flavor || '',
    item.eggOption || '',
    item.customization?.milk || '',
    item.customization?.sugar || ''
  ].join('__');
}

function addToCart(configuredItem, qty = 1) {
  const cartKey = getCartItemKey(configuredItem);
  const existing = cart.find(c => c.cartKey === cartKey);

  if (existing) {
    existing.qty += qty;
  } else {
    cart.push({
      cartKey,
      id: configuredItem.id,
      name: configuredItem.name,
      price: configuredItem.price,
      qty: qty,
      size: configuredItem.size,
      flavor: configuredItem.flavor,
      eggOption: configuredItem.eggOption,
      customization: configuredItem.customization || {},
      imageUrl: configuredItem.imageUrl
    });
  }

  updateCartUI();
}

function updateCartUI() {
  const cartItemsEl = document.getElementById('cartItems');
  const subtotalEl = document.getElementById('cartSubtotal');
  const vatSummaryRow = document.getElementById('vatSummaryRow');
  const taxEl = document.getElementById('cartTax');
  const summaryVatPercent = document.getElementById('summaryVatPercent');
  const takeoutTaxRow = document.getElementById('takeoutTaxRow');
  const takeoutTaxEl = document.getElementById('cartTakeoutTax');
  const totalEl = document.getElementById('cartTotal');
  const discountInput = document.getElementById('discountInput');
  const discountType = document.getElementById('discountType')?.value || 'percentage';
  const discountVal = parseFloat(discountInput?.value || 0);

  const activeTaxRate = currentStoreSettings?.taxRate !== undefined ? currentStoreSettings.taxRate : storeData.taxRate;
  const activeTakeoutTaxRate = currentStoreSettings?.takeoutTaxRate !== undefined ? currentStoreSettings.takeoutTaxRate : storeData.takeoutTaxRate;

  const totals = OrderService.calculateTotals(cart, orderType, discountVal, discountType, activeTaxRate, activeTakeoutTaxRate);

  if (cartItemsEl) {
    if (cart.length === 0) {
      cartItemsEl.innerHTML = `
        <div class="empty-cart">
          <i class="fas fa-shopping-basket"></i>
          <p>No items in order</p>
          <span>Tap any item on the menu to add</span>
        </div>
      `;
    } else {
      cartItemsEl.innerHTML = cart.map(item => {
        let details = [];
        if (item.size) details.push(item.size);
        if (item.flavor) details.push(item.flavor);
        if (item.eggOption) details.push(item.eggOption);
        if (item.customization) {
          if (item.customization.milk) details.push(`${item.customization.milk} Milk`);
          if (item.customization.sugar) details.push(`${item.customization.sugar} Sugar`);
        }
        const detailStr = details.length > 0 ? `<div class="cart-item-customizations">${details.join(' · ')}</div>` : '';

        return `
          <div class="cart-item">
            <div class="item-info">
              <div class="item-name">${item.name}</div>
              ${detailStr}
              <div class="item-price">₱${item.price.toFixed(2)}</div>
            </div>
            <div class="item-qty">
              <button type="button" class="qty-btn" data-key="${item.cartKey}" data-action="minus">−</button>
              <span class="qty-num">${item.qty}</span>
              <button type="button" class="qty-btn" data-key="${item.cartKey}" data-action="plus">+</button>
            </div>
            <span class="item-total">₱${(item.price * item.qty).toFixed(2)}</span>
            <button type="button" class="remove-item" data-key="${item.cartKey}" title="Remove">
              <i class="fas fa-times"></i>
            </button>
          </div>
        `;
      }).join('');

      cartItemsEl.querySelectorAll('.qty-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const key = btn.dataset.key;
          const action = btn.dataset.action;
          const target = cart.find(c => c.cartKey === key);
          if (target) {
            if (action === 'plus') {
              target.qty += 1;
            } else {
              if (target.qty > 1) {
                target.qty -= 1;
              } else {
                cart = cart.filter(c => c.cartKey !== key);
              }
            }
            updateCartUI();
          }
        });
      });

      cartItemsEl.querySelectorAll('.remove-item').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const key = btn.dataset.key;
          cart = cart.filter(c => c.cartKey !== key);
          updateCartUI();
        });
      });
    }
  }

  if (subtotalEl) subtotalEl.textContent = `₱${totals.subtotal.toFixed(2)}`;

  // VAT Display: Hide if 0% or 0 tax
  if (vatSummaryRow) {
    if (activeTaxRate > 0 && totals.tax > 0) {
      vatSummaryRow.style.display = 'flex';
      if (summaryVatPercent) summaryVatPercent.textContent = (activeTaxRate * 100).toFixed(0);
      if (taxEl) taxEl.textContent = `₱${totals.tax.toFixed(2)}`;
    } else {
      vatSummaryRow.style.display = 'none';
    }
  }

  // Takeout Tax
  if (takeoutTaxRow && takeoutTaxEl) {
    if (orderType === 'Takeout' && totals.takeoutTax > 0) {
      takeoutTaxRow.style.display = 'flex';
      takeoutTaxEl.textContent = `₱${totals.takeoutTax.toFixed(2)}`;
    } else {
      takeoutTaxRow.style.display = 'none';
    }
  }

  if (totalEl) totalEl.textContent = `₱${totals.total.toFixed(2)}`;
}

function clearCart() {
  if (cart.length === 0) return;
  cart = [];
  updateCartUI();
  showToast('Cart cleared', 'info');
}

let lastCompletedOrder = null;

function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add('open');
    modal.style.display = 'flex';
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('open');
    modal.style.display = 'none';
  }
}

function openCheckout() {
  if (cart.length === 0) {
    showToast('Add items to cart first', 'error');
    return;
  }

  const reviewItems = document.getElementById('orderReviewItems');
  const reviewTotal = document.getElementById('orderReviewTotal');
  const orderTypeBadge = document.getElementById('checkoutOrderType');
  const tableVal = document.getElementById('tableNumber')?.value;

  const discountVal = parseFloat(document.getElementById('discountInput')?.value || 0);
  const discountType = document.getElementById('discountType')?.value || 'percentage';
  const activeTaxRate = currentStoreSettings?.taxRate !== undefined ? currentStoreSettings.taxRate : storeData.taxRate;
  const activeTakeoutTaxRate = currentStoreSettings?.takeoutTaxRate !== undefined ? currentStoreSettings.takeoutTaxRate : storeData.takeoutTaxRate;
  const totals = OrderService.calculateTotals(cart, orderType, discountVal, discountType, activeTaxRate, activeTakeoutTaxRate);

  if (orderTypeBadge) {
    orderTypeBadge.innerHTML = `<i class="fas ${orderType === 'Dine-in' ? 'fa-store' : 'fa-bag-shopping'}"></i> ${orderType}${orderType === 'Dine-in' && tableVal ? ` — Table ${tableVal}` : ''}`;
  }

  if (reviewItems) {
    reviewItems.innerHTML = cart.map(item => {
      let details = [];
      if (item.size) details.push(item.size);
      if (item.flavor) details.push(item.flavor);
      if (item.eggOption) details.push(item.eggOption);
      const detailStr = details.length > 0 ? ` <small style="color:var(--brown-500);">(${details.join(', ')})</small>` : '';
      return `
        <div class="cart-item" style="padding: 0.35rem 0;">
          <span>${item.qty}x ${item.name}${detailStr}</span>
          <span style="font-weight:600;">₱${(item.price * item.qty).toFixed(2)}</span>
        </div>
      `;
    }).join('');
  }

  if (reviewTotal) {
    reviewTotal.textContent = `₱${totals.total.toFixed(2)}`;
  }

  renderQuickAmounts(totals.total);

  const payInput = document.getElementById('paymentAmount');
  if (payInput) payInput.value = '';
  const changeEl = document.getElementById('changeAmount');
  if (changeEl) changeEl.textContent = '₱0.00';

  openModal('checkoutModal');
}

function renderQuickAmounts(total) {
  const container = document.getElementById('quickAmounts');
  if (!container) return;

  const exact = Math.ceil(total);
  const options = new Set([exact]);

  if (exact < 100) options.add(100);
  if (exact < 200) options.add(200);
  if (exact < 500) options.add(500);
  if (exact < 1000) options.add(1000);

  const next50 = Math.ceil(exact / 50) * 50;
  if (next50 > exact) options.add(next50);
  const next100 = Math.ceil(exact / 100) * 100;
  if (next100 > exact) options.add(next100);

  const sorted = Array.from(options).sort((a, b) => a - b).slice(0, 4);

  container.innerHTML = sorted.map(amt => `
    <button type="button" class="quick-amount-btn" data-amt="${amt}">₱${amt}</button>
  `).join('');

  container.querySelectorAll('.quick-amount-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const amt = parseFloat(btn.dataset.amt);
      const input = document.getElementById('paymentAmount');
      if (input) {
        input.value = amt;
        calculateChange();
      }
    });
  });
}

function calculateChange() {
  const discountVal = parseFloat(document.getElementById('discountInput')?.value || 0);
  const discountType = document.getElementById('discountType')?.value || 'percentage';
  const activeTaxRate = currentStoreSettings?.taxRate !== undefined ? currentStoreSettings.taxRate : storeData.taxRate;
  const activeTakeoutTaxRate = currentStoreSettings?.takeoutTaxRate !== undefined ? currentStoreSettings.takeoutTaxRate : storeData.takeoutTaxRate;
  const totals = OrderService.calculateTotals(cart, orderType, discountVal, discountType, activeTaxRate, activeTakeoutTaxRate);
  const amountPaid = parseFloat(document.getElementById('paymentAmount')?.value || 0);
  const changeEl = document.getElementById('changeAmount');

  if (!changeEl) return;

  if (amountPaid === 0) {
    changeEl.textContent = '₱0.00';
    changeEl.style.color = 'var(--brown-700)';
    return;
  }

  const change = amountPaid - totals.total;
  if (change >= 0) {
    changeEl.textContent = `₱${change.toFixed(2)}`;
    changeEl.style.color = 'var(--success)';
  } else {
    changeEl.textContent = `Insufficient (₱${Math.abs(change).toFixed(2)})`;
    changeEl.style.color = 'var(--danger)';
  }
}

function closeCheckout() {
  closeModal('checkoutModal');
}

async function completeOrder() {
  try {
    if (cart.length === 0) return;

    const discountVal = parseFloat(document.getElementById('discountInput')?.value || 0);
    const discountType = document.getElementById('discountType')?.value || 'percentage';
    const activeTaxRate = currentStoreSettings?.taxRate !== undefined ? currentStoreSettings.taxRate : storeData.taxRate;
    const activeTakeoutTaxRate = currentStoreSettings?.takeoutTaxRate !== undefined ? currentStoreSettings.takeoutTaxRate : storeData.takeoutTaxRate;
    const totals = OrderService.calculateTotals(cart, orderType, discountVal, discountType, activeTaxRate, activeTakeoutTaxRate);

    const paymentMethod = document.querySelector('.payment-btn.active')?.dataset.method || 'Cash';
    let amountPaid = parseFloat(document.getElementById('paymentAmount')?.value || 0);
    
    if (paymentMethod !== 'Cash' && (!amountPaid || amountPaid === 0)) {
      amountPaid = totals.total;
    }

    if (amountPaid < totals.total && paymentMethod === 'Cash') {
      showToast('Amount received is less than total', 'error');
      return;
    }

    const customerName = document.getElementById('customerName')?.value?.trim() || 'Walk-in';
    const notes = document.getElementById('orderNotes')?.value?.trim() || '';
    const tableVal = document.getElementById('tableNumber')?.value || null;

    const orderPayload = {
      items: cart,
      subtotal: totals.subtotal,
      tax: totals.tax,
      takeoutTax: totals.takeoutTax,
      discount: totals.discount,
      total: totals.total,
      orderType: orderType,
      tableNumber: orderType === 'Dine-in' ? tableVal : null,
      customer: { name: customerName },
      notes: notes,
      payment: {
        type: paymentMethod,
        amount: amountPaid,
        change: Math.max(0, amountPaid - totals.total),
        status: 'Paid'
      },
      status: 'Preparing', // Direct cashier POS checkout with payment starts in Preparing
      source: 'pos',
      staff: currentUser
    };

    const createdOrder = await orderService.createOrder(orderPayload);
    lastCompletedOrder = createdOrder;

    showToast(`Order ${createdOrder.orderNumber} placed & marked Preparing!`, 'success');

    // Reset Cart & Close Payment modal
    clearCart();
    closeCheckout();
    updateOrderCounter();

    // Show Print Confirmation Modal
    const numEl = document.getElementById('confirmOrderNumber');
    const totEl = document.getElementById('confirmOrderTotal');
    const chgEl = document.getElementById('confirmOrderChange');
    if (numEl) numEl.textContent = `Order #: ${createdOrder.orderNumber}`;
    if (totEl) totEl.textContent = `₱${createdOrder.total.toFixed(2)} (${createdOrder.payment.type})`;
    if (chgEl) chgEl.textContent = `₱${(createdOrder.payment.change || 0).toFixed(2)}`;

    openModal('printConfirmModal');

  } catch (error) {
    console.error('Checkout error:', error);
    showToast('Failed to complete order: ' + error.message, 'error');
  }
}

// ---------- Orders Real-Time Management ----------
let activeConfirmingOrder = null;

function initOrders() {
  orderService.subscribeToOrders((fetchedOrders) => {
    orders = fetchedOrders;
    renderOrdersList();
    updateOrderCounter();
    updateAnalytics();
  });
}

function updateOrderCounter() {
  const counter = document.getElementById('orderCount');
  const badge = document.getElementById('pendingBadge');
  
  if (counter) {
    const todayStr = new Date().toDateString();
    const todayOrders = orders.filter(o => {
      const d = o.createdAt instanceof Date ? o.createdAt : new Date(o.createdAt);
      return d.toDateString() === todayStr;
    });
    counter.textContent = todayOrders.length;
  }

  if (badge) {
    const pendingCount = orders.filter(o => o.status === 'Pending' || o.status === 'Preparing').length;
    if (pendingCount > 0) {
      badge.textContent = pendingCount;
      badge.style.display = 'block';
    } else {
      badge.style.display = 'none';
    }
  }
}

function renderOrdersList() {
  const container = document.getElementById('ordersList');
  if (!container) return;

  const statusFilter = document.getElementById('orderStatusFilter')?.value || 'all';
  const dateFilter = document.getElementById('orderDateFilter')?.value || '';

  let filtered = orders;

  if (statusFilter !== 'all') {
    filtered = filtered.filter(o => o.status === statusFilter);
  }

  if (dateFilter) {
    filtered = filtered.filter(o => {
      const d = o.createdAt instanceof Date ? o.createdAt : new Date(o.createdAt);
      return d.toISOString().split('T')[0] === dateFilter;
    });
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="text-align:center;padding:3rem 1rem;">
        <i class="fas fa-receipt" style="font-size:2.5rem;color:var(--brown-400);margin-bottom:0.75rem;"></i>
        <p style="font-weight:600;color:var(--brown-700);">No orders found</p>
        <span style="font-size:0.85rem;color:var(--brown-500);">New customer orders will sync here automatically</span>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(order => {
    const statusClass = (order.status || 'Pending').toLowerCase();
    const isUnpaid = order.status === 'Pending' || order.payment?.status === 'Unpaid' || (order.payment?.type && order.payment.type.includes('Unpaid'));
    const isKiosk = order.source === 'kiosk';

    const itemsSummary = (order.items || []).map(i => {
      let d = [];
      if (i.size) d.push(i.size);
      if (i.flavor) d.push(i.flavor);
      if (i.eggOption) d.push(i.eggOption);
      return `<div><strong>${i.qty}x</strong> ${i.name} ${d.length ? `<small style="color:var(--brown-500);">(${d.join(', ')})</small>` : ''}</div>`;
    }).join('');

    const timeStr = order.createdAt ? (order.createdAt instanceof Date ? order.createdAt : new Date(order.createdAt)).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' }) : '';

    return `
      <div class="order-card-detailed ${statusClass}" data-id="${order.id}">
        <div class="order-card-header">
          <div style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap;">
            <span style="font-weight:700;color:var(--brown-800);">${order.orderNumber}</span>
            <span style="font-size:0.8rem;color:var(--brown-500);"><i class="far fa-clock"></i> ${timeStr}</span>
            ${isKiosk ? `<span class="badge-kiosk-tag"><i class="fas fa-mobile-alt"></i> Self-Order</span>` : `<span class="badge-pos-tag"><i class="fas fa-desktop"></i> POS</span>`}
          </div>
          <div style="display:flex; align-items:center; gap:0.5rem;">
            ${isUnpaid 
              ? `<span class="badge-payment-pill unpaid"><i class="fas fa-wallet"></i> To Pay</span>` 
              : `<span class="badge-payment-pill paid"><i class="fas fa-check-circle"></i> Paid</span>`}
            <span class="order-status ${statusClass}">${order.status}</span>
          </div>
        </div>

        <div style="font-size:0.85rem;color:var(--brown-600);display:flex;gap:1rem;flex-wrap:wrap;">
          <span><i class="fas ${order.orderType === 'Takeout' ? 'fa-bag-shopping' : 'fa-store'}"></i> ${order.orderType}${order.tableNumber ? ` (Table ${order.tableNumber})` : ''}</span>
          <span><i class="fas fa-user"></i> ${order.customer?.name || 'Walk-in'}</span>
          <span><i class="fas fa-credit-card"></i> ${order.payment?.type || 'Cash'}</span>
        </div>

        <div class="order-card-items-list">
          ${itemsSummary}
        </div>

        <div style="display:flex;justify-content:space-between;align-items:center;font-weight:700;font-size:1.1rem;color:var(--brown-900);">
          <span style="font-size:0.85rem;font-weight:normal;color:var(--brown-500);">Total:</span>
          <span style="color:var(--yellow-600);">₱${Number(order.total || 0).toFixed(2)}</span>
        </div>

        <div class="order-card-actions">
          <button type="button" class="btn-status-action print" data-id="${order.id}" title="Print Receipt">
            <i class="fas fa-print"></i> Print
          </button>
          
          ${order.status === 'Pending' ? `
            <button type="button" class="btn-status-action confirm-pay-btn" data-id="${order.id}" title="Confirm Payment & Send to Kitchen">
              <i class="fas fa-cash-register"></i> Confirm Payment & Prepare
            </button>
          ` : ''}
          ${order.status === 'Preparing' ? `
            <button type="button" class="btn-status-action advance ready-btn" data-id="${order.id}" data-next="Ready" title="Mark Ready for Pickup">
              <i class="fas fa-bell"></i> Mark Ready
            </button>
          ` : ''}
          ${order.status === 'Ready' ? `
            <button type="button" class="btn-status-action advance complete-btn" data-id="${order.id}" data-next="Completed" title="Complete & Handover">
              <i class="fas fa-check-double"></i> Complete
            </button>
          ` : ''}
          ${(order.status !== 'Completed' && order.status !== 'Cancelled' && (currentUser?.role === 'admin' || currentUser?.role === 'manager' || authService.hasPermission('canVoidOrders'))) ? `
            <button type="button" class="btn-status-action cancel" data-id="${order.id}">
              <i class="fas fa-ban"></i> Void
            </button>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');

  // Confirm Payment & Prepare button
  container.querySelectorAll('.btn-status-action.confirm-pay-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      const targetOrder = orders.find(o => o.id === id);
      if (targetOrder) {
        openPaymentConfirmModal(targetOrder);
      }
    });
  });

  // Advance status button (Mark Ready, Complete)
  container.querySelectorAll('.btn-status-action.advance').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      const next = btn.dataset.next;
      await orderService.updateStatus(id, next);
      showToast(`Order status updated to ${next}`, 'success');
    });
  });

  container.querySelectorAll('.btn-status-action.print').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      const targetOrder = orders.find(o => o.id === id);
      if (targetOrder) {
        printService.printReceipt(targetOrder);
        showToast('Printing receipt...', 'info');
      }
    });
  });

  container.querySelectorAll('.btn-status-action.cancel').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      if (confirm('Are you sure you want to void this order in Firestore?')) {
        await orderService.cancelOrder(id, 'Voided by staff');
        showToast('Order voided in Firestore', 'info');
      }
    });
  });
}

// Open Payment Confirmation Modal for Customer Kiosk / Pending Orders
function openPaymentConfirmModal(order) {
  activeConfirmingOrder = order;
  
  document.getElementById('kioskPayOrderNumber').textContent = order.orderNumber || 'LIKHA-0000';
  document.getElementById('kioskPayCustomerName').textContent = `${order.customer?.name || 'Customer'} (${order.orderType || 'Dine-in'}${order.tableNumber ? ` - Table #${order.tableNumber}` : ''})`;
  document.getElementById('kioskPayTotalDue').textContent = `₱${Number(order.total || 0).toFixed(2)}`;

  // Default to Cash
  document.querySelectorAll('#kioskPaymentMethods .payment-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.method === 'Cash');
  });

  const payInput = document.getElementById('kioskPaymentAmount');
  const cashGroup = document.getElementById('kioskCashAmountGroup');
  if (payInput) payInput.value = order.total;
  if (cashGroup) cashGroup.style.display = 'block';

  calculateKioskChange();
  openModal('paymentConfirmModal');
}

function calculateKioskChange() {
  if (!activeConfirmingOrder) return;
  const total = activeConfirmingOrder.total || 0;
  const method = document.querySelector('#kioskPaymentMethods .payment-btn.active')?.dataset.method || 'Cash';
  const amountPaid = parseFloat(document.getElementById('kioskPaymentAmount')?.value || 0);
  const changeEl = document.getElementById('kioskChangeAmount');
  
  if (!changeEl) return;

  if (method !== 'Cash') {
    changeEl.textContent = '₱0.00';
    changeEl.style.color = 'var(--success)';
    return;
  }

  const change = amountPaid - total;
  if (change >= 0) {
    changeEl.textContent = `₱${change.toFixed(2)}`;
    changeEl.style.color = 'var(--success)';
  } else {
    changeEl.textContent = `Insufficient (₱${Math.abs(change).toFixed(2)})`;
    changeEl.style.color = 'var(--danger)';
  }
}

async function submitKioskPaymentConfirmation() {
  if (!activeConfirmingOrder) return;

  const total = activeConfirmingOrder.total || 0;
  const method = document.querySelector('#kioskPaymentMethods .payment-btn.active')?.dataset.method || 'Cash';
  let amountPaid = parseFloat(document.getElementById('kioskPaymentAmount')?.value || 0);

  if (method !== 'Cash') {
    amountPaid = total;
  } else if (amountPaid < total) {
    showToast('Amount received is less than total due', 'error');
    return;
  }

  const change = Math.max(0, amountPaid - total);

  try {
    await orderService.confirmPaymentAndPrepare(activeConfirmingOrder.id, {
      type: method,
      amount: amountPaid,
      change: change,
      total: total
    });

    showToast(`Payment confirmed! Order ${activeConfirmingOrder.orderNumber} marked Preparing.`, 'success');
    closeModal('paymentConfirmModal');

    // Optionally prompt to print
    lastCompletedOrder = {
      ...activeConfirmingOrder,
      payment: {
        type: method,
        amount: amountPaid,
        change: change,
        status: 'Paid'
      }
    };
    
    // Auto-ask if want to print receipt
    const numEl = document.getElementById('confirmOrderNumber');
    const totEl = document.getElementById('confirmOrderTotal');
    const chgEl = document.getElementById('confirmOrderChange');
    if (numEl) numEl.textContent = `Order #: ${lastCompletedOrder.orderNumber}`;
    if (totEl) totEl.textContent = `₱${lastCompletedOrder.total.toFixed(2)} (${method})`;
    if (chgEl) chgEl.textContent = `₱${change.toFixed(2)}`;
    openModal('printConfirmModal');

    activeConfirmingOrder = null;
  } catch (err) {
    console.error('Error confirming kiosk payment:', err);
    showToast('Failed to confirm payment: ' + err.message, 'error');
  }
}

let pendingItemPhotoFile = null;

// ---------- Admin Menu Item CRUD ----------
function renderAdminMenuList(items = allMenuItems) {
  const container = document.getElementById('adminMenuList');
  if (!container) return;

  if (!items || items.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1/-1; text-align:center; padding:3rem 1rem; color:var(--brown-500); background:var(--white); border-radius:var(--radius); border:1.5px dashed var(--brown-200);">
        <i class="fas fa-utensils" style="font-size:2.5rem; color:var(--brown-300); margin-bottom:0.75rem;"></i>
        <h4 style="color:var(--brown-800); margin-bottom:0.25rem;">No menu items found</h4>
        <p style="font-size:0.88rem; margin-bottom:1rem;">Add a new item or seed the pre-loaded 45 items.</p>
        <button type="button" id="inlineSeedBtn" class="btn-primary"><i class="fas fa-cloud-upload-alt"></i> Seed 45 Pre-loaded Items</button>
      </div>
    `;
    document.getElementById('inlineSeedBtn')?.addEventListener('click', seedMenuItems);
    return;
  }

  container.innerHTML = items.map(item => {
    let iconClass = 'fa-mug-hot';
    if (item.category === 'Non-Coffee' || item.category === 'Matcha' || item.category === 'Frappe') iconClass = 'fa-glass-whiskey';
    if (item.category === 'Shareables' || item.category === 'Pasta' || item.category === 'Sandwiches') iconClass = 'fa-utensils';
    if (item.category === 'Wings') iconClass = 'fa-drumstick-bite';
    if (item.category === 'Silogs' || item.category === 'Rice Meals') iconClass = 'fa-bowl-rice';

    const isAvailable = item.available !== false;
    const tagBadges = item.tags && item.tags.length > 0
      ? item.tags.map(t => `<span class="badge ${t.toLowerCase().replace(/\s+/g, '-')}">${t}</span>`).join('')
      : '';

    return `
      <div class="admin-item-card" data-id="${item.id}">
        <div class="admin-card-top">
          <span class="admin-card-cat">${item.category}</span>
          <span class="admin-card-status ${isAvailable ? 'in' : 'out'}">
            ${isAvailable ? '● In Stock' : '✕ Out of Stock'}
          </span>
        </div>
        <div class="admin-card-body">
          <div class="admin-card-icon">
            ${item.imageUrl ? `<img src="${item.imageUrl}" alt="${item.name}">` : `<i class="fas ${iconClass}"></i>`}
          </div>
          <div class="admin-card-info">
            <h4 class="admin-card-title" title="${item.name}">${item.name}</h4>
            <p class="admin-card-desc">${item.description || (item.sizes && item.sizes.length ? item.sizes.join(', ') : item.category)}</p>
            ${tagBadges ? `<div class="admin-card-tags">${tagBadges}</div>` : ''}
          </div>
        </div>
        <div class="admin-card-bottom">
          <div class="admin-card-price">₱${Number(item.price).toFixed(2)}</div>
          <div class="admin-card-actions">
            <button type="button" class="edit-btn" data-id="${item.id}" title="Edit Item">
              <i class="fas fa-edit"></i> Edit
            </button>
            <button type="button" class="delete-btn" data-id="${item.id}" title="Delete Item">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  container.querySelectorAll('.edit-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const item = allMenuItems.find(i => i.id === id);
      if (item) openItemModal(item);
    });
  });

  container.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      const item = allMenuItems.find(i => i.id === id);
      if (confirm(`Are you sure you want to delete "${item?.name}" from Firestore?`)) {
        await menuService.deleteItem(id);
        showToast(`Item "${item?.name}" deleted from Firestore`, 'info');
      }
    });
  });
}

function openItemModal(item = null) {
  const modal = document.getElementById('itemModal');
  const title = document.getElementById('itemModalTitle');
  
  document.getElementById('itemId').value = item ? item.id : '';
  document.getElementById('itemName').value = item ? item.name : '';
  document.getElementById('itemCategory').value = item ? item.category : 'Coffee';
  document.getElementById('itemPrice').value = item ? item.price : '';
  document.getElementById('itemSizes').value = item && item.sizes ? item.sizes.join(', ') : 'Hot, Iced';
  document.getElementById('itemTags').value = item && item.tags ? item.tags.join(', ') : '';
  document.getElementById('itemDesc').value = item && item.description ? item.description : '';
  
  document.getElementById('itemHasWingsFlavors').checked = item && item.flavors && item.flavors.length > 0;
  document.getElementById('itemHasEggOptions').checked = item && item.eggOptions && item.eggOptions.length > 0;
  document.getElementById('itemHasMilkSugar').checked = item && item.customization && (item.customization.milk || item.customization.sugar);
  document.getElementById('itemAvailable').checked = item ? item.available !== false : true;

  // Photo state reset
  pendingItemPhotoFile = null;
  const fileInput = document.getElementById('itemPhotoFile');
  if (fileInput) fileInput.value = '';
  
  const existingUrl = item && item.imageUrl ? item.imageUrl : '';
  document.getElementById('itemExistingImageUrl').value = existingUrl;
  document.getElementById('itemPhotoUrl').value = existingUrl;

  const dropzone = document.getElementById('itemPhotoDropzone');
  const previewContainer = document.getElementById('itemPhotoPreviewContainer');
  const previewImg = document.getElementById('itemPhotoPreview');
  const statusLabel = document.getElementById('photoStatusLabel');

  if (existingUrl) {
    if (previewImg) previewImg.src = existingUrl;
    if (statusLabel) statusLabel.textContent = 'Current Photo Loaded';
    if (dropzone) dropzone.classList.add('hidden');
    if (previewContainer) previewContainer.classList.remove('hidden');
  } else {
    if (previewImg) previewImg.src = '';
    if (dropzone) dropzone.classList.remove('hidden');
    if (previewContainer) previewContainer.classList.add('hidden');
  }

  if (title) {
    title.innerHTML = item ? `<i class="fas fa-edit"></i> Edit Menu Item` : `<i class="fas fa-plus"></i> Add Menu Item`;
  }

  openModal('itemModal');
}

function handlePhotoFileSelect(file) {
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    showToast('Please select a valid image file (JPG, PNG, WebP)', 'error');
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    showToast('Image size exceeds 5MB limit', 'error');
    return;
  }

  pendingItemPhotoFile = file;
  const dropzone = document.getElementById('itemPhotoDropzone');
  const previewContainer = document.getElementById('itemPhotoPreviewContainer');
  const previewImg = document.getElementById('itemPhotoPreview');
  const statusLabel = document.getElementById('photoStatusLabel');

  const reader = new FileReader();
  reader.onload = (e) => {
    if (previewImg) previewImg.src = e.target.result;
    if (statusLabel) statusLabel.textContent = `${file.name} (${Math.round(file.size / 1024)} KB)`;
    if (dropzone) dropzone.classList.add('hidden');
    if (previewContainer) previewContainer.classList.remove('hidden');
  };
  reader.readAsDataURL(file);
}

function clearItemPhoto() {
  pendingItemPhotoFile = null;
  const fileInput = document.getElementById('itemPhotoFile');
  if (fileInput) fileInput.value = '';
  document.getElementById('itemExistingImageUrl').value = '';
  document.getElementById('itemPhotoUrl').value = '';

  const dropzone = document.getElementById('itemPhotoDropzone');
  const previewContainer = document.getElementById('itemPhotoPreviewContainer');
  const previewImg = document.getElementById('itemPhotoPreview');

  if (previewImg) previewImg.src = '';
  if (dropzone) dropzone.classList.remove('hidden');
  if (previewContainer) previewContainer.classList.add('hidden');
}

function closeItemModal() {
  closeModal('itemModal');
  pendingItemPhotoFile = null;
}

async function saveItem(e) {
  e.preventDefault();
  const submitBtn = e.target.querySelector('button[type="submit"]');
  const originalBtnHtml = submitBtn ? submitBtn.innerHTML : '';

  try {
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Saving...`;
    }

    const id = document.getElementById('itemId').value;
    const name = document.getElementById('itemName').value.trim();
    const category = document.getElementById('itemCategory').value;
    const price = parseFloat(document.getElementById('itemPrice').value);
    const sizesStr = document.getElementById('itemSizes').value.trim();
    const tagsStr = document.getElementById('itemTags').value.trim();
    const description = document.getElementById('itemDesc').value.trim();
    const hasWings = document.getElementById('itemHasWingsFlavors').checked;
    const hasEggs = document.getElementById('itemHasEggOptions').checked;
    const hasMilkSugar = document.getElementById('itemHasMilkSugar').checked;
    const available = document.getElementById('itemAvailable').checked;

    const sizes = sizesStr ? sizesStr.split(',').map(s => s.trim()).filter(Boolean) : [];
    const tags = tagsStr ? tagsStr.split(',').map(t => t.trim()).filter(Boolean) : [];

    // Resolve Image URL
    let imageUrl = null;
    if (pendingItemPhotoFile) {
      showToast('Uploading photo to Firebase Storage...', 'info');
      imageUrl = await menuService.uploadItemImage(pendingItemPhotoFile, id || name);
    } else if (document.getElementById('itemPhotoUrl').value.trim()) {
      imageUrl = document.getElementById('itemPhotoUrl').value.trim();
    } else if (document.getElementById('itemExistingImageUrl').value.trim()) {
      imageUrl = document.getElementById('itemExistingImageUrl').value.trim();
    }

    const itemPayload = {
      name,
      category,
      price,
      sizes,
      tags,
      description,
      available,
      imageUrl: imageUrl || null,
      flavors: hasWings ? ['Original', 'Buffalo', 'Honey Garlic', 'Garlic Parmesan', 'BBQ', 'Spicy'] : [],
      eggOptions: hasEggs ? ['Sunny Side Up', 'Scrambled', 'Hard-boiled'] : [],
      customization: hasMilkSugar ? {
        milk: ['Whole', 'Oat', 'Almond'],
        sugar: ['Less', 'Regular', 'Extra']
      } : {}
    };

    if (id) {
      await menuService.updateItem(id, itemPayload);
      showToast(`Updated "${name}" in Firestore`, 'success');
    } else {
      await menuService.addItem(itemPayload);
      showToast(`Added "${name}" to Firestore`, 'success');
    }

    closeItemModal();
  } catch (error) {
    console.error('Error saving item:', error);
    showToast('Failed to save item: ' + error.message, 'error');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalBtnHtml;
    }
  }
}

async function seedMenuItems() {
  try {
    showToast('Seeding 45 items to Firestore collection...', 'info');
    const count = await menuService.bulkImport();
    showToast(`Successfully seeded ${count} menu items to Firestore!`, 'success');
  } catch (err) {
    showToast('Seeding error: ' + err.message, 'error');
  }
}

// ---------- Admin Staff CRUD ----------
function loadStaff() {
  staffService.subscribeToStaff((list) => {
    allStaff = list;
    renderStaffList();
  });
}

function renderStaffList() {
  const container = document.getElementById('staffList');
  if (!container) return;

  if (allStaff.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1/-1; text-align:center; padding:3rem 1rem; color:var(--brown-500); background:var(--white); border-radius:var(--radius); border:1.5px dashed var(--brown-200);">
        <i class="fas fa-users" style="font-size:2.5rem; color:var(--brown-300); margin-bottom:0.75rem;"></i>
        <h4 style="color:var(--brown-800); margin-bottom:0.25rem;">No staff accounts registered</h4>
        <p style="font-size:0.88rem; margin-bottom:1rem;">Add cashiers, managers, or kitchen accounts.</p>
        <button type="button" id="inlineAddStaffBtn" class="btn-primary"><i class="fas fa-user-plus"></i> Add First Staff Account</button>
      </div>
    `;
    document.getElementById('inlineAddStaffBtn')?.addEventListener('click', () => openStaffModal());
    return;
  }

  container.innerHTML = allStaff.map(staff => {
    const isActive = staff.isActive !== false;
    return `
      <div class="admin-staff-card" data-id="${staff.id}">
        <div class="admin-card-top">
          <span class="staff-role-badge ${staff.role}">${staff.role}</span>
          <span class="admin-card-status ${isActive ? 'in' : 'out'}">
            ${isActive ? '● Active' : '✕ Inactive'}
          </span>
        </div>
        <div class="admin-card-body">
          <div class="admin-card-icon staff-avatar">
            <i class="fas fa-user-circle"></i>
          </div>
          <div class="admin-card-info">
            <h4 class="admin-card-title">${staff.name}</h4>
            <p class="admin-card-desc"><i class="fas fa-envelope"></i> ${staff.email || 'PIN Login Only'}</p>
            <p class="admin-card-desc"><i class="fas fa-key"></i> PIN: ••••</p>
          </div>
        </div>
        <div class="admin-card-bottom">
          <div class="admin-card-actions" style="margin-left: auto;">
            <button type="button" class="edit-staff" data-id="${staff.id}" title="Edit Staff">
              <i class="fas fa-edit"></i> Edit
            </button>
            <button type="button" class="delete-staff delete-btn" data-id="${staff.id}" title="Delete Staff">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  container.querySelectorAll('.edit-staff').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const s = allStaff.find(item => item.id === id);
      if (s) openStaffModal(s);
    });
  });

  container.querySelectorAll('.delete-staff').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      const s = allStaff.find(item => item.id === id);
      if (confirm(`Delete staff account for "${s?.name}" from Firestore?`)) {
        await staffService.deleteStaff(id);
        showToast(`Staff "${s?.name}" removed from Firestore`, 'info');
      }
    });
  });
}

function openStaffModal(staff = null) {
  const modal = document.getElementById('staffModal');
  const title = document.getElementById('staffModalTitle');
  
  document.getElementById('staffId').value = staff ? staff.id : '';
  document.getElementById('staffInputName').value = staff ? staff.name : '';
  document.getElementById('staffInputEmail').value = staff ? staff.email : '';
  document.getElementById('staffInputRole').value = staff ? staff.role : 'cashier';
  document.getElementById('staffInputPin').value = staff ? staff.pin : '1234';
  document.getElementById('staffInputActive').checked = staff ? staff.isActive !== false : true;

  if (title) {
    title.innerHTML = staff ? `<i class="fas fa-user-edit"></i> Edit Staff Account` : `<i class="fas fa-user-plus"></i> Add Staff Account`;
  }

  openModal('staffModal');
}

function closeStaffModal() {
  closeModal('staffModal');
}

async function saveStaff(e) {
  e.preventDefault();
  try {
    const id = document.getElementById('staffId').value;
    const name = document.getElementById('staffInputName').value.trim();
    const email = document.getElementById('staffInputEmail').value.trim();
    const role = document.getElementById('staffInputRole').value;
    const pin = document.getElementById('staffInputPin').value.trim();
    const isActive = document.getElementById('staffInputActive').checked;

    const payload = { name, email, role, pin, isActive };

    if (id) {
      await staffService.updateStaff(id, payload);
      showToast(`Updated staff "${name}" in Firestore`, 'success');
    } else {
      await staffService.addStaff(payload);
      showToast(`Added staff "${name}" to Firestore`, 'success');
    }

    closeStaffModal();
  } catch (error) {
    console.error('Error saving staff:', error);
    showToast('Failed to save staff: ' + error.message, 'error');
  }
}

// ---------- Store Settings CRUD ----------
async function saveStoreSettings(e) {
  e.preventDefault();
  try {
    const name = document.getElementById('settingStoreName').value.trim();
    const tagline = document.getElementById('settingTagline').value.trim();
    const location = document.getElementById('settingLocation').value.trim();
    const contact = document.getElementById('settingContact').value.trim();
    const email = document.getElementById('settingEmail').value.trim();
    const social = document.getElementById('settingSocial').value.trim();
    const taxRate = parseFloat(document.getElementById('settingTaxRate').value) / 100;
    const takeoutTaxRate = parseFloat(document.getElementById('settingTakeoutTaxRate').value) / 100;
    const receiptFooter = document.getElementById('settingReceiptFooter').value.trim();
    const hoursDisplay = document.getElementById('settingHours').value.trim();

    await settingsService.updateSettings({
      name,
      tagline,
      location,
      contact,
      email,
      social,
      taxRate,
      takeoutTaxRate,
      receipt: {
        header: name,
        tagline: tagline,
        footer: receiptFooter,
        social: social,
        thankYou: '☕ Thank you for your order!'
      },
      hoursDisplay
    });

    currentStoreSettings = {
      ...currentStoreSettings,
      name,
      tagline,
      location,
      contact,
      email,
      social,
      taxRate,
      takeoutTaxRate,
      hoursDisplay
    };

    updateStoreSettingsUI();
    updateCartUI();

    showToast('Store settings saved to Firestore!', 'success');
  } catch (error) {
    console.error('Error updating settings:', error);
    showToast('Failed to save settings: ' + error.message, 'error');
  }
}

// ---------- Analytics & Reports ----------
function updateAnalytics() {
  const todayStr = new Date().toDateString();
  const todayOrders = orders.filter(o => {
    const d = o.createdAt instanceof Date ? o.createdAt : new Date(o.createdAt);
    return d.toDateString() === todayStr && o.status !== 'Cancelled';
  });

  const revenue = todayOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
  let totalItems = 0;
  const itemCounts = {};
  const categoryTotals = {};
  const paymentTotals = {};

  todayOrders.forEach(o => {
    const pay = o.payment?.type || 'Cash';
    paymentTotals[pay] = (paymentTotals[pay] || 0) + (Number(o.total) || 0);

    (o.items || []).forEach(i => {
      totalItems += i.qty;
      itemCounts[i.name] = (itemCounts[i.name] || 0) + i.qty;
      
      const cat = i.category || 'General';
      categoryTotals[cat] = (categoryTotals[cat] || 0) + (i.price * i.qty);
    });
  });

  let topItemName = '-';
  let maxCount = 0;
  for (const [name, count] of Object.entries(itemCounts)) {
    if (count > maxCount) {
      maxCount = count;
      topItemName = `${name} (${count})`;
    }
  }

  const revEl = document.getElementById('todayRevenue');
  const ordEl = document.getElementById('todayOrders');
  const itmEl = document.getElementById('todayItems');
  const topEl = document.getElementById('topItem');

  if (revEl) revEl.textContent = `₱${revenue.toFixed(2)}`;
  if (ordEl) ordEl.textContent = todayOrders.length;
  if (itmEl) itmEl.textContent = totalItems;
  if (topEl) topEl.textContent = topItemName;

  // Render Category Breakdown List
  const catListEl = document.getElementById('categoryBreakdownList');
  if (catListEl) {
    const entries = Object.entries(categoryTotals);
    if (entries.length === 0) {
      catListEl.innerHTML = '<div style="color:var(--brown-500);font-size:0.85rem;">No category sales recorded today.</div>';
    } else {
      catListEl.innerHTML = entries.map(([cat, total]) => `
        <div class="breakdown-item">
          <span class="breakdown-item-label">${cat}</span>
          <span class="breakdown-item-val">₱${total.toFixed(2)}</span>
        </div>
      `).join('');
    }
  }

  // Render Payment Breakdown List
  const payListEl = document.getElementById('paymentBreakdownList');
  if (payListEl) {
    const entries = Object.entries(paymentTotals);
    if (entries.length === 0) {
      payListEl.innerHTML = '<div style="color:var(--brown-500);font-size:0.85rem;">No payments recorded today.</div>';
    } else {
      payListEl.innerHTML = entries.map(([pay, total]) => `
        <div class="breakdown-item">
          <span class="breakdown-item-label">${pay}</span>
          <span class="breakdown-item-val">₱${total.toFixed(2)}</span>
        </div>
      `).join('');
    }
  }
}

// ---------- Event Listeners Setup ----------
function setupEventListeners() {
  // Navigation sidebar
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      switchPage(item.dataset.page);
    });
  });

  // Search inputs
  const searchInput = document.getElementById('menuSearch');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value;
      filterAndRenderMenu();
    });
  }

  const adminSearchInput = document.getElementById('adminMenuSearch');
  if (adminSearchInput) {
    adminSearchInput.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase().trim();
      const filtered = allMenuItems.filter(i => 
        i.name.toLowerCase().includes(q) ||
        i.category.toLowerCase().includes(q) ||
        (i.tags && i.tags.some(t => t.toLowerCase().includes(q))) ||
        (i.description && i.description.toLowerCase().includes(q))
      );
      renderAdminMenuList(filtered);
    });
  }

  // Clear cart
  document.getElementById('clearCartBtn')?.addEventListener('click', clearCart);

  // Order type toggle in cart (Dine-in / Takeout)
  document.querySelectorAll('.order-type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.order-type-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      orderType = btn.dataset.type;

      const tableRow = document.getElementById('tableSelectRow');
      if (tableRow) {
        tableRow.style.display = orderType === 'Dine-in' ? 'flex' : 'none';
      }

      updateCartUI();
    });
  });

  // Discount input
  document.getElementById('discountInput')?.addEventListener('input', updateCartUI);
  document.getElementById('discountType')?.addEventListener('change', updateCartUI);

  // Customization Modal actions
  document.getElementById('closeCustomize')?.addEventListener('click', closeCustomizationModal);
  document.getElementById('cancelCustomize')?.addEventListener('click', closeCustomizationModal);
  document.getElementById('confirmCustomize')?.addEventListener('click', confirmCustomization);

  // Checkout Modal actions
  document.getElementById('checkoutBtn')?.addEventListener('click', openCheckout);
  document.getElementById('closeCheckoutModal')?.addEventListener('click', closeCheckout);
  document.getElementById('cancelCheckout')?.addEventListener('click', closeCheckout);
  document.getElementById('confirmCheckout')?.addEventListener('click', completeOrder);

  // Print Confirmation Modal actions
  document.getElementById('confirmPrintBtn')?.addEventListener('click', () => {
    if (lastCompletedOrder) {
      printService.printReceipt(lastCompletedOrder);
      showToast('Printing receipt...', 'info');
    }
    closeModal('printConfirmModal');
  });

  document.getElementById('skipPrintBtn')?.addEventListener('click', () => {
    closeModal('printConfirmModal');
  });

  // Payment Confirmation Modal actions (for Kiosk / Pending orders)
  document.getElementById('closePaymentConfirmModal')?.addEventListener('click', () => closeModal('paymentConfirmModal'));
  document.getElementById('cancelKioskPayBtn')?.addEventListener('click', () => closeModal('paymentConfirmModal'));
  document.getElementById('confirmKioskPayBtn')?.addEventListener('click', submitKioskPaymentConfirmation);

  document.querySelectorAll('#kioskPaymentMethods .payment-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#kioskPaymentMethods .payment-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const method = btn.dataset.method;
      const cashGroup = document.getElementById('kioskCashAmountGroup');
      if (cashGroup) {
        cashGroup.style.display = method === 'Cash' ? 'block' : 'none';
      }
      calculateKioskChange();
    });
  });

  document.getElementById('kioskPaymentAmount')?.addEventListener('input', calculateKioskChange);

  // Payment method buttons (POS Checkout)
  document.querySelectorAll('.payment-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.payment-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      calculateChange();
    });
  });

  document.getElementById('paymentAmount')?.addEventListener('input', calculateChange);

  // Orders filters
  document.getElementById('orderStatusFilter')?.addEventListener('change', renderOrdersList);
  document.getElementById('orderDateFilter')?.addEventListener('input', renderOrdersList);

  // Admin tabs
  document.querySelectorAll('.admin-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      document.querySelectorAll('.admin-panel').forEach(p => p.classList.remove('active'));
      const target = document.getElementById(tab.dataset.tab);
      if (target) target.classList.add('active');
    });
  });

  // Admin Menu Item Modal & Photo Upload
  document.getElementById('addMenuItemBtn')?.addEventListener('click', () => openItemModal());
  document.getElementById('closeItemModal')?.addEventListener('click', closeItemModal);
  document.getElementById('cancelItemModal')?.addEventListener('click', closeItemModal);
  document.getElementById('itemForm')?.addEventListener('submit', saveItem);
  document.getElementById('importMenuBtn')?.addEventListener('click', seedMenuItems);

  const dropzone = document.getElementById('itemPhotoDropzone');
  const fileInput = document.getElementById('itemPhotoFile');
  if (dropzone && fileInput) {
    dropzone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        handlePhotoFileSelect(e.target.files[0]);
      }
    });

    // Drag & Drop
    ['dragenter', 'dragover'].forEach(eventName => {
      dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.add('drag-over');
      });
    });

    ['dragleave', 'drop'].forEach(eventName => {
      dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.remove('drag-over');
      });
    });

    dropzone.addEventListener('drop', (e) => {
      const dt = e.dataTransfer;
      if (dt && dt.files && dt.files[0]) {
        handlePhotoFileSelect(dt.files[0]);
      }
    });
  }

  document.getElementById('removePhotoBtn')?.addEventListener('click', clearItemPhoto);
  document.getElementById('changePhotoBtn')?.addEventListener('click', () => fileInput?.click());

  // Admin Staff Modal
  document.getElementById('addStaffBtn')?.addEventListener('click', () => openStaffModal());
  document.getElementById('closeStaffModal')?.addEventListener('click', closeStaffModal);
  document.getElementById('cancelStaffModal')?.addEventListener('click', closeStaffModal);
  document.getElementById('staffForm')?.addEventListener('submit', saveStaff);

  // Admin Settings Form
  document.getElementById('settingsForm')?.addEventListener('submit', saveStoreSettings);

  // Login forms
  document.querySelectorAll('.login-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.login-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      document.querySelectorAll('.login-form').forEach(f => f.classList.remove('active'));
      const target = document.getElementById(tab.dataset.tab + 'Login');
      if (target) target.classList.add('active');
    });
  });

  document.getElementById('emailLogin')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    try {
      showToast('Authenticating with Firebase...', 'info');
      currentUser = await authService.login(email, password);
      showToast(`Welcome, ${currentUser?.name || 'Staff'}!`, 'success');
      showMainApp();
      loadMenu();
      initOrders();
      loadStaff();
      updateStaffInfo();
    } catch (error) {
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found') {
        showToast('Account not found! Click the "Register Admin" tab to create your account first.', 'error');
      } else {
        showToast('Login failed: ' + error.message, 'error');
      }
    }
  });

  document.getElementById('pinLogin')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const pin = document.getElementById('loginPin').value;
    try {
      showToast('Verifying PIN in Firestore...', 'info');
      currentUser = await authService.loginWithPIN(pin);
      showToast(`Logged in as ${currentUser?.name} (${currentUser?.role})`, 'success');
      showMainApp();
      loadMenu();
      initOrders();
      loadStaff();
      updateStaffInfo();
    } catch (error) {
      showToast(error.message, 'error');
    }
  });

  // Logout
  document.getElementById('logoutBtn')?.addEventListener('click', async () => {
    if (confirm('Are you sure you want to logout?')) {
      await authService.logout();
      currentUser = null;
      showLogin();
      showToast('Logged out', 'info');
    }
  });
}

export { authService, menuService, orderService, printService, staffService, settingsService };