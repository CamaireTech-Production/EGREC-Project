import { collection, doc, runTransaction, query, where, getDocs, increment, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { toast } from 'react-hot-toast';
import CryptoJS from 'crypto-js';
import { saveOfflineSale } from '../lib/db';

// Generate unique hash for sale
export const generateSaleHash = (saleData: any): string => {
  const timestamp = typeof saleData.timestamp === 'number' ? saleData.timestamp : saleData.timestamp.getTime();
  const hashInput = `${timestamp}_${saleData.userUID}_${saleData.totalAmount}_${saleData.productReference.join('_')}`;
  return CryptoJS.SHA256(hashInput).toString();
};

// Check for potential duplicates
const checkForDuplicates = async (saleHash: string, timeWindow: number = 5000): Promise<boolean> => {
  const endTime = new Date();
  const startTime = new Date(endTime.getTime() - timeWindow);
  
  const salesQuery = query(
    collection(db, 'ventes'),
    where('saleHash', '==', saleHash),
    where('timestamp', '>=', Timestamp.fromDate(startTime)),
    where('timestamp', '<=', Timestamp.fromDate(endTime))
  );

  const snapshot = await getDocs(salesQuery);
  return !snapshot.empty;
};

export const createSale = async (saleData: any) => {
  try {
    // Generate sale hash
    const saleHash = generateSaleHash(saleData);
    
    // Check for duplicates
    const isDuplicate = await checkForDuplicates(saleHash);
    if (isDuplicate) {
      throw new Error('Transaction doublon détectée');
    }

    // Create the sale document with all necessary fields
    const saleDoc = {
      ...saleData,
      saleHash,
      isDuplicate: false,
      createdAt: Timestamp.fromDate(saleData.createdAt),
      updatedAt: Timestamp.fromDate(saleData.updatedAt),
      timestamp: Timestamp.fromDate(saleData.timestamp),
      deletedAt: null,
      deletedBy: null,
      deletedByName: null,
      deleteReason: null,
      stockUpdated: false // Will be updated when synced
    };

    if (navigator.onLine) {
      // If online, save to Firestore
      await runTransaction(db, async (transaction) => {
        // Check again for duplicates within transaction
        const saleRef = doc(db, 'ventes', saleHash);
        const existingSale = await transaction.get(saleRef);
        if (existingSale.exists()) {
          throw new Error('Transaction doublon détectée');
        }

        // STEP 1: Read all product documents
        const productReads = await Promise.all(
          saleData.productReference.map(async (productId: string) => {
            const productRef = doc(db, 'products', productId);
            const productDoc = await transaction.get(productRef);
            
            if (!productDoc.exists()) {
              throw new Error(`Produit non trouvé: ${saleData.productName[saleData.productReference.indexOf(productId)]}`);
            }
            
            return {
              ref: productRef,
              data: productDoc.data(),
              id: productId
            };
          })
        );

        // Read company statistics
        const statsRef = doc(db, 'statistics', saleData.company);
        const statsDoc = await transaction.get(statsRef);

        // STEP 2: Validate and prepare updates
        const productUpdates = productReads.map((product, index) => {
          const stockParAgence = product.data.stockParAgence || {};
          const currentAgencyStock = stockParAgence[saleData.agency] || 0;
          const quantityToSell = saleData.quantity[index];

          if (quantityToSell <= 0) {
            throw new Error(`Quantité invalide pour ${saleData.productName[index]}`);
          }

          if (currentAgencyStock < quantityToSell) {
            throw new Error(`Stock insuffisant pour ${saleData.productName[index]} dans l'agence ${saleData.agency} (Disponible: ${currentAgencyStock})`);
          }

          stockParAgence[saleData.agency] = currentAgencyStock - quantityToSell;
          
          return {
            ref: product.ref,
            updates: {
              stockParAgence,
              totalQuantitySold: (product.data.totalQuantitySold || 0) + quantityToSell,
              totalRevenue: (product.data.totalRevenue || 0) + (quantityToSell * product.data.price),
              updatedAt: Timestamp.now()
            }
          };
        });

        // STEP 3: Execute all writes atomically
        // Create the sale document with stockUpdated true since we're online
        transaction.set(saleRef, { ...saleDoc, stockUpdated: true });

        // Update products
        productUpdates.forEach(update => {
          transaction.update(update.ref, update.updates);
        });

        // Update or create company statistics
        if (statsDoc.exists()) {
          transaction.update(statsRef, {
            totalRevenue: increment(saleData.totalAmount),
            totalSalesCount: increment(1),
            lastUpdated: Timestamp.now()
          });
        } else {
          transaction.set(statsRef, {
            totalRevenue: saleData.totalAmount,
            totalSalesCount: 1,
            lastUpdated: Timestamp.now(),
            createdAt: Timestamp.now()
          });
        }
      });
    } else {
      // If offline, save to local storage
      await saveOfflineSale({
        ...saleDoc,
        timestamp: saleData.timestamp.getTime(),
        createdAt: saleData.createdAt.getTime(),
        updatedAt: saleData.updatedAt.getTime()
      });
    }

    return { success: true };
  } catch (error) {
    console.error('Error creating sale:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erreur lors de la création de la vente';
    toast.error(errorMessage);
    return { success: false, error: errorMessage };
  }
};

export const deleteSale = async (saleId: string, deleteInfo: {
  reason: string;
  deletedBy: string;
  deletedByName: string;
}) => {
  const saleRef = doc(db, 'ventes', saleId);
  
  try {
    await runTransaction(db, async (transaction) => {
      // First, perform all reads
      const saleDoc = await transaction.get(saleRef);
      if (!saleDoc.exists()) {
        throw new Error('La vente n\'existe pas ou a déjà été supprimée');
      }
      const saleData = saleDoc.data();

      // Read statistics document
      const statsRef = doc(db, 'statistics', saleData.company);
      const statsDoc = await transaction.get(statsRef);

      // Read all product documents
      const productDocs = await Promise.all(
        saleData.productReference.map(async (productId: string) => {
          const productRef = doc(db, 'products', productId);
          const productDoc = await transaction.get(productRef);
          return {
            ref: productRef,
            doc: productDoc,
            data: productDoc.data()
          };
        })
      );

      // After all reads are complete, perform writes
      
      // Update the sale document
      transaction.update(saleRef, {
        deletedAt: Timestamp.now(),
        deletedBy: deleteInfo.deletedBy,
        deletedByName: deleteInfo.deletedByName,
        deleteReason: deleteInfo.reason,
        updatedAt: Timestamp.now()
      });

      // Update statistics if they exist
      if (statsDoc.exists()) {
        transaction.update(statsRef, {
          totalRevenue: increment(-saleData.totalAmount),
          deletedSalesCount: increment(1),
          deletedSalesAmount: increment(saleData.totalAmount),
          lastUpdated: Timestamp.now()
        });
      }

      // Update product statistics and restore stock
      productDocs.forEach((productInfo, index) => {
        if (productInfo.doc.exists()) {
          const stockParAgence = productInfo.data.stockParAgence || {};
          const currentAgencyStock = stockParAgence[saleData.agency] || 0;
          const quantityToRestore = saleData.quantity[index];

          // Restore agency-specific stock
          stockParAgence[saleData.agency] = currentAgencyStock + quantityToRestore;

          transaction.update(productInfo.ref, {
            stockParAgence,
            totalQuantitySold: increment(-saleData.quantity[index]),
            totalRevenue: increment(-(saleData.quantity[index] * productInfo.data.price)),
            updatedAt: Timestamp.now()
          });
        }
      });

      // Create deletion log
      const logRef = collection(db, 'deletionLogs');
      transaction.set(doc(logRef), {
        saleId,
        timestamp: Timestamp.now(),
        deletedBy: deleteInfo.deletedBy,
        deletedByName: deleteInfo.deletedByName,
        reason: deleteInfo.reason,
        saleAmount: saleData.totalAmount,
        company: saleData.company,
        agency: saleData.agency
      });
    });

    toast.success('Vente supprimée et statistiques mises à jour');
    return { success: true };
  } catch (error) {
    console.error('Error deleting sale:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erreur lors de la suppression';
    toast.error(errorMessage);
    throw error;
  }
};

export const syncStockUpdates = async () => {
  try {
    const salesQuery = query(
      collection(db, 'ventes'),
      where('stockUpdated', '==', false),
      where('isDuplicate', '==', false),
      where('deletedAt', '==', null)
    );

    const snapshot = await getDocs(salesQuery);
    if (snapshot.empty) return;

    for (const saleDoc of snapshot.docs) {
      const saleData = saleDoc.data();

      try {
        await runTransaction(db, async (transaction) => {
          if (saleData.stockUpdated) return;

          // STEP 1: Perform ALL reads first
          const productReads = await Promise.all(
            saleData.productReference.map(async (productId: string, index: number) => {
              const productRef = doc(db, 'products', productId);
              const productDoc = await transaction.get(productRef);
              
              return {
                ref: productRef,
                doc: productDoc,
                data: productDoc.exists() ? productDoc.data() : null,
                productId,
                productName: saleData.productName[index],
                quantity: saleData.quantity[index]
              };
            })
          );

          // STEP 2: Prepare all updates based on read data
          const productUpdates = [];
          
          for (const productRead of productReads) {
            if (!productRead.doc.exists()) {
              console.error(`Product not found: ${productRead.productName}`);
              continue;
            }

            const productData = productRead.data;
            const stockParAgence = productData.stockParAgence || {};
            const currentAgencyStock = stockParAgence[saleData.agency] || 0;
            const quantityToDeduct = productRead.quantity;

            if (currentAgencyStock >= quantityToDeduct) {
              stockParAgence[saleData.agency] = currentAgencyStock - quantityToDeduct;
              
              productUpdates.push({
                ref: productRead.ref,
                updates: {
                  stockParAgence,
                  totalQuantitySold: (productData.totalQuantitySold || 0) + quantityToDeduct,
                  totalRevenue: (productData.totalRevenue || 0) + (quantityToDeduct * productData.price)
                }
              });
            } else {
              console.warn(`Insufficient stock for ${productRead.productName} in agency ${saleData.agency}`);
            }
          }

          // STEP 3: Execute ALL writes
          // Update all products
          productUpdates.forEach(update => {
            transaction.update(update.ref, update.updates);
          });

          // Update the sale document
          transaction.update(doc(db, 'ventes', saleDoc.id), {
            stockUpdated: true,
            synced: true
          });
        });
      } catch (error) {
        console.error(`Error processing sale ${saleDoc.id}:`, error);
      }
    }

    toast.success('Synchronisation du stock terminée');
  } catch (error) {
    console.error('Error syncing stock updates:', error);
    toast.error('Erreur lors de la synchronisation du stock');
  }
};