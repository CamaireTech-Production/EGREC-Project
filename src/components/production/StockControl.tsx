import React, { useState, useEffect } from 'react';
import { collection, query, where, orderBy, getDocs, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useUser } from '../../context/UserContext';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Loader2, Save } from 'lucide-react';
import { toast } from 'react-hot-toast';
import StockControlHistory from './StockControlHistory';

interface Product {
  id: string;
  name: string;
  reference: string;
  stockParAgence?: { [agency: string]: number };
  price: number;
}

interface StockEntry {
  productId: string;
  productName: string;
  reference: string;
  initialStock: number;
  theoreticalStock: number;
  actualStock: number | null;
  entryTime: string | null;
  isEditable: boolean;
  difference: number | null;
  quantitySoldTheoretical: number;
  quantitySoldReal: number | null;
  theoreticalAmount: number;
  realAmount: number | null;
  avaries: number;
}

const StockControl: React.FC = () => {
  const { user, loading: userLoading } = useUser();
  const [products, setProducts] = useState<Product[]>([]);
  const [stockEntries, setStockEntries] = useState<StockEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      if (!user?.company || !user?.agencyName) return;
      setLoading(true);

      try {
        const productQuery = query(
          collection(db, 'products'),
          where('company', '==', user.company),
          orderBy('name', 'asc')
        );
        const stockQuery = query(
          collection(db, 'controleStock'),
          where('company', '==', user.company),
          where('agencyName', '==', user.agencyName),
          orderBy('timestamp', 'desc')
        );
        const avariesQuery = query(
          collection(db, 'avaries'),
          where('company', '==', user.company),
          where('agencyName', '==', user.agencyName)
        );

        const [productsSnap, stockSnap, avariesSnap] = await Promise.all([
          getDocs(productQuery),
          getDocs(stockQuery),
          getDocs(avariesQuery)
        ]);

        const productsData = productsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Product[];
        const latestStockDoc = stockSnap.docs[0];
        const latestStock = latestStockDoc ? latestStockDoc.data() : null;
        const latestTimestamp = latestStock?.timestamp?.toDate?.() || new Date(0);

        const avariesData = avariesSnap.docs.map(doc => doc.data()).filter(av => {
          const avDate = av.timestamp?.toDate?.();
          return avDate && avDate > latestTimestamp;
        });

        const entries = productsData.map(product => {
          const lastEntry = latestStock?.produits?.find((p: any) => p.productId === product.id);
          const stockInitial = lastEntry?.stockReel ?? 0;
          const stockTheorique = product.stockParAgence?.[user.agencyName] ?? 0;
          const quantitySoldTheoretical = stockInitial - stockTheorique;
          const relatedAvaries = avariesData.filter(av => av.productId === product.id);
          const avariesQty = relatedAvaries.reduce((sum, av) => sum + (av.quantity || 0), 0);

          return {
            productId: product.id,
            productName: product.name,
            reference: product.reference,
            initialStock: stockInitial,
            theoreticalStock: stockTheorique,
            actualStock: null,
            entryTime: null,
            isEditable: true,
            difference: null,
            quantitySoldTheoretical,
            quantitySoldReal: null,
            theoreticalAmount: quantitySoldTheoretical * product.price,
            realAmount: null,
            avaries: avariesQty
          };
        });

        setProducts(productsData);
        setStockEntries(entries);
      } catch (error) {
        console.error(error);
        toast.error('Erreur de chargement');
      } finally {
        setLoading(false);
      }
    };

    if (!userLoading && user) {
      fetchData();
    }
  }, [user, userLoading]);

  const handleStockEntry = (productId: string, value: string) => {
    setStockEntries(prev => prev.map(entry => {
      if (entry.productId === productId) {
        const actualStock = value === '' ? null : parseInt(value);
        const product = products.find(p => p.id === productId);
        const price = product?.price || 0;

        if (actualStock === null) {
          return {
            ...entry,
            actualStock: null,
            entryTime: null,
            difference: null,
            quantitySoldReal: null,
            realAmount: null
          };
        }

        const difference = actualStock - entry.theoreticalStock;
        const quantitySoldReal = entry.initialStock - actualStock;
        const realAmount = quantitySoldReal * price;

        return {
          ...entry,
          actualStock,
          entryTime: format(new Date(), 'dd/MM/yyyy HH:mm', { locale: fr }),
          difference,
          quantitySoldReal,
          realAmount,
          isEditable: true
        };
      }
      return entry;
    }));
  };

  const calculateTotals = () => {
    return stockEntries.reduce((totals, entry) => ({
      theoreticalSales: totals.theoreticalSales + entry.quantitySoldTheoretical,
      theoreticalAmount: totals.theoreticalAmount + entry.theoreticalAmount,
      realSales: totals.realSales + (entry.quantitySoldReal || 0),
      realAmount: totals.realAmount + (entry.realAmount || 0)
    }), {
      theoreticalSales: 0,
      theoreticalAmount: 0,
      realSales: 0,
      realAmount: 0
    });
  };

  const totals = calculateTotals();

  if (!user?.company || !user?.agencyName) {
    return (
      <div className="p-6">
        <div className="bg-yellow-50 text-yellow-700 p-4 rounded-lg">
          Informations entreprise ou agence manquantes
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Contrôle de stock</h1>
      {loading ? (
        <div className="flex justify-center items-center h-32">
          <Loader2 className="animate-spin w-6 h-6 text-gray-600" />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border border-gray-200">
            <thead>
              <tr className="bg-gray-100">
                <th className="px-4 py-2 text-left">Produit</th>
                <th className="px-4 py-2 text-right">Stock initial</th>
                <th className="px-4 py-2 text-right">Stock théorique</th>
                <th className="px-4 py-2 text-right">Quantité vendue (théorique)</th>
                <th className="px-4 py-2 text-right">Montant théorique</th>
                <th className="px-4 py-2 text-center">Stock réel</th>
                <th className="px-4 py-2 text-right">Quantité vendue (réelle)</th>
                <th className="px-4 py-2 text-right">Montant réel</th>
                <th className="px-4 py-2 text-right">Écart</th>
                <th className="px-4 py-2">Date de saisie</th>
                <th className="px-4 py-2 text-right">Avaries</th>
              </tr>
            </thead>
            <tbody>
              {stockEntries.map(entry => (
                <tr key={entry.productId} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-2">{entry.productName}</td>
                  <td className="px-4 py-2 text-right">{entry.initialStock}</td>
                  <td className="px-4 py-2 text-right">{entry.theoreticalStock}</td>
                  <td className="px-4 py-2 text-right">{entry.quantitySoldTheoretical}</td>
                  <td className="px-4 py-2 text-right">{entry.theoreticalAmount.toFixed(0)} FCFA</td>
                  <td className="px-4 py-2">
                    <div className="flex justify-center">
                      <input
                        type="number"
                        value={entry.actualStock ?? ''}
                        onChange={(e) => handleStockEntry(entry.productId, e.target.value)}
                        disabled={!entry.isEditable}
                        className="w-24 p-2 text-center border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-[#8B4513] focus:border-[#8B4513] hover:border-gray-400 transition-colors disabled:bg-gray-100 disabled:cursor-not-allowed"
                        min="0"
                        placeholder="Saisir..."
                      />
                    </div>
                  </td>
                  <td className="px-4 py-2 text-right">
                    {entry.quantitySoldReal !== null ? entry.quantitySoldReal : '-'}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {entry.realAmount !== null ? `${entry.realAmount.toFixed(0)} FCFA` : '-'}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {entry.difference !== null && (
                      <span className={`font-medium ${
                        entry.difference > 0 ? 'text-green-600' :
                        entry.difference < 0 ? 'text-red-600' :
                        'text-gray-500'
                      }`}>
                        {entry.difference > 0 ? '+' : ''}{entry.difference}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2">{entry.entryTime || '-'}</td>
                  <td className="px-4 py-2 text-right">{entry.avaries}</td>
                </tr>
              ))}
              <tr className="bg-gray-50 font-bold">
                <td className="px-4 py-2">Total</td>
                <td className="px-4 py-2 text-right">-</td>
                <td className="px-4 py-2 text-right">-</td>
                <td className="px-4 py-2 text-right">{totals.theoreticalSales}</td>
                <td className="px-4 py-2 text-right">{totals.theoreticalAmount.toFixed(0)} FCFA</td>
                <td className="px-4 py-2">-</td>
                <td className="px-4 py-2 text-right">{totals.realSales}</td>
                <td className="px-4 py-2 text-right">{totals.realAmount.toFixed(0)} FCFA</td>
                <td className="px-4 py-2 text-right">-</td>
                <td className="px-4 py-2">-</td>
                <td className="px-4 py-2 text-right">-</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default StockControl;