import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy, doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../../lib/firebase';
import { Plus, Search, Loader2, ArrowUpDown, Trash2 } from 'lucide-react';
import NewMaterialModal from './NewMaterialModal';
import UpdatePriceModal from './UpdatePriceModal';
import DeleteMaterialModal from './DeleteMaterialModal';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from 'react-hot-toast';

interface RawMaterial {
  id: string;
  code: string;
  nom: string;
  uniteMessure: string;
  prixUnitaire: number;
  entrepriseId: string;
  dateCreation: Date;
  derniereMiseAJour: Date;
  creePar: string;
  company: string;
}

const RawMaterials: React.FC = () => {
  const [materials, setMaterials] = useState<RawMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewModal, setShowNewModal] = useState(false);
  const [showPriceModal, setShowPriceModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState<RawMaterial | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortConfig, setSortConfig] = useState<{
    key: keyof RawMaterial;
    direction: 'asc' | 'desc';
  }>({ key: 'dateCreation', direction: 'desc' });

  useEffect(() => {
    if (!auth.currentUser) return;

    const fetchMaterials = async () => {
      try {
        // Get user's company first
        const userDocRef = doc(db, 'users', auth.currentUser.uid);
        const userDocSnap = await getDoc(userDocRef);
        const company = userDocSnap.exists() ? userDocSnap.data().company : null;

        if (!company) {
          toast.error('Erreur: Informations entreprise manquantes');
          setLoading(false);
          return;
        }

        const materialsQuery = query(
          collection(db, 'matieresPremiere'),
          where('company', '==', company),
          orderBy(sortConfig.key, sortConfig.direction)
        );
        
        const unsubscribe = onSnapshot(materialsQuery, 
          (snapshot) => {
            const materialsData = snapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data(),
              dateCreation: doc.data().dateCreation.toDate(),
              derniereMiseAJour: doc.data().derniereMiseAJour?.toDate() || doc.data().dateCreation.toDate()
            })) as RawMaterial[];
            
            setMaterials(materialsData);
            setLoading(false);
          },
          (error) => {
            console.error('Erreur lors du chargement des matières premières:', error);
            setLoading(false);
          }
        );

        return () => unsubscribe();
      } catch (error) {
        console.error('Erreur lors du chargement des matières premières:', error);
        setLoading(false);
      }
    };

    fetchMaterials();
  }, [sortConfig]);

  const handleSort = (key: keyof RawMaterial) => {
    setSortConfig(current => ({
      key,
      direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const filteredMaterials = materials.filter(material =>
    (material.nom || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (material.code || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleUpdatePrice = (material: RawMaterial) => {
    setSelectedMaterial(material);
    setShowPriceModal(true);
  };

  const handleDelete = (material: RawMaterial) => {
    setSelectedMaterial(material);
    setShowDeleteModal(true);
  };

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
        <h2 className="text-2xl font-bold text-[#8B4513]">Matières Premières</h2>
        <button
          className="bg-[#8B4513] text-white px-4 py-2 rounded-lg flex items-center hover:bg-[#663300]"
          onClick={() => setShowNewModal(true)}
        >
          <Plus className="h-5 w-5 mr-2" />
          Nouvelle Matière
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="mb-6 relative">
          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Rechercher par nom ou code..."
            className="w-full pl-10 p-3 border border-gray-300 rounded-lg focus:ring-[#8B4513] focus:border-[#8B4513]"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left bg-gray-50">
                <th className="px-6 py-3">
                  <button
                    className="text-gray-500 font-medium flex items-center"
                    onClick={() => handleSort('code')}
                  >
                    Code
                    <ArrowUpDown className="h-4 w-4 ml-1" />
                  </button>
                </th>
                <th className="px-6 py-3">
                  <button
                    className="text-gray-500 font-medium flex items-center"
                    onClick={() => handleSort('nom')}
                  >
                    Désignation
                    <ArrowUpDown className="h-4 w-4 ml-1" />
                  </button>
                </th>
                <th className="px-6 py-3 text-gray-500 font-medium">Unité</th>
                <th className="px-6 py-3">
                  <button
                    className="text-gray-500 font-medium flex items-center"
                    onClick={() => handleSort('prixUnitaire')}
                  >
                    Prix Unitaire
                    <ArrowUpDown className="h-4 w-4 ml-1" />
                  </button>
                </th>
                <th className="px-6 py-3">
                  <button
                    className="text-gray-500 font-medium flex items-center"
                    onClick={() => handleSort('derniereMiseAJour')}
                  >
                    Dernière M.A.J
                    <ArrowUpDown className="h-4 w-4 ml-1" />
                  </button>
                </th>
                <th className="px-6 py-3 text-gray-500 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredMaterials.map((material) => (
                <tr key={material.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-medium">{material.code}</td>
                  <td className="px-6 py-4">{material.nom}</td>
                  <td className="px-6 py-4">{material.uniteMessure}</td>
                  <td className="px-6 py-4">{material.prixUnitaire} Fcfa/{material.uniteMessure}</td>
                  <td className="px-6 py-4">
                    {format(material.derniereMiseAJour, 'dd/MM/yyyy HH:mm', { locale: fr })}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-4">
                      <button
                        onClick={() => handleUpdatePrice(material)}
                        className="text-[#8B4513] hover:text-[#663300] font-medium"
                      >
                        Modifier prix
                      </button>
                      <button
                        onClick={() => handleDelete(material)}
                        className="text-red-600 hover:text-red-800"
                        title="Supprimer"
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredMaterials.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    Aucune matière première trouvée
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showNewModal && (
        <NewMaterialModal
          onClose={() => setShowNewModal(false)}
          onMaterialAdded={() => {}}
        />
      )}

      {showPriceModal && selectedMaterial && (
        <UpdatePriceModal
          material={selectedMaterial}
          onClose={() => {
            setShowPriceModal(false);
            setSelectedMaterial(null);
          }}
          onPriceUpdated={() => {}}
        />
      )}

      {showDeleteModal && selectedMaterial && (
        <DeleteMaterialModal
          material={selectedMaterial}
          onClose={() => {
            setShowDeleteModal(false);
            setSelectedMaterial(null);
          }}
          onDeleted={() => {}}
        />
      )}
    </div>
  );
};

export default RawMaterials;