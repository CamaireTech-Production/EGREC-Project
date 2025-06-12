import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { v4 as uuidv4 } from 'uuid';
import CryptoJS from 'crypto-js';

// Encryption key - in production this should be stored securely
const ENCRYPTION_KEY = 'your-secure-key-here';

interface OfflineSale {
  id: string;
  syncId: string;
  timestamp: number;
  productName: string[];
  quantity: number[];
  unitPrice: number[];
  productCategory: string[];
  productReference: string[];
  totalAmount: number;
  recordedBy: string;
  userUID: string;
  synced: number;
  syncAttempts?: number;
  lastSyncAttempt?: number;
  cashReceived: number;
  changeDue: number;
  company: string;
  agency: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface EncryptedData {
  id: string;
  syncId: string;
  data: string;
  synced: number;
  timestamp: number;
}

interface OfflineDB extends DBSchema {
  'offline-sales': {
    key: string;
    value: EncryptedData;
    indexes: {
      'by-sync-status': number;
      'by-timestamp': number;
      'by-sync-id': string;
    };
  };
}

let db: IDBPDatabase<OfflineDB>;

const encrypt = (data: any): string => {
  try {
    if (data === null || data === undefined) {
      throw new Error('Cannot encrypt null or undefined data');
    }

    if (!data.id || !data.syncId) {
      throw new Error('Data must have id and syncId properties');
    }

    const jsonString = JSON.stringify(data);
    if (!jsonString) {
      throw new Error('Failed to stringify data for encryption');
    }

    const encrypted = CryptoJS.AES.encrypt(jsonString, ENCRYPTION_KEY);
    if (!encrypted) {
      throw new Error('Encryption operation failed');
    }

    return encrypted.toString();
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error(`Failed to encrypt data: ${error.message}`);
  }
};

const decrypt = (encryptedData: string): any => {
  try {
    if (!encryptedData) {
      console.warn('Attempted to decrypt empty or null data');
      return null;
    }

    const bytes = CryptoJS.AES.decrypt(encryptedData, ENCRYPTION_KEY);
    if (!bytes) {
      throw new Error('Decryption operation failed');
    }

    const decryptedString = bytes.toString(CryptoJS.enc.Utf8);
    if (!decryptedString) {
      console.warn('Decryption resulted in empty string');
      return null;
    }

    try {
      const parsed = JSON.parse(decryptedString);
      if (!parsed || typeof parsed !== 'object' || !parsed.id || !parsed.syncId) {
        throw new Error('Decrypted data is not a valid object or missing required fields');
      }
      return parsed;
    } catch (jsonError) {
      console.error('Failed to parse decrypted JSON:', jsonError);
      return null;
    }
  } catch (error) {
    console.error('Decryption error:', error);
    return null;
  }
};

export const initDB = async () => {
  db = await openDB<OfflineDB>('egrec-pos', 11, {
    upgrade(db, oldVersion, newVersion, transaction) {
      if (db.objectStoreNames.contains('offline-sales')) {
        db.deleteObjectStore('offline-sales');
      }

      const salesStore = db.createObjectStore('offline-sales', {
        keyPath: 'id'
      });
      salesStore.createIndex('by-sync-status', 'synced');
      salesStore.createIndex('by-timestamp', 'timestamp');
      salesStore.createIndex('by-sync-id', 'syncId', { unique: true });
    },
  });

  await cleanupOldSales();
};

export const saveOfflineSale = async (saleData: Omit<OfflineSale, 'id' | 'synced' | 'syncAttempts' | 'lastSyncAttempt' | 'syncId'>) => {
  if (!db) await initDB();
  
  const id = uuidv4();
  const syncId = saleData.syncId || uuidv4();

  if (!id || !syncId) {
    throw new Error('Failed to generate valid IDs for offline sale');
  }

  const offlineSale: OfflineSale = {
    ...saleData,
    id,
    syncId,
    synced: 0,
    syncAttempts: 0,
    lastSyncAttempt: Date.now(),
    timestamp: Date.now()
  };
  
  try {
    if (!offlineSale.id || !offlineSale.timestamp || !offlineSale.productName) {
      throw new Error('Invalid sale data: missing required properties');
    }

    const existingSale = await db.getFromIndex('offline-sales', 'by-sync-id', syncId);
    if (existingSale) {
      throw new Error('Sale with this syncId already exists');
    }

    const encryptedSale = encrypt(offlineSale);
    
    const encryptedData: EncryptedData = {
      id: offlineSale.id,
      syncId: offlineSale.syncId,
      data: encryptedSale,
      synced: offlineSale.synced,
      timestamp: Date.now()
    };
    
    const testDecrypt = decrypt(encryptedSale);
    if (!testDecrypt || !testDecrypt.id || !testDecrypt.syncId) {
      throw new Error('Encryption validation failed');
    }
    
    await db.put('offline-sales', encryptedData);
    return offlineSale;
  } catch (error) {
    console.error('Error saving offline sale:', error);
    throw new Error(`Failed to save offline sale: ${error.message}`);
  }
};

export const getUnsynedSales = async () => {
  if (!db) await initDB();
  
  try {
    const tx = db.transaction('offline-sales', 'readonly');
    const store = tx.objectStore('offline-sales');
    const index = store.index('by-sync-status');
    const unsynced = await index.getAll(0);
    
    return unsynced
      .map(sale => {
        try {
          const decryptedSale = decrypt(sale.data);
          return decryptedSale && decryptedSale.synced === 0 ? decryptedSale : null;
        } catch (error) {
          console.error('Error decrypting sale:', error);
          return null;
        }
      })
      .filter((sale): sale is OfflineSale => sale !== null);
  } catch (error) {
    console.error('Error getting unsynced sales:', error);
    return [];
  }
};

export const markSaleAsSynced = async (id: string, syncId: string) => {
  if (!db) await initDB();
  const tx = db.transaction('offline-sales', 'readwrite');
  const store = tx.objectStore('offline-sales');
  
  try {
    const encryptedData = await store.get(id);
    if (!encryptedData || encryptedData.syncId !== syncId) {
      throw new Error('Sale not found or syncId mismatch');
    }

    const sale = decrypt(encryptedData.data);
    if (!sale) {
      throw new Error('Failed to decrypt sale data');
    }

    sale.synced = 1;
    sale.lastSyncAttempt = Date.now();
    
    const newEncryptedData: EncryptedData = {
      id: sale.id,
      syncId: sale.syncId,
      data: encrypt(sale),
      synced: 1,
      timestamp: encryptedData.timestamp
    };

    await store.put(newEncryptedData);
    await tx.done;
  } catch (error) {
    console.error('Error marking sale as synced:', error);
    throw error;
  }
};

export const updateSyncAttempts = async (id: string) => {
  if (!db) await initDB();
  const tx = db.transaction('offline-sales', 'readwrite');
  const store = tx.objectStore('offline-sales');
  
  try {
    const encryptedData = await store.get(id);
    if (!encryptedData) {
      throw new Error('Sale not found');
    }

    const sale = decrypt(encryptedData.data);
    if (!sale) {
      throw new Error('Failed to decrypt sale data');
    }

    sale.syncAttempts = (sale.syncAttempts || 0) + 1;
    sale.lastSyncAttempt = Date.now();
    
    const newEncryptedData: EncryptedData = {
      id: sale.id,
      syncId: sale.syncId,
      data: encrypt(sale),
      synced: sale.synced,
      timestamp: encryptedData.timestamp
    };

    await store.put(newEncryptedData);
    await tx.done;
  } catch (error) {
    console.error('Error updating sync attempts:', error);
    throw error;
  }
};

export const cleanupOldSales = async () => {
  if (!db) await initDB();
  
  try {
    const tx = db.transaction('offline-sales', 'readwrite');
    const store = tx.objectStore('offline-sales');
    const index = store.index('by-timestamp');
    
    const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
    const oldSales = await index.getAllKeys(IDBKeyRange.upperBound(oneDayAgo));
    
    await Promise.all(oldSales.map(key => store.delete(key)));
    await tx.done;
    
    console.log(`Cleaned up ${oldSales.length} old sales`);
  } catch (error) {
    console.error('Error cleaning up old sales:', error);
  }
};

export const clearSyncedData = async () => {
  if (!db) await initDB();
  
  try {
    const tx = db.transaction('offline-sales', 'readwrite');
    const store = tx.objectStore('offline-sales');
    
    const index = store.index('by-sync-status');
    const syncedItems = await index.getAllKeys(1);
    
    await Promise.all(syncedItems.map(key => store.delete(key)));
    await tx.done;
  } catch (error) {
    console.error('Error clearing synced data:', error);
  }
};