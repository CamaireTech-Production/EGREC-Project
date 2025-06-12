import React, { useState, useEffect } from 'react';
import { collection, query, where, orderBy, getDocs, doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../../lib/firebase';
import { Product } from '../../types';
import DepartmentSelector from './DepartmentSelector';
import CategoryTabs from './CategoryTabs';
import StoreCategoryTabs from './StoreCategoryTabs';
import SearchBar from './SearchBar';
import ProductGrid from './ProductGrid';
import Cart from './Cart';
import Checkout from './Checkout';
import { toast } from 'react-hot-toast';
import { WifiOff, ShoppingBag } from 'lucide-react';
import { initProductCache, fetchAndCacheProducts, getCachedProducts } from '../../lib/productCache';
import { useUser } from '../../context/UserContext';

type BakeryCategory = 'pains' | 'viennoiseries' | 'patisseries' | 'favoris';
type StoreCategory = 'boisson' | 'margarine' | 'raffinerie' | 'savonnerie' | 'cosmetique' | 'champs';

const POSView: React.FC = () => {
  const { user, loading: userLoading, error: userError } = useUser();
  const [selectedDepartment, setSelectedDepartment] = useState<'Boulangerie' | 'Boutique'>('Boulangerie');
  const [activeBakeryCategory, setActiveBakeryCategory] = useState<BakeryCategory>('pains');
  const [activeStoreCategory, setActiveStoreCategory] = useState<StoreCategory>('boisson');
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCheckout, setShowCheckout] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [cacheInitialized, setCacheInitialized] = useState(false);

  useEffect(() => {
    const init = async () => {
      try {
        await initProductCache();
        setCacheInitialized(true);
      } catch (error) {
        console.error('Failed to initialize product cache:', error);
        setError('Failed to initialize product cache');
      }
    };
    init();
  }, []);

  useEffect(() => {
    const handleOnline = async () => {
      setIsOffline(false);
      if (user?.company && cacheInitialized) {
        try {
          const products = await fetchAndCacheProducts(user.company);
          setProducts(products);
          setError(null);
        } catch (error) {
          console.error('Error fetching products:', error);
          toast.error('Échec du chargement des produits');
        }
      }
    };

    const handleOffline = () => {
      setIsOffline(true);
      toast('Mode hors-ligne activé - Utilisation du cache local', {
        icon: '🔌',
        duration: 4000,
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [user?.company, cacheInitialized]);

  useEffect(() => {
    const loadProducts = async () => {
      if (!user?.company || !user?.agencyName || !cacheInitialized) return;

      setLoading(true);
      try {
        let loadedProducts: Product[] = [];
        
        if (navigator.onLine) {
          try {
            const productsQuery = query(
              collection(db, 'products'),
              where('company', '==', user.company),
              orderBy('name', 'asc')
            );

            const snapshot = await getDocs(productsQuery);
            loadedProducts = snapshot.docs
              .map(doc => ({
                id: doc.id,
                ...doc.data()
              })) as Product[];

            // Filter products based on agency state
            loadedProducts = loadedProducts.filter(product => {
              const productState = product.stateByAgency?.[user.agencyName];
              return !productState || productState === 'active';
            });

            await fetchAndCacheProducts(user.company);
          } catch (error) {
            console.error('Error fetching products:', error);
            loadedProducts = await getCachedProducts(user.company);
            if (loadedProducts.length > 0) {
              toast('Utilisation des produits en cache - Certaines données peuvent être obsolètes', {
                icon: '⚠️',
                duration: 4000,
              });
            } else {
              throw new Error('Aucun produit disponible en ligne ou en cache');
            }
          }
        } else {
          loadedProducts = await getCachedProducts(user.company);
          if (loadedProducts.length === 0) {
            throw new Error('Connexion Internet requise pour le premier chargement des produits');
          }
        }

        setProducts(loadedProducts);
        setError(null);
      } catch (error) {
        console.error('Error loading products:', error);
        setError(error instanceof Error ? error.message : 'Échec du chargement des produits');
      } finally {
        setLoading(false);
      }
    };

    if (!userLoading) {
      loadProducts();
    }
  }, [user?.company, user?.agencyName, userLoading, cacheInitialized]);

  // Separate products by department
  const bakeryProducts = products.filter(product => product.department === 'Boulangerie');
  const storeProducts = products.filter(product => product.department === 'Boutique');

  // Calculate category counts for store products
  const getStoreCategoryCounts = (): Record<StoreCategory, number> => {
    const counts = {
      boisson: 0,
      margarine: 0,
      raffinerie: 0,
      savonnerie: 0,
      cosmetique: 0,
      champs: 0
    };

    storeProducts.forEach(product => {
      if (product.category in counts) {
        counts[product.category as StoreCategory]++;
      }
    });

    return counts;
  };

  useEffect(() => {
    let filtered = selectedDepartment === 'Boulangerie' ? bakeryProducts : storeProducts;
    
    if (searchQuery) {
      filtered = filtered.filter(product => 
        product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.reference.toLowerCase().includes(searchQuery.toLowerCase())
      );
    } else {
      // Filter by category when no search query
      if (selectedDepartment === 'Boulangerie') {
        if (activeBakeryCategory === 'favoris') {
          filtered = filtered.filter(product => product.isFavorite);
        } else {
          filtered = filtered.filter(product => product.category === activeBakeryCategory);
        }
      } else {
        filtered = filtered.filter(product => product.category === activeStoreCategory);
      }
    }
    
    setFilteredProducts(filtered);
  }, [selectedDepartment, activeBakeryCategory, activeStoreCategory, searchQuery, bakeryProducts, storeProducts]);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
  };

  const handleDepartmentChange = (department: 'Boulangerie' | 'Boutique') => {
    setSelectedDepartment(department);
    setSearchQuery(''); // Clear search when changing departments
  };

  const handleCheckoutComplete = () => {
    setShowCheckout(false);
  };

  if (userLoading || loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-[#8B4513] text-xl">Chargement des produits...</div>
      </div>
    );
  }

  if (userError || error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 text-red-700 p-4 rounded-lg flex flex-col items-center gap-4">
          <p>{userError || error}</p>
          {error?.includes('Aucun produit') && (
            <div className="flex flex-col items-center gap-2">
              <ShoppingBag className="h-8 w-8" />
              <p className="text-center">
                Aucun produit trouvé pour votre entreprise. Veuillez ajouter des produits dans le panneau d'administration.
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (!user?.company || !user?.agencyName) {
    return (
      <div className="p-6">
        <div className="bg-yellow-50 text-yellow-700 p-4 rounded-lg">
          Informations entreprise ou agence manquantes
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row h-full gap-6">
      {isOffline && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 fixed top-4 right-4 flex items-center space-x-2 z-40">
          <WifiOff className="h-5 w-5 text-yellow-700" />
          <span className="text-yellow-700">Mode hors-ligne</span>
        </div>
      )}

      <div className="flex-grow md:w-2/3 overflow-auto">
        <SearchBar onSearch={handleSearch} />
        
        {/* Department Selector */}
        <DepartmentSelector
          selectedDepartment={selectedDepartment}
          onDepartmentChange={handleDepartmentChange}
          bakeryCount={bakeryProducts.length}
          storeCount={storeProducts.length}
        />

        {/* Department Status Indicator */}
        <div className="mb-4 flex items-center justify-between bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center">
            <div className={`w-3 h-3 rounded-full mr-3 ${
              selectedDepartment === 'Boulangerie' ? 'bg-orange-500' : 'bg-blue-500'
            }`}></div>
            <span className="font-medium text-gray-800">
              Département : {selectedDepartment}
            </span>
            <span className="ml-2 bg-white text-gray-800 px-3 py-1 rounded-full text-sm font-medium shadow-sm">
              {filteredProducts.length} produit{filteredProducts.length > 1 ? 's' : ''}
            </span>
          </div>
          <div className="text-sm text-gray-600">
            {selectedDepartment === 'Boulangerie' 
              ? `Catégorie: ${activeBakeryCategory === 'favoris' ? 'Favoris' : activeBakeryCategory}`
              : `Catégorie: ${activeStoreCategory}`
            }
          </div>
        </div>
        
        {/* Category Tabs */}
        {selectedDepartment === 'Boulangerie' ? (
          <CategoryTabs 
            activeCategory={activeBakeryCategory} 
            onCategoryChange={category => {
              setActiveBakeryCategory(category);
              setSearchQuery('');
            }} 
          />
        ) : (
          <StoreCategoryTabs
            activeCategory={activeStoreCategory}
            onCategoryChange={category => {
              setActiveStoreCategory(category);
              setSearchQuery('');
            }}
            categoryCounts={getStoreCategoryCounts()}
          />
        )}
        
        <ProductGrid products={filteredProducts} />
      </div>
      
      <div className="md:w-1/3">
        <Cart onCheckout={() => setShowCheckout(true)} />
      </div>
      
      {showCheckout && (
        <Checkout 
          onClose={() => setShowCheckout(false)} 
          onComplete={handleCheckoutComplete}
        />
      )}
    </div>
  );
};

export default POSView;