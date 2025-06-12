import React from 'react';
import { X, Printer, Download, Truck, Package, Factory, Calendar, User, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { generateMovementPDF } from '../../../lib/movementPDF';
import { toast } from 'react-hot-toast';

interface MovementDetailsModalProps {
  movement: {
    id: string;
    movementType: 'factory_supply' | 'incoming_transfer' | 'outgoing_transfer';
    department?: 'Boulangerie' | 'Boutique';
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
  };
  onClose: () => void;
}

const MovementDetailsModal: React.FC<MovementDetailsModalProps> = ({ movement, onClose }) => {
  const getMovementTypeIcon = () => {
    switch (movement.movementType) {
      case 'factory_supply':
        return <Factory className="h-6 w-6" />;
      case 'incoming_transfer':
        return <Package className="h-6 w-6" />;
      case 'outgoing_transfer':
        return <Truck className="h-6 w-6" />;
      default:
        return <Package className="h-6 w-6" />;
    }
  };

  const getMovementTypeLabel = () => {
    switch (movement.movementType) {
      case 'factory_supply':
        return 'Approvisionnement Usine';
      case 'incoming_transfer':
        return 'Transfert Entrant';
      case 'outgoing_transfer':
        return 'Transfert Sortant';
      default:
        return movement.movementType;
    }
  };

  const getStatusColor = () => {
    switch (movement.status) {
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

  const getStatusLabel = () => {
    switch (movement.status) {
      case 'pending':
        return 'En attente';
      case 'in_transit':
        return 'En transit';
      case 'completed':
        return 'Terminé';
      case 'cancelled':
        return 'Annulé';
      default:
        return movement.status;
    }
  };

  const handlePrintPDF = async () => {
    try {
      await generateMovementPDF(movement);
      toast.success('Document PDF généré avec succès');
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Erreur lors de la génération du PDF');
    }
  };

  const getMovementDirection = () => {
    switch (movement.movementType) {
      case 'factory_supply':
        return `Usine → ${movement.agency}`;
      case 'incoming_transfer':
        return `${movement.sourceAgency} → ${movement.agency}`;
      case 'outgoing_transfer':
        return `${movement.agency} → ${movement.destinationAgency}`;
      default:
        return '';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[95vh] overflow-auto">
        <div className="bg-gradient-to-r from-[#8B4513] to-[#663300] text-white p-6 flex justify-between items-center sticky top-0 z-10">
          <div className="flex items-center">
            {getMovementTypeIcon()}
            <div className="ml-3">
              <h2 className="font-bold text-xl">Détails du Mouvement</h2>
              <p className="text-white/80">{movement.referenceNumber}</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handlePrintPDF}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
              title="Imprimer le document"
            >
              <Printer className="h-6 w-6" />
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        <div className="p-6">
          {/* Header Information */}
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-2xl p-6 mb-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="bg-white rounded-xl p-4 shadow-sm">
                  <div className="flex items-center justify-center mb-2">
                    {getMovementTypeIcon()}
                  </div>
                  <h3 className="font-semibold text-gray-900">{getMovementTypeLabel()}</h3>
                  <p className="text-sm text-gray-600 mt-1">{getMovementDirection()}</p>
                </div>
              </div>

              <div className="text-center">
                <div className="bg-white rounded-xl p-4 shadow-sm">
                  <Calendar className="h-6 w-6 mx-auto mb-2 text-blue-600" />
                  <h3 className="font-semibold text-gray-900">
                    {format(movement.date, 'dd MMMM yyyy', { locale: fr })}
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    {format(movement.date, 'HH:mm', { locale: fr })}
                  </p>
                </div>
              </div>

              <div className="text-center">
                <div className="bg-white rounded-xl p-4 shadow-sm">
                  <div className="flex items-center justify-center mb-2">
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor()}`}>
                      {getStatusLabel()}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">Statut du mouvement</p>
                </div>
              </div>
            </div>
          </div>

          {/* Department Information */}
          {movement.department && (
            <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-8">
              <h3 className="font-bold text-lg text-gray-900 mb-4 flex items-center">
                <Package className="h-5 w-5 mr-2 text-[#8B4513]" />
                Département
              </h3>
              <div className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-medium ${
                movement.department === 'Boulangerie' 
                  ? 'bg-orange-100 text-orange-800' 
                  : 'bg-blue-100 text-blue-800'
              }`}>
                {movement.department}
              </div>
            </div>
          )}

          {/* Movement Details */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            <div className="bg-white border border-gray-200 rounded-2xl p-6">
              <h3 className="font-bold text-lg text-gray-900 mb-6 flex items-center">
                <FileText className="h-5 w-5 mr-2 text-[#8B4513]" />
                Informations Générales
              </h3>
              
              <div className="space-y-4">
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-gray-600">Référence:</span>
                  <span className="font-mono font-medium">{movement.referenceNumber}</span>
                </div>

                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-gray-600">Opérateur:</span>
                  <span className="font-medium">{movement.operatorName}</span>
                </div>

                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-gray-600">Véhicule:</span>
                  <span className="font-mono bg-gray-100 px-2 py-1 rounded">
                    {movement.vehicleRegistration}
                  </span>
                </div>

                {movement.supplyCode && (
                  <div className="flex justify-between items-center py-2 border-b border-gray-100">
                    <span className="text-gray-600">Code approvisionnement:</span>
                    <span className="font-mono font-medium">{movement.supplyCode}</span>
                  </div>
                )}

                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-gray-600">Créé par:</span>
                  <span className="font-medium">{movement.createdByName}</span>
                </div>

                <div className="flex justify-between items-center py-2">
                  <span className="text-gray-600">Date de création:</span>
                  <span className="text-sm">
                    {format(movement.createdAt, 'dd/MM/yyyy HH:mm', { locale: fr })}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-2xl p-6">
              <h3 className="font-bold text-lg text-gray-900 mb-6 flex items-center">
                <Truck className="h-5 w-5 mr-2 text-[#8B4513]" />
                Détails du Transport
              </h3>

              <div className="space-y-4">
                <div className="bg-gray-50 rounded-xl p-4">
                  <h4 className="font-medium text-gray-900 mb-2">Itinéraire</h4>
                  <div className="flex items-center justify-between">
                    <div className="text-center">
                      <div className="w-3 h-3 bg-blue-500 rounded-full mx-auto mb-1"></div>
                      <span className="text-sm font-medium">
                        {movement.movementType === 'factory_supply' ? 'Usine' : 
                         movement.movementType === 'incoming_transfer' ? movement.sourceAgency :
                         movement.agency}
                      </span>
                    </div>
                    <div className="flex-1 h-0.5 bg-gray-300 mx-4"></div>
                    <div className="text-center">
                      <div className="w-3 h-3 bg-green-500 rounded-full mx-auto mb-1"></div>
                      <span className="text-sm font-medium">
                        {movement.movementType === 'outgoing_transfer' ? movement.destinationAgency : movement.agency}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-blue-50 rounded-xl p-4">
                  <h4 className="font-medium text-blue-900 mb-2">Quantité Totale</h4>
                  <p className="text-2xl font-bold text-blue-600">
                    {movement.totalQuantity.toLocaleString()} unités
                  </p>
                  <p className="text-sm text-blue-700 mt-1">
                    {movement.products.length} produit{movement.products.length > 1 ? 's' : ''} différent{movement.products.length > 1 ? 's' : ''}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Products Table */}
          <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-8">
            <h3 className="font-bold text-lg text-gray-900 mb-6 flex items-center">
              <Package className="h-5 w-5 mr-2 text-[#8B4513]" />
              Liste des Produits
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-600">Produit</th>
                    <th className="px-6 py-3 text-right text-sm font-semibold text-gray-600">Quantité</th>
                    <th className="px-6 py-3 text-center text-sm font-semibold text-gray-600">Unité</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {movement.products.map((product, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 font-medium text-gray-900">
                        {product.productName}
                      </td>
                      <td className="px-6 py-4 text-right font-medium">
                        {product.quantity.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="bg-gray-100 text-gray-800 px-2 py-1 rounded text-sm">
                          {product.unit}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50 font-semibold">
                    <td className="px-6 py-4">Total</td>
                    <td className="px-6 py-4 text-right">
                      {movement.totalQuantity.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-center">-</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Comments */}
          {movement.comments && (
            <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-8">
              <h3 className="font-bold text-lg text-gray-900 mb-4 flex items-center">
                <FileText className="h-5 w-5 mr-2 text-[#8B4513]" />
                Commentaires
              </h3>
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-gray-700 whitespace-pre-wrap">{movement.comments}</p>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end space-x-4">
            <button
              onClick={handlePrintPDF}
              className="px-6 py-3 bg-[#8B4513] text-white rounded-lg font-medium hover:bg-[#663300] transition-colors flex items-center"
            >
              <Download className="h-5 w-5 mr-2" />
              Télécharger PDF
            </button>
            <button
              onClick={onClose}
              className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-100 transition-colors"
            >
              Fermer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MovementDetailsModal;