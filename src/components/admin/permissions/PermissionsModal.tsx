import React, { useState } from 'react';
import { X, Loader2, Save } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { toast } from 'react-hot-toast';

interface Permission {
  module: string;
  read: boolean;
  write: boolean;
}

interface FirebaseUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  permissions?: Permission[];
}

interface PermissionsModalProps {
  user: FirebaseUser;
  onClose: () => void;
  onPermissionsUpdated: () => void;
}

const DEFAULT_MODULES = [
  { id: 'pos', name: 'Point de Vente' },
  { id: 'admin', name: 'Administration' },
  { id: 'production', name: 'Production' },
  { id: 'inventory', name: 'Inventaire' },
  { id: 'reports', name: 'Rapports' },
  { id: 'users', name: 'Utilisateurs' },
  { id: 'settings', name: 'Paramètres' }
];

const PermissionsModal: React.FC<PermissionsModalProps> = ({
  user,
  onClose,
  onPermissionsUpdated
}) => {
  const [permissions, setPermissions] = useState<Permission[]>(
    user.permissions || DEFAULT_MODULES.map(module => ({
      module: module.id,
      read: false,
      write: false
    }))
  );
  const [saving, setSaving] = useState(false);

  const handlePermissionChange = (moduleId: string, type: 'read' | 'write', value: boolean) => {
    setPermissions(prev => prev.map(perm => 
      perm.module === moduleId 
        ? { ...perm, [type]: value } 
        : perm
    ));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      await updateDoc(doc(db, 'users', user.id), {
        permissions,
        updatedAt: new Date().toISOString()
      });

      toast.success('Permissions mises à jour avec succès');
      onPermissionsUpdated();
      onClose();
    } catch (error) {
      console.error('Error updating permissions:', error);
      toast.error('Erreur lors de la mise à jour des permissions');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl">
        <div className="bg-[#8B4513] text-white p-4 flex justify-between items-center">
          <h2 className="font-bold text-xl">Gestion des Permissions</h2>
          <button
            onClick={onClose}
            className="text-white hover:bg-[#663300] p-2 rounded-full"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="mb-6">
            <h3 className="font-medium text-gray-900 mb-2">
              {user.firstName} {user.lastName}
            </h3>
            <p className="text-sm text-gray-500">
              {user.email} - {user.role}
            </p>
          </div>

          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <table className="w-full">
              <thead>
                <tr className="text-left border-b">
                  <th className="pb-2">Module</th>
                  <th className="pb-2 text-center">Lecture</th>
                  <th className="pb-2 text-center">Écriture</th>
                </tr>
              </thead>
              <tbody>
                {DEFAULT_MODULES.map(module => {
                  const permission = permissions.find(p => p.module === module.id);
                  return (
                    <tr key={module.id} className="border-b last:border-0">
                      <td className="py-3">{module.name}</td>
                      <td className="py-3 text-center">
                        <input
                          type="checkbox"
                          checked={permission?.read || false}
                          onChange={(e) => handlePermissionChange(module.id, 'read', e.target.checked)}
                          className="rounded border-gray-300 text-[#8B4513] focus:ring-[#8B4513]"
                        />
                      </td>
                      <td className="py-3 text-center">
                        <input
                          type="checkbox"
                          checked={permission?.write || false}
                          onChange={(e) => handlePermissionChange(module.id, 'write', e.target.checked)}
                          className="rounded border-gray-300 text-[#8B4513] focus:ring-[#8B4513]"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
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
              type="submit"
              disabled={saving}
              className="px-6 py-3 bg-[#8B4513] text-white rounded-lg font-medium hover:bg-[#663300] disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center"
            >
              {saving ? (
                <>
                  <Loader2 className="animate-spin h-5 w-5 mr-2" />
                  Enregistrement...
                </>
              ) : (
                <>
                  <Save className="h-5 w-5 mr-2" />
                  Enregistrer
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PermissionsModal;