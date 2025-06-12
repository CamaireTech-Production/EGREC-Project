import React, { useState, useEffect } from 'react';
import { collection, getDocs, doc, updateDoc, deleteDoc, query, where, orderBy, getDoc } from 'firebase/firestore';
import { db, auth } from '../../lib/firebase';
import { Plus, Search, Loader2, Filter } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Product } from '../../types';
import NewProductModal from './NewProductModal';
import EditProductModal from './EditProductModal';
import { useUser } from '../../context/UserContext';
import ProductTypeSelector from './ProductTypeSelector';
import CategoryTabs from '../pos/CategoryTabs';
import StoreCategoryTabs from './StoreCategoryTabs';

type BakeryCategory = 'pains' | 'viennoiseries' | 'patisseries' | 'favoris';
type StoreCategory = 'boisson' | 'margarine' | 'raffinerie' | 'savonnerie' | 'cosmetique' | 'champs';

const ProductManagement: React.FC = () => {
  const { user } = useUser();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewModal, setShowNewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [productType, setProductType] = useState<'bakery' | 'store'>('bakery');
  const [activeBakeryCategory, setActiveBakeryCategory] = useState<BakeryCategory>('pains');
  const [activeStoreCategory, setActiveStoreCategory] = useState<StoreCategory>('boisson');

  // Vérifier si l'utilisateur est administrateur
  const isAdmin = user?.role === 'ADMINISTRATEUR';

  const fetchProducts = async () => {
    if (!auth.currentUser || !user?.company) return;

    try {
      const productsQuery = query(
        collection(db, 'products'),
        where('company', '==', user.company),
        orderBy('name', 'asc')
      );
      
      const querySnapshot = await getDocs(productsQuery);
      const productsData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Product[];
      
      setProducts(productsData);
    } catch (error) {
      console.error('Erreur lors du chargement des produits:', error);
      toast.error('Erreur lors du chargement des produits');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [user]);

  const handleToggleProductState = async (productId: string, currentState?: 'active' | 'dormant') => {
    if (!user?.agencyName) {
      toast.error('Agence non définie');
      return;
    }

    try {
      const productRef = doc(db, 'products', productId);
      const newState = currentState === 'active' ? 'dormant' : 'active';
      
      await updateDoc(productRef, {
        [`stateByAgency.${user.agencyName}`]: newState,
        updatedAt: new Date().toISOString()
      });

      toast.success(`Produit marqué comme ${newState === 'active' ? 'actif' : 'dormant'}`);
      fetchProducts();
    } catch (error) {
      console.error('Erreur lors de la mise à jour:', error);
      toast.error('Erreur lors de la mise à jour');
    }
  };

  const handleEditProduct = (product: Product) => {
    if (!isAdmin) {
      toast.error('Seuls les administrateurs peuvent modifier les produits');
      return;
    }
    setSelectedProduct(product);
    setShowEditModal(true);
  };

  const handleDeleteProduct = async (productId: string, productName: string) => {
    if (!isAdmin) {
      toast.error('Seuls les administrateurs peuvent supprimer les produits');
      return;
    }

    if (!window.confirm(`Êtes-vous sûr de vouloir supprimer le produit "${productName}" ? Cette action est irréversible.`)) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'products', productId));
      toast.success('Produit supprimé avec succès');
      fetchProducts();
    } catch (error) {
      console.error('Erreur lors de la suppression:', error);
      toast.error('Erreur lors de la suppression du produit');
    }
  };

  // Séparer les produits par département
  const bakeryProducts = products.filter(product => product.department === 'Boulangerie');
  const storeProducts = products.filter(product => product.department === 'Boutique');

  // Filtrer les produits selon le type sélectionné et la catégorie
  const getFilteredProducts = () => {
    let baseProducts = productType === 'bakery' ? bakeryProducts : storeProducts;
    
    // Filtrer par catégorie
    if (productType === 'bakery') {
      if (activeBakeryCategory === 'favoris') {
        baseProducts = baseProducts.filter(product => product.isFavorite);
      } else {
        baseProducts = baseProducts.filter(product => product.category === activeBakeryCategory);
      }
    } else {
      baseProducts = baseProducts.filter(product => product.category === activeStoreCategory);
    }
    
    // Filtrer par recherche
    if (searchQuery) {
      baseProducts = baseProducts.filter(product =>
        product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.reference.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    return baseProducts;
  };

  const filteredProducts = getFilteredProducts();

  // Calculer les compteurs pour les catégories de boutique
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-[#8B4513]" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-[#8B4513]">Gestion des Produits</h2>
        {isAdmin && (
          <button
            className="bg-[#8B4513] text-white px-4 py-2 rounded-lg flex items-center hover:bg-[#663300]"
            onClick={() => setShowNewModal(true)}
          >
            <Plus className="h-5 w-5 mr-2" />
            Nouveau Produit
          </button>
        )}
      </div>

      {!isAdmin && (
        <div className="mb-4 p-4 bg-yellow-50 border-l-4 border-yellow-400 text-yellow-700">
          <p className="text-sm">
            <strong>Information :</strong> Seuls les administrateurs peuvent ajouter, modifier ou supprimer des produits.
          </p>
        </div>
      )}

      {/* Sélecteur de type de produit */}
      <ProductTypeSelector
        selectedType={productType}
        onTypeChange={setProductType}
        bakeryCount={bakeryProducts.length}
        storeCount={storeProducts.length}
      />

      {/* Indicateur de type de produit actuel */}
      <div className="mb-4 flex items-center justify-between bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center">
          <div className={`w-3 h-3 rounded-full mr-3 ${
            productType === 'bakery' ? 'bg-orange-500' : 'bg-blue-500'
          }`}></div>
          <span className="font-medium text-gray-800">
            Affichage des produits : {productType === 'bakery' ? 'Boulangerie' : 'Boutique'}
          </span>
          <span className="ml-2 bg-white text-gray-800 px-3 py-1 rounded-full text-sm font-medium shadow-sm">
            {filteredProducts.length} produit{filteredProducts.length > 1 ? 's' : ''}
          </span>
        </div>
        <div className="text-sm text-gray-600">
          {productType === 'bakery' 
            ? `Catégorie: ${activeBakeryCategory === 'favoris' ? 'Favoris' : activeBakeryCategory}`
            : `Catégorie: ${activeStoreCategory}`
          }
        </div>
      </div>

      {/* Onglets de catégories */}
      {productType === 'bakery' ? (
        <CategoryTabs 
          activeCategory={activeBakeryCategory} 
          onCategoryChange={setActiveBakeryCategory} 
        />
      ) : (
        <StoreCategoryTabs
          activeCategory={activeStoreCategory}
          onCategoryChange={setActiveStoreCategory}
          categoryCounts={getStoreCategoryCounts()}
        />
      )}

      <div className="bg-white rounded-lg shadow-md p-6">
        {/* Barre de recherche */}
        <div className="mb-6 relative">
          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder={`Rechercher dans les produits ${productType === 'bakery' ? 'boulangerie' : 'boutique'}...`}
            className="w-full pl-10 p-3 border border-gray-300 rounded-lg focus:ring-[#8B4513] focus:border-[#8B4513]"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left bg-gray-50">
                <th className="px-6 py-3 text-gray-500 font-medium">Nom</th>
                <th className="px-6 py-3 text-gray-500 font-medium">Catégorie</th>
                <th className="px-6 py-3 text-gray-500 font-medium">Référence</th>
                <th className="px-6 py-3 text-gray-500 font-medium">Prix</th>
                <th className="px-6 py-3 text-gray-500 font-medium">Stock Agence</th>
                <th className="px-6 py-3 text-gray-500 font-medium">État</th>
                {isAdmin && (
                  <th className="px-6 py-3 text-gray-500 font-medium">Actions</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredProducts.map((product) => {
                const productState = user?.agencyName ? 
                  product.stateByAgency?.[user.agencyName] || 'active' : 
                  'active';

                const agencyStock = user?.agencyName && product.stockParAgence ? 
                  product.stockParAgence[user.agencyName] || 0 : 
                  0;

                return (
                  <tr key={product.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium">{product.name}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        productType === 'bakery'
                          ? 'bg-orange-100 text-orange-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {product.category}
                      </span>
                    </td>
                    <td className="px-6 py-4">{product.reference}</td>
                    <td className="px-6 py-4">{product.price} Fcfa</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        agencyStock <= (product.minStock || 0)
                          ? 'bg-red-100 text-red-800'
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {agencyStock}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          className="sr-only peer"
                          checked={productState === 'active'}
                          onChange={() => handleToggleProductState(product.id, productState)}
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-[#8B4513]/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#8B4513]"></div>
                        <span className="ml-3 text-sm font-medium text-gray-900">
                          {productState === 'active' ? 'Actif' : 'Dormant'}
                        </span>
                      </label>
                    </td>
                    {isAdmin && (
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-3">
                          <button
                            onClick={() => handleEditProduct(product)}
                            className="text-[#8B4513] hover:text-[#663300] font-medium transition-colors"
                            title="Modifier le produit"
                          >
                            Modifier
                          </button>
                          <button
                            onClick={() => handleDeleteProduct(product.id, product.name)}
                            className="text-red-600 hover:text-red-800 font-medium transition-colors"
                            title="Supprimer le produit"
                          >
                            Supprimer
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredProducts.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            {searchQuery 
              ? `Aucun produit trouvé pour "${searchQuery}" dans la catégorie ${productType === 'bakery' ? activeBakeryCategory : activeStoreCategory}`
              : `Aucun produit trouvé dans la catégorie ${productType === 'bakery' ? activeBakeryCategory : activeStoreCategory}`
            }
          </div>
        )}
      </div>

      {showNewModal && isAdmin && (
        <NewProductModal
          onClose={() => setShowNewModal(false)}
          onProductAdded={fetchProducts}
        />
      )}

      {showEditModal && selectedProduct && isAdmin && (
        <EditProductModal
          product={selectedProduct}
          onClose={() => {
            setShowEditModal(false);
            setSelectedProduct(null);
          }}
          onProductUpdated={fetchProducts}
        />
      )}
    </div>
  );
};

export default ProductManagement;