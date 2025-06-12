import React, { useState, useEffect } from 'react';
import { collection, query, where, orderBy, getDocs, doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../../lib/firebase';
import { Plus, Search, Loader2, Eye, AlertCircle, CheckCircle2, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from 'react-hot-toast';
import { deleteSale } from '../../services/sales';
import { useUser } from '../../context/UserContext';

interface DeleteConfirmationModalProps {
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}

const DeleteConfirmationModal: React.FC<DeleteConfirmationModalProps> = ({ onConfirm, onCancel }) => {
  const [reason, setReason] = useState('');
  
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full">
        <h3 className="text-lg font-bold mb-4">Confirmer la suppression</h3>
        <p className="text-gray-600 mb-4">
          Cette action ne peut pas être annulée. La transaction sera marquée comme supprimée mais conservée dans la base de données.
        </p>
        <div className="mb-4">
          <label className="block text-gray-700 font-medium mb-2">
            Raison de la suppression
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-lg"
            required
            rows={3}
            placeholder="Veuillez indiquer la raison de la suppression..."
          />
        </div>
        <div className="flex justify-end space-x-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 border border-gray-300 rounded-lg"
          >
            Annuler
          </button>
          <button
            onClick={() => onConfirm(reason)}
            disabled={!reason.trim()}
            className="px-4 py-2 bg-red-600 text-white rounded-lg disabled:bg-gray-300"
          >
            Confirmer la suppression
          </button>
        </div>
      </div>
    </div>
  );
};

const SalesRecords: React.FC = () => {
  const { user, loading: userLoading, error: userError } = useUser();
  const [pendingSales, setPendingSales] = useState<any[]>([]);
  const [syncedSales, setSyncedSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedSale, setSelectedSale] = useState<any>(null);
  const [showDeleted, setShowDeleted] = useState(false);

  useEffect(() => {
    const fetchSales = async () => {
      if (!user?.company || !user?.agencyName) return;

      try {
        const salesQuery = query(
          collection(db, 'ventes'),
          where('company', '==', user.company),
          where('agency', '==', user.agencyName),
          orderBy('timestamp', 'desc')
        );

        const snapshot = await getDocs(salesQuery);
        const pending: any[] = [];
        const synced: any[] = [];

        snapshot.forEach(doc => {
          const sale = {
            id: doc.id,
            ...doc.data(),
            date: doc.data().timestamp.toDate()
          };

          // Filter deleted sales based on showDeleted state
          if (sale.deletedAt && !showDeleted) {
            return;
          }

          if (sale.stockUpdated) {
            synced.push(sale);
          } else {
            pending.push(sale);
          }
        });

        setPendingSales(pending);
        setSyncedSales(synced);
      } catch (error) {
        console.error('Error fetching sales:', error);
        setError('Erreur lors du chargement des ventes');
      } finally {
        setLoading(false);
      }
    };

    if (!userLoading && user) {
      fetchSales();
    }
  }, [user, userLoading, showDeleted]);

  const handleDeleteClick = (sale: any) => {
    setSelectedSale(sale);
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async (reason: string) => {
    if (!selectedSale || !user) return;

    try {
      // First check if the sale still exists
      const saleRef = doc(db, 'ventes', selectedSale.id);
      const saleDoc = await getDoc(saleRef);
      
      if (!saleDoc.exists()) {
        // Remove from UI immediately if sale no longer exists
        setPendingSales(prev => prev.filter(sale => sale.id !== selectedSale.id));
        setSyncedSales(prev => prev.filter(sale => sale.id !== selectedSale.id));
        toast.error('Cette vente a déjà été supprimée');
        setShowDeleteModal(false);
        setSelectedSale(null);
        return;
      }

      // Proceed with deletion if sale exists
      await deleteSale(selectedSale.id, {
        reason,
        deletedBy: user.id,
        deletedByName: `${user.firstName} ${user.lastName}`
      });
      
      toast.success('Transaction supprimée avec succès');
      
      // Update UI after successful deletion
      setPendingSales(prev => prev.filter(sale => sale.id !== selectedSale.id));
      setSyncedSales(prev => prev.filter(sale => sale.id !== selectedSale.id));
    } catch (error: any) {
      console.error('Error deleting sale:', error);
      toast.error(error.message || 'Erreur lors de la suppression');
    } finally {
      setShowDeleteModal(false);
      setSelectedSale(null);
    }
  };

  const SalesList = ({ sales, isPending }: { sales: any[], isPending: boolean }) => (
    <div className="space-y-4">
      {sales.map(sale => (
        <div 
          key={sale.id} 
          className={`bg-white rounded-lg shadow-sm p-4 border-l-4 ${
            sale.deletedAt ? 'opacity-50 border-gray-300' :
            isPending ? 'border-red-500' : 'border-green-500'
          }`}
        >
          <div className="flex items-start justify-between">
            <div className="flex-grow">
              <div className="flex items-center gap-2">
                {isPending ? (
                  <AlertCircle className="h-5 w-5 text-red-500" />
                ) : (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                )}
                <span className="font-medium">
                  {format(sale.date, 'dd MMMM yyyy à HH:mm', { locale: fr })}
                </span>
              </div>
              
              <div className="mt-2 space-y-1">
                {sale.productName.map((name: string, index: number) => (
                  <div key={index} className="flex justify-between text-sm">
                    <span className="text-gray-600">{name}</span>
                    <span className="font-medium">x{sale.quantity[index]}</span>
                  </div>
                ))}
              </div>

              {sale.deletedAt && (
                <div className="mt-2 text-sm text-gray-500">
                  <p>Supprimé le {format(sale.deletedAt.toDate(), 'dd/MM/yyyy HH:mm', { locale: fr })}</p>
                  <p>Par: {sale.deletedByName}</p>
                  <p>Raison: {sale.deleteReason}</p>
                </div>
              )}
            </div>
            
            <div className="text-right flex flex-col items-end gap-2">
              <span className="font-bold">{Math.round(sale.totalAmount)} Fcfa</span>
              <div className="text-sm text-gray-500">
                {isPending ? 'En attente de sync' : 'Synchronisé'}
              </div>
              {!sale.deletedAt && (
                <button
                  onClick={() => handleDeleteClick(sale)}
                  className="text-red-600 hover:text-red-800 p-2"
                  title="Supprimer"
                >
                  <Trash2 className="h-5 w-5" />
                </button>
              )}
            </div>
          </div>
        </div>
      ))}
      
      {sales.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          Aucune vente {isPending ? 'en attente' : 'synchronisée'}
        </div>
      )}
    </div>
  );

  if (userLoading || loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-[#8B4513]" />
      </div>
    );
  }

  if (userError || error) {
    return (
      <div className="bg-red-50 text-red-700 p-4 rounded-lg">
        {userError || error}
      </div>
    );
  }

  if (!user?.company || !user?.agencyName) {
    return (
      <div className="bg-yellow-50 text-yellow-700 p-4 rounded-lg">
        Informations entreprise ou agence manquantes
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-bold text-red-600 mb-4 flex items-center">
          <AlertCircle className="h-5 w-5 mr-2" />
          En attente de synchronisation ({pendingSales.length})
        </h3>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={showDeleted}
              onChange={(e) => setShowDeleted(e.target.checked)}
              className="rounded border-gray-300 text-[#8B4513] focus:ring-[#8B4513]"
            />
            <span className="text-sm text-gray-600">Afficher les transactions supprimées</span>
          </label>
        </div>
      </div>

      <SalesList sales={pendingSales} isPending={true} />

      <div>
        <h3 className="text-lg font-bold text-green-600 mb-4 flex items-center">
          <CheckCircle2 className="h-5 w-5 mr-2" />
          Ventes synchronisées ({syncedSales.length})
        </h3>
        <SalesList sales={syncedSales} isPending={false} />
      </div>

      {showDeleteModal && (
        <DeleteConfirmationModal
          onConfirm={handleDeleteConfirm}
          onCancel={() => {
            setShowDeleteModal(false);
            setSelectedSale(null);
          }}
        />
      )}
    </div>
  );
};

export default SalesRecords;