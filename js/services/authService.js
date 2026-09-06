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

    // Immediately hydrate from localStorage on construction
    // This ensures staffData is available before onAuthStateChanged fires
    try {
      const storedStaff = localStorage.getItem('likha_staffData');
      const storedUser = localStorage.getItem('likha_user');
      if (storedStaff && storedUser) {
        this.staffData = JSON.parse(storedStaff);
        this.currentUser = JSON.parse(storedUser);
      }
    } catch (e) {
      console.warn('localStorage hydration notice:', e);
    }
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
      } else {
        // If auth user exists but no Firestore profile, create admin profile in Firestore
        const newProfile = {
          name: email.split('@')[0],
          email: email,
          role: 'admin',
          pin: '',
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
      }
      
      // Persist to localStorage for refresh fallback - SYNCROUNOUS
      try {
        localStorage.setItem('likha_staffData', JSON.stringify(this.staffData));
        localStorage.setItem('likha_user', JSON.stringify(this.currentUser));
      } catch (e) {
        console.warn('localStorage save notice:', e);
      }
      
      // Update last login in Firestore
      try {
        await updateDoc(doc(db, 'staff', this.currentUser.uid), {
          lastLogin: serverTimestamp()
        });
      } catch (e) {
        console.warn('Firestore lastLogin update notice:', e);
      }
      
      return this.staffData;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }

  // Register / Create new Admin account
  async registerAdmin(name, email, password, pin = '') {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      this.currentUser = userCredential.user;
      
      const adminProfile = {
        name: name || email.split('@')[0],
        email: email,
        role: 'admin',
        pin: pin || '',
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
    // Check localStorage FIRST - synchronous, before any Firebase operations
    // This handles refresh scenarios immediately
    let storedStaff = null;
    let storedUser = null;
    
    try {
      storedStaff = localStorage.getItem('likha_staffData');
      storedUser = localStorage.getItem('likha_user');
    } catch (e) {
      console.warn('localStorage read notice:', e);
    }
    
    // If we have stored data from a previous login, restore it immediately
    if (storedStaff && storedUser) {
      try {
        this.staffData = JSON.parse(storedStaff);
        this.currentUser = JSON.parse(storedUser);
        // Update lastLogin in Firestore background
        try {
          await updateDoc(doc(db, 'staff', this.staffData.uid), {
            lastLogin: serverTimestamp()
          });
        } catch (e) {
          console.warn('Firestore lastLogin update notice:', e);
        }
        return this.staffData;
      } catch (e) {
        console.warn('localStorage parse notice:', e);
        // Fall through to Firestore login
      }
    }

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
        this.currentUser = { uid: staffDoc.id, name: staffDoc.data().name || 'Staff', email: staffDoc.data().email || '' };
        
        // Persist to localStorage for refresh fallback
        try {
          localStorage.setItem('likha_staffData', JSON.stringify(this.staffData));
          localStorage.setItem('likha_user', JSON.stringify(this.currentUser));
        } catch (e) {
          console.warn('localStorage save notice:', e);
        }
        
        await updateDoc(doc(db, 'staff', staffDoc.id), {
          lastLogin: serverTimestamp()
        });
        
        return this.staffData;
      } else {
        throw new Error('Invalid PIN. Please enter a valid 4-digit PIN or sign in with your email account.');
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
      // Clear localStorage
      try {
        localStorage.removeItem('likha_staffData');
        localStorage.removeItem('likha_user');
      } catch (e) {
        console.warn('localStorage clear notice:', e);
      }
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
      // Immediately check localStorage - this is the refresh fallback
      const storedStaff = localStorage.getItem('likha_staffData');
      const storedUser = localStorage.getItem('likha_user');

      if (user) {
        this.currentUser = user;

        // If we have localStorage data, restore from it FIRST (synchronously)
        // Then fall through to Firestore fetch for synchronization
        if (storedStaff && storedUser) {
          // Restore from localStorage - this takes priority on refresh
          this.staffData = JSON.parse(storedStaff);
          // Update lastLogin in Firestore to keep it in sync
          try {
            await updateDoc(doc(db, 'staff', this.staffData.uid), {
              lastLogin: serverTimestamp()
            });
          } catch (e) {
            console.warn('Firestore lastLogin update notice:', e);
          }
        } else {
          // No localStorage - try to fetch from Firestore
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
            // Fallback to localStorage if Firestore fails
            if (storedStaff) {
              this.staffData = JSON.parse(storedStaff);
            }
          }
        }

        // Persist to localStorage again
        try {
          localStorage.setItem('likha_staffData', JSON.stringify(this.staffData));
          localStorage.setItem('likha_user', JSON.stringify(this.currentUser));
        } catch (e) {
          console.warn('localStorage save notice:', e);
        }

        callback(this.staffData || null);
      } else {
        // No Firebase Auth user — check if we have a PIN-based session in localStorage
        const lsStaff = localStorage.getItem('likha_staffData');
        const lsUser = localStorage.getItem('likha_user');

        if (lsStaff && lsUser) {
          // Restore PIN-based session from localStorage
          try {
            this.staffData = JSON.parse(lsStaff);
            this.currentUser = JSON.parse(lsUser);
            callback(this.staffData);
            return; // Keep session alive, do NOT clear
          } catch (e) {
            console.warn('localStorage parse notice during restore:', e);
          }
        }

        // Truly logged out — no Firebase user AND no localStorage session
        this.currentUser = null;
        this.staffData = null;
        try {
          localStorage.removeItem('likha_staffData');
          localStorage.removeItem('likha_user');
        } catch (e) {
          console.warn('localStorage clear notice:', e);
        }
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