import React, { useState, useEffect } from 'react';
import { Plus, Search, Filter, Download, Eye, Truck, Package, ArrowRight, ArrowLeft, Factory } from 'lucide-react';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useUser } from '../../context/UserContext';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from 'react-hot-toast';
import NewMovementModal from './movements/NewMovementModal';
import MovementDetailsModal from './movements/MovementDetailsModal';

interface StockMovement {
  id: string;
  movementType: 'factory_supply' | 'incoming_transfer' | 'outgoing_transfer';
  department: 'Boulangerie' | 'Boutique';
  referenceNumber: string;
  date: Date;
  operatorName: string;
  vehicleRegistration: string;
  supplyCode?: string;
  sourceAgency?: string;
  destinationAgency?: string;
  comments: string;
  products: Array<{
    productId: string;
    productName: string;
    quantity: number;
    unit: string;
  }>;
  totalQuantity: number;
  status: 'pending' | 'in_transit' | 'completed' | 'cancelled';
  createdBy: string;
  createdByName: string;
  company: string;
  agency: string;
  createdAt: Date;
}

const StockMovement: React.FC = () => {
  const { user } = useUser();
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewModal, setShowNewModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedMovement, setSelectedMovement] = useState<StockMovement | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'factory_supply' | 'incoming_transfer' | 'outgoing_transfer'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'in_transit' | 'completed' | 'cancelled'>('all');
  const [filterDepartment, setFilterDepartment] = useState<'all' | 'Boulangerie' | 'Boutique'>('all');
  const [dateRange, setDateRange] = useState({
    start: '',
    end: ''
  });

  useEffect(() => {
    const fetchMovements = async () => {
      if (!user?.company || !user?.agencyName) return;

      setLoading(true);
      try {
        // Query movements where the user's agency is involved
        // This includes movements where:
        // 1. The agency is the source (for outgoing transfers)
        // 2. The agency is the destination (for incoming transfers and factory supplies)
        const movementsQuery = query(
          collection(db, 'stockMovements'),
          where('company', '==', user.company)
        );

        const snapshot = await getDocs(movementsQuery);
        const allMovements = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          date: doc.data().date.toDate(),
          createdAt: doc.data().createdAt.toDate()
        })) as StockMovement[];

        // Filter movements to show only those relevant to the user's agency
        const agencyMovements = allMovements.filter(movement => {
          // Include movements where the user's agency is involved
          return (
            // Factory supplies to this agency
            (movement.movementType === 'factory_supply' && movement.agency === user.agencyName) ||
            // Incoming transfers to this agency
            (movement.movementType === 'incoming_transfer' && movement.agency === user.agencyName) ||
            // Outgoing transfers from this agency
            (movement.movementType === 'outgoing_transfer' && movement.agency === user.agencyName) ||
            // Incoming transfers from this agency (as source)
            (movement.movementType === 'incoming_transfer' && movement.sourceAgency === user.agencyName) ||
            // Outgoing transfers to this agency (as destination)
            (movement.movementType === 'outgoing_transfer' && movement.destinationAgency === user.agencyName)
          );
        });

        // Sort by createdAt in descending order
        agencyMovements.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

        setMovements(agencyMovements);
      } catch (error) {
        console.error('Error fetching movements:', error);
        toast.error('Erreur lors du chargement des mouvements');
      } finally {
        setLoading(false);
      }
    };

    fetchMovements();
  }, [user]);

  const getMovementTypeIcon = (type: string) => {
    switch (type) {
      case 'factory_supply':
        return <Factory className="h-5 w-5" />;
      case 'incoming_transfer':
        return <ArrowRight className="h-5 w-5" />;
      case 'outgoing_transfer':
        return <ArrowLeft className="h-5 w-5" />;
      default:
        return <Package className="h-5 w-5" />;
    }
  };

  const getMovementTypeLabel = (type: string) => {
    switch (type) {
      case 'factory_supply':
        return 'Approvisionnement Usine';
      case 'incoming_transfer':
        return 'Transfert Entrant';
      case 'outgoing_transfer':
        return 'Transfert Sortant';
      default:
        return type;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'in_transit':
        return 'bg-blue-100 text-blue-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending':
        return 'En attente';
      case 'in_transit':
        return 'En transit';
      case 'completed':
        return 'Terminé';
      case 'cancelled':
        return 'Annulé';
      default:
        return status;
    }
  };

  const getDepartmentColor = (department: string) => {
    switch (department) {
      case 'Boulangerie':
        return 'bg-orange-100 text-orange-800';
      case 'Boutique':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getMovementDirection = (movement: StockMovement) => {
    const userAgency = user?.agencyName;
    
    switch (movement.movementType) {
      case 'factory_supply':
        return `Usine → ${movement.agency}`;
      case 'incoming_transfer':
        if (movement.agency === userAgency) {
          return `${movement.sourceAgency} → ${movement.agency}`;
        } else {
          return `${movement.sourceAgency} → ${movement.agency}`;
        }
      case 'outgoing_transfer':
        if (movement.agency === userAgency) {
          return `${movement.agency} → ${movement.destinationAgency}`;
        } else {
          return `${movement.agency} → ${movement.destinationAgency}`;
        }
      default:
        return '';
    }
  };

  const filteredMovements = movements.filter(movement => {
    const matchesSearch = movement.referenceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         movement.operatorName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         movement.vehicleRegistration.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesType = filterType === 'all' || movement.movementType === filterType;
    const matchesStatus = filterStatus === 'all' || movement.status === filterStatus;
    const matchesDepartment = filterDepartment === 'all' || movement.department === filterDepartment;
    
    const movementDate = new Date(movement.date);
    const isInDateRange = (!dateRange.start || movementDate >= new Date(dateRange.start)) &&
                         (!dateRange.end || movementDate <= new Date(dateRange.end));
    
    return matchesSearch && matchesType && matchesStatus && matchesDepartment && isInDateRange;
  });

  const handleViewDetails = (movement: StockMovement) => {
    setSelectedMovement(movement);
    setShowDetailsModal(true);
  };

  const handleMovementAdded = () => {
    // Refresh movements list
    const fetchMovements = async () => {
      if (!user?.company || !user?.agencyName) return;

      try {
        const movementsQuery = query(
          collection(db, 'stockMovements'),
          where('company', '==', user.company)
        );

        const snapshot = await getDocs(movementsQuery);
        const allMovements = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          date: doc.data().date.toDate(),
          createdAt: doc.data().createdAt.toDate()
        })) as StockMovement[];

        // Filter movements to show only those relevant to the user's agency
        const agencyMovements = allMovements.filter(movement => {
          return (
            (movement.movementType === 'factory_supply' && movement.agency === user.agencyName) ||
            (movement.movementType === 'incoming_transfer' && movement.agency === user.agencyName) ||
            (movement.movementType === 'outgoing_transfer' && movement.agency === user.agencyName) ||
            (movement.movementType === 'incoming_transfer' && movement.sourceAgency === user.agencyName) ||
            (movement.movementType === 'outgoing_transfer' && movement.destinationAgency === user.agencyName)
          );
        });

        // Sort by createdAt in descending order
        agencyMovements.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

        setMovements(agencyMovements);
      } catch (error) {
        console.error('Error fetching movements:', error);
      }
    };

    fetchMovements();
  };

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
        <div>
          <h2 className="text-2xl font-bold text-[#8B4513]">Mouvements de Stock</h2>
          <p className="text-gray-600 mt-1">Agence: {user.agencyName}</p>
        </div>
        <button
          onClick={() => setShowNewModal(true)}
          className="bg-[#8B4513] text-white px-6 py-3 rounded-xl flex items-center hover:bg-[#663300] transition-colors shadow-lg hover:shadow-xl"
        >
          <Plus className="h-5 w-5 mr-2" />
          Nouveau Mouvement
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher..."
              className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#8B4513] focus:border-transparent"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as any)}
            className="px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#8B4513] focus:border-transparent"
          >
            <option value="all">Tous les types</option>
            <option value="factory_supply">Approvisionnement Usine</option>
            <option value="incoming_transfer">Transfert Entrant</option>
            <option value="outgoing_transfer">Transfert Sortant</option>
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
            className="px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#8B4513] focus:border-transparent"
          >
            <option value="all">Tous les statuts</option>
            <option value="pending">En attente</option>
            <option value="in_transit">En transit</option>
            <option value="completed">Terminé</option>
            <option value="cancelled">Annulé</option>
          </select>

          <select
            value={filterDepartment}
            onChange={(e) => setFilterDepartment(e.target.value as any)}
            className="px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#8B4513]focus:border-transparent"
          >
            <option value="all">Tous les départements</option>
            <option value="Boulangerie">Boulangerie</option>
            <option value="Boutique">Boutique</option>
          </select>

          <input
            type="date"
            value={dateRange.start}
            onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
            className="px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#8B4513] focus:border-transparent"
            placeholder="Date début"
          />

          <input
            type="date"
            value={dateRange.end}
            onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
            className="px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#8B4513] focus:border-transparent"
            placeholder="Date fin"
          />
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-2xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-sm">Total Mouvements</p>
              <p className="text-2xl font-bold">{filteredMovements.length}</p>
            </div>
            <Package className="h-8 w-8 text-blue-200" />
          </div>
        </div>

        <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-2xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-100 text-sm">Terminés</p>
              <p className="text-2xl font-bold">
                {filteredMovements.filter(m => m.status === 'completed').length}
              </p>
            </div>
            <ArrowRight className="h-8 w-8 text-green-200" />
          </div>
        </div>

        <div className="bg-gradient-to-r from-yellow-500 to-yellow-600 rounded-2xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-yellow-100 text-sm">En Transit</p>
              <p className="text-2xl font-bold">
                {filteredMovements.filter(m => m.status === 'in_transit').length}
              </p>
            </div>
            <Truck className="h-8 w-8 text-yellow-200" />
          </div>
        </div>

        <div className="bg-gradient-to-r from-purple-500 to-purple-600 rounded-2xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-100 text-sm">En Attente</p>
              <p className="text-2xl font-bold">
                {filteredMovements.filter(m => m.status === 'pending').length}
              </p>
            </div>
            <Factory className="h-8 w-8 text-purple-200" />
          </div>
        </div>
      </div>

      {/* Movements Table */}
      <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Type</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Département</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Référence</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Date</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Opérateur</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Véhicule</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Agences</th>
                <th className="px-6 py-4 text-center text-sm font-semibold text-gray-600">Produits</th>
                <th className="px-6 py-4 text-center text-sm font-semibold text-gray-600">Statut</th>
                <th className="px-6 py-4 text-center text-sm font-semibold text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={10} className="px-6 py-12 text-center">
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#8B4513]"></div>
                      <span className="ml-2 text-gray-500">Chargement...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredMovements.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-6 py-12 text-center text-gray-500">
                    Aucun mouvement trouvé
                  </td>
                </tr>
              ) : (
                filteredMovements.map((movement) => (
                  <tr key={movement.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className={`p-2 rounded-lg mr-3 ${
                          movement.movementType === 'factory_supply' ? 'bg-purple-100 text-purple-600' :
                          movement.movementType === 'incoming_transfer' ? 'bg-green-100 text-green-600' :
                          'bg-blue-100 text-blue-600'
                        }`}>
                          {getMovementTypeIcon(movement.movementType)}
                        </div>
                        <span className="text-sm font-medium">
                          {getMovementTypeLabel(movement.movementType)}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {movement.department && (
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${getDepartmentColor(movement.department)}`}>
                          {movement.department}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-mono text-sm font-medium text-gray-900">
                        {movement.referenceNumber}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {format(movement.date, 'dd/MM/yyyy HH:mm', { locale: fr })}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {movement.operatorName}
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-mono text-sm bg-gray-100 px-2 py-1 rounded">
                        {movement.vehicleRegistration}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {getMovementDirection(movement)}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="bg-gray-100 text-gray-800 px-2 py-1 rounded-full text-xs font-medium">
                        {movement.products.length} produit{movement.products.length > 1 ? 's' : ''}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(movement.status)}`}>
                        {getStatusLabel(movement.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => handleViewDetails(movement)}
                        className="p-2 text-gray-600 hover:text-[#8B4513] hover:bg-gray-100 rounded-lg transition-colors"
                        title="Voir les détails"
                      >
                        <Eye className="h-5 w-5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      {showNewModal && (
        <NewMovementModal
          onClose={() => setShowNewModal(false)}
          onMovementAdded={handleMovementAdded}
        />
      )}

      {showDetailsModal && selectedMovement && (
        <MovementDetailsModal
          movement={selectedMovement}
          onClose={() => {
            setShowDetailsModal(false);
            setSelectedMovement(null);
          }}
        />
      )}
    </div>
  );
};

export default StockMovement;