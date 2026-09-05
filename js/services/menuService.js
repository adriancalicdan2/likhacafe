import { 
  db,
  storage,
  ref,
  uploadBytes,
  getDownloadURL,
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  writeBatch
} from '../firebase-config.js';
import { menuData } from '../data/menuData.js';

class MenuService {
  constructor() {
    this.collectionName = 'menuItems';
    this.localItems = [...menuData]; // Offline fallback
    this.isOnline = true;
    this.unsubscribe = null;
  }

  // Real-time listener with offline fallback
  subscribeToMenu(callback) {
    try {
      const q = query(
        collection(db, this.collectionName),
        orderBy('category'),
        orderBy('name')
      );
      
      this.unsubscribe = onSnapshot(q, (snapshot) => {
        if (snapshot.empty && this.localItems.length > 0) {
          // Firestore is empty — use local data
          console.log('📋 Using local menu data (Firestore empty)');
          this.isOnline = true;
          callback(this.localItems);
        } else {
          const items = [];
          snapshot.forEach((doc) => {
            items.push({ id: doc.id, ...doc.data() });
          });
          this.isOnline = true;
          callback(items.length > 0 ? items : this.localItems);
        }
      }, (error) => {
        console.warn('⚠️ Firestore offline, using local menu:', error.message);
        this.isOnline = false;
        callback(this.localItems);
      });

      return this.unsubscribe;
    } catch (error) {
      console.warn('⚠️ Firestore unavailable, using local menu');
      this.isOnline = false;
      callback(this.localItems);
    }
  }

  // Get local menu data (no Firebase needed)
  getLocalMenu() {
    return this.localItems;
  }

  // Filter by category locally
  getByCategory(category) {
    if (category === 'all') return this.localItems;
    return this.localItems.filter(item => item.category === category);
  }

  // Search items locally
  searchItems(queryStr) {
    const q = queryStr.toLowerCase();
    return this.localItems.filter(item =>
      item.name.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q) ||
      (item.tags && item.tags.some(tag => tag.toLowerCase().includes(q))) ||
      (item.description && item.description.toLowerCase().includes(q))
    );
  }

  // Bulk import all menu items to Firestore
  async bulkImport(items = null) {
    const data = items || this.localItems;
    try {
      const batch = writeBatch(db);
      
      data.forEach((item) => {
        const docRef = doc(collection(db, this.collectionName));
        batch.set(docRef, {
          ...item,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      });

      await batch.commit();
      console.log(`✅ Imported ${data.length} menu items to Firestore`);
      return data.length;
    } catch (error) {
      console.error('Error bulk importing:', error);
      throw error;
    }
  }

  // Add item
  async addItem(itemData) {
    try {
      const docRef = await addDoc(collection(db, this.collectionName), {
        ...itemData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      return { id: docRef.id, ...itemData };
    } catch (error) {
      console.error('Error adding item:', error);
      throw error;
    }
  }

  // Update item
  async updateItem(id, itemData) {
    try {
      const docRef = doc(db, this.collectionName, id);
      await updateDoc(docRef, {
        ...itemData,
        updatedAt: serverTimestamp()
      });
      return { id, ...itemData };
    } catch (error) {
      console.error('Error updating item:', error);
      throw error;
    }
  }

  // Delete item
  async deleteItem(id) {
    try {
      const docRef = doc(db, this.collectionName, id);
      await deleteDoc(docRef);
      return id;
    } catch (error) {
      console.error('Error deleting item:', error);
      throw error;
    }
  }

  // Upload item image to Firebase Storage
  async uploadItemImage(file, itemId = null) {
    if (!file) return null;
    try {
      const fileExt = file.name ? file.name.split('.').pop() : 'jpg';
      const cleanId = (itemId || 'item_' + Date.now()).replace(/[^a-zA-Z0-9_-]/g, '_');
      const filename = `menu_items/${cleanId}_${Date.now()}.${fileExt}`;
      const storageRef = ref(storage, filename);
      
      const snapshot = await uploadBytes(storageRef, file, {
        contentType: file.type || 'image/jpeg'
      });
      const downloadURL = await getDownloadURL(snapshot.ref);
      console.log('📸 Menu photo uploaded to Firebase Storage:', downloadURL);
      return downloadURL;
    } catch (error) {
      console.warn('⚠️ Firebase Storage upload failed, falling back to base64 data URL:', error.message);
      // Fallback: convert to base64 Data URL if storage bucket is not configured or offline
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = (err) => reject(err);
        reader.readAsDataURL(file);
      });
    }
  }

  // Cleanup
  destroy() {
    if (this.unsubscribe) {
      this.unsubscribe();
    }
  }
}

export default MenuService;