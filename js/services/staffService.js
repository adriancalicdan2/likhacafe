import { 
  db,
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp
} from '../firebase-config.js';

class StaffService {
  constructor() {
    this.collectionName = 'staff';
    this.unsubscribe = null;
  }

  // Subscribe to all staff members
  subscribeToStaff(callback) {
    try {
      const q = query(collection(db, this.collectionName), orderBy('name', 'asc'));
      this.unsubscribe = onSnapshot(q, (snapshot) => {
        const staffList = [];
        snapshot.forEach((docSnap) => {
          staffList.push({ id: docSnap.id, ...docSnap.data() });
        });
        callback(staffList);
      }, (error) => {
        console.error('Error fetching staff list:', error);
        callback([]);
      });
      return this.unsubscribe;
    } catch (error) {
      console.error('Staff subscribe error:', error);
      callback([]);
    }
  }

  // Get all staff once
  async getStaff() {
    try {
      const snapshot = await getDocs(collection(db, this.collectionName));
      const staffList = [];
      snapshot.forEach(docSnap => {
        staffList.push({ id: docSnap.id, ...docSnap.data() });
      });
      return staffList;
    } catch (error) {
      console.error('Error getting staff:', error);
      return [];
    }
  }

  // Add a new staff member to Firestore
  async addStaff(staffData) {
    try {
      if (!staffData.pin || staffData.pin.length !== 4) {
        throw new Error('A 4-digit PIN is required for staff members.');
      }
      const docRef = await addDoc(collection(db, this.collectionName), {
        name: staffData.name,
        email: staffData.email || '',
        role: staffData.role || 'cashier',
        pin: staffData.pin,
        isActive: staffData.isActive !== false,
        permissions: this.getDefaultPermissions(staffData.role || 'cashier'),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        lastLogin: null
      });
      return { id: docRef.id, ...staffData };
    } catch (error) {
      console.error('Error adding staff:', error);
      throw error;
    }
  }

  // Update staff member
  async updateStaff(id, staffData) {
    try {
      const docRef = doc(db, this.collectionName, id);
      const updatePayload = {
        name: staffData.name,
        email: staffData.email || '',
        role: staffData.role,
        pin: staffData.pin,
        isActive: staffData.isActive !== false,
        permissions: this.getDefaultPermissions(staffData.role),
        updatedAt: serverTimestamp()
      };
      await updateDoc(docRef, updatePayload);
      return { id, ...updatePayload };
    } catch (error) {
      console.error('Error updating staff:', error);
      throw error;
    }
  }

  // Delete staff member
  async deleteStaff(id) {
    try {
      const docRef = doc(db, this.collectionName, id);
      await deleteDoc(docRef);
      return id;
    } catch (error) {
      console.error('Error deleting staff:', error);
      throw error;
    }
  }

  // Helper for role-based permissions
  getDefaultPermissions(role) {
    switch (role) {
      case 'admin':
        return {
          canTakeOrders: true,
          canProcessPayments: true,
          canVoidOrders: true,
          canViewOrders: true,
          canEditMenu: true,
          canManageStaff: true,
          canViewReports: true,
          canEditSettings: true
        };
      case 'manager':
        return {
          canTakeOrders: true,
          canProcessPayments: true,
          canVoidOrders: true,
          canViewOrders: true,
          canEditMenu: true,
          canManageStaff: false,
          canViewReports: true,
          canEditSettings: false
        };
      case 'cashier':
        return {
          canTakeOrders: true,
          canProcessPayments: true,
          canVoidOrders: false,
          canViewOrders: true,
          canEditMenu: false,
          canManageStaff: false,
          canViewReports: false,
          canEditSettings: false
        };
      case 'kitchen':
        return {
          canTakeOrders: false,
          canProcessPayments: false,
          canVoidOrders: false,
          canViewOrders: true,
          canEditMenu: false,
          canManageStaff: false,
          canViewReports: false,
          canEditSettings: false
        };
      default:
        return {};
    }
  }

  destroy() {
    if (this.unsubscribe) this.unsubscribe();
  }
}

export default StaffService;
