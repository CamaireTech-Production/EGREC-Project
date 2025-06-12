import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';

export const calculateAvailableStock = async (
  productId: string,
  company: string,
  agencyName: string
): Promise<number> => {
  try {
    // Get the latest stock control for initial stock
    const stockControlQuery = query(
      collection(db, 'controleStock'),
      where('company', '==', company),
      where('agencyName', '==', agencyName),
      where('produits.productId', '==', productId)
    );
    
    const stockControlSnapshot = await getDocs(stockControlQuery);
    let initialStock = 0;
    
    if (!stockControlSnapshot.empty) {
      const latestControl = stockControlSnapshot.docs
        .map(doc => ({ ...doc.data(), timestamp: doc.data().timestamp.toDate() }))
        .sort((a, b) => b.timestamp - a.timestamp)[0];
      
      const productEntry = latestControl.produits.find((p: any) => p.productId === productId);
      initialStock = productEntry?.stockReel || 0;
    }

    // Get sales since last stock control
    const lastControlDate = stockControlSnapshot.empty ? 
      new Date(0) : 
      stockControlSnapshot.docs[0].data().timestamp;

    const salesQuery = query(
      collection(db, 'ventes'),
      where('company', '==', company),
      where('agencyName', '==', agencyName),
      where('timestamp', '>=', lastControlDate)
    );

    const salesSnapshot = await getDocs(salesQuery);
    const totalSales = salesSnapshot.docs.reduce((total, doc) => {
      const data = doc.data();
      const productIndex = data.productReference.indexOf(productId);
      return total + (productIndex >= 0 ? data.quantity[productIndex] : 0);
    }, 0);

    // Get avaries since last stock control
    const avariesQuery = query(
      collection(db, 'avaries'),
      where('company', '==', company),
      where('agencyName', '==', agencyName),
      where('productId', '==', productId),
      where('timestamp', '>=', lastControlDate)
    );

    const avariesSnapshot = await getDocs(avariesQuery);
    const totalAvaries = avariesSnapshot.docs.reduce((total, doc) => {
      return total + (doc.data().quantity || 0);
    }, 0);

    // Calculate available stock
    const availableStock = initialStock - (totalSales + totalAvaries);
    return Math.max(0, availableStock); // Ensure we don't return negative stock

  } catch (error) {
    console.error('Error calculating available stock:', error);
    throw error;
  }
};