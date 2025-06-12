import React, { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { collection, addDoc, doc, getDoc, Timestamp } from 'firebase/firestore';
import { db, auth } from '../../lib/firebase';
import { toast } from 'react-hot-toast';

interface NewMaterialModalProps {
  onClose: () => void;
  onMaterialAdded: () => void;
}

const UNITES_MESURE = [
  'kg',
  'g',
  'L',
  'mL',
  'unité',
  'sachet',
  'boîte'
];

const NewMaterialModal: React.FC<NewMaterialModalProps> = ({ onClose, onMaterialAdded }) => {
  const [formData, setFormData] = useState({
    nom: '',
    uniteMessure: UNITES_MESURE[0],
    prixUnitaire: ''
  });
  const [loading, setLoading] = useState(false);

  const generateCode = () => {
    const prefix = 'MP';
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `${prefix}${timestamp}${random}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;

    const price = parseFloat(formData.prixUnitaire);
    if (isNaN(price) || price <= 0) {
      toast.error('Le prix unitaire doit être un nombre positif');
      return;
    }

    setLoading(true);
    try {
      // Get user's company
      const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
      const company = userDoc.exists() ? userDoc.data().company : undefined;

      if (!company) {
        throw new Error('Erreur: Informations entreprise manquantes');
      }

      const now = Timestamp.now();
      await addDoc(collection(db, 'matieresPremiere'), {
        code: generateCode(),
        nom: formData.nom.trim(),
        uniteMessure: formData.uniteMessure,
        prixUnitaire: price,
        entrepriseId: auth.currentUser.uid,
        dateCreation: now,
        derniereMiseAJour: now,
        creePar: auth.currentUser.uid,
        company: company,
        historiquePrix: [{
          prix: price,
          date: now,
          justification: 'Prix initial'
        }]
      });

      toast.success('Matière première ajoutée avec succès');
      onMaterialAdded();
      onClose();
    } catch (error) {
      console.error('Erreur lors de l\'ajout:', error);
      toast.error('Erreur lors de l\'ajout de la matière première');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="bg-[#8B4513] text-white p-4 flex justify-between items-center">
          <h2 className="font-bold text-xl">Nouvelle Matière Première</h2>
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
                Désignation
              </label>
              <input
                type="text"
                value={formData.nom}
                onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-[#8B4513] focus:border-[#8B4513]"
                required
                placeholder="Ex: Farine de blé T55"
              />
            </div>

            <div>
              <label className="block text-gray-700 font-medium mb-2">
                Unité de mesure
              </label>
              <select
                value={formData.uniteMessure}
                onChange={(e) => setFormData({ ...formData, uniteMessure: e.target.value })}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-[#8B4513] focus:border-[#8B4513]"
                required
              >
                {UNITES_MESURE.map(unite => (
                  <option key={unite} value={unite}>
                    {unite}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-gray-700 font-medium mb-2">
                Prix unitaire initial (Fcfa)
              </label>
              <input
                type="number"
                value={formData.prixUnitaire}
                onChange={(e) => setFormData({ ...formData, prixUnitaire: e.target.value })}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-[#8B4513] focus:border-[#8B4513]"
                required
                min="0"
                step="0.01"
                placeholder={`Prix par ${formData.uniteMessure}`}
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

export default NewMaterialModal;