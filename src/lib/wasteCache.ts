import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { db } from './firebase';
import { toast } from 'react-hot-toast';

interface WasteRecord {
  id?: string;
  productId: string;
  productName: string;
  quantity: number;
  reason: 'mauvaise production' | 'produit bientôt périmé';
  timestamp: Date;
  userId: string;
  userName: string;
  company: string;
  agencyName: string;
  synced: number; // Changed from boolean to number (0 = false, 1 = true)
}

interface WasteDB extends DBSchema {
  'waste-records': {
    key: string;
    value: WasteRecord;
    indexes: {
      'by-sync-status': number; // Changed from boolean to number
      'by-company': string;
      'by-agency': string;
    };
  };
}

let wasteDB: IDBPDatabase<WasteDB>;

export const initWasteCache = async () => {
  wasteDB = await openDB<WasteDB>('egrec-waste', 2, { // Bumped version number
    upgrade(db, oldVersion) {
      // Delete old store if exists
      if (oldVersion > 0) {
        db.deleteObjectStore('waste-records');
      }
      
      const store = db.createObjectStore('waste-records', {
        keyPath: 'id',
        autoIncrement: true
      });
      store.createIndex('by-sync-status', 'synced');
      store.createIndex('by-company', 'company');
      store.createIndex('by-agency', 'agencyName');
    },
  });
};

export const saveWasteRecord = async (record: Omit<WasteRecord, 'id' | 'synced'>) => {
  if (!wasteDB) await initWasteCache();

  try {
    const wasteRecord: WasteRecord = {
      ...record,
      synced: 0 // Using 0 instead of false
    };

    // Save to IndexedDB
    await wasteDB.add('waste-records', wasteRecord);

    // If online, try to sync immediately
    if (navigator.onLine) {
      await syncWasteRecords();
    }

    return true;
  } catch (error) {
    console.error('Error saving waste record:', error);
    throw error;
  }
};

export const getWasteRecords = async (company: string, agencyName: string): Promise<WasteRecord[]> => {
  if (!wasteDB) await initWasteCache();

  try {
    const tx = wasteDB.transaction('waste-records', 'readonly');
    const store = tx.objectStore('waste-records');
    const records = await store.getAll();

    return records
      .filter(record => record.company === company && record.agencyName === agencyName)
      .map(record => ({
        ...record,
        synced: record.synced === 1 // Convert back to boolean for external use
      })) as any[]; // Using any[] to avoid type conflicts
  } catch (error) {
    console.error('Error getting waste records:', error);
    return [];
  }
};

export const syncWasteRecords = async () => {
  if (!wasteDB) await initWasteCache();

  try {
    // Get all unsynced records first
    const tx = wasteDB.transaction('waste-records', 'readonly');
    const store = tx.objectStore('waste-records');
    const index = store.index('by-sync-status');
    const unsynced = await index.getAll(0);
    await tx.done;

    // Process each record individually
    for (const record of unsynced) {
      try {
        // First add to Firestore
        const docRef = await addDoc(collection(db, 'avaries'), {
          ...record,
          timestamp: Timestamp.fromDate(record.timestamp),
          synced: 1
        });

        // Then update local record in a new transaction
        const updateTx = wasteDB.transaction('waste-records', 'readwrite');
        const updateStore = updateTx.objectStore('waste-records');
        await updateStore.put({
          ...record,
          id: record.id,
          synced: 1
        });
        await updateTx.done;
      } catch (error) {
        console.error('Error syncing waste record:', error);
      }
    }

    return true;
  } catch (error) {
    console.error('Error during waste records sync:', error);
    toast.error('Erreur lors de la synchronisation des avaries');
    return false;
  }
};

export const setupWasteSyncListener = () => {
  window.addEventListener('online', () => {
    syncWasteRecords();
  });
};