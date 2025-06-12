import React, { useState } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { X, Printer, ArrowLeft, Loader2 } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../../lib/firebase';
import { toast } from 'react-hot-toast';

interface ProductionSheetPreviewProps {
  data: {
    dateProduction: string;
    responsable: string;
    materialsUsed: Array<{
      materialName?: string;
      quantity: number;
      unitPrice: number;
      unit?: string; // Ajout de l'unité pour la gestion des conversions
    }>;
    productsProduced: Array<{
      productName?: string;
      quantity: number;
      unitPrice: number;
      weightPerUnit: number;
    }>;
    totals: {
      materialsTotalWeight: number;
      materialsTotalCost: number;
      productionTotalQuantity: number;
      productionTotalWeight: number;
      productionTotalAmount: number;
      profitabilityRate: number;
      weightDifference: number;
    };
  };
  onConfirm: () => void;
  onEdit: () => void;
  onClose: () => void;
}

const ProductionSheetPreview: React.FC<ProductionSheetPreviewProps> = ({
  data,
  onConfirm,
  onEdit,
  onClose
}) => {
  const [loading, setLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [userData, setUserData] = useState<{ company: string; agencyName: string } | null>(null);

  React.useEffect(() => {
    const fetchUserData = async () => {
      if (!auth.currentUser) return;

      try {
        const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
        if (!userDoc.exists()) {
          throw new Error('User data not found');
        }

        const userData = userDoc.data();
        if (!userData.company || !userData.agencyName) {
          throw new Error('Company or agency information missing');
        }

        setUserData({
          company: userData.company,
          agencyName: userData.agencyName
        });
      } catch (error) {
        console.error('Error fetching user data:', error);
        toast.error('Erreur lors du chargement des données utilisateur');
      }
    };

    fetchUserData();
  }, []);

  const handleConfirmAndPrint = async () => {
    if (isProcessing) return; // Empêcher les clics multiples
    
    setIsProcessing(true);
    try {
      await onConfirm();
    } catch (error) {
      console.error('Error during confirmation:', error);
      toast.error('Erreur lors de l\'enregistrement');
      setIsProcessing(false); // Réactiver le bouton en cas d'erreur
    }
    // Note: Le bouton reste désactivé en cas de succès car la modal se ferme
  };

  // Fonction pour afficher l'unité correcte
  const getDisplayUnit = (material: any): string => {
    return material.unit === 'g' ? 'g' : 'kg';
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8">
          <Loader2 className="animate-spin h-8 w-8 text-[#8B4513] mx-auto" />
          <p className="mt-4 text-gray-600">Chargement des données...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-auto">
        <div className="bg-[#8B4513] text-white p-4 flex justify-between items-center sticky top-0 z-10">
          <h2 className="font-bold text-xl">Fiche de Production</h2>
          <button onClick={onClose} className="text-white hover:bg-[#663300] p-2 rounded-full">
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6">
          <div className="mb-8 border-b pb-6">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <h3 className="font-bold text-gray-700">Date de Production</h3>
                <p>{format(new Date(data.dateProduction), 'dd MMMM yyyy', { locale: fr })}</p>
              </div>
              <div>
                <h3 className="font-bold text-gray-700">Responsable</h3>
                <p>{data.responsable}</p>
              </div>
            </div>
          </div>

          <div className="mb-8">
            <h3 className="font-bold text-lg mb-4 text-[#8B4513]">Matières Premières Utilisées</h3>
            <div className="bg-gray-50 rounded-lg p-4">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-gray-600">
                    <th className="py-2">Matière Première</th>
                    <th className="py-2 text-right">Quantité</th>
                    <th className="py-2 text-right">Prix Unitaire</th>
                    <th className="py-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {data.materialsUsed.map((material, index) => (
                    <tr key={index}>
                      <td className="py-2">{material.materialName}</td>
                      <td className="py-2 text-right">
                        {material.quantity.toFixed(2)} {getDisplayUnit(material)}
                      </td>
                      <td className="py-2 text-right">
                        {material.unitPrice.toFixed(2)} Fcfa/{getDisplayUnit(material)}
                      </td>
                      <td className="py-2 text-right">
                        {(material.quantity * material.unitPrice).toFixed(2)} Fcfa
                      </td>
                    </tr>
                  ))}
                  <tr className="font-bold">
                    <td className="py-2">Total</td>
                    <td className="py-2 text-right">{data.totals.materialsTotalWeight.toFixed(2)} kg</td>
                    <td className="py-2"></td>
                    <td className="py-2 text-right">{data.totals.materialsTotalCost.toFixed(2)} Fcfa</td>
                  </tr>
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
                    <th className="py-2 text-right">Poids Total</th>
                    <th className="py-2 text-right">Prix Unitaire</th>
                    <th className="py-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {data.productsProduced.map((product, index) => (
                    <tr key={index}>
                      <td className="py-2">{product.productName}</td>
                      <td className="py-2 text-right">{product.quantity}</td>
                      <td className="py-2 text-right">{product.weightPerUnit.toFixed(3)} kg</td>
                      <td className="py-2 text-right">
                        {(product.quantity * product.weightPerUnit).toFixed(2)} kg
                      </td>
                      <td className="py-2 text-right">{product.unitPrice.toFixed(2)} Fcfa</td>
                      <td className="py-2 text-right">
                        {(product.quantity * product.unitPrice).toFixed(2)} Fcfa
                      </td>
                    </tr>
                  ))}
                  <tr className="font-bold">
                    <td className="py-2">Total</td>
                    <td className="py-2 text-right">{data.totals.productionTotalQuantity}</td>
                    <td className="py-2"></td>
                    <td className="py-2 text-right">{data.totals.productionTotalWeight.toFixed(2)} kg</td>
                    <td className="py-2"></td>
                    <td className="py-2 text-right">{data.totals.productionTotalAmount.toFixed(2)} Fcfa</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-gray-50 p-4 rounded-lg mb-8">
            <h4 className="font-bold mb-4">Synthèse de Production</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-gray-600">Poids total matières:</p>
                <p className="font-bold">{data.totals.materialsTotalWeight.toFixed(2)} kg</p>
              </div>
              <div>
                <p className="text-gray-600">Poids total production:</p>
                <p className="font-bold">{data.totals.productionTotalWeight.toFixed(2)} kg</p>
              </div>
              <div>
                <p className="text-gray-600">Différence de poids:</p>
                <p className={`font-bold ${
                  data.totals.weightDifference > 0 ? 'text-green-600' : 
                  data.totals.weightDifference < 0 ? 'text-red-600' : ''
                }`}>
                  {data.totals.weightDifference > 0 ? '+' : ''}
                  {data.totals.weightDifference.toFixed(2)} kg
                </p>
              </div>
              <div>
                <p className="text-gray-600">Coût total matières:</p>
                <p className="font-bold">{data.totals.materialsTotalCost.toFixed(2)} Fcfa</p>
              </div>
              <div>
                <p className="text-gray-600">Valeur totale production:</p>
                <p className="font-bold">{data.totals.productionTotalAmount.toFixed(2)} Fcfa</p>
              </div>
              <div>
                <p className="text-gray-600">Taux de rentabilité:</p>
                <p className={`font-bold ${
                  data.totals.profitabilityRate > 30 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {data.totals.profitabilityRate.toFixed(2)}%
                </p>
              </div>
              <div>
                <p className="text-gray-600">Marge brute:</p>
                <p className="font-bold">
                  {(data.totals.productionTotalAmount - data.totals.materialsTotalCost).toFixed(2)} Fcfa
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-between">
            <button
              onClick={onEdit}
              disabled={isProcessing}
              className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-100 flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ArrowLeft className="h-5 w-5 mr-2" />
              Modifier
            </button>
            <button
              onClick={handleConfirmAndPrint}
              disabled={isProcessing}
              className="px-6 py-3 bg-[#8B4513] text-white rounded-lg font-medium hover:bg-[#663300] flex items-center disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="animate-spin h-5 w-5 mr-2" />
                  Traitement en cours...
                </>
              ) : (
                <>
                  <Printer className="h-5 w-5 mr-2" />
                  Enregistrer et Imprimer
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductionSheetPreview;