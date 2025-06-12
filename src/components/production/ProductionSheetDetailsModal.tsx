import React, { useState } from 'react';
import { X, Printer, Save, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { printProductionSheet } from '../../lib/productionSheet';
import { ProductionSheet } from './ProductionSheets';
import { doc, updateDoc, runTransaction } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { toast } from 'react-hot-toast';

interface ProductionSheetDetailsModalProps {
  sheet: ProductionSheet;
  onClose: () => void;
  onUpdate?: () => void;
}

const ProductionSheetDetailsModal: React.FC<ProductionSheetDetailsModalProps> = ({ 
  sheet: initialSheet, 
  onClose,
  onUpdate 
}) => {
  const [sheet, setSheet] = useState(initialSheet);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [printing, setPrinting] = useState(false);

  const handlePrint = async () => {
    setPrinting(true);
    try {
      // Prepare the data for printing with proper structure
      const printData = {
        numero: sheet.numero,
        dateProduction: format(sheet.dateProduction, 'yyyy-MM-dd'),
        responsable: sheet.responsable,
        agency: sheet.agency,
        createdBy: sheet.createdBy,
        materialsUsed: sheet.materialsUsed.map(material => ({
          materialName: material.materialName || '',
          quantity: material.quantity || 0,
          unitPrice: material.unitPrice || 0,
          unit: material.unit || 'kg'
        })),
        productsProduced: sheet.productsProduced.map(product => ({
          productName: product.productName || '',
          quantity: product.quantity || 0,
          unitPrice: product.unitPrice || 0,
          weightPerUnit: product.weightPerUnit || 0
        })),
        totals: {
          materialsTotalWeight: sheet.poidsMatieres || 0,
          materialsTotalCost: sheet.coutMatieres || 0,
          productionTotalQuantity: sheet.quantiteTotale || 0,
          productionTotalWeight: sheet.poidsTotal || 0,
          productionTotalAmount: sheet.montantTotal || 0,
          profitabilityRate: sheet.tauxRentabilite || 0,
          weightDifference: sheet.differencePoidsTotal || 0
        },
        company: sheet.company || 'EGREC BOULANGERIE'
      };

      // Call the print function with the prepared data
      await printProductionSheet(printData);
      toast.success('Document envoyé vers l\'imprimante');
    } catch (error) {
      console.error('Erreur lors de l\'impression:', error);
      toast.error('Erreur lors de l\'impression du document');
    } finally {
      setPrinting(false);
    }
  };

  const updateMaterialQuantity = (index: number, quantity: number) => {
    const newMaterials = [...sheet.materialsUsed];
    newMaterials[index] = {
      ...newMaterials[index],
      quantity: Math.max(0, quantity)
    };

    // Calculate new totals
    const poidsMatieres = newMaterials.reduce((sum, mat) => {
      const convertedQuantity = mat.unit === 'g' ? mat.quantity / 1000 : mat.quantity;
      return sum + convertedQuantity;
    }, 0);
    const coutMatieres = newMaterials.reduce((sum, mat) => sum + (mat.quantity * mat.unitPrice), 0);

    // Calculate new profitability rate and weight difference
    const tauxRentabilite = sheet.montantTotal > 0 
      ? ((sheet.montantTotal - coutMatieres) / sheet.montantTotal) * 100 
      : 0;
    const differencePoidsTotal = sheet.poidsTotal - poidsMatieres;

    setSheet(prev => ({
      ...prev,
      materialsUsed: newMaterials,
      poidsMatieres,
      coutMatieres,
      tauxRentabilite,
      differencePoidsTotal
    }));
  };

  const updateProductQuantity = (index: number, quantity: number) => {
    const newProducts = [...sheet.productsProduced];
    newProducts[index] = {
      ...newProducts[index],
      quantity: Math.max(0, quantity)
    };

    // Calculate new totals
    const quantiteTotale = newProducts.reduce((sum, prod) => sum + prod.quantity, 0);
    const poidsTotal = newProducts.reduce((sum, prod) => sum + (prod.quantity * prod.weightPerUnit), 0);
    const montantTotal = newProducts.reduce((sum, prod) => sum + (prod.quantity * prod.unitPrice), 0);

    // Calculate new profitability rate and weight difference
    const tauxRentabilite = montantTotal > 0 
      ? ((montantTotal - sheet.coutMatieres) / montantTotal) * 100 
      : 0;
    const differencePoidsTotal = poidsTotal - sheet.poidsMatieres;

    setSheet(prev => ({
      ...prev,
      productsProduced: newProducts,
      quantiteTotale,
      poidsTotal,
      montantTotal,
      tauxRentabilite,
      differencePoidsTotal
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await runTransaction(db, async (transaction) => {
        // First, perform all reads
        const productDocs = await Promise.all(
          sheet.productsProduced.map(async (product) => {
            const productRef = doc(db, 'products', product.productId);
            const productDoc = await transaction.get(productRef);
            return {
              ref: productRef,
              doc: productDoc,
              product
            };
          })
        );

        // Prepare updates after all reads are complete
        const updates = productDocs.map(({ ref, doc, product }) => {
          if (doc.exists()) {
            const productData = doc.data();
            const stockParAgence = productData.stockParAgence || {};
            const originalProduct = initialSheet.productsProduced.find(p => p.productId === product.productId);
            const quantityDiff = product.quantity - (originalProduct?.quantity || 0);
            stockParAgence[sheet.agency] = (stockParAgence[sheet.agency] || 0) + quantityDiff;
            
            return {
              ref,
              data: { stockParAgence }
            };
          }
          return null;
        }).filter(Boolean);

        // Now perform all writes
        const sheetRef = doc(db, 'fichesProduction', sheet.id);
        
        // Ensure all numeric values are properly defined
        const updateData = {
          materialsUsed: sheet.materialsUsed,
          productsProduced: sheet.productsProduced,
          poidsMatieres: sheet.poidsMatieres || 0,
          coutMatieres: sheet.coutMatieres || 0,
          quantiteTotale: sheet.quantiteTotale || 0,
          poidsTotal: sheet.poidsTotal || 0,
          montantTotal: sheet.montantTotal || 0,
          tauxRentabilite: sheet.tauxRentabilite || 0,
          differencePoidsTotal: sheet.differencePoidsTotal || 0
        };

        transaction.update(sheetRef, updateData);

        updates.forEach(update => {
          if (update) {
            transaction.update(update.ref, update.data);
          }
        });
      });

      toast.success('Fiche de production mise à jour avec succès');
      onUpdate?.();
      setEditing(false);
    } catch (error) {
      console.error('Error updating production sheet:', error);
      toast.error('Erreur lors de la mise à jour');
    } finally {
      setSaving(false);
    }
  };

  // Fonction pour obtenir l'unité d'affichage
  const getDisplayUnit = (material: any): string => {
    return material.unit === 'g' ? 'g' : 'kg';
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-auto">
        <div className="bg-[#8B4513] text-white p-4 flex justify-between items-center sticky top-0">
          <h2 className="font-bold text-xl">Détails de la Fiche de Production</h2>
          <button
            onClick={onClose}
            className="text-white hover:bg-[#663300] p-2 rounded-full"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6">
          <div className="mb-8">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <h3 className="font-bold text-gray-700">N° Fiche</h3>
                <p>{sheet.numero}</p>
              </div>
              <div>
                <h3 className="font-bold text-gray-700">Date de Production</h3>
                <p>{format(sheet.dateProduction, 'dd MMMM yyyy', { locale: fr })}</p>
              </div>
              <div>
                <h3 className="font-bold text-gray-700">Responsable</h3>
                <p>{sheet.responsable}</p>
              </div>
              <div>
                <h3 className="font-bold text-gray-700">Agence</h3>
                <p>{sheet.agency}</p>
              </div>
            </div>
          </div>

          <div className="mb-8">
            <h3 className="font-bold text-lg mb-4 text-[#8B4513]">Matières Premières Utilisées</h3>
            <div className="bg-gray-50 rounded-lg p-4">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-gray-600">
                    <th className="py-2">Matière</th>
                    <th className="py-2 text-right">Quantité</th>
                    <th className="py-2 text-right">Prix Unitaire</th>
                    <th className="py-2 text-right">Montant Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {sheet.materialsUsed.map((material, index) => (
                    <tr key={index}>
                      <td className="py-2">{material.materialName}</td>
                      <td className="py-2 text-right">
                        {editing ? (
                          <input
                            type="number"
                            value={material.quantity}
                            onChange={(e) => updateMaterialQuantity(index, parseFloat(e.target.value))}
                            className="w-24 text-right p-1 border rounded"
                            min="0"
                            step="0.01"
                          />
                        ) : (
                          `${material.quantity} ${getDisplayUnit(material)}`
                        )}
                      </td>
                      <td className="py-2 text-right">{material.unitPrice} Fcfa/{getDisplayUnit(material)}</td>
                      <td className="py-2 text-right">
                        {(material.quantity * material.unitPrice).toFixed(2)} Fcfa
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mb-8">
            <h3 className="font-bold text-lg mb-4 text-[#8B4513]">Produits Fabriqués</h3>
            <div className="bg-gray-50 rounded-lg p-4">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-gray-600">
                    <th className="py-2">Produit</th>
                    <th className="py-2 text-right">Quantité</th>
                    <th className="py-2 text-right">Poids Unitaire</th>
                    <th className="py-2 text-right">Prix Unitaire</th>
                    <th className="py-2 text-right">Montant Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {sheet.productsProduced.map((product, index) => (
                    <tr key={index}>
                      <td className="py-2">{product.productName}</td>
                      <td className="py-2 text-right">
                        {editing ? (
                          <input
                            type="number"
                            value={product.quantity}
                            onChange={(e) => updateProductQuantity(index, parseInt(e.target.value))}
                            className="w-24 text-right p-1 border rounded"
                            min="0"
                          />
                        ) : (
                          product.quantity
                        )}
                      </td>
                      <td className="py-2 text-right">{product.weightPerUnit} kg</td>
                      <td className="py-2 text-right">{product.unitPrice} Fcfa</td>
                      <td className="py-2 text-right">
                        {(product.quantity * product.unitPrice).toFixed(2)} Fcfa
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-gray-50 p-4 rounded-lg mb-8">
            <h4 className="font-bold mb-4">Synthèse</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-gray-600">Poids total matières:</p>
                <p className="font-bold">{(sheet.poidsMatieres || 0).toFixed(2)} kg</p>
              </div>
              <div>
                <p className="text-gray-600">Poids total production:</p>
                <p className="font-bold">{(sheet.poidsTotal || 0).toFixed(2)} kg</p>
              </div>
              <div>
                <p className="text-gray-600">Différence de poids:</p>
                <p className={`font-bold ${
                  (sheet.differencePoidsTotal || 0) > 0 ? 'text-green-600' : 
                  (sheet.differencePoidsTotal || 0) < 0 ? 'text-red-600' : ''
                }`}>
                  {(sheet.differencePoidsTotal || 0) > 0 ? '+' : ''}
                  {(sheet.differencePoidsTotal || 0).toFixed(2)} kg
                </p>
              </div>
              <div>
                <p className="text-gray-600">Coût total matières:</p>
                <p className="font-bold">{(sheet.coutMatieres || 0).toFixed(2)} Fcfa</p>
              </div>
              <div>
                <p className="text-gray-600">Montant total production:</p>
                <p className="font-bold">{(sheet.montantTotal || 0).toFixed(2)} Fcfa</p>
              </div>
              <div>
                <p className="text-gray-600">Taux de rentabilité:</p>
                <p className={`font-bold ${
                  (sheet.tauxRentabilite || 0) > 30 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {(sheet.tauxRentabilite || 0).toFixed(2)}%
                </p>
              </div>
              <div>
                <p className="text-gray-600">Rendement:</p>
                <p className="font-bold">
                  {(((sheet.poidsTotal || 0) / (sheet.poidsMatieres || 1)) * 100).toFixed(2)}%
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-4">
            {editing ? (
              <>
                <button
                  onClick={() => setSheet(initialSheet)}
                  className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-100"
                  disabled={saving}
                >
                  Annuler
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-6 py-3 bg-[#8B4513] text-white rounded-lg font-medium hover:bg-[#663300] flex items-center disabled:bg-gray-300"
                >
                  {saving ? (
                    <>
                      <Loader2 className="animate-spin h-5 w-5 mr-2" />
                      Enregistrement...
                    </>
                  ) : (
                    <>
                      <Save className="h-5 w-5 mr-2" />
                      Enregistrer
                    </>
                  )}
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setEditing(true)}
                  className="px-6 py-3 bg-[#8B4513] text-white rounded-lg font-medium hover:bg-[#663300]"
                >
                  Modifier
                </button>
                <button
                  onClick={handlePrint}
                  disabled={printing}
                  className="px-6 py-3 bg-[#8B4513] text-white rounded-lg font-medium hover:bg-[#663300] flex items-center"
                >
                  {printing ? (
                    <>
                      <Loader2 className="animate-spin h-5 w-5 mr-2" />
                      Impression...
                    </>
                  ) : (
                    <>
                      <Printer className="h-5 w-5 mr-2" />
                      Imprimer
                    </>
                  )}
                </button>
              </>
            )}
            <button
              onClick={onClose}
              className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-100"
            >
              Fermer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductionSheetDetailsModal;