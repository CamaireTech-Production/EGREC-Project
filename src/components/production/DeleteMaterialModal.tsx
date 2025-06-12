import React, { useState } from 'react';
import { X, Loader2, AlertTriangle } from 'lucide-react';
import { doc, deleteDoc } from 'firebase/firestore';
import { db, auth } from '../../lib/firebase';
import { toast } from 'react-hot-toast';

interface DeleteMaterialModalProps {
  material: {
    id: string;
    nom: string;
    code: string;
  };
  onClose: () => void;
  onDeleted: () => void;
}

const DeleteMaterialModal: React.FC<DeleteMaterialModalProps> = ({
  material,
  onClose,
  onDeleted
}) => {
  const [confirmation, setConfirmation] = useState('');
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    if (!auth.currentUser) return;
    if (confirmation !== material.nom) {
      toast.error('Le nom de la matière première ne correspond pas');
      return;
    }

    setLoading(true);
    try {
      await deleteDoc(doc(db, 'matieresPremiere', material.id));
      toast.success('Matière première supprimée avec succès');
      onDeleted();
      onClose();
    } catch (error) {
      console.error('Erreur lors de la suppression:', error);
      toast.error('Erreur lors de la suppression');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="bg-red-600 text-white p-4 flex justify-between items-center">
          <h2 className="font-bold text-xl flex items-center">
            <AlertTriangle className="h-6 w-6 mr-2" />
            Supprimer la Matière Première
          </h2>
          <button
            onClick={onClose}
            className="text-white hover:bg-red-700 p-2 rounded-full"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6">
          <div className="bg-red-50 text-red-800 p-4 rounded-lg mb-6">
            <p className="font-bold mb-2">⚠️ Cette action est irréversible</p>
            <p className="text-sm">
              La suppression de cette matière première effacera définitivement toutes les données associées, 
              y compris l'historique des prix et les références dans les fiches de production.
            </p>
          </div>

          <div className="mb-6">
            <h3 className="font-medium text-gray-900">{material.nom}</h3>
            <p className="text-sm text-gray-500">Code: {material.code}</p>
          </div>

          <div className="mb-6">
            <label className="block text-gray-700 font-medium mb-2">
              Pour confirmer, tapez le nom exact de la matière première :
              <span className="font-bold text-red-600"> {material.nom}</span>
            </label>
            <input
              type="text"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-red-500 focus:border-red-500"
              placeholder="Nom de la matière première"
            />
          </div>

          <div className="flex justify-end space-x-4">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-100"
            >
              Annuler
            </button>
            <button
              onClick={handleDelete}
              disabled={loading || confirmation !== material.nom}
              className="px-6 py-3 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center"
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin h-5 w-5 mr-2" />
                  Suppression...
                </>
              ) : (
                'Supprimer'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeleteMaterialModal;