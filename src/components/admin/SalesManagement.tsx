import React, { useState, useEffect } from 'react';
import { collection, doc, updateDoc, deleteDoc, query, where, orderBy, Timestamp, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../../lib/firebase';
import { Plus, Search, Loader2, ArrowUpDown, Trash2, Eye, Calendar, FileText } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import SaleDetailModal from './SaleDetailModal';
import { useUser } from '../../context/UserContext';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

interface SalesManagementProps {}

const SalesManagement: React.FC<SalesManagementProps> = () => {
  const { user, loading: userLoading } = useUser();
  const [sales, setSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  useEffect(() => {
    if (userLoading || !user?.agencyName || !user?.company) return;

    let unsubscribe: () => void;

    const setupSalesListener = async () => {
      try {
        // Build base query with company and agency filters
        let baseQuery = query(
          collection(db, 'ventes'),
          where('company', '==', user.company),
          where('agency', '==', user.agencyName)
        );

        // Add date range if specified
        if (startDate && endDate) {
          const startDateTime = new Date(startDate);
          startDateTime.setHours(0, 0, 0, 0);
          const endDateTime = new Date(endDate);
          endDateTime.setHours(23, 59, 59, 999);

          baseQuery = query(
            collection(db, 'ventes'),
            where('company', '==', user.company),
            where('agency', '==', user.agencyName),
            where('timestamp', '>=', Timestamp.fromDate(startDateTime)),
            where('timestamp', '<=', Timestamp.fromDate(endDateTime)),
            orderBy('timestamp', 'desc')
          );
        } else {
          baseQuery = query(
            baseQuery,
            orderBy('timestamp', 'desc')
          );
        }

        unsubscribe = onSnapshot(baseQuery, (snapshot) => {
          const salesData = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
              id: doc.id,
              ...data,
              timestamp: data.timestamp instanceof Date ? data.timestamp : 
                        typeof data.timestamp === 'number' ? new Date(data.timestamp) :
                        data.timestamp.toDate()
            };
          });
          setSales(salesData);
          setLoading(false);
        }, (error) => {
          console.error('Error in sales listener:', error);
          toast.error('Erreur lors du chargement des ventes');
          setLoading(false);
        });
      } catch (error) {
        console.error('Error setting up sales listener:', error);
        toast.error('Erreur lors du chargement des ventes');
        setLoading(false);
      }
    };

    setupSalesListener();

    // Cleanup subscription on unmount or when dependencies change
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [user?.agencyName, user?.company, startDate, endDate, userLoading]);

  const isAdmin = user?.role === 'ADMINISTRATEUR';

  const handleDeleteSale = async (saleId: string) => {
    if (!isAdmin) {
      toast.error('Action non autorisée');
      return;
    }

    if (!window.confirm('Êtes-vous sûr de vouloir supprimer cette vente ?')) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'ventes', saleId));
      // No need to update sales state manually as the onSnapshot listener will handle it
      toast.success('Vente supprimée avec succès');
      if (selectedSaleId === saleId) {
        setSelectedSaleId(null); // Close modal if the deleted sale was being viewed
      }
    } catch (error) {
      console.error('Error deleting sale:', error);
      toast.error('Erreur lors de la suppression');
    }
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    
    // Add title
    doc.setFontSize(16);
    doc.text('Rapport des Ventes', 14, 20);
    
    // Add agency info
    doc.setFontSize(12);
    doc.text(`Agence: ${user?.agencyName || ''}`, 14, 30);
    
    // Add date range if filtered
    if (startDate && endDate) {
      doc.text(`Période: du ${format(new Date(startDate), 'dd/MM/yyyy')} au ${format(new Date(endDate), 'dd/MM/yyyy')}`, 14, 40);
    }
    
    // Create table data
    const tableData = filteredSales.map(sale => [
      format(new Date(sale.timestamp), 'dd/MM/yyyy HH:mm', { locale: fr }),
      sale.productName.join(', '),
      sale.quantity.reduce((sum: number, qty: number) => sum + qty, 0),
      `${sale.totalAmount} Fcfa`
    ]);
    
    // Add table
    (doc as any).autoTable({
      startY: startDate && endDate ? 45 : 35,
      head: [['Date', 'Articles', 'Quantités', 'Montant']],
      body: tableData,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [139, 69, 19] }
    });
    
    // Save PDF
    doc.save(`rapport-ventes-${user?.agencyName}.pdf`);
    toast.success('Rapport PDF généré avec succès');
  };

  const filteredSales = sales.filter(sale => {
    const searchLower = searchQuery.toLowerCase();
    return sale.productName.some((name: string) => 
      name.toLowerCase().includes(searchLower)
    );
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-[#8B4513]" />
      </div>
    );
  }

  if (!user?.agencyName) {
    return (
      <div className="p-6">
        <div className="bg-yellow-50 text-yellow-700 p-4 rounded-lg">
          Aucune agence associée à votre compte
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-[#8B4513]">Gestion des Ventes</h2>
        <button
          onClick={exportToPDF}
          className="bg-[#8B4513] text-white px-4 py-2 rounded-lg flex items-center hover:bg-[#663300]"
        >
          <FileText className="h-5 w-5 mr-2" />
          Exporter PDF
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="relative flex-grow">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Rechercher une vente..."
              className="w-full pl-10 p-3 border border-gray-300 rounded-lg focus:ring-[#8B4513] focus:border-[#8B4513]"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          <div className="flex gap-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-gray-400" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="p-3 border border-gray-300 rounded-lg focus:ring-[#8B4513] focus:border-[#8B4513]"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-500">au</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="p-3 border border-gray-300 rounded-lg focus:ring-[#8B4513] focus:border-[#8B4513]"
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left bg-gray-50">
                <th className="px-6 py-3 text-gray-500 font-medium">Date</th>
                <th className="px-6 py-3 text-gray-500 font-medium">Articles</th>
                <th className="px-6 py-3 text-gray-500 font-medium">Quantités</th>
                <th className="px-6 py-3 text-gray-500 font-medium">Montant</th>
                <th className="px-6 py-3 text-gray-500 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-center">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-[#8B4513]" />
                  </td>
                </tr>
              ) : filteredSales.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                    Aucune vente trouvée
                  </td>
                </tr>
              ) : (
                filteredSales.map((sale) => (
                  <tr key={sale.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      {format(new Date(sale.timestamp), 'dd/MM/yyyy HH:mm', { locale: fr })}
                    </td>
                    <td className="px-6 py-4">
                      <ul className="list-disc list-inside">
                        {sale.productName.map((name: string, index: number) => (
                          <li key={index}>{name}</li>
                        ))}
                      </ul>
                    </td>
                    <td className="px-6 py-4">
                      <ul className="list-none">
                        {sale.quantity.map((qty: number, index: number) => (
                          <li key={index}>{qty}</li>
                        ))}
                      </ul>
                    </td>
                    <td className="px-6 py-4">{sale.totalAmount} Fcfa</td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        <button
                          onClick={() => setSelectedSaleId(sale.id)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                          title="Voir les détails"
                        >
                          <Eye className="h-5 w-5" />
                        </button>
                        {isAdmin && (
                          <button
                            onClick={() => handleDeleteSale(sale.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                            title="Supprimer"
                          >
                            <Trash2 className="h-5 w-5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedSaleId && (
        <SaleDetailModal
          saleId={selectedSaleId}
          onClose={() => setSelectedSaleId(null)}
        />
      )}
    </div>
  );
};

export default SalesManagement;