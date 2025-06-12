import React, { useState, useEffect } from 'react';
import { X, Plus, Minus, Loader2, Save, Truck, Package, Factory } from 'lucide-react';
import { collection, addDoc, query, where, getDocs, Timestamp, doc, updateDoc, runTransaction } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { useUser } from '../../../context/UserContext';
import { toast } from 'react-hot-toast';
import { v4 as uuidv4 } from 'uuid';
import { generateMovementPDF } from '../../../lib/movementPDF';

interface NewMovementModalProps {
  onClose: () => void;
  onMovementAdded: () => void;
}

interface ProductLine {
  productId: string;
  productName: string;
  quantity: number;
  unit: string;
}

interface Agency {
  id: string;
  name: string;
}

interface Product {
  id: string;
  name: string;
  reference: string;
  department: 'Boulangerie' | 'Boutique';
  stockParAgence?: { [agency: string]: number };
}

const NewMovementModal: React.FC<NewMovementModalProps> = ({ onClose, onMovementAdded }) => {
  const { user } = useUser();
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState<'Boulangerie' | 'Boutique'>('Boulangerie');
  const [formData, setFormData] = useState({
    movementType: 'factory_supply' as 'factory_supply' | 'incoming_transfer' | 'outgoing_transfer',
    referenceNumber: `MOV-${Date.now()}`,
    date: new Date().toISOString().slice(0, 16),
    operatorName: '',
    vehicleRegistration: '',
    supplyCode: '',
    sourceAgency: '',
    destinationAgency: '',
    comments: ''
  });
  const [productLines, setProductLines] = useState<ProductLine[]>([
    { productId: '', productName: '', quantity: 0, unit: 'kg' }
  ]);

  useEffect(() => {
    const fetchData = async () => {
      if (!user?.company) return;

      try {
        // Fetch products
        const productsQuery = query(
          collection(db, 'products'),
          where('company', '==', user.company)
        );
        const productsSnapshot = await getDocs(productsQuery);
        const productsData = productsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Product[];
        setProducts(productsData);

        // Fetch agencies
        const usersQuery = query(
          collection(db, 'users'),
          where('company', '==', user.company)
        );
        const usersSnapshot = await getDocs(usersQuery);
        const uniqueAgencies = Array.from(new Set(
          usersSnapshot.docs
            .map(doc => doc.data().agencyName)
            .filter(Boolean)
        )).map(name => ({ id: name, name }));
        setAgencies(uniqueAgencies);
      } catch (error) {
        console.error('Error fetching data:', error);
        toast.error('Erreur lors du chargement des données');
      }
    };

    fetchData();
  }, [user?.company]);

  // Filter products by selected department
  const filteredProducts = products.filter(product => product.department === selectedDepartment);

  // Get available products (not already selected)
  const getAvailableProducts = (currentIndex: number) => {
    const selectedProductIds = productLines
      .map((line, index) => index !== currentIndex ? line.productId : null)
      .filter(Boolean);
    
    return filteredProducts.filter(product => !selectedProductIds.includes(product.id));
  };

  const addProductLine = () => {
    setProductLines([...productLines, { productId: '', productName: '', quantity: 0, unit: 'kg' }]);
  };

  const removeProductLine = (index: number) => {
    if (productLines.length > 1) {
      setProductLines(productLines.filter((_, i) => i !== index));
    }
  };

  const updateProductLine = (index: number, field: keyof ProductLine, value: string | number) => {
    const updatedLines = [...productLines];
    
    if (field === 'productId') {
      const product = filteredProducts.find(p => p.id === value);
      updatedLines[index] = {
        ...updatedLines[index],
        productId: value as string,
        productName: product?.name || ''
      };
    } else {
      updatedLines[index] = {
        ...updatedLines[index],
        [field]: value
      };
    }
    
    setProductLines(updatedLines);
  };

  const validateForm = () => {
    if (!selectedDepartment) {
      toast.error('Veuillez sélectionner un département');
      return false;
    }

    if (!formData.operatorName.trim()) {
      toast.error('Le nom de l\'opérateur est requis');
      return false;
    }

    if (!formData.vehicleRegistration.trim()) {
      toast.error('L\'immatriculation du véhicule est requise');
      return false;
    }

    if (formData.movementType === 'factory_supply' && !formData.supplyCode.trim()) {
      toast.error('Le code d\'approvisionnement est requis pour les livraisons usine');
      return false;
    }

    if (formData.movementType === 'incoming_transfer' && !formData.sourceAgency) {
      toast.error('L\'agence source est requise pour les transferts entrants');
      return false;
    }

    if (formData.movementType === 'outgoing_transfer' && !formData.destinationAgency) {
      toast.error('L\'agence de destination est requise pour les transferts sortants');
      return false;
    }

    const validProducts = productLines.filter(line => line.productId && line.quantity > 0);
    if (validProducts.length === 0) {
      toast.error('Au moins un produit avec une quantité positive est requis');
      return false;
    }

    // Check for duplicate products
    const productIds = validProducts.map(line => line.productId);
    const uniqueProductIds = new Set(productIds);
    if (productIds.length !== uniqueProductIds.size) {
      toast.error('Un même produit ne peut être sélectionné qu\'une seule fois');
      return false;
    }

    return true;
  };

  const updateProductStock = async (validProducts: ProductLine[]) => {
    if (!user?.agencyName) return;

    try {
      await runTransaction(db, async (transaction) => {
        // Read all product documents first
        const productReads = await Promise.all(
          validProducts.map(async (productLine) => {
            const productRef = doc(db, 'products', productLine.productId);
            const productDoc = await transaction.get(productRef);
            return {
              ref: productRef,
              doc: productDoc,
              productLine
            };
          })
        );

        // Prepare updates based on movement type
        const updates = productReads.map(({ ref, doc, productLine }) => {
          if (!doc.exists()) {
            throw new Error(`Produit non trouvé: ${productLine.productName}`);
          }

          const productData = doc.data();
          const stockParAgence = productData.stockParAgence || {};
          
          // Determine stock change based on movement type
          let stockChange = 0;
          
          switch (formData.movementType) {
            case 'factory_supply':
            case 'incoming_transfer':
              // Incoming movements increase stock
              stockChange = productLine.quantity;
              break;
            case 'outgoing_transfer':
              // Outgoing movements decrease stock
              stockChange = -productLine.quantity;
              break;
          }

          // Update agency stock
          const currentStock = stockParAgence[user.agencyName] || 0;
          const newStock = Math.max(0, currentStock + stockChange);
          stockParAgence[user.agencyName] = newStock;

          return {
            ref,
            updates: {
              stockParAgence,
              updatedAt: Timestamp.now()
            }
          };
        });

        // Execute all updates
        updates.forEach(({ ref, updates }) => {
          transaction.update(ref, updates);
        });
      });

      toast.success('Stock mis à jour avec succès');
    } catch (error) {
      console.error('Error updating stock:', error);
      toast.error('Erreur lors de la mise à jour du stock');
      throw error;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !validateForm()) return;

    setLoading(true);
    try {
      const validProducts = productLines.filter(line => line.productId && line.quantity > 0);
      const totalQuantity = validProducts.reduce((sum, line) => sum + line.quantity, 0);

      const movementData = {
        movementType: formData.movementType,
        department: selectedDepartment,
        referenceNumber: formData.referenceNumber,
        date: Timestamp.fromDate(new Date(formData.date)),
        operatorName: formData.operatorName.trim(),
        vehicleRegistration: formData.vehicleRegistration.trim().toUpperCase(),
        supplyCode: formData.supplyCode.trim(),
        sourceAgency: formData.sourceAgency,
        destinationAgency: formData.destinationAgency,
        comments: formData.comments.trim(),
        products: validProducts,
        totalQuantity,
        status: 'pending',
        createdBy: user.id,
        createdByName: `${user.firstName} ${user.lastName}`,
        company: user.company,
        agency: user.agencyName,
        createdAt: Timestamp.now()
      };

      // Create movement document
      const docRef = await addDoc(collection(db, 'stockMovements'), movementData);

      // Update product stock
      await updateProductStock(validProducts);

      // Generate PDF
      await generateMovementPDF({
        ...movementData,
        id: docRef.id,
        date: new Date(formData.date),
        createdAt: new Date()
      });

      toast.success('Mouvement de stock créé avec succès');
      onMovementAdded();
      onClose();
    } catch (error) {
      console.error('Error creating movement:', error);
      toast.error('Erreur lors de la création du mouvement');
    } finally {
      setLoading(false);
    }
  };

  const getMovementTypeIcon = () => {
    switch (formData.movementType) {
      case 'factory_supply':
        return <Factory className="h-5 w-5" />;
      case 'incoming_transfer':
        return <Package className="h-5 w-5" />;
      case 'outgoing_transfer':
        return <Truck className="h-5 w-5" />;
      default:
        return <Package className="h-5 w-5" />;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[95vh] overflow-auto">
        <div className="bg-[#8B4513] text-white p-6 flex justify-between items-center sticky top-0 z-10">
          <div className="flex items-center">
            {getMovementTypeIcon()}
            <h2 className="font-bold text-xl ml-2">Nouveau Mouvement de Stock</h2>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-[#663300] p-2 rounded-full transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          {/* Department Selection */}
          <div className="mb-8">
            <label className="block text-gray-700 font-medium mb-4">
              Département concerné <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { value: 'Boulangerie', label: 'Boulangerie', icon: Package, color: 'orange' },
                { value: 'Boutique', label: 'Boutique', icon: Package, color: 'blue' }
              ].map((dept) => {
                const Icon = dept.icon;
                const isSelected = selectedDepartment === dept.value;
                return (
                  <label
                    key={dept.value}
                    className={`flex items-center p-4 border-2 rounded-xl cursor-pointer transition-all ${
                      isSelected
                        ? `border-${dept.color}-500 bg-${dept.color}-50`
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="department"
                      value={dept.value}
                      checked={isSelected}
                      onChange={(e) => {
                        setSelectedDepartment(e.target.value as 'Boulangerie' | 'Boutique');
                        // Reset product lines when department changes
                        setProductLines([{ productId: '', productName: '', quantity: 0, unit: 'kg' }]);
                      }}
                      className="sr-only"
                      required
                    />
                    <Icon className={`h-6 w-6 mr-3 ${isSelected ? `text-${dept.color}-600` : 'text-gray-400'}`} />
                    <div>
                      <span className={`font-medium ${isSelected ? `text-${dept.color}-900` : 'text-gray-700'}`}>
                        {dept.label}
                      </span>
                      <p className="text-sm text-gray-500 mt-1">
                        {filteredProducts.length} produit{filteredProducts.length > 1 ? 's' : ''} disponible{filteredProducts.length > 1 ? 's' : ''}
                      </p>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Movement Type Selection */}
          <div className="mb-8">
            <label className="block text-gray-700 font-medium mb-4">Type de mouvement</label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { value: 'factory_supply', label: 'Approvisionnement Usine', icon: Factory, color: 'purple' },
                { value: 'incoming_transfer', label: 'Transfert Entrant', icon: Package, color: 'green' },
                { value: 'outgoing_transfer', label: 'Transfert Sortant', icon: Truck, color: 'blue' }
              ].map((type) => {
                const Icon = type.icon;
                const isSelected = formData.movementType === type.value;
                return (
                  <label
                    key={type.value}
                    className={`flex items-center p-4 border-2 rounded-xl cursor-pointer transition-all ${
                      isSelected
                        ? `border-${type.color}-500 bg-${type.color}-50`
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="movementType"
                      value={type.value}
                      checked={isSelected}
                      onChange={(e) => setFormData({ ...formData, movementType: e.target.value as any })}
                      className="sr-only"
                    />
                    <Icon className={`h-6 w-6 mr-3 ${isSelected ? `text-${type.color}-600` : 'text-gray-400'}`} />
                    <span className={`font-medium ${isSelected ? `text-${type.color}-900` : 'text-gray-700'}`}>
                      {type.label}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Basic Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div>
              <label className="block text-gray-700 font-medium mb-2">
                Numéro de référence <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.referenceNumber}
                onChange={(e) => setFormData({ ...formData, referenceNumber: e.target.value })}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-[#8B4513] focus:border-[#8B4513]"
                required
              />
            </div>

            <div>
              <label className="block text-gray-700 font-medium mb-2">
                Date et heure <span className="text-red-500">*</span>
              </label>
              <input
                type="datetime-local"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-[#8B4513] focus:border-[#8B4513]"
                required
              />
            </div>

            <div>
              <label className="block text-gray-700 font-medium mb-2">
                Nom de l'opérateur <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.operatorName}
                onChange={(e) => setFormData({ ...formData, operatorName: e.target.value })}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-[#8B4513] focus:border-[#8B4513]"
                required
                placeholder="Nom complet de l'opérateur"
              />
            </div>

            <div>
              <label className="block text-gray-700 font-medium mb-2">
                Immatriculation véhicule <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.vehicleRegistration}
                onChange={(e) => setFormData({ ...formData, vehicleRegistration: e.target.value })}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-[#8B4513] focus:border-[#8B4513]"
                required
                placeholder="Ex: AB-123-CD"
              />
            </div>
          </div>

          {/* Conditional Fields */}
          {formData.movementType === 'factory_supply' && (
            <div className="mb-8">
              <label className="block text-gray-700 font-medium mb-2">
                Code d'approvisionnement <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.supplyCode}
                onChange={(e) => setFormData({ ...formData, supplyCode: e.target.value })}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-[#8B4513] focus:border-[#8B4513]"
                required
                placeholder="Code fourni par l'usine"
              />
            </div>
          )}

          {formData.movementType === 'incoming_transfer' && (
            <div className="mb-8">
              <label className="block text-gray-700 font-medium mb-2">
                Agence source <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.sourceAgency}
                onChange={(e) => setFormData({ ...formData, sourceAgency: e.target.value })}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-[#8B4513] focus:border-[#8B4513]"
                required
              >
                <option value="">Sélectionner l'agence source</option>
                {agencies.filter(agency => agency.name !== user?.agencyName).map(agency => (
                  <option key={agency.id} value={agency.name}>
                    {agency.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {formData.movementType === 'outgoing_transfer' && (
            <div className="mb-8">
              <label className="block text-gray-700 font-medium mb-2">
                Agence de destination <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.destinationAgency}
                onChange={(e) => setFormData({ ...formData, destinationAgency: e.target.value })}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-[#8B4513] focus:border-[#8B4513]"
                required
              >
                <option value="">Sélectionner l'agence de destination</option>
                {agencies.filter(agency => agency.name !== user?.agencyName).map(agency => (
                  <option key={agency.id} value={agency.name}>
                    {agency.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Products Section */}
          <div className="mb-8">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg text-[#8B4513]">
                Produits ({selectedDepartment})
              </h3>
              <button
                type="button"
                onClick={addProductLine}
                className="flex items-center px-4 py-2 bg-[#8B4513] text-white rounded-lg hover:bg-[#663300] transition-colors"
                disabled={!selectedDepartment}
              >
                <Plus className="h-5 w-5 mr-2" />
                Ajouter un produit
              </button>
            </div>

            {!selectedDepartment && (
              <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4">
                <p className="text-yellow-700">
                  Veuillez d'abord sélectionner un département pour voir les produits disponibles.
                </p>
              </div>
            )}

            <div className="space-y-4">
              {productLines.map((line, index) => {
                const availableProducts = getAvailableProducts(index);
                
                return (
                  <div key={index} className="flex gap-4 items-end p-4 bg-gray-50 rounded-lg">
                    <div className="flex-grow">
                      <label className="block text-gray-700 font-medium mb-2">
                        Produit
                      </label>
                      <select
                        value={line.productId}
                        onChange={(e) => updateProductLine(index, 'productId', e.target.value)}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-[#8B4513] focus:border-[#8B4513]"
                        required
                        disabled={!selectedDepartment}
                      >
                        <option value="">Sélectionner un produit</option>
                        {availableProducts.map(product => (
                          <option key={product.id} value={product.id}>
                            {product.name} - {product.reference}
                          </option>
                        ))}
                      </select>
                      {availableProducts.length === 0 && selectedDepartment && (
                        <p className="mt-1 text-sm text-red-600">
                          Tous les produits de ce département ont déjà été sélectionnés
                        </p>
                      )}
                    </div>

                    <div className="w-32">
                      <label className="block text-gray-700 font-medium mb-2">
                        Quantité
                      </label>
                      <input
                        type="number"
                        value={line.quantity}
                        onChange={(e) => updateProductLine(index, 'quantity', parseFloat(e.target.value) || 0)}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-[#8B4513] focus:border-[#8B4513]"
                        min="0"
                        step="0.01"
                        required
                      />
                    </div>

                    <div className="w-24">
                      <label className="block text-gray-700 font-medium mb-2">
                        Unité
                      </label>
                      <select
                        value={line.unit}
                        onChange={(e) => updateProductLine(index, 'unit', e.target.value)}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-[#8B4513] focus:border-[#8B4513]"
                      >
                        <option value="kg">kg</option>
                        <option value="g">g</option>
                        <option value="L">L</option>
                        <option value="mL">mL</option>
                        <option value="unité">unité</option>
                        <option value="carton">carton</option>
                        <option value="palette">palette</option>
                      </select>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeProductLine(index)}
                      disabled={productLines.length === 1}
                      className="p-3 text-red-500 hover:bg-red-50 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Minus className="h-5 w-5" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Comments */}
          <div className="mb-8">
            <label className="block text-gray-700 font-medium mb-2">
              Commentaires / Notes
            </label>
            <textarea
              value={formData.comments}
              onChange={(e) => setFormData({ ...formData, comments: e.target.value })}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-[#8B4513] focus:border-[#8B4513]"
              rows={4}
              placeholder="Informations supplémentaires, instructions spéciales..."
            />
          </div>

          {/* Submit Buttons */}
          <div className="flex justify-end space-x-4">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-100 transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading || !selectedDepartment}
              className="px-6 py-3 bg-[#8B4513] text-white rounded-lg font-medium hover:bg-[#663300] disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center transition-colors"
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin h-5 w-5 mr-2" />
                  Création...
                </>
              ) : (
                <>
                  <Save className="h-5 w-5 mr-2" />
                  Créer le mouvement
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default NewMovementModal;