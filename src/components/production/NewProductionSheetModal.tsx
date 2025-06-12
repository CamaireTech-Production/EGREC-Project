import React, { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, query, where, orderBy, doc, getDoc, Timestamp, updateDoc } from 'firebase/firestore';
import { db, auth } from '../../lib/firebase';
import { toast } from 'react-hot-toast';
import { Product } from '../../types';
import ProductionSheetPreview from './ProductionSheetPreview';
import { printProductionSheet } from '../../lib/productionSheet';
import { X, Plus, Minus, Loader2 } from 'lucide-react';
import { useUser } from '../../context/UserContext';

interface MaterialLine {
  materialId: string;
  materialName?: string;
  quantity: number;
  unitPrice: number;
  unit?: string; // Ajout de l'unité pour la gestion des conversions
}

interface ProductLine {
  productId: string;
  productName?: string;
  quantity: number;
  unitPrice: number;
  weightPerUnit: number;
}

const NewProductionSheetModal: React.FC<{
  onClose: () => void;
  onSheetAdded: () => void;
}> = ({ onClose, onSheetAdded }) => {
  const { user, loading: userLoading } = useUser();
  const [materials, setMaterials] = useState<any[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPreview, setShowPreview] = useState(false);
  const [formData, setFormData] = useState({
    dateProduction: new Date().toISOString().split('T')[0],
    responsable: user?.firstName ? `${user.firstName} ${user.lastName}` : '',
    materialsUsed: [] as MaterialLine[],
    productsProduced: [] as ProductLine[],
    totals: {
      materialsTotalWeight: 0,
      materialsTotalCost: 0,
      productionTotalQuantity: 0,
      productionTotalWeight: 0,
      productionTotalAmount: 0,
      profitabilityRate: 0,
      weightDifference: 0
    },
    agency: user?.agencyName || '',
    createdBy: user?.id || ''
  });

  const [materialPrices, setMaterialPrices] = useState<{[key: string]: number}>({});

  useEffect(() => {
    const fetchData = async () => {
      if (!user?.company) return;

      try {
        // Query materials for this company
        const materialsQuery = query(
          collection(db, 'matieresPremiere'),
          where('company', '==', user.company),
          orderBy('nom', 'asc')
        );
        
        const materialsSnapshot = await getDocs(materialsQuery);
        const materialsData = materialsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setMaterials(materialsData);

        const prices: {[key: string]: number} = {};
        materialsData.forEach(material => {
          prices[material.id] = material.prixUnitaire;
        });
        setMaterialPrices(prices);

        // Query products for this company - FILTER BY DEPARTMENT "Boulangerie"
        // Removed orderBy to avoid composite index requirement
        const productsQuery = query(
          collection(db, 'products'),
          where('company', '==', user.company),
          where('department', '==', 'Boulangerie')
        );
        
        const productsSnapshot = await getDocs(productsQuery);
        const productsData = productsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Product[];
        
        // Sort products by name in the frontend
        const sortedProducts = productsData.sort((a, b) => a.name.localeCompare(b.name));
        
        setProducts(sortedProducts);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching data:', error);
        toast.error('Erreur lors du chargement des données');
        setLoading(false);
      }
    };

    if (!userLoading) {
      fetchData();
    }
  }, [user, userLoading]);

  const addMaterialLine = () => {
    setFormData(prev => ({
      ...prev,
      materialsUsed: [...prev.materialsUsed, { materialId: '', quantity: 0, unitPrice: 0, unit: '' }]
    }));
  };

  const removeMaterialLine = (index: number) => {
    setFormData(prev => {
      const newData = {
        ...prev,
        materialsUsed: prev.materialsUsed.filter((_, i) => i !== index)
      };
      return {
        ...newData,
        totals: calculateTotals(newData.materialsUsed, newData.productsProduced)
      };
    });
  };

  const updateMaterialLine = (index: number, field: keyof MaterialLine, value: string | number) => {
    setFormData(prev => {
      const updatedLines = [...prev.materialsUsed];
      const updatedLine = { ...updatedLines[index] };

      if (field === 'materialId' && typeof value === 'string') {
        // Check if material already exists in the list
        const materialExists = prev.materialsUsed.some(
          (line, i) => i !== index && line.materialId === value
        );

        if (materialExists) {
          toast.error('Cette matière est déjà présente dans la fiche');
          return prev;
        }

        const material = materials.find(m => m.id === value);
        updatedLine.materialId = value;
        updatedLine.materialName = material?.nom || '';
        updatedLine.unitPrice = materialPrices[value] || 0;
        updatedLine.unit = material?.uniteMessure || '';
      } else if (field === 'quantity') {
        const quantity = typeof value === 'string' ? parseFloat(value) : value;
        updatedLine.quantity = Math.max(0, Math.round(quantity * 100) / 100);
      } else {
        updatedLine[field] = value;
      }

      updatedLines[index] = updatedLine;
      const newData = { ...prev, materialsUsed: updatedLines };
      return {
        ...newData,
        totals: calculateTotals(newData.materialsUsed, newData.productsProduced)
      };
    });
  };

  const addProductLine = () => {
    setFormData(prev => ({
      ...prev,
      productsProduced: [...prev.productsProduced, { 
        productId: '', 
        productName: '',
        quantity: 0, 
        unitPrice: 0,
        weightPerUnit: 0
      }]
    }));
  };

  const removeProductLine = (index: number) => {
    setFormData(prev => {
      const newData = {
        ...prev,
        productsProduced: prev.productsProduced.filter((_, i) => i !== index)
      };
      return {
        ...newData,
        totals: calculateTotals(newData.materialsUsed, newData.productsProduced)
      };
    });
  };

  const updateProductLine = (index: number, field: keyof ProductLine, value: string | number) => {
    setFormData(prev => {
      const updatedLines = [...prev.productsProduced];
      const updatedLine = { ...updatedLines[index] };
      
      if (field === 'productId' && typeof value === 'string') {
        const product = products.find(p => p.id === value);
        if (product) {
          updatedLine.productId = value;
          updatedLine.productName = product.name;
          updatedLine.unitPrice = product.price;
          updatedLine.weightPerUnit = product.freshWeight;
        }
      } else if (field === 'quantity') {
        const quantity = typeof value === 'string' ? parseInt(value) : value;
        updatedLine.quantity = Math.max(0, quantity);
      } else {
        updatedLine[field] = value;
      }
      
      updatedLines[index] = updatedLine;
      const newData = { ...prev, productsProduced: updatedLines };
      return {
        ...newData,
        totals: calculateTotals(newData.materialsUsed, newData.productsProduced)
      };
    });
  };

  // Fonction pour convertir les quantités en kilogrammes
  const convertToKilograms = (quantity: number, unit: string): number => {
    if (unit === 'g') {
      return quantity / 1000; // Convertir grammes en kilogrammes
    }
    return quantity; // Retourner la quantité telle quelle pour les autres unités
  };

  const calculateTotals = (materials: MaterialLine[], products: ProductLine[]) => {
    // Calculer le poids total des matières en convertissant les grammes en kilogrammes
    const materialsTotalWeight = materials.reduce((sum, line) => {
      const convertedQuantity = convertToKilograms(line.quantity, line.unit || '');
      return sum + Math.round(convertedQuantity * 100) / 100;
    }, 0);
    
    const materialsTotalCost = materials.reduce((sum, line) => 
      sum + (line.quantity * line.unitPrice), 0
    );
    
    const productionTotalQuantity = products.reduce((sum, line) => 
      sum + line.quantity, 0
    );
    
    const productionTotalWeight = products.reduce((sum, line) => 
      sum + Math.round(line.quantity * line.weightPerUnit * 100) / 100, 0
    );
    
    const productionTotalAmount = products.reduce((sum, line) => 
      sum + (line.quantity * line.unitPrice), 0
    );

    // Calcul du taux de rentabilité (en pourcentage)
    // Formule corrigée: (montant total production - cout total matière) / montant total production * 100
    const profitabilityRate = productionTotalAmount > 0 
      ? ((productionTotalAmount - materialsTotalCost) / productionTotalAmount) * 100 
      : 0;

    // Calcul de la différence de poids
    const weightDifference = productionTotalWeight - materialsTotalWeight;

    return {
      materialsTotalWeight: Math.round(materialsTotalWeight * 100) / 100,
      materialsTotalCost,
      productionTotalQuantity,
      productionTotalWeight: Math.round(productionTotalWeight * 100) / 100,
      productionTotalAmount,
      profitabilityRate: Math.round(profitabilityRate * 100) / 100,
      weightDifference: Math.round(weightDifference * 100) / 100
    };
  };

  const validateForm = () => {
    const invalidMaterial = formData.materialsUsed.find(line => 
      line.quantity <= 0 || line.quantity > 999.99
    );
    if (invalidMaterial) {
      toast.error('Les quantités de matières premières doivent être comprises entre 0.01 et 999.99');
      return false;
    }

    const invalidProduct = formData.productsProduced.find(line => 
      line.quantity <= 0
    );
    if (invalidProduct) {
      toast.error('Les quantités de produits doivent être positives');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    const totals = calculateTotals(formData.materialsUsed, formData.productsProduced);
    setFormData(prev => ({
      ...prev,
      totals
    }));
    setShowPreview(true);
  };

  const handleConfirmAndPrint = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const totals = calculateTotals(formData.materialsUsed, formData.productsProduced);
      const sheetNumber = `FP-${Date.now()}`;

      // First, update stock for each product
      for (const product of formData.productsProduced) {
        const productRef = doc(db, 'products', product.productId);
        const productDoc = await getDoc(productRef);
        
        if (productDoc.exists()) {
          const productData = productDoc.data();
          const stockParAgence = productData.stockParAgence || {};
          const currentStock = stockParAgence[user.agencyName] || 0;
          
          // Update agency-specific stock
          stockParAgence[user.agencyName] = currentStock + product.quantity;
          
          await updateDoc(productRef, {
            stockParAgence,
            updatedAt: Timestamp.now()
          });
        }
      }

      const sheetData = {
        numero: sheetNumber,
        dateProduction: Timestamp.fromDate(new Date(formData.dateProduction)),
        responsable: formData.responsable,
        materialsUsed: formData.materialsUsed.map(line => ({
          ...line,
          quantity: Math.round(line.quantity * 100) / 100
        })),
        productsProduced: formData.productsProduced.map(line => ({
          ...line,
          weightPerUnit: Math.round(line.weightPerUnit * 100) / 100
        })),
        poidsMatieres: totals.materialsTotalWeight,
        coutMatieres: totals.materialsTotalCost,
        quantiteTotale: totals.productionTotalQuantity,
        poidsTotal: totals.productionTotalWeight,
        montantTotal: totals.productionTotalAmount,
        tauxRentabilite: totals.profitabilityRate,
        differencePoidsTotal: totals.weightDifference,
        entrepriseId: user.id,
        agency: formData.agency,
        createdBy: formData.createdBy,
        createdAt: Timestamp.now(),
        department: 'Boulangerie' // Ajout du département
      };

      await addDoc(collection(db, 'fichesProduction'), sheetData);

      printProductionSheet({
        ...sheetData,
        dateProduction: formData.dateProduction,
        materialsUsed: formData.materialsUsed,
        productsProduced: formData.productsProduced,
        totals,
        company: user.company
      });

      toast.success('Fiche de production créée avec succès');
      onSheetAdded();
      onClose();
    } catch (error) {
      console.error('Erreur lors de la création:', error);
      toast.error('Erreur lors de la création de la fiche');
    } finally {
      setLoading(false);
    }
  };

  // Fonction pour obtenir l'unité d'affichage
  const getDisplayUnit = (materialId: string): string => {
    const material = materials.find(m => m.id === materialId);
    if (material?.uniteMessure === 'g') {
      return 'g';
    }
    return 'kg';
  };

  if (showPreview) {
    return (
      <ProductionSheetPreview
        data={formData}
        onConfirm={handleConfirmAndPrint}
        onEdit={() => setShowPreview(false)}
        onClose={onClose}
      />
    );
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[95vh] overflow-auto">
        <div className="bg-[#8B4513] text-white p-6 flex justify-between items-center sticky top-0 z-10">
          <div className="flex items-center">
            <h2 className="font-bold text-xl ml-2">Nouvelle Fiche de Production - Boulangerie</h2>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-[#663300] p-2 rounded-full transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div>
              <label className="block text-gray-700 font-medium mb-2">
                Date de Production
              </label>
              <input
                type="date"
                value={formData.dateProduction}
                onChange={(e) => setFormData({ ...formData, dateProduction: e.target.value })}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-[#8B4513] focus:border-[#8B4513]"
                required
              />
            </div>

            <div>
              <label className="block text-gray-700 font-medium mb-2">
                Responsable
              </label>
              <input
                type="text"
                value={formData.responsable}
                onChange={(e) => setFormData({ ...formData, responsable: e.target.value })}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-[#8B4513] focus:border-[#8B4513]"
                required
                placeholder="Nom du responsable"
              />
            </div>
          </div>

          <div className="mb-8">
            <h3 className="font-bold text-lg mb-4 text-[#8B4513]">Matières Premières Utilisées</h3>
            
            {formData.materialsUsed.map((line, index) => (
              <div key={index} className="flex gap-4 mb-4">
                <div className="flex-grow">
                  <select
                    value={line.materialId}
                    onChange={(e) => updateMaterialLine(index, 'materialId', e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-[#8B4513] focus:border-[#8B4513]"
                    required
                  >
                    <option value="">Sélectionner une matière</option>
                    {materials.map(material => (
                      <option key={material.id} value={material.id}>
                        {material.nom} ({material.uniteMessure})
                      </option>
                    ))}
                  </select>
                  {line.materialName && (
                    <p className="mt-1 text-sm text-gray-600">{line.materialName}</p>
                  )}
                </div>
                
                <div className="w-40">
                  <div className="relative">
                    <input
                      type="number"
                      value={line.quantity || ''}
                      onChange={(e) => updateMaterialLine(index, 'quantity', e.target.value)}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-[#8B4513] focus:border-[#8B4513] pr-12"
                      placeholder="Quantité"
                      required
                      min="0.01"
                      max="999.99"
                      step="0.01"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">
                      {getDisplayUnit(line.materialId)}
                    </span>
                  </div>
                </div>
                
                <div className="w-40">
                  <div className="relative">
                    <input
                      type="number"
                      value={line.unitPrice || ''}
                      onChange={(e) => updateMaterialLine(index, 'unitPrice', parseFloat(e.target.value))}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-[#8B4513] focus:border-[#8B4513] pr-16"
                      placeholder="Prix/unité"
                      required
                      min="0"
                      step="0.01"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">
                      F/{getDisplayUnit(line.materialId)}
                    </span>
                  </div>
                </div>
                
                <button
                  type="button"
                  onClick={() => removeMaterialLine(index)}
                  className="p-3 text-red-500 hover:bg-red-50 rounded-lg"
                >
                  <Minus className="h-5 w-5" />
                </button>
              </div>
            ))}
            
            <button
              type="button"
              onClick={addMaterialLine}
              className="flex items-center text-[#8B4513] hover:bg-[#8B4513]/10 px-4 py-2 rounded-lg"
            >
              <Plus className="h-5 w-5 mr-2" />
              Ajouter une matière
            </button>
          </div>

          <div className="mb-8">
            <h3 className="font-bold text-lg mb-4 text-[#8B4513]">Produits à Fabriquer</h3>
            
            {formData.productsProduced.map((line, index) => (
              <div key={index} className="flex gap-4 mb-4">
                <div className="flex-grow">
                  <select
                    value={line.productId}
                    onChange={(e) => updateProductLine(index, 'productId', e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-[#8B4513] focus:border-[#8B4513]"
                    required
                  >
                    <option value="">Sélectionner un produit</option>
                    {products.map(product => (
                      <option key={product.id} value={product.id}>
                        {product.name} - Réf: {product.reference}
                      </option>
                    ))}
                  </select>
                  {line.productName && (
                    <p className="mt-1 text-sm text-gray-600">{line.productName}</p>
                  )}
                </div>
                
                <div className="w-32">
                  <input
                    type="number"
                    value={line.quantity || ''}
                    onChange={(e) => updateProductLine(index, 'quantity', parseInt(e.target.value))}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-[#8B4513] focus:border-[#8B4513]"
                    placeholder="Quantité"
                    required
                    min="1"
                  />
                </div>

                <div className="w-40">
                  <div className="relative">
                    <input
                      type="number"
                      value={line.weightPerUnit || ''}
                      className="w-full p-3 border border-gray-300 rounded-lg bg-gray-50 pr-12"
                      placeholder="Poids"
                      disabled
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">
                      kg
                    </span>
                  </div>
                </div>
                
                <div className="w-40">
                  <input
                    type="number"
                    value={line.unitPrice || ''}
                    className="w-full p-3 border border-gray-300 rounded-lg bg-gray-50"
                    placeholder="Prix unitaire"
                    disabled
                  />
                </div>
                
                <div className="w-32 p-3 text-right font-medium">
                  {(line.quantity * line.unitPrice).toFixed(2)} Fcfa
                </div>
                
                <button
                  type="button"
                  onClick={() => removeProductLine(index)}
                  className="p-3 text-red-500 hover:bg-red-50 rounded-lg"
                >
                  <Minus className="h-5 w-5" />
                </button>
              </div>
            ))}
            
            <button
              type="button"
              onClick={addProductLine}
              className="flex items-center text-[#8B4513] hover:bg-[#8B4513]/10 px-4 py-2 rounded-lg"
            >
              <Plus className="h-5 w-5 mr-2" />
              Ajouter un produit
            </button>
          </div>

          <div className="bg-gray-50 p-4 rounded-lg mb-8">
            <h4 className="font-bold mb-4">Récapitulatif</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-gray-600">Poids total matières:</p>
                <p className="font-bold">{formData.totals.materialsTotalWeight.toFixed(2)} kg</p>
              </div>
              <div>
                <p className="text-gray-600">Coût total matières:</p>
                <p className="font-bold">{formData.totals.materialsTotalCost.toFixed(2)} Fcfa</p>
              </div>
              <div>
                <p className="text-gray-600">Quantité totale produite:</p>
                <p className="font-bold">{formData.totals.productionTotalQuantity} unités</p>
              </div>
              <div>
                <p className="text-gray-600">Poids total production:</p>
                <p className="font-bold">{formData.totals.productionTotalWeight.toFixed(2)} kg</p>
              </div>
              <div>
                <p className="text-gray-600">Montant total production:</p>
                <p className="font-bold">{formData.totals.productionTotalAmount.toFixed(2)} Fcfa</p>
              </div>
              <div>
                <p className="text-gray-600">Différence de poids:</p>
                <p className={`font-bold ${
                  formData.totals.weightDifference > 0 ? 'text-green-600' : 
                  formData.totals.weightDifference < 0 ? 'text-red-600' : ''
                }`}>
                  {formData.totals.weightDifference > 0 ? '+' : ''}
                  {formData.totals.weightDifference.toFixed(2)} kg
                </p>
              </div>
              <div className="col-span-2">
                <p className="text-gray-600">Taux de rentabilité:</p>
                <p className={`font-bold ${
                  formData.totals.profitabilityRate > 30 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {formData.totals.profitabilityRate.toFixed(2)}%
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-4">
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

export default NewProductionSheetModal;