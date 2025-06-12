import { collection, doc, setDoc, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { db as firestore } from './firebase';
import { 
  getUnsynedSales, 
  markSaleAsSynced, 
  updateSyncAttempts,
  clearSyncedData
} from './db';
import { syncStockUpdates, generateSaleHash } from '../services/sales';
import { toast } from 'react-hot-toast';

let isSyncing = false;
let syncAttempts = 0;
const MAX_SYNC_ATTEMPTS = 3;
const SYNC_RETRY_DELAY = 5000;
const MAX_BATCH_SIZE = 50;

export const syncOfflineData = async () => {
  if (isSyncing) return;
  
  try {
    isSyncing = true;
    
    // Get all unsynced sales
    const unsynedSales = await getUnsynedSales();
    
    if (!unsynedSales.length) {
      isSyncing = false;
      return;
    }
    
    let successCount = 0;
    let failureCount = 0;
    
    const totalItems = unsynedSales.length;
    const syncToast = toast.loading(
      `Synchronisation de ${totalItems} élément${totalItems > 1 ? 's' : ''}...`
    );
    
    // Sync sales in batches
    for (let i = 0; i < unsynedSales.length; i += MAX_BATCH_SIZE) {
      const batch = unsynedSales.slice(i, i + MAX_BATCH_SIZE);
      for (const sale of batch) {
        try {
          // Check if sale already exists in Firestore
          const saleHash = generateSaleHash(sale);
          const existingQuery = query(
            collection(firestore, 'ventes'),
            where('saleHash', '==', saleHash)
          );
          const existingDocs = await getDocs(existingQuery);
          
          if (!existingDocs.empty) {
            // Sale already exists, mark as synced locally
            await markSaleAsSynced(sale.id, sale.syncId);
            successCount++;
            continue;
          }

          // Save to Firestore using syncId as document ID
          await setDoc(doc(firestore, 'ventes', sale.syncId), {
            ...sale,
            timestamp: Timestamp.fromMillis(sale.timestamp),
            syncedAt: Timestamp.now(),
            syncAttempts: (sale.syncAttempts || 0) + 1,
            synced: true,
            stockUpdated: false
          });
          
          await markSaleAsSynced(sale.id, sale.syncId);
          successCount++;
          
          toast.loading(
            `Synchronisation en cours... (${successCount}/${totalItems})`,
            { id: syncToast }
          );
        } catch (error) {
          console.error('Error syncing sale:', error);
          failureCount++;
          await updateSyncAttempts(sale.id);
        }
      }
    }
    
    // Show final status
    if (successCount > 0) {
      toast.success(
        `${successCount} élément${successCount > 1 ? 's' : ''} synchronisé${successCount > 1 ? 's' : ''} avec succès`,
        { id: syncToast }
      );
      
      // Clean up synced data
      await clearSyncedData();
      
      // Sync stock updates after successful sync
      await syncStockUpdates();
    }
    
    if (failureCount > 0) {
      toast.error(
        `Échec de la synchronisation pour ${failureCount} élément${failureCount > 1 ? 's' : ''}`,
        { duration: 5000 }
      );
      
      if (syncAttempts < MAX_SYNC_ATTEMPTS) {
        syncAttempts++;
        setTimeout(() => {
          syncOfflineData();
        }, SYNC_RETRY_DELAY);
      }
    }
  } catch (error) {
    console.error('Sync error:', error);
    toast.error('Erreur lors de la synchronisation', { duration: 5000 });
  } finally {
    isSyncing = false;
  }
};

export const setupSyncListener = () => {
  let wasOffline = !navigator.onLine;
  
  window.addEventListener('online', () => {
    if (wasOffline) {
      toast.success('Connexion internet rétablie');
      syncOfflineData();
    }
    wasOffline = false;
  });
  
  window.addEventListener('offline', () => {
    wasOffline = true;
    toast.error('Mode hors-ligne activé', { duration: 3000 });
  });
  
  // Initial sync check
  if (navigator.onLine) {
    syncOfflineData();
  }
};