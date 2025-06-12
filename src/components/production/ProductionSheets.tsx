import React, { useState, useEffect } from 'react';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { db, auth } from '../../lib/firebase';
import { Plus, Search, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import NewProductionSheetModal from './NewProductionSheetModal';
import ProductionSheetDetailsModal from './ProductionSheetDetailsModal';

interface Material {
  materialId?: string;
  materialName: string;
  quantity: number;
  unitPrice: number;
  unit?: string;
}

interface Product {
  productId?: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  weightPerUnit: number;
}

export interface ProductionSheet {
  id: string;
  numero: string;
  dateProduction: Date;
  responsable: string;
  agency: string;
  createdBy: string;
  company: string;
  materialsUsed: Material[];
  productsProduced: Product[];
  poidsMatieres: number;
  coutMatieres: number;
  quantiteTotale: number;
  poidsTotal: number;
  montantTotal: number;
  tauxRentabilite?: number;
  differencePoidsTotal?: number;
}

const ProductionSheets: React.FC = () => {
  const [sheets, setSheets] = useState<ProductionSheet[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewModal, setShowNewModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedSheet, setSelectedSheet] = useState<ProductionSheet | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchSheets = async () => {
    if (!auth.currentUser) return;

    try {
      const sheetsQuery = query(
        collection(db, 'fichesProduction'),
        where('entrepriseId', '==', auth.currentUser.uid),
        orderBy('dateProduction', 'desc')
      );
      
      const snapshot = await getDocs(sheetsQuery);
      const sheetsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        dateProduction: doc.data().dateProduction.toDate()
      })) as ProductionSheet[];
      
      setSheets(sheetsData);
    } catch (error) {
      console.error('Erreur lors du chargement des fiches:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSheets();
  }, []);

  const handleSheetClick = (sheet: ProductionSheet) => {
    setSelectedSheet(sheet);
    setShowDetailsModal(true);
  };

  const filteredSheets = sheets.filter(sheet =>
    sheet.numero.toLowerCase().includes(searchQuery.toLowerCase()) ||
    sheet.responsable.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
        <h2 className="text-2xl font-bold text-[#8B4513]">Fiches de Production</h2>
        <button
          className="bg-[#8B4513] text-white px-4 py-2 rounded-lg flex items-center hover:bg-[#663300]"
          onClick={() => setShowNewModal(true)}
        >
          <Plus className="h-5 w-5 mr-2" />
          Nouvelle Fiche
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="mb-6 relative">
          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Rechercher une fiche de production..."
            className="w-full pl-10 p-3 border border-gray-300 rounded-lg focus:ring-[#8B4513] focus:border-[#8B4513]"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left bg-gray-50">
                <th className="px-6 py-3 text-gray-500 font-medium">N° Fiche</th>
                <th className="px-6 py-3 text-gray-500 font-medium">Date</th>
                <th className="px-6 py-3 text-gray-500 font-medium">Responsable</th>
                <th className="px-6 py-3 text-gray-500 font-medium">Quantité</th>
                <th className="px-6 py-3 text-gray-500 font-medium">Poids Total</th>
                <th className="px-6 py-3 text-gray-500 font-medium">Montant Total</th>
                <th className="px-6 py-3 text-gray-500 font-medium">Rentabilité</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredSheets.map((sheet) => (
                <tr 
                  key={sheet.id} 
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => handleSheetClick(sheet)}
                >
                  <td className="px-6 py-4 font-medium">{sheet.numero}</td>
                  <td className="px-6 py-4">
                    {format(sheet.dateProduction, 'dd/MM/yyyy', { locale: fr })}
                  </td>
                  <td className="px-6 py-4">{sheet.responsable}</td>
                  <td className="px-6 py-4">{sheet.quantiteTotale}</td>
                  <td className="px-6 py-4">{sheet.poidsTotal.toFixed(2)} kg</td>
                  <td className="px-6 py-4">{sheet.montantTotal.toFixed(2)} Fcfa</td>
                  <td className="px-6 py-4">
                    <span className={`font-medium ${
                      (sheet.tauxRentabilite || 0) > 30 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {(sheet.tauxRentabilite || 0).toFixed(2)}%
                    </span>
                  </td>
                </tr>
              ))}
              {filteredSheets.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                    Aucune fiche de production trouvée
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showNewModal && (
        <NewProductionSheetModal
          onClose={() => setShowNewModal(false)}
          onSheetAdded={fetchSheets}
        />
      )}

      {showDetailsModal && selectedSheet && (
        <ProductionSheetDetailsModal
          sheet={selectedSheet}
          onClose={() => {
            setShowDetailsModal(false);
            setSelectedSheet(null);
          }}
          onUpdate={fetchSheets}
        />
      )}
    </div>
  );
};

export default ProductionSheets;