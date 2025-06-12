import React, { useState, useEffect } from 'react';
import { collection, query, where, orderBy, getDocs, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useUser } from '../../context/UserContext';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Loader2, Save, Croissant, Store, Filter, Search } from 'lucide-react';
import { toast } from 'react-hot-toast';
import StockControlHistory from './StockControlHistory';

interface Product {
  id: string;
  name: string;
  reference: string;
  stockParAgence?: { [agency: string]: number };
  price: number;
  department: 'Boulangerie' | 'Boutique';
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
  department: 'Boulangerie' | 'Boutique';
}

const StockControl: React.FC = () => {
  const { user, loading: userLoading } = useUser();
  const [products, setProducts] = useState<Product[]>([]);
  const [stockEntries, setStockEntries] = useState<StockEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [physicalCash, setPhysicalCash] = useState<string>('');
  const [cashDifference, setCashDifference] = useState<number>(0);
  const [selectedDepartment, setSelectedDepartment] = useState<'Boulangerie' | 'Boutique'>('Boulangerie');

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
            avaries: avariesQty,
            department: product.department || 'Boulangerie' // Default to Boulangerie if not specified
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

  const calculateTotals = (entries: StockEntry[]) => {
    return entries.reduce((totals, entry) => ({
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

  useEffect(() => {
    const filteredEntries = stockEntries.filter(entry => entry.department === selectedDepartment);
    const totals = calculateTotals(filteredEntries);
    const physicalCashNum = parseFloat(physicalCash) || 0;
    setCashDifference(physicalCashNum - totals.realAmount);
  }, [physicalCash, stockEntries, selectedDepartment]);

  const handleSave = async () => {
    if (!user?.company || !user?.agencyName) {
      toast.error('Informations entreprise ou agence manquantes');
      return;
    }

    const filteredEntries = stockEntries.filter(entry => 
      entry.department === selectedDepartment && entry.actualStock !== null
    );

    if (filteredEntries.length === 0) {
      toast.error('Aucune saisie à enregistrer');
      return;
    }

    setSaving(true);
    try {
      const totals = calculateTotals(filteredEntries);
      const physicalCashAmount = parseFloat(physicalCash) || 0;
      
      const stockControlData = {
        timestamp: Timestamp.now(),
        company: user.company,
        agencyName: user.agencyName,
        userId: user.id,
        userName: `${user.firstName} ${user.lastName}`,
        department: selectedDepartment,
        produits: filteredEntries.map(entry => ({
          productId: entry.productId,
          productName: entry.productName,
          stockInitial: entry.initialStock,
          stockTheorique: entry.theoreticalStock,
          stockReel: entry.actualStock,
          dateHeureSaisie: entry.entryTime,
          ecart: entry.difference,
          department: entry.department
        })),
        physicalCash: physicalCashAmount,
        theoreticalAmount: totals.realAmount,
        cashDifference: physicalCashAmount - totals.realAmount
      };

      await addDoc(collection(db, 'controleStock'), stockControlData);
      
      toast.success('Contrôle de stock enregistré avec succès');

      // Reset form for the current department
      setStockEntries(prev => prev.map(entry => {
        if (entry.department === selectedDepartment) {
          return {
            ...entry,
            actualStock: null,
            entryTime: null,
            difference: null,
            quantitySoldReal: null,
            realAmount: null
          };
        }
        return entry;
      }));
      setPhysicalCash('');
    } catch (error) {
      console.error('Error saving stock control:', error);
      toast.error('Erreur lors de l\'enregistrement');
    } finally {
      setSaving(false);
    }
  };

  // Filter entries by department and search query
  const filteredEntries = stockEntries.filter(entry => {
    const matchesDepartment = entry.department === selectedDepartment;
    const matchesSearch = searchQuery === '' || 
      entry.productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.reference.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesDepartment && matchesSearch;
  });

  const totals = calculateTotals(filteredEntries);

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
      <h1 className="text-2xl font-bold mb-6">Contrôle de stock</h1>
      
      {/* Department Selector */}
      <div className="bg-white rounded-lg shadow-md p-4 mb-6">
        <h2 className="text-lg font-semibold mb-4">Sélectionner un département</h2>
        <div className="flex space-x-4">
          <button
            onClick={() => setSelectedDepartment('Boulangerie')}
            className={`flex items-center px-6 py-3 rounded-lg transition-all ${
              selectedDepartment === 'Boulangerie'
                ? 'bg-orange-100 text-orange-800 shadow-md transform scale-105'
                : 'bg-gray-100 text-gray-700 hover:bg-orange-50'
            }`}
          >
            <Croissant className="h-5 w-5 mr-2" />
            <span>Boulangerie</span>
            <span className="ml-2 bg-white px-2 py-1 rounded-full text-xs font-bold">
              {stockEntries.filter(entry => entry.department === 'Boulangerie').length}
            </span>
          </button>
          
          <button
            onClick={() => setSelectedDepartment('Boutique')}
            className={`flex items-center px-6 py-3 rounded-lg transition-all ${
              selectedDepartment === 'Boutique'
                ? 'bg-blue-100 text-blue-800 shadow-md transform scale-105'
                : 'bg-gray-100 text-gray-700 hover:bg-blue-50'
            }`}
          >
            <Store className="h-5 w-5 mr-2" />
            <span>Boutique</span>
            <span className="ml-2 bg-white px-2 py-1 rounded-full text-xs font-bold">
              {stockEntries.filter(entry => entry.department === 'Boutique').length}
            </span>
          </button>
        </div>
      </div>
      
      {/* Department Status Indicator */}
      <div className="bg-white rounded-lg shadow-md p-4 mb-6">
        <div className="flex items-center">
          <div className={`w-3 h-3 rounded-full mr-3 ${
            selectedDepartment === 'Boulangerie' ? 'bg-orange-500' : 'bg-blue-500'
          }`}></div>
          <span className="font-medium text-gray-800">
            Contrôle de stock : Département {selectedDepartment}
          </span>
          <span className="ml-2 bg-gray-100 text-gray-800 px-3 py-1 rounded-full text-sm font-medium">
            {filteredEntries.length} produit{filteredEntries.length > 1 ? 's' : ''}
          </span>
        </div>
      </div>
      
      {/* Search Bar */}
      <div className="bg-white rounded-lg shadow-md p-4 mb-6">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder={`Rechercher un produit dans ${selectedDepartment}...`}
            className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#8B4513] focus:border-transparent"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>
      
      {loading ? (
        <div className="flex justify-center items-center h-32">
          <Loader2 className="animate-spin w-6 h-6 text-gray-600" />
        </div>
      ) : (
        <>
          <div className="overflow-x-auto bg-white rounded-lg shadow-md p-4 mb-6">
            <table className="min-w-full">
              <thead>
                <tr className="bg-gray-100 text-left">
                  <th className="px-4 py-3 text-gray-600 font-semibold rounded-tl-lg">Produit</th>
                  <th className="px-4 py-3 text-right text-gray-600 font-semibold">Stock initial</th>
                  <th className="px-4 py-3 text-right text-gray-600 font-semibold">Stock théorique</th>
                  <th className="px-4 py-3 text-right text-gray-600 font-semibold">Quantité vendue (théorique)</th>
                  <th className="px-4 py-3 text-right text-gray-600 font-semibold">Montant théorique</th>
                  <th className="px-4 py-3 text-center text-gray-600 font-semibold">Stock réel</th>
                  <th className="px-4 py-3 text-right text-gray-600 font-semibold">Quantité vendue (réelle)</th>
                  <th className="px-4 py-3 text-right text-gray-600 font-semibold">Montant réel</th>
                  <th className="px-4 py-3 text-right text-gray-600 font-semibold">Écart</th>
                  <th className="px-4 py-3 text-gray-600 font-semibold">Date de saisie</th>
                  <th className="px-4 py-3 text-right text-gray-600 font-semibold rounded-tr-lg">Avaries</th>
                </tr>
              </thead>
              <tbody>
                {filteredEntries.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-4 py-6 text-center text-gray-500">
                      Aucun produit trouvé pour le département {selectedDepartment}
                      {searchQuery && ` correspondant à "${searchQuery}"`}
                    </td>
                  </tr>
                ) : (
                  filteredEntries.map(entry => (
                    <tr key={entry.productId} className="border-t hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div>
                          <div className="font-medium text-gray-900">{entry.productName}</div>
                          <div className="text-xs text-gray-500">Réf: {entry.reference}</div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">{entry.initialStock}</td>
                      <td className="px-4 py-3 text-right">{entry.theoreticalStock}</td>
                      <td className="px-4 py-3 text-right">{entry.quantitySoldTheoretical}</td>
                      <td className="px-4 py-3 text-right">{entry.theoreticalAmount.toFixed(0)} FCFA</td>
                      <td className="px-4 py-3">
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
                      <td className="px-4 py-3 text-right">
                        {entry.quantitySoldReal !== null ? entry.quantitySoldReal : '-'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {entry.realAmount !== null ? `${entry.realAmount.toFixed(0)} FCFA` : '-'}
                      </td>
                      <td className="px-4 py-3 text-right">
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
                      <td className="px-4 py-3">{entry.entryTime || '-'}</td>
                      <td className="px-4 py-3 text-right">{entry.avaries}</td>
                    </tr>
                  ))
                )}
                {filteredEntries.length > 0 && (
                  <tr className="bg-gray-50 font-bold">
                    <td className="px-4 py-3 rounded-bl-lg">Total</td>
                    <td className="px-4 py-3 text-right">-</td>
                    <td className="px-4 py-3 text-right">-</td>
                    <td className="px-4 py-3 text-right">{totals.theoreticalSales}</td>
                    <td className="px-4 py-3 text-right">{totals.theoreticalAmount.toFixed(0)} FCFA</td>
                    <td className="px-4 py-3">-</td>
                    <td className="px-4 py-3 text-right">{totals.realSales}</td>
                    <td className="px-4 py-3 text-right">{totals.realAmount.toFixed(0)} FCFA</td>
                    <td className="px-4 py-3 text-right">-</td>
                    <td className="px-4 py-3">-</td>
                    <td className="px-4 py-3 text-right rounded-br-lg">-</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-6 bg-white p-6 rounded-lg shadow-md">
            <div className="grid grid-cols-2 gap-6 mb-6">
              <div>
                <label className="block text-gray-700 font-medium mb-2">
                  Montant en caisse physique (FCFA)
                </label>
                <input
                  type="number"
                  value={physicalCash}
                  onChange={(e) => setPhysicalCash(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-[#8B4513] focus:border-[#8B4513]"
                  placeholder="Entrez le montant..."
                />
              </div>
              <div>
                <label className="block text-gray-700 font-medium mb-2">
                  Différence avec le montant théorique
                </label>
                <div className={`text-xl font-bold ${
                  cashDifference > 0 ? 'text-green-600' : 
                  cashDifference < 0 ? 'text-red-600' : 
                  'text-gray-600'
                }`}>
                  {cashDifference > 0 ? '+' : ''}{cashDifference.toFixed(0)} FCFA
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-4">
              <button
                onClick={handleSave}
                disabled={saving || filteredEntries.every(entry => entry.actualStock === null)}
                className="px-6 py-3 bg-[#8B4513] text-white rounded-lg font-medium hover:bg-[#663300] disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center"
              >
                {saving ? (
                  <>
                    <Loader2 className="animate-spin h-5 w-5 mr-2" />
                    Enregistrement...
                  </>
                ) : (
                  <>
                    <Save className="h-5 w-5 mr-2" />
                    Enregistrer le contrôle
                  </>
                )}
              </button>
            </div>
          </div>

          {user && <StockControlHistory agencyName={user.agencyName} company={user.company} />}
        </>
      )}
    </div>
  );
};

export default StockControl;