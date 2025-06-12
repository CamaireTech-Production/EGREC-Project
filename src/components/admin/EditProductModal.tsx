import React, { useState, useRef } from 'react';
import { X, Upload, Loader2, Save, History } from 'lucide-react';
import { db, storage } from '../../lib/firebase';
import { doc, updateDoc, getDoc, arrayUnion, Timestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { v4 as uuidv4 } from 'uuid';
import { toast } from 'react-hot-toast';
import { Product } from '../../types';
import { useUser } from '../../context/UserContext';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import imageCompression from 'browser-image-compression';

interface EditProductModalProps {
  product: Product;
  onClose: () => void;
  onProductUpdated: () => void;
}

interface ModificationHistory {
  timestamp: Timestamp;
  modifiedBy: string;
  modifiedByName: string;
  changes: {
    field: string;
    oldValue: any;
    newValue: any;
  }[];
  reason?: string;
}

const EditProductModal: React.FC<EditProductModalProps> = ({ 
  product, 
  onClose, 
  onProductUpdated 
}) => {
  const { user } = useUser();
  const [loading, setLoading] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [modificationHistory, setModificationHistory] = useState<ModificationHistory[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    name: product.name,
    description: product.description || '',
    price: product.price.toString(),
    category: product.category,
    reference: product.reference,
    allergens: product.allergens.join(', '),
    minStock: product.minStock?.toString() || '5',
    freshWeight: product.freshWeight?.toString() || '',
    department: product.department,
    image: product.image,
    modificationReason: ''
  });

  React.useEffect(() => {
    const fetchHistory = async () => {
      try {
        const productDoc = await getDoc(doc(db, 'products', product.id));
        if (productDoc.exists()) {
          const data = productDoc.data();
          setModificationHistory(data.modificationHistory || []);
        }
      } catch (error) {
        console.error('Error fetching modification history:', error);
      }
    };

    fetchHistory();
  }, [product.id]);

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error('L\'image ne doit pas dépasser 2MB');
      return;
    }

    try {
      setImageLoading(true);

      // Compress image
      const options = {
        maxSizeMB: 1,
        maxWidthOrHeight: 800,
        useWebWorker: true
      };
      
      const compressedFile = await imageCompression(file, options);
      
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(compressedFile);
      
      // Upload new image
      const imageRef = ref(storage, `products/${uuidv4()}`);
      await uploadBytes(imageRef, compressedFile);
      const imageUrl = await getDownloadURL(imageRef);

      setFormData(prev => ({ ...prev, image: imageUrl }));
      toast.success('Image mise à jour');
    } catch (error) {
      console.error('Error uploading image:', error);
      toast.error('Erreur lors du téléchargement de l\'image');
    } finally {
      setImageLoading(false);
    }
  };

  const detectChanges = () => {
    const changes: { field: string; oldValue: any; newValue: any }[] = [];

    // Compare each field
    if (formData.name !== product.name) {
      changes.push({ field: 'Nom', oldValue: product.name, newValue: formData.name });
    }
    if (formData.description !== (product.description || '')) {
      changes.push({ field: 'Description', oldValue: product.description || '', newValue: formData.description });
    }
    if (parseFloat(formData.price) !== product.price) {
      changes.push({ field: 'Prix', oldValue: product.price, newValue: parseFloat(formData.price) });
    }
    if (formData.category !== product.category) {
      changes.push({ field: 'Catégorie', oldValue: product.category, newValue: formData.category });
    }
    if (formData.reference !== product.reference) {
      changes.push({ field: 'Référence', oldValue: product.reference, newValue: formData.reference });
    }
    if (formData.allergens !== product.allergens.join(', ')) {
      changes.push({ field: 'Allergènes', oldValue: product.allergens.join(', '), newValue: formData.allergens });
    }
    if (parseInt(formData.minStock) !== (product.minStock || 5)) {
      changes.push({ field: 'Stock minimum', oldValue: product.minStock || 5, newValue: parseInt(formData.minStock) });
    }
    if (parseFloat(formData.freshWeight) !== (product.freshWeight || 0)) {
      changes.push({ field: 'Poids unitaire', oldValue: product.freshWeight || 0, newValue: parseFloat(formData.freshWeight) });
    }
    if (formData.department !== product.department) {
      changes.push({ field: 'Département', oldValue: product.department, newValue: formData.department });
    }
    if (formData.image !== product.image) {
      changes.push({ field: 'Image', oldValue: 'Image précédente', newValue: 'Nouvelle image' });
    }

    return changes;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const price = parseFloat(formData.price);
    const minStock = parseInt(formData.minStock);
    const freshWeight = parseFloat(formData.freshWeight);

    if (isNaN(price) || price <= 0) {
      toast.error('Le prix doit être un nombre positif');
      return;
    }

    if (isNaN(minStock) || minStock < 0) {
      toast.error('Le stock minimum doit être un nombre positif');
      return;
    }

    if (isNaN(freshWeight) || freshWeight <= 0) {
      toast.error('Le poids unitaire doit être un nombre positif');
      return;
    }

    const changes = detectChanges();
    
    if (changes.length === 0) {
      toast.error('Aucune modification détectée');
      return;
    }

    if (!formData.modificationReason.trim()) {
      toast.error('Veuillez indiquer la raison de la modification');
      return;
    }

    setLoading(true);
    try {
      // Delete old image if a new one was uploaded
      if (formData.image !== product.image && product.image) {
        try {
          const oldImageRef = ref(storage, product.image);
          await deleteObject(oldImageRef);
        } catch (error) {
          console.error('Error deleting old image:', error);
        }
      }

      const updateData = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        price: price,
        category: formData.category,
        reference: formData.reference.trim(),
        allergens: formData.allergens.split(',').map(a => a.trim()).filter(Boolean),
        minStock: minStock,
        freshWeight: freshWeight,
        department: formData.department,
        image: formData.image,
        updatedAt: Timestamp.now(),
        lastModifiedBy: user.id,
        lastModifiedByName: `${user.firstName} ${user.lastName}`,
        modificationHistory: arrayUnion({
          timestamp: Timestamp.now(),
          modifiedBy: user.id,
          modifiedByName: `${user.firstName} ${user.lastName}`,
          changes: changes,
          reason: formData.modificationReason.trim()
        })
      };

      await updateDoc(doc(db, 'products', product.id), updateData);
      
      toast.success('Produit modifié avec succès');
      onProductUpdated();
      onClose();
    } catch (error) {
      console.error('Error updating product:', error);
      toast.error('Erreur lors de la modification du produit');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-auto">
        <div className="bg-[#8B4513] text-white p-4 flex justify-between items-center sticky top-0">
          <h2 className="font-bold text-xl">Modifier le Produit</h2>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="text-white hover:bg-[#663300] p-2 rounded-full"
              title="Historique des modifications"
            >
              <History className="h-5 w-5" />
            </button>
            <button
              onClick={onClose}
              className="text-white hover:bg-[#663300] p-2 rounded-full"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        {showHistory && (
          <div className="bg-gray-50 p-4 border-b">
            <h3 className="font-bold text-lg mb-4">Historique des Modifications</h3>
            {modificationHistory.length === 0 ? (
              <p className="text-gray-500">Aucune modification enregistrée</p>
            ) : (
              <div className="space-y-4 max-h-60 overflow-y-auto">
                {modificationHistory.map((entry, index) => (
                  <div key={index} className="bg-white p-4 rounded-lg border">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-medium">{entry.modifiedByName}</p>
                        <p className="text-sm text-gray-500">
                          {format(entry.timestamp.toDate(), 'dd MMMM yyyy à HH:mm', { locale: fr })}
                        </p>
                      </div>
                      {entry.reason && (
                        <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
                          {entry.reason}
                        </span>
                      )}
                    </div>
                    <div className="space-y-1">
                      {entry.changes.map((change, changeIndex) => (
                        <div key={changeIndex} className="text-sm">
                          <span className="font-medium">{change.field}:</span>
                          <span className="text-red-600 line-through ml-2">{change.oldValue}</span>
                          <span className="text-green-600 ml-2">→ {change.newValue}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

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
                onChange={(e) => setFormData({...formData, department: e.target.value as 'Boulangerie' | 'Boutique'})}
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
                onChange={(e) => setFormData({...formData, category: e.target.value})}
              >
                <option value="pains">Pains</option>
                <option value="viennoiseries">Viennoiseries</option>
                <option value="patisseries">Pâtisseries</option>
              </select>
            </div>

            <div>
              <label className="block text-gray-700 font-medium mb-2">
                Référence *
              </label>
              <input
                type="text"
                required
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-[#8B4513] focus:border-[#8B4513]"
                value={formData.reference}
                onChange={(e) => setFormData({...formData, reference: e.target.value})}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
            <div>
              <label className="block text-gray-700 font-medium mb-2">
                Stock minimum
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
              </label>
              <input
                type="number"
                step="0.001"
                required
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-[#8B4513] focus:border-[#8B4513]"
                value={formData.freshWeight}
                onChange={(e) => setFormData({...formData, freshWeight: e.target.value})}
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
                {(imagePreview || formData.image) ? (
                  <div className="relative">
                    <img
                      src={imagePreview || formData.image}
                      alt="Aperçu"
                      className="mx-auto h-32 w-32 object-cover rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setImagePreview(null);
                        setFormData({...formData, image: ''});
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

          <div className="mt-6">
            <label className="block text-gray-700 font-medium mb-2">
              Raison de la modification *
            </label>
            <textarea
              required
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-[#8B4513] focus:border-[#8B4513]"
              rows={3}
              value={formData.modificationReason}
              onChange={(e) => setFormData({...formData, modificationReason: e.target.value})}
              placeholder="Expliquez pourquoi vous modifiez ce produit..."
            />
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
              disabled={loading || imageLoading}
              className="px-6 py-3 bg-[#8B4513] text-white rounded-lg font-medium hover:bg-[#663300] disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center"
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin h-5 w-5 mr-2" />
                  Enregistrement...
                </>
              ) : (
                <>
                  <Save className="h-5 w-5 mr-2" />
                  Enregistrer les modifications
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditProductModal;