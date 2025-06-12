import React, { useState, useEffect } from 'react';
import { X, Loader2, WifiOff } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useUser } from '../../context/UserContext';
import { Product } from '../../types';
import { fetchAndCacheProducts, getCachedProducts } from '../../lib/productCache';

interface NewWasteModalProps {
  onClose: () => void;
  onSubmit: (data: any) => void;
}

const NewWasteModal: React.FC<NewWasteModalProps> = ({ onClose, onSubmit }) => {
  const { user } = useUser();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [formData, setFormData] = useState({
    productId: '',
    quantity: '',
    reason: 'mauvaise production' as 'mauvaise production' | 'produit bientôt périmé'
  });

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    const loadProducts = async () => {
      if (!user?.company) return;

      setLoading(true);
      try {
        let loadedProducts: Product[] = [];

        if (navigator.onLine) {
          try {
            loadedProducts = await fetchAndCacheProducts(user.company);
          } catch (error) {
            console.error('Error fetching products:', error);
            loadedProducts = await getCachedProducts(user.company);
            if (loadedProducts.length === 0) {
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
      } catch (error) {
        console.error('Error loading products:', error);
        toast.error(error instanceof Error ? error.message : 'Erreur lors du chargement des produits');
      } finally {
        setLoading(false);
      }
    };

    loadProducts();
  }, [user?.company]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const quantity = parseInt(formData.quantity);
    if (isNaN(quantity) || quantity <= 0) {
      toast.error('La quantité doit être un nombre positif');
      return;
    }

    const product = products.find(p => p.id === formData.productId);
    if (!product) {
      toast.error('Produit non trouvé');
      return;
    }

    if (quantity > product.stock) {
      toast.error('Quantité supérieure au stock disponible');
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit({
        productId: formData.productId,
        productName: product.name,
        quantity,
        reason: formData.reason,
        timestamp: new Date(),
        userId: user.id,
        userName: `${user.firstName} ${user.lastName}`,
        company: user.company,
        agencyName: user.agencyName
      });
    } catch (error) {
      console.error('Error submitting waste:', error);
      toast.error('Erreur lors de l\'enregistrement');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="bg-[#8B4513] text-white p-4 flex justify-between items-center">
          <h2 className="font-bold text-xl">Nouvelle Avarie</h2>
          <button
            onClick={onClose}
            className="text-white hover:bg-[#663300] p-2 rounded-full"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {isOffline && (
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 flex items-center">
            <WifiOff className="h-5 w-5 text-yellow-700 mr-2" />
            <p className="text-yellow-700 text-sm">
              Mode hors-ligne actif. Les données seront synchronisées lors du retour de la connexion.
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6">
          <div className="space-y-4">
            <div>
              <label className="block text-gray-700 font-medium mb-2">
                Produit
              </label>
              {loading ? (
                <div className="flex items-center justify-center p-4">
                  <Loader2 className="h-6 w-6 animate-spin text-[#8B4513]" />
                </div>
              ) : products.length === 0 ? (
                <div className="bg-red-50 text-red-700 p-4 rounded-lg text-sm">
                  Aucun produit disponible. Une connexion Internet est requise pour le premier chargement.
                </div>
              ) : (
                <select
                  value={formData.productId}
                  onChange={(e) => setFormData({ ...formData, productId: e.target.value })}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-[#8B4513] focus:border-[#8B4513]"
                  required
                >
                  <option value="">Sélectionner un produit</option>
                  {products.map(product => (
                    <option key={product.id} value={product.id}>
                      {product.name} (Stock: {product.stock})
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label className="block text-gray-700 font-medium mb-2">
                Quantité
              </label>
              <input
                type="number"
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-[#8B4513] focus:border-[#8B4513]"
                required
                min="1"
                placeholder="Quantité perdue"
              />
            </div>

            <div>
              <label className="block text-gray-700 font-medium mb-2">
                Motif
              </label>
              <select
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value as 'mauvaise production' | 'produit bientôt périmé' })}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-[#8B4513] focus:border-[#8B4513]"
                required
              >
                <option value="mauvaise production">Mauvaise production</option>
                <option value="produit bientôt périmé">Produit bientôt périmé</option>
              </select>
            </div>
          </div>

          <div className="mt-6 flex justify-end space-x-4">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-100"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={submitting || loading || products.length === 0}
              className="px-6 py-3 bg-[#8B4513] text-white rounded-lg font-medium hover:bg-[#663300] disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center"
            >
              {submitting ? (
                <>
                  <Loader2 className="animate-spin h-5 w-5 mr-2" />
                  Enregistrement...
                </>
              ) : (
                'Enregistrer'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default NewWasteModal;