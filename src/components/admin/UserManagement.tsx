import React, { useState, useEffect } from 'react';
import { collection, getDocs, doc, updateDoc, deleteDoc, query, where, getDoc } from 'firebase/firestore';
import { auth, db } from '../../lib/firebase';
import { RefreshCw } from 'lucide-react';
import EditUserModal from './EditUserModal';
import UserTable from './UserTable';
import { toast } from 'react-hot-toast';
import { sendPasswordResetEmail } from 'firebase/auth';
import PermissionsModal from './permissions/PermissionsModal';

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
  phone?: string;
  role: 'CAISSIERE BOULANGERIE' | 'CAISSIERE BOUTIQUE' | 'GESTIONNAIRE' | 'ADMINISTRATEUR' | 'PRODUCTEUR';
  createdAt: string;
  lastSignInTime?: string;
  disabled?: boolean;
  company: string;
  permissions?: Permission[];
}

const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<FirebaseUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<FirebaseUser | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);
  const [processingAction, setProcessingAction] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [currentUserCompany, setCurrentUserCompany] = useState<string | null>(null);

  const fetchUsers = async () => {
    if (!auth.currentUser) return;

    try {
      // Get current user's role and company
      const currentUserDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
      if (!currentUserDoc.exists()) {
        toast.error('Erreur: Informations utilisateur manquantes');
        return;
      }

      const currentUserData = currentUserDoc.data();
      setCurrentUserRole(currentUserData.role);
      setCurrentUserCompany(currentUserData.company);

      // Query users from the same company
      const usersQuery = query(
        collection(db, 'users'),
        where('company', '==', currentUserData.company)
      );
      
      const querySnapshot = await getDocs(usersQuery);
      const usersData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as FirebaseUser[];
      
      // Sort users by creation date (newest first)
      usersData.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      
      setUsers(usersData);
    } catch (error) {
      console.error('Erreur lors du chargement des utilisateurs:', error);
      toast.error('Erreur lors du chargement des utilisateurs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const isAdmin = currentUserRole === 'ADMINISTRATEUR';

  const handleToggleStatus = async (userId: string, currentStatus: boolean) => {
    if (!isAdmin) {
      toast.error('Action non autorisée');
      return;
    }

    setProcessingAction(`status-${userId}`);
    try {
      await updateDoc(doc(db, 'users', userId), {
        disabled: !currentStatus
      });
      await fetchUsers();
      toast.success(`Compte ${currentStatus ? 'activé' : 'désactivé'} avec succès`);
    } catch (error) {
      console.error('Erreur lors de la modification du statut:', error);
      toast.error('Erreur lors de la modification du statut');
    } finally {
      setProcessingAction(null);
    }
  };

  const handleResetPassword = async (email: string) => {
    if (!isAdmin) {
      toast.error('Action non autorisée');
      return;
    }

    try {
      await sendPasswordResetEmail(auth, email);
      toast.success('Email de réinitialisation envoyé avec succès');
    } catch (error) {
      console.error('Erreur lors de l\'envoi de l\'email:', error);
      toast.error('Erreur lors de l\'envoi de l\'email');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!isAdmin) {
      toast.error('Action non autorisée');
      return;
    }

    if (!window.confirm('Êtes-vous sûr de vouloir supprimer cet utilisateur ?')) {
      return;
    }

    setProcessingAction(`delete-${userId}`);
    try {
      await deleteDoc(doc(db, 'users', userId));
      await fetchUsers();
      toast.success('Utilisateur supprimé avec succès');
    } catch (error) {
      console.error('Erreur lors de la suppression:', error);
      toast.error('Erreur lors de la suppression');
    } finally {
      setProcessingAction(null);
    }
  };

  const handleManagePermissions = (user: FirebaseUser) => {
    if (!isAdmin) {
      toast.error('Action non autorisée');
      return;
    }
    setSelectedUser(user);
    setShowPermissionsModal(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#8B4513]"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-[#8B4513]">Gestion des Utilisateurs</h2>
        <button
          onClick={fetchUsers}
          className="flex items-center px-4 py-2 text-[#8B4513] hover:bg-[#8B4513]/10 rounded-lg"
        >
          <RefreshCw className="h-5 w-5 mr-2" />
          Actualiser
        </button>
      </div>

      <UserTable
        users={users}
        onEditUser={(user) => {
          if (!isAdmin) {
            toast.error('Action non autorisée');
            return;
          }
          setSelectedUser(user);
          setShowEditModal(true);
        }}
        onDeleteUser={handleDeleteUser}
        onToggleStatus={handleToggleStatus}
        onResetPassword={handleResetPassword}
        onManagePermissions={handleManagePermissions}
        isAdmin={isAdmin}
      />

      {showEditModal && selectedUser && (
        <EditUserModal
          user={selectedUser}
          onClose={() => {
            setShowEditModal(false);
            setSelectedUser(null);
          }}
          onUserUpdated={fetchUsers}
        />
      )}

      {showPermissionsModal && selectedUser && (
        <PermissionsModal
          user={selectedUser}
          onClose={() => {
            setShowPermissionsModal(false);
            setSelectedUser(null);
          }}
          onPermissionsUpdated={fetchUsers}
        />
      )}
    </div>
  );
};

export default UserManagement;