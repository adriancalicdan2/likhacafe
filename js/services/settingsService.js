import { 
  db,
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  serverTimestamp
} from '../firebase-config.js';
import storeData from '../data/storeData.js';

class SettingsService {
  constructor() {
    this.docRef = doc(db, 'settings', 'storeInfo');
    this.currentSettings = { ...storeData };
    this.unsubscribe = null;
  }

  // Subscribe to store settings
  subscribeToSettings(callback) {
    try {
      this.unsubscribe = onSnapshot(this.docRef, (docSnap) => {
        if (docSnap.exists()) {
          this.currentSettings = { ...storeData, ...docSnap.data() };
          callback(this.currentSettings);
        } else {
          // If document doesn't exist yet, initialize it in Firestore
          this.initSettings(storeData).then(() => {
            callback(this.currentSettings);
          }).catch(() => {
            callback(this.currentSettings);
          });
        }
      }, (error) => {
        console.warn('Settings snapshot error:', error.message);
        callback(this.currentSettings);
      });
      return this.unsubscribe;
    } catch (error) {
      console.warn('Settings error:', error.message);
      callback(this.currentSettings);
    }
  }

  // Initialize settings in Firestore
  async initSettings(data) {
    try {
      await setDoc(this.docRef, {
        ...data,
        updatedAt: serverTimestamp()
      });
      this.currentSettings = { ...data };
    } catch (error) {
      console.error('Error initializing settings:', error);
    }
  }

  // Update store settings in Firestore
  async updateSettings(settingsData) {
    try {
      const merged = {
        ...this.currentSettings,
        ...settingsData,
        updatedAt: serverTimestamp()
      };
      await setDoc(this.docRef, merged, { merge: true });
      this.currentSettings = merged;
      return merged;
    } catch (error) {
      console.error('Error saving settings to Firestore:', error);
      throw error;
    }
  }

  getSettings() {
    return this.currentSettings;
  }

  destroy() {
    if (this.unsubscribe) this.unsubscribe();
  }
}

export default SettingsService;
