import React, { useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { X, Loader2 } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface FirebaseUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  role: 'CAISSIERE BOULANGERIE' | 'CAISSIERE BOUTIQUE' | 'GESTIONNAIRE' | 'ADMINISTRATEUR' | 'PRODUCTEUR';
  createdAt: string;
}

interface EditUserModalProps {
  user: FirebaseUser;
  onClose: () => void;
  onUserUpdated: () => void;
}

const EditUserModal: React.FC<EditUserModalProps> = ({ user, onClose, onUserUpdated }) => {
  const [formData, setFormData] = useState({
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone || '',
    role: user.role,
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await updateDoc(doc(db, 'users', user.id), {
        firstName: formData.firstName,
        lastName: formData.lastName,
        phone: formData.phone,
        role: formData.role,
      });
      
      toast.success('Utilisateur mis à jour avec succès');
      onUserUpdated();
      onClose();
    } catch (error) {
      console.error('Erreur lors de la mise à jour:', error);
      toast.error('Erreur lors de la mise à jour');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="bg-[#8B4513] text-white p-4 flex justify-between items-center">
          <h2 className="font-bold text-xl">Modifier l'utilisateur</h2>
          <button
            onClick={onClose}
            className="text-white hover:bg-[#663300] p-2 rounded-full"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="space-y-4">
            <div>
              <label className="block text-gray-700 font-medium mb-2">
                Prénom
              </label>
              <input
                type="text"
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-[#8B4513] focus:border-[#8B4513]"
                required
              />
            </div>

            <div>
              <label className="block text-gray-700 font-medium mb-2">
                Nom
              </label>
              <input
                type="text"
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-[#8B4513] focus:border-[#8B4513]"
                required
              />
            </div>

            <div>
              <label className="block text-gray-700 font-medium mb-2">
                Grade
              </label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value as FirebaseUser['role'] })}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-[#8B4513] focus:border-[#8B4513]"
                required
              >
                <option value="CAISSIERE BOULANGERIE">Caissière Boulangerie</option>
                <option value="CAISSIERE BOUTIQUE">Caissière Boutique</option>
                <option value="GESTIONNAIRE">Gestionnaire</option>
                <option value="ADMINISTRATEUR">Administrateur</option>
                <option value="PRODUCTEUR">Producteur</option>
              </select>
            </div>

            <div>
              <label className="block text-gray-700 font-medium mb-2">
                Téléphone
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-[#8B4513] focus:border-[#8B4513]"
                placeholder="Ex: 06 12 34 56 78"
              />
            </div>

            <div>
              <label className="block text-gray-700 font-medium mb-2">
                Email
              </label>
              <input
                type="email"
                value={user.email}
                className="w-full p-3 bg-gray-100 border border-gray-300 rounded-lg text-gray-500"
                disabled
              />
            </div>
          </div>

          <div className="mt-6 flex justify-end space-x-4">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-100"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-3 bg-[#8B4513] text-white rounded-lg font-medium hover:bg-[#663300] disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center"
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin h-5 w-5 mr-2" />
                  Enregistrement...
                </>
              ) : (
                'Enregistrer'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditUserModal;