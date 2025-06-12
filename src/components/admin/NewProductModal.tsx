import React, { useState, useRef } from 'react';
import { X, Upload, Loader2 } from 'lucide-react';
import { db, storage, auth } from '../../lib/firebase';
import { collection, addDoc, doc, getDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { v4 as uuidv4 } from 'uuid';

interface NewProductModalProps {
  onClose: () => void;
  onProductAdded: () => void;
}

// Define category types for better TypeScript support
type BoulangerieCategory = 'pains' | 'viennoiseries' | 'patisseries';
type BoutiqueCategory = 'boisson' | 'margarine' | 'raffinerie' | 'savonnerie' | 'cosmetique' | 'champs';
type ProductCategory = BoulangerieCategory | BoutiqueCategory;

interface FormData {
  name: string;
  description: string;
  price: string;
  category: ProductCategory;
  reference: string;
  allergens: string;
  stock: string;
  minStock: string;
  freshWeight: string;
  department: 'Boulangerie' | 'Boutique';
}

const NewProductModal: React.FC<NewProductModalProps> = ({ onClose, onProductAdded }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  
  const [formData, setFormData] = useState<FormData>({
    name: '',
    description: '',
    price: '',
    category: 'pains', // Default to boulangerie category
    reference: '',
    allergens: '',
    stock: '0',
    minStock: '5',
    freshWeight: '',
    department: 'Boulangerie'
  });

  // Category options based on department
  const boulangerieCategories: { value: BoulangerieCategory; label: string }[] = [
    { value: 'pains', label: 'Pains' },
    { value: 'viennoiseries', label: 'Viennoiseries' },
    { value: 'patisseries', label: 'Pâtisseries' }
  ];

  const boutiqueCategories: { value: BoutiqueCategory; label: string }[] = [
    { value: 'boisson', label: 'Boisson' },
    { value: 'margarine', label: 'Margarine' },
    { value: 'raffinerie', label: 'Raffinerie' },
    { value: 'savonnerie', label: 'Savonnerie' },
    { value: 'cosmetique', label: 'Cosmétique' },
    { value: 'champs', label: 'Champs' }
  ];

  // Handle department change and reset category
  const handleDepartmentChange = (department: 'Boulangerie' | 'Boutique') => {
    setFormData(prev => ({
      ...prev,
      department,
      // Reset category to first option of the selected department
      category: department === 'Boulangerie' ? 'pains' : 'boisson'
    }));
  };

  // Handle category change with proper typing
  const handleCategoryChange = (category: string) => {
    setFormData(prev => ({
      ...prev,
      category: category as ProductCategory
    }));
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        setError('L\'image ne doit pas dépasser 2MB');
        return;
      }
      
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;
    
    setError('');
    setLoading(true);

    try {
      const price = parseFloat(formData.price);
      const stock = parseInt(formData.stock);
      const minStock = parseInt(formData.minStock);
      const freshWeight = parseFloat(formData.freshWeight);

      if (isNaN(price) || price <= 0) {
        throw new Error('Le prix doit être un nombre positif');
      }

      if (isNaN(minStock) || minStock < 0) {
        throw new Error('Le stock minimum doit être un nombre positif');
      }

      if (isNaN(stock) || stock < 0) {
        throw new Error('Le stock doit être un nombre positif');
      }

      if (isNaN(freshWeight) || freshWeight <= 0) {
        throw new Error('Le poids unitaire frais doit être un nombre positif');
      }

      if (minStock > stock) {
        throw new Error('Le stock minimum ne peut pas être supérieur au stock actuel');
      }

      let imageUrl = '';
      if (fileInputRef.current?.files?.[0]) {
        const file = fileInputRef.current.files[0];
        const imageRef = ref(storage, `products/${uuidv4()}`);
        await uploadBytes(imageRef, file);
        imageUrl = await getDownloadURL(imageRef);
      }

      const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
      const company = userDoc.exists() ? userDoc.data().company : undefined;

      if (!company) {
        throw new Error('Erreur: Informations entreprise manquantes');
      }

      const productData = {
        name: formData.name,
        description: formData.description,
        price: price,
        category: formData.category,
        reference: formData.reference || `REF-${Date.now()}`,
        allergens: formData.allergens.split(',').map(a => a.trim()).filter(Boolean),
        stock: stock,
        minStock: minStock,
        freshWeight: freshWeight,
        image: imageUrl,
        isFavorite: false,
        createdAt: new Date().toISOString(),
        company: company,
        department: formData.department
      };

      await addDoc(collection(db, 'products'), productData);
      onProductAdded();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-auto">
        <div className="bg-[#8B4513] text-white p-4 flex justify-between items-center sticky top-0">
          <h2 className="font-bold text-xl">Nouveau Produit</h2>
          <button
            onClick={onClose}
            className="text-white hover:bg-[#663300] p-2 rounded-full"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-gray-700 font-medium mb-2">
                Nom du produit *
              </label>
              <input
                type="text"
                required
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-[#8B4513] focus:border-[#8B4513]"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
              />
            </div>

            <div>
              <label className="block text-gray-700 font-medium mb-2">
                Prix (Fcfa) *
              </label>
              <input
                type="number"
                step="0.01"
                required
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-[#8B4513] focus:border-[#8B4513]"
                value={formData.price}
                onChange={(e) => setFormData({...formData, price: e.target.value})}
              />
            </div>
          </div>

          <div className="mt-6">
            <label className="block text-gray-700 font-medium mb-2">
              Description
            </label>
            <textarea
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-[#8B4513] focus:border-[#8B4513]"
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
            <div>
              <label className="block text-gray-700 font-medium mb-2">
                Département *
              </label>
              <select
                required
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-[#8B4513] focus:border-[#8B4513]"
                value={formData.department}
                onChange={(e) => handleDepartmentChange(e.target.value as 'Boulangerie' | 'Boutique')}
              >
                <option value="Boulangerie">Boulangerie</option>
                <option value="Boutique">Boutique</option>
              </select>
            </div>

            <div>
              <label className="block text-gray-700 font-medium mb-2">
                Catégorie *
              </label>
              <select
                required
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-[#8B4513] focus:border-[#8B4513]"
                value={formData.category}
                onChange={(e) => handleCategoryChange(e.target.value)}
                disabled={!formData.department}
              >
                {formData.department === 'Boulangerie' 
                  ? boulangerieCategories.map(cat => (
                      <option key={cat.value} value={cat.value}>
                        {cat.label}
                      </option>
                    ))
                  : boutiqueCategories.map(cat => (
                      <option key={cat.value} value={cat.value}>
                        {cat.label}
                      </option>
                    ))
                }
              </select>
              {formData.department === 'Boutique' && (
                <p className="mt-1 text-sm text-blue-600">
                  Catégories spécifiques à la boutique disponibles
                </p>
              )}
            </div>

            <div>
              <label className="block text-gray-700 font-medium mb-2">
                Référence
              </label>
              <input
                type="text"
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-[#8B4513] focus:border-[#8B4513]"
                value={formData.reference}
                onChange={(e) => setFormData({...formData, reference: e.target.value})}
                placeholder="Généré automatiquement si vide"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
            <div>
              <label className="block text-gray-700 font-medium mb-2">
                Stock initial
              </label>
              <input
                type="number"
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-[#8B4513] focus:border-[#8B4513]"
                value={formData.stock}
                onChange={(e) => setFormData({...formData, stock: e.target.value})}
              />
            </div>

            <div>
              <label className="block text-gray-700 font-medium mb-2">
                Stock minimum
                <span className="ml-1 text-gray-400 hover:text-gray-600 cursor-help" title="Seuil d'alerte pour le réapprovisionnement">
                  ⓘ
                </span>
              </label>
              <input
                type="number"
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-[#8B4513] focus:border-[#8B4513]"
                value={formData.minStock}
                onChange={(e) => setFormData({...formData, minStock: e.target.value})}
              />
            </div>

            <div>
              <label className="block text-gray-700 font-medium mb-2">
                Poids unitaire frais (kg) *
                <span className="ml-1 text-gray-400 hover:text-gray-600 cursor-help" title="Poids du produit à l'état frais">
                  ⓘ
                </span>
              </label>
              <input
                type="number"
                step="0.001"
                required
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-[#8B4513] focus:border-[#8B4513]"
                value={formData.freshWeight}
                onChange={(e) => setFormData({...formData, freshWeight: e.target.value})}
                placeholder="Ex: 0.250"
                min="0.001"
              />
            </div>
          </div>

          <div className="mt-6">
            <label className="block text-gray-700 font-medium mb-2">
              Allergènes
            </label>
            <input
              type="text"
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-[#8B4513] focus:border-[#8B4513]"
              value={formData.allergens}
              onChange={(e) => setFormData({...formData, allergens: e.target.value})}
              placeholder="Séparés par des virgules"
            />
          </div>

          <div className="mt-6">
            <label className="block text-gray-700 font-medium mb-2">
              Image du produit
            </label>
            <div className="mt-2 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-lg">
              <div className="space-y-2 text-center">
                {imagePreview ? (
                  <div className="relative">
                    <img
                      src={imagePreview}
                      alt="Aperçu"
                      className="mx-auto h-32 w-32 object-cover rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setImagePreview(null);
                        if (fileInputRef.current) {
                          fileInputRef.current.value = '';
                        }
                      }}
                      className="absolute top-0 right-0 -mt-2 -mr-2 bg-red-500 text-white rounded-full p-1"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    <Upload className="mx-auto h-12 w-12 text-gray-400" />
                    <div className="flex text-sm text-gray-600">
                      <label className="relative cursor-pointer bg-white rounded-md font-medium text-[#8B4513] hover:text-[#663300]">
                        <span>Télécharger une image</span>
                        <input
                          ref={fileInputRef}
                          type="file"
                          className="sr-only"
                          accept="image/*"
                          onChange={handleImageChange}
                        />
                      </label>
                    </div>
                  </>
                )}
                <p className="text-xs text-gray-500">PNG, JPG jusqu'à 2MB</p>
              </div>
            </div>
          </div>

          {error && (
            <div className="mt-6 p-4 bg-red-100 text-red-700 rounded-lg">
              {error}
            </div>
          )}

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
              disabled={loading}
              className="px-6 py-3 bg-[#8B4513] text-white rounded-lg font-medium hover:bg-[#663300] disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center"
            >
              {loading ? (
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

export default NewProductModal;