import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, updateDoc, increment } from 'firebase/firestore';
import { db, auth } from '../../lib/firebase';
import { Plus, Search, Loader2, Filter } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from 'react-hot-toast';
import { useUser } from '../../context/UserContext';
import { initWasteCache, saveWasteRecord, getWasteRecords, setupWasteSyncListener } from '../../lib/wasteCache';
import NewWasteModal from './NewWasteModal';

interface WasteRecord {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  reason: 'mauvaise production' | 'produit bientôt périmé';
  timestamp: Date;
  userId: string;
  userName: string;
  company: string;
  agencyName: string;
  synced: boolean;
}

const WasteManagement: React.FC = () => {
  const { user } = useUser();
  const [records, setRecords] = useState<WasteRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewModal, setShowNewModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const init = async () => {
      await initWasteCache();
      setupWasteSyncListener();
    };
    init();
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      toast.success('Connexion rétablie');
    };

    const handleOffline = () => {
      setIsOffline(true);
      toast('Mode hors-ligne activé', {
        icon: '🔌',
        duration: 3000
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    const fetchRecords = async () => {
      if (!user?.company || !user?.agencyName) return;

      setLoading(true);
      try {
        let wasteRecords: WasteRecord[] = [];

        if (navigator.onLine) {
          const q = query(
            collection(db, 'avaries'),
            where('company', '==', user.company),
            where('agencyName', '==', user.agencyName)
          );
          const snapshot = await getDocs(q);
          wasteRecords = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            timestamp: doc.data().timestamp.toDate()
          })) as WasteRecord[];
        }

        // Get local records
        const localRecords = await getWasteRecords(user.company, user.agencyName);
        
        // Merge records, prioritizing local unsynced records
        const mergedRecords = [
          ...localRecords.filter(r => !r.synced),
          ...wasteRecords
        ].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

        setRecords(mergedRecords);
      } catch (error) {
        console.error('Error fetching waste records:', error);
        toast.error('Erreur lors du chargement des avaries');
      } finally {
        setLoading(false);
      }
    };

    fetchRecords();
  }, [user]);

  const handleNewWaste = async (wasteData: Omit<WasteRecord, 'id' | 'synced'>) => {
    try {
      await saveWasteRecord(wasteData);

      // Update product stock
      if (navigator.onLine) {
        const productRef = doc(db, 'products', wasteData.productId);
        await updateDoc(productRef, {
          stock: increment(-wasteData.quantity)
        });
      }

      toast.success('Avarie enregistrée avec succès');
      setShowNewModal(false);
      
      // Refresh records
      if (user?.company && user?.agencyName) {
        const localRecords = await getWasteRecords(user.company, user.agencyName);
        setRecords(localRecords);
      }
    } catch (error) {
      console.error('Error saving waste record:', error);
      toast.error('Erreur lors de l\'enregistrement');
    }
  };

  const filteredRecords = records.filter(record =>
    record.productName.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-[#8B4513]">Gestion des Avaries</h2>
        <button
          className="bg-[#8B4513] text-white px-4 py-2 rounded-lg flex items-center hover:bg-[#663300]"
          onClick={() => setShowNewModal(true)}
        >
          <Plus className="h-5 w-5 mr-2" />
          Nouvelle Avarie
        </button>
      </div>

      {isOffline && (
        <div className="mb-6 bg-yellow-50 border-l-4 border-yellow-400 p-4">
          <p className="text-yellow-700">
            Mode hors-ligne actif. Les avaries seront synchronisées automatiquement lors du retour de la connexion.
          </p>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="mb-6 relative">
          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Rechercher une avarie..."
            className="w-full pl-10 p-3 border border-gray-300 rounded-lg focus:ring-[#8B4513] focus:border-[#8B4513]"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left bg-gray-50">
                <th className="px-6 py-3 text-gray-500 font-medium">Date</th>
                <th className="px-6 py-3 text-gray-500 font-medium">Produit</th>
                <th className="px-6 py-3 text-gray-500 font-medium">Quantité</th>
                <th className="px-6 py-3 text-gray-500 font-medium">Motif</th>
                <th className="px-6 py-3 text-gray-500 font-medium">Utilisateur</th>
                <th className="px-6 py-3 text-gray-500 font-medium">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center">
                    <Loader2 className="h-8 w-8 animate-spin text-[#8B4513] mx-auto" />
                  </td>
                </tr>
              ) : filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    Aucune avarie enregistrée
                  </td>
                </tr>
              ) : (
                filteredRecords.map((record) => (
                  <tr key={record.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      {format(record.timestamp, 'dd/MM/yyyy HH:mm', { locale: fr })}
                    </td>
                    <td className="px-6 py-4">{record.productName}</td>
                    <td className="px-6 py-4">{record.quantity}</td>
                    <td className="px-6 py-4">{record.reason}</td>
                    <td className="px-6 py-4">{record.userName}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        record.synced
                          ? 'bg-green-100 text-green-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {record.synced ? 'Synchronisé' : 'En attente'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showNewModal && (
        <NewWasteModal
          onClose={() => setShowNewModal(false)}
          onSubmit={handleNewWaste}
        />
      )}
    </div>
  );
}

export default WasteManagement;