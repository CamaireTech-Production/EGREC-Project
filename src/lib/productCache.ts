import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { Product } from '../types';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from './firebase';
import { toast } from 'react-hot-toast';

interface ProductDB extends DBSchema {
  'cached-products': {
    key: string;
    value: Product;
    indexes: {
      'by-company': string;
      'by-category': string;
    };
  };
}

let productDB: IDBPDatabase<ProductDB>;

export const initProductCache = async () => {
  productDB = await openDB<ProductDB>('egrec-products', 1, {
    upgrade(db) {
      const store = db.createObjectStore('cached-products', {
        keyPath: 'id'
      });
      store.createIndex('by-company', 'company');
      store.createIndex('by-category', 'category');
    },
  });
};

export const cacheProducts = async (products: Product[], company: string) => {
  if (!productDB) await initProductCache();

  const tx = productDB.transaction('cached-products', 'readwrite');
  const store = tx.objectStore('cached-products');

  // Clear existing products for this company
  const companyIndex = store.index('by-company');
  const existingKeys = await companyIndex.getAllKeys(company);
  await Promise.all(existingKeys.map(key => store.delete(key)));

  // Store new products
  await Promise.all(products.map(product => store.put(product)));
  await tx.done;
};

export const getCachedProducts = async (company: string): Promise<Product[]> => {
  if (!productDB) await initProductCache();

  try {
    const index = productDB.transaction('cached-products').store.index('by-company');
    return await index.getAll(company);
  } catch (error) {
    console.error('Error getting cached products:', error);
    return [];
  }
};

export const fetchAndCacheProducts = async (company: string): Promise<Product[]> => {
  if (!db) {
    throw new Error('Base de données Firebase non initialisée');
  }

  try {
    const productsQuery = query(
      collection(db, 'products'),
      where('company', '==', company)
    );

    const snapshot = await getDocs(productsQuery);
    const products = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Product[];

    if (products.length === 0) {
      throw new Error('Aucun produit trouvé pour cette entreprise');
    }

    await cacheProducts(products, company);
    return products;
  } catch (error) {
    console.error('Error fetching products:', error);
    const cachedProducts = await getCachedProducts(company);
    
    if (cachedProducts.length > 0) {
      toast('Utilisation des produits en cache', {
        icon: '✅',
        duration: 3000,
      });
      return cachedProducts;
    }
    
    throw error;
  }
};

export const clearProductCache = async (company: string) => {
  if (!productDB) await initProductCache();

  const tx = productDB.transaction('cached-products', 'readwrite');
  const store = tx.objectStore('cached-products');
  const index = store.index('by-company');
  const keys = await index.getAllKeys(company);
  await Promise.all(keys.map(key => store.delete(key)));
  await tx.done;
};