import React from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { X, Printer, Download } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { toast } from 'react-hot-toast';
import { printReceipt } from '../../lib/receipt';

interface SaleDetailModalProps {
  saleId: string;
  onClose: () => void;
}

interface SaleData {
  timestamp: Date;
  productName: string[];
  quantity: number[];
  unitPrice: number[];
  totalAmount: number;
  recordedBy: string;
  agency: string;
  company: string;
  cashReceived: number;
  changeDue: number;
}

const SaleDetailModal: React.FC<SaleDetailModalProps> = ({ saleId, onClose }) => {
  const [saleData, setSaleData] = React.useState<SaleData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const fetchSaleData = async () => {
      try {
        const saleDoc = await getDoc(doc(db, 'ventes', saleId));
        if (!saleDoc.exists()) {
          throw new Error('Vente non trouvée');
        }

        const data = saleDoc.data();
        setSaleData({
          ...data,
          timestamp: data.timestamp.toDate()
        } as SaleData);
      } catch (error) {
        console.error('Error fetching sale:', error);
        setError(error instanceof Error ? error.message : 'Erreur lors du chargement des données');
      } finally {
        setLoading(false);
      }
    };

    fetchSaleData();
  }, [saleId]);

  const handlePrint = async () => {
    if (!saleData) return;

    try {
      await printReceipt(
        saleData.productName.map((name, index) => ({
          product: {
            id: `${index}`,
            name,
            price: saleData.unitPrice[index],
            category: 'pains',
            image: '',
            reference: '',
            allergens: [],
            stock: 0,
            isFavorite: false,
            minStock: 0,
            freshWeight: 0,
            department: 'Boulangerie'
          },
          quantity: saleData.quantity[index]
        })),
        saleData.totalAmount,
        saleData.totalAmount / 1.1925,
        saleData.totalAmount - (saleData.totalAmount / 1.1925),
        saleData.cashReceived,
        saleData.changeDue,
        saleData.company,
        saleData.agency
      );
      toast.success('Impression du ticket en cours');
    } catch (error) {
      console.error('Error printing receipt:', error);
      toast.error('Erreur lors de l\'impression');
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#8B4513]"></div>
        </div>
      </div>
    );
  }

  if (error || !saleData) {
    return (
      <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8">
          <p className="text-red-600">{error || 'Données non disponibles'}</p>
          <button
            onClick={onClose}
            className="mt-4 px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
          >
            Fermer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-auto">
        <div className="bg-[#8B4513] text-white p-4 flex justify-between items-center sticky top-0 z-10">
          <h2 className="font-bold text-xl">Détails de la Vente</h2>
          <button
            onClick={onClose}
            className="text-white hover:bg-[#663300] p-2 rounded-full"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-2 gap-6 mb-8">
            <div>
              <h3 className="font-bold text-gray-700 mb-2">Date de Facturation</h3>
              <p>{format(saleData.timestamp, 'dd MMMM yyyy à HH:mm', { locale: fr })}</p>
            </div>
            <div>
              <h3 className="font-bold text-gray-700 mb-2">Enregistré par</h3>
              <p>{saleData.recordedBy}</p>
            </div>
            <div>
              <h3 className="font-bold text-gray-700 mb-2">Société</h3>
              <p>{saleData.company}</p>
            </div>
            <div>
              <h3 className="font-bold text-gray-700 mb-2">Agence</h3>
              <p>{saleData.agency}</p>
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-6 mb-8">
            <h3 className="font-bold text-lg mb-4 text-[#8B4513]">Détails des Produits</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left bg-gray-100">
                    <th className="px-6 py-3 text-gray-600">Produit</th>
                    <th className="px-6 py-3 text-right text-gray-600">Quantité</th>
                    <th className="px-6 py-3 text-right text-gray-600">Prix Unit.</th>
                    <th className="px-6 py-3 text-right text-gray-600">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {saleData.productName.map((name, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-6 py-4">{name}</td>
                      <td className="px-6 py-4 text-right">{saleData.quantity[index]}</td>
                      <td className="px-6 py-4 text-right">
                        {saleData.unitPrice[index].toFixed(0)} Fcfa
                      </td>
                      <td className="px-6 py-4 text-right">
                        {(saleData.quantity[index] * saleData.unitPrice[index]).toFixed(0)} Fcfa
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50">
                  <tr>
                    <td colSpan={3} className="px-6 py-4 font-bold text-right">Total HT:</td>
                    <td className="px-6 py-4 font-bold text-right">
                      {(saleData.totalAmount / 1.1925).toFixed(0)} Fcfa
                    </td>
                  </tr>
                  <tr>
                    <td colSpan={3} className="px-6 py-4 font-bold text-right">TVA (19.25%):</td>
                    <td className="px-6 py-4 font-bold text-right">
                      {(saleData.totalAmount - (saleData.totalAmount / 1.1925)).toFixed(0)} Fcfa
                    </td>
                  </tr>
                  <tr>
                    <td colSpan={3} className="px-6 py-4 font-bold text-right">Total TTC:</td>
                    <td className="px-6 py-4 font-bold text-right">
                      {saleData.totalAmount.toFixed(0)} Fcfa
                    </td>
                  </tr>
                  <tr>
                    <td colSpan={3} className="px-6 py-4 text-right">Montant reçu:</td>
                    <td className="px-6 py-4 text-right">{saleData.cashReceived.toFixed(0)} Fcfa</td>
                  </tr>
                  <tr>
                    <td colSpan={3} className="px-6 py-4 text-right">Monnaie rendue:</td>
                    <td className="px-6 py-4 text-right">{saleData.changeDue.toFixed(0)} Fcfa</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          <div className="flex justify-end space-x-4">
            <button
              onClick={handlePrint}
              className="px-6 py-3 bg-[#8B4513] text-white rounded-lg font-medium hover:bg-[#663300] flex items-center"
            >
              <Printer className="h-5 w-5 mr-2" />
              Imprimer
            </button>
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

export default SaleDetailModal;