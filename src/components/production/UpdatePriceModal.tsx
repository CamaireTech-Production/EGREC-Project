import React, { useState } from 'react';
import { X, Loader2, History } from 'lucide-react';
import { doc, updateDoc, arrayUnion, Timestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { toast } from 'react-hot-toast';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface PriceHistory {
  prix: number;
  date: Timestamp;
  justification: string;
}

interface RawMaterial {
  id: string;
  code: string;
  nom: string;
  uniteMessure: string;
  prixUnitaire: number;
  historiquePrix?: PriceHistory[];
}

interface UpdatePriceModalProps {
  material: RawMaterial;
  onClose: () => void;
  onPriceUpdated: () => void;
}

const UpdatePriceModal: React.FC<UpdatePriceModalProps> = ({
  material,
  onClose,
  onPriceUpdated
}) => {
  const [newPrice, setNewPrice] = useState('');
  const [justification, setJustification] = useState('');
  const [loading, setLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const price = parseFloat(newPrice);
    if (isNaN(price) || price <= 0) {
      toast.error('Le prix doit être un nombre positif');
      return;
    }

    if (!justification.trim()) {
      toast.error('La justification est requise');
      return;
    }

    setLoading(true);
    try {
      const now = Timestamp.now();
      await updateDoc(doc(db, 'matieresPremiere', material.id), {
        prixUnitaire: price,
        derniereMiseAJour: now,
        historiquePrix: arrayUnion({
          prix: price,
          date: now,
          justification: justification.trim()
        })
      });

      toast.success('Prix mis à jour avec succès');
      onPriceUpdated();
      onClose();
    } catch (error) {
      console.error('Erreur lors de la mise à jour:', error);
      toast.error('Erreur lors de la mise à jour du prix');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="bg-[#8B4513] text-white p-4 flex justify-between items-center">
          <h2 className="font-bold text-xl">Modifier le Prix</h2>
          <button
            onClick={onClose}
            className="text-white hover:bg-[#663300] p-2 rounded-full"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6">
          <div className="mb-6">
            <h3 className="font-medium text-gray-900">{material.nom}</h3>
            <p className="text-sm text-gray-500">Code: {material.code}</p>
            <p className="text-sm text-gray-500">
              Prix actuel: {material.prixUnitaire} Fcfa/{material.uniteMessure}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-gray-700 font-medium mb-2">
                Nouveau prix (Fcfa)
              </label>
              <input
                type="number"
                value={newPrice}
                onChange={(e) => setNewPrice(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-[#8B4513] focus:border-[#8B4513]"
                required
                min="0"
                step="0.01"
                placeholder={`Prix par ${material.uniteMessure}`}
              />
            </div>

            <div>
              <label className="block text-gray-700 font-medium mb-2">
                Justification du changement
              </label>
              <textarea
                value={justification}
                onChange={(e) => setJustification(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-[#8B4513] focus:border-[#8B4513]"
                required
                rows={3}
                placeholder="Raison du changement de prix..."
              />
            </div>

            {material.historiquePrix && (
              <div>
                <button
                  type="button"
                  onClick={() => setShowHistory(!showHistory)}
                  className="flex items-center text-[#8B4513] hover:text-[#663300]"
                >
                  <History className="h-4 w-4 mr-2" />
                  {showHistory ? 'Masquer l\'historique' : 'Voir l\'historique'}
                </button>

                {showHistory && (
                  <div className="mt-4 max-h-40 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left bg-gray-50">
                          <th className="px-4 py-2">Date</th>
                          <th className="px-4 py-2">Prix</th>
                          <th className="px-4 py-2">Justification</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {material.historiquePrix.map((entry, index) => (
                          <tr key={index} className="hover:bg-gray-50">
                            <td className="px-4 py-2">
                              {format(entry.date.toDate(), 'dd/MM/yyyy HH:mm', { locale: fr })}
                            </td>
                            <td className="px-4 py-2">
                              {entry.prix} Fcfa/{material.uniteMessure}
                            </td>
                            <td className="px-4 py-2">{entry.justification}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end space-x-4 pt-4">
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
                  'Mettre à jour'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default UpdatePriceModal;