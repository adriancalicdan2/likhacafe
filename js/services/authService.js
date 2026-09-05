import { 
  auth, 
  db,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  collection,
  query,
  where,
  serverTimestamp
} from '../firebase-config.js';

class AuthService {
  constructor() {
    this.currentUser = null;
    this.staffData = null;
  }

  // Login with email/password
  async login(email, password) {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      this.currentUser = userCredential.user;
      
      // Get staff data from Firestore staff collection
      const staffDoc = await getDoc(doc(db, 'staff', this.currentUser.uid));
      if (staffDoc.exists()) {
        this.staffData = { uid: this.currentUser.uid, ...staffDoc.data() };
        await updateDoc(doc(db, 'staff', this.currentUser.uid), {
          lastLogin: serverTimestamp()
        });
        return this.staffData;
      } else {
        // If auth user exists but no Firestore profile, create admin profile in Firestore
        const newProfile = {
          name: email.split('@')[0],
          email: email,
          role: 'admin',
          pin: '1234',
          isActive: true,
          permissions: {
            canTakeOrders: true,
            canProcessPayments: true,
            canVoidOrders: true,
            canViewOrders: true,
            canEditMenu: true,
            canManageStaff: true,
            canViewReports: true,
            canEditSettings: true
          },
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          lastLogin: serverTimestamp()
        };
        await setDoc(doc(db, 'staff', this.currentUser.uid), newProfile);
        this.staffData = { uid: this.currentUser.uid, ...newProfile };
        return this.staffData;
      }
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }

  // Register / Create new Admin account
  async registerAdmin(name, email, password, pin = '1234') {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      this.currentUser = userCredential.user;
      
      const adminProfile = {
        name: name || email.split('@')[0],
        email: email,
        role: 'admin',
        pin: pin || '1234',
        isActive: true,
        permissions: {
          canTakeOrders: true,
          canProcessPayments: true,
          canVoidOrders: true,
          canViewOrders: true,
          canEditMenu: true,
          canManageStaff: true,
          canViewReports: true,
          canEditSettings: true
        },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        lastLogin: serverTimestamp()
      };
      
      await setDoc(doc(db, 'staff', this.currentUser.uid), adminProfile);
      this.staffData = { uid: this.currentUser.uid, ...adminProfile };
      return this.staffData;
    } catch (error) {
      console.error('Register admin error:', error);
      throw error;
    }
  }

  // Quick login with PIN via Firestore query
  async loginWithPIN(pin) {
    try {
      const q = query(
        collection(db, 'staff'),
        where('pin', '==', pin),
        where('isActive', '==', true)
      );
      const snapshot = await getDocs(q);
      
      if (!snapshot.empty) {
        const staffDoc = snapshot.docs[0];
        this.staffData = { uid: staffDoc.id, ...staffDoc.data() };
        
        await updateDoc(doc(db, 'staff', staffDoc.id), {
          lastLogin: serverTimestamp()
        });
        
        return this.staffData;
      } else {
        // Self-bootstrapping: If Firestore staff is empty and pin is 1234, create admin!
        try {
          const allStaffSnap = await getDocs(collection(db, 'staff'));
          if (allStaffSnap.empty && pin === '1234') {
            const newAdmin = {
              name: 'Admin',
              email: 'admin@likhacafe.com',
              role: 'admin',
              pin: '1234',
              isActive: true,
              permissions: {
                canTakeOrders: true,
                canProcessPayments: true,
                canVoidOrders: true,
                canViewOrders: true,
                canEditMenu: true,
                canManageStaff: true,
                canViewReports: true,
                canEditSettings: true
              },
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
              lastLogin: serverTimestamp()
            };
            const docRef = await addDoc(collection(db, 'staff'), newAdmin);
            this.staffData = { uid: docRef.id, ...newAdmin };
            console.log('✅ Auto-created default Admin profile in Firestore staff collection');
            return this.staffData;
          }
        } catch (e) {
          console.warn('Auto-admin notice:', e);
        }

        throw new Error('Invalid PIN. Use default PIN 1234 for initial login.');
      }
    } catch (error) {
      console.error('PIN login error:', error);
      throw error;
    }
  }

  // Logout
  async logout() {
    try {
      await signOut(auth);
      this.currentUser = null;
      this.staffData = null;
      return true;
    } catch (error) {
      console.error('Logout error:', error);
      throw error;
    }
  }

  // Check if user is admin
  isAdmin() {
    return this.staffData?.role === 'admin' || this.staffData?.role === 'manager';
  }

  // Check permissions
  hasPermission(permission) {
    if (this.staffData?.role === 'admin') return true;
    return this.staffData?.permissions?.[permission] || false;
  }

  // Auth state observer
  onAuthStateChange(callback) {
    return onAuthStateChanged(auth, async (user) => {
      if (user) {
        this.currentUser = user;
        try {
          const staffDoc = await getDoc(doc(db, 'staff', user.uid));
          if (staffDoc.exists()) {
            this.staffData = { uid: user.uid, ...staffDoc.data() };
          } else {
            this.staffData = {
              uid: user.uid,
              name: user.email?.split('@')[0] || 'Staff',
              email: user.email,
              role: 'admin'
            };
          }
        } catch (error) {
          console.error('Error fetching staff profile:', error);
        }
        callback(this.staffData || null);
      } else if (this.staffData) {
        // Logged in via PIN
        callback(this.staffData);
      } else {
        this.currentUser = null;
        this.staffData = null;
        callback(null);
      }
    });
  }

  // Get current user
  getCurrentUser() {
    return this.staffData;
  }
}

export default AuthService;