import { 
  db,
  collection,
  doc,
  addDoc,
  updateDoc,
  getDocs,
  onSnapshot,
  query,
  where,
  orderBy,
  serverTimestamp
} from '../firebase-config.js';
import storeData from '../data/storeData.js';

class OrderService {
  constructor() {
    this.collectionName = 'orders';
    this.dailySalesCollection = 'dailySales';
    this.orderCountToday = 0;
    this.unsubscribe = null;
    // Offline storage key
    this.offlineKey = 'likha_offline_orders';
  }

  // Generate order number: LIKHA-YYYYMMDD-XXXX
  async generateOrderNumber() {
    try {
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0].replace(/-/g, '');
      
      // Get today's start and end timestamps
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

      const q = query(
        collection(db, this.collectionName),
        where('createdAt', '>=', todayStart),
        where('createdAt', '<', todayEnd)
      );
      const snapshot = await getDocs(q);
      const count = snapshot.size + 1;
      this.orderCountToday = count;
      return `LIKHA-${dateStr}-${String(count).padStart(4, '0')}`;
    } catch (error) {
      // Fallback: use local counter
      this.orderCountToday++;
      const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
      return `LIKHA-${dateStr}-${String(this.orderCountToday).padStart(4, '0')}`;
    }
  }

  // Create order with full details
  async createOrder(orderData) {
    try {
      const orderNumber = await this.generateOrderNumber();
      const now = new Date();
      
      const fullOrder = {
        orderNumber,
        items: orderData.items.map(item => ({
          id: item.id,
          name: item.name,
          qty: item.qty,
          price: item.price,
          total: item.price * item.qty,
          size: item.size || null,
          customization: item.customization || {},
          flavor: item.flavor || null,
          eggOption: item.eggOption || null,
          notes: item.notes || ''
        })),
        subtotal: orderData.subtotal,
        tax: orderData.tax,
        takeoutTax: orderData.takeoutTax || 0,
        discount: orderData.discount || { type: 'none', value: 0, amount: 0 },
        total: orderData.total,
        orderType: orderData.orderType || 'Dine-in',
        tableNumber: orderData.tableNumber || null,
        customer: orderData.customer || { name: 'Walk-in' },
        payment: {
          type: orderData.payment?.type || 'Cash',
          amount: orderData.payment?.amount || orderData.total,
          change: orderData.payment?.change || 0,
          status: orderData.payment?.status || (orderData.status === 'Preparing' ? 'Paid' : 'Unpaid')
        },
        status: orderData.status || 'Pending',
        source: orderData.source || 'pos',
        staff: {
          id: orderData.staff?.uid || orderData.staff?.id || 'unknown',
          name: orderData.staff?.name || 'Staff'
        },
        notes: orderData.notes || '',
        createdAt: now,
        updatedAt: now,
        completedAt: null
      };

      try {
        // Try saving to Firestore
        const docRef = await addDoc(collection(db, this.collectionName), {
          ...fullOrder,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        console.log('✅ Order saved to Firestore:', orderNumber);
        return { id: docRef.id, ...fullOrder };
      } catch (firebaseError) {
        // Offline fallback: save to LocalStorage
        console.warn('⚠️ Saving order offline:', firebaseError.message);
        return this.saveOffline(fullOrder);
      }
    } catch (error) {
      console.error('Error creating order:', error);
      throw error;
    }
  }

  // Confirm payment & mark order as Preparing
  async confirmPaymentAndPrepare(orderId, paymentData = {}) {
    try {
      const docRef = doc(db, this.collectionName, orderId);
      const updateData = {
        status: 'Preparing',
        'payment.type': paymentData.type || 'Cash',
        'payment.amount': paymentData.amount || paymentData.total || 0,
        'payment.change': paymentData.change || 0,
        'payment.status': 'Paid',
        'payment.paidAt': serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      
      await updateDoc(docRef, updateData);
      console.log(`✅ Order ${orderId} payment confirmed & marked Preparing`);
    } catch (error) {
      console.error('Error confirming payment & preparing order:', error);
      throw error;
    }
  }

  // Save order to LocalStorage (offline mode)
  saveOffline(order) {
    const offlineOrders = JSON.parse(localStorage.getItem(this.offlineKey) || '[]');
    const offlineId = `offline-${Date.now()}`;
    const savedOrder = { id: offlineId, ...order, isOffline: true };
    offlineOrders.push(savedOrder);
    localStorage.setItem(this.offlineKey, JSON.stringify(offlineOrders));
    console.log('💾 Order saved offline:', order.orderNumber);
    return savedOrder;
  }

  // Sync offline orders to Firestore when back online
  async syncOfflineOrders() {
    const offlineOrders = JSON.parse(localStorage.getItem(this.offlineKey) || '[]');
    if (offlineOrders.length === 0) return 0;

    let synced = 0;
    for (const order of offlineOrders) {
      try {
        delete order.id;
        delete order.isOffline;
        await addDoc(collection(db, this.collectionName), {
          ...order,
          syncedAt: serverTimestamp()
        });
        synced++;
      } catch (error) {
        console.error('Error syncing order:', error);
      }
    }

    if (synced > 0) {
      localStorage.setItem(this.offlineKey, '[]');
      console.log(`✅ Synced ${synced} offline orders to Firestore`);
    }
    return synced;
  }

  // Subscribe to real-time orders
  subscribeToOrders(callback, filters = {}) {
    try {
      let constraints = [orderBy('createdAt', 'desc')];
      
      if (filters.status && filters.status !== 'all') {
        constraints = [where('status', '==', filters.status), ...constraints];
      }

      const q = query(collection(db, this.collectionName), ...constraints);
      
      this.unsubscribe = onSnapshot(q, (snapshot) => {
        const orders = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          orders.push({ 
            id: doc.id, 
            ...data,
            // Convert Firestore timestamps to Date
            createdAt: data.createdAt?.toDate?.() || data.createdAt,
            updatedAt: data.updatedAt?.toDate?.() || data.updatedAt,
            completedAt: data.completedAt?.toDate?.() || data.completedAt
          });
        });
        callback(orders);
      }, (error) => {
        console.warn('⚠️ Orders offline, loading from localStorage');
        const offlineOrders = JSON.parse(localStorage.getItem(this.offlineKey) || '[]');
        callback(offlineOrders.reverse());
      });

      return this.unsubscribe;
    } catch (error) {
      console.error('Error subscribing to orders:', error);
      const offlineOrders = JSON.parse(localStorage.getItem(this.offlineKey) || '[]');
      callback(offlineOrders.reverse());
    }
  }

  // Get today's orders for counter
  async getTodaysOrderCount() {
    try {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      const q = query(
        collection(db, this.collectionName),
        where('createdAt', '>=', todayStart)
      );
      const snapshot = await getDocs(q);
      this.orderCountToday = snapshot.size;
      return snapshot.size;
    } catch (error) {
      return this.orderCountToday;
    }
  }

  // Update order status
  async updateStatus(orderId, status) {
    try {
      const docRef = doc(db, this.collectionName, orderId);
      const updateData = {
        status,
        updatedAt: serverTimestamp()
      };
      
      if (status === 'Completed') {
        updateData.completedAt = serverTimestamp();
      }
      
      await updateDoc(docRef, updateData);
      console.log(`✅ Order ${orderId} → ${status}`);
    } catch (error) {
      console.error('Error updating order status:', error);
      throw error;
    }
  }

  // Cancel order
  async cancelOrder(orderId, reason = '') {
    try {
      const docRef = doc(db, this.collectionName, orderId);
      await updateDoc(docRef, {
        status: 'Cancelled',
        cancelReason: reason,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error cancelling order:', error);
      throw error;
    }
  }

  // Calculate order totals (Declared prices are VAT-inclusive)
  static calculateTotals(items, orderType = 'Dine-in', discountValue = 0, discountType = 'percentage', customTaxRate = null, customTakeoutTaxRate = null) {
    const activeTaxRate = customTaxRate !== null ? customTaxRate : storeData.taxRate;
    const activeTakeoutTaxRate = customTakeoutTaxRate !== null ? customTakeoutTaxRate : storeData.takeoutTaxRate;

    const subtotal = items.reduce((sum, item) => sum + (item.price * item.qty), 0);
    // Prices are VAT-inclusive: calculate included VAT component without adding to total
    const tax = activeTaxRate > 0 ? (subtotal - (subtotal / (1 + activeTaxRate))) : 0;
    const takeoutTax = orderType === 'Takeout' && activeTakeoutTaxRate > 0 ? subtotal * activeTakeoutTaxRate : 0;
    
    let discountAmount = 0;
    if (discountType === 'percentage') {
      discountAmount = subtotal * (discountValue / 100);
    } else {
      discountAmount = discountValue;
    }
    
    // Total is subtotal minus discount (VAT is already included in item prices)
    const total = subtotal - discountAmount + takeoutTax;
    
    return {
      subtotal: Math.round(subtotal * 100) / 100,
      tax: Math.round(tax * 100) / 100,
      takeoutTax: Math.round(takeoutTax * 100) / 100,
      taxRate: activeTaxRate,
      takeoutTaxRate: activeTakeoutTaxRate,
      discount: {
        type: discountType,
        value: discountValue,
        amount: Math.round(discountAmount * 100) / 100
      },
      total: Math.round(Math.max(0, total) * 100) / 100
    };
  }

  // Cleanup
  destroy() {
    if (this.unsubscribe) {
      this.unsubscribe();
    }
  }
}

export default OrderService;