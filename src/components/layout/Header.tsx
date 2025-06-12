import React, { useState, useEffect } from 'react';
import { User, ShoppingCart, BarChart3, LogOut, Factory } from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { auth, db } from '../../lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import AuthModal from '../auth/AuthModal';
import UserProfile from '../profile/UserProfile';

interface HeaderProps {
  onViewChange: (view: 'pos' | 'admin' | 'production') => void;
  currentView: 'pos' | 'admin' | 'production';
}

const Header: React.FC<HeaderProps> = ({ onViewChange, currentView }) => {
  const { totalItems } = useCart();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [userData, setUserData] = useState<{
    firstName: string;
    lastName: string;
    role: string;
    agency: string;
  } | null>(null);
  
  // Update time every minute
  React.useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    
    return () => clearInterval(timer);
  }, []);

  // Subscribe to user data changes
  React.useEffect(() => {
    if (!auth.currentUser) return;

    const unsubscribe = onSnapshot(
      doc(db, 'users', auth.currentUser.uid),
      (doc) => {
        if (doc.exists()) {
          const data = doc.data();
          setUserData({
            firstName: data.firstName || '',
            lastName: data.lastName || '',
            role: data.role || '',
            agency: data.agency || ''
          });
        }
      }
    );

    return () => unsubscribe();
  }, []);
  
  const formattedTime = currentTime.toLocaleTimeString('fr-FR', { 
    hour: '2-digit', 
    minute: '2-digit' 
  });
  
  const formattedDate = currentTime.toLocaleDateString('fr-FR', { 
    day: '2-digit', 
    month: '2-digit', 
    year: 'numeric' 
  });

  const handleLogout = async () => {
    try {
      await auth.signOut();
    } catch (error) {
      console.error('Erreur lors de la déconnexion:', error);
    }
  };

  const formatRole = (role: string) => {
    const roles: { [key: string]: string } = {
      'CAISSIERE': 'Caissière',
      'GESTIONNAIRE': 'Gestionnaire',
      'ADMINISTRATEUR': 'Administrateur',
      'PRODUCTEUR': 'Producteur'
    };
    return roles[role] || role;
  };
  
  return (
    <header className="bg-[#8B4513] text-white px-6 py-4 shadow-md">
      <div className="container mx-auto flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <h1 className="text-2xl font-bold">EGREC GESTIONNAIRE</h1>
          <div className="text-sm font-medium hidden md:block">
            {formattedDate} | {formattedTime}
          </div>
        </div>
        
        <div className="flex items-center space-x-6">
          <button 
            className={`flex items-center px-4 py-2 rounded-lg transition-colors ${
              currentView === 'pos' 
                ? 'bg-[#663300] text-white' 
                : 'text-[#FFFDD0] hover:bg-[#663300]/50'
            }`}
            onClick={() => onViewChange('pos')}
          >
            <ShoppingCart className="mr-2 h-5 w-5" />
            <span>Vente</span>
            {totalItems > 0 && currentView === 'pos' && (
              <span className="ml-2 bg-[#FFD700] text-[#8B4513] rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">
                {totalItems}
              </span>
            )}
          </button>
          
          <button 
            className={`flex items-center px-4 py-2 rounded-lg transition-colors ${
              currentView === 'production' 
                ? 'bg-[#663300] text-white' 
                : 'text-[#FFFDD0] hover:bg-[#663300]/50'
            }`}
            onClick={() => onViewChange('production')}
          >
            <Factory className="mr-2 h-5 w-5" />
            <span>Production</span>
          </button>

          <button 
            className={`flex items-center px-4 py-2 rounded-lg transition-colors ${
              currentView === 'admin' 
                ? 'bg-[#663300] text-white' 
                : 'text-[#FFFDD0] hover:bg-[#663300]/50'
            }`}
            onClick={() => onViewChange('admin')}
          >
            <BarChart3 className="mr-2 h-5 w-5" />
            <span>Admin</span>
          </button>
          
          {auth.currentUser ? (
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setShowProfileModal(true)}
                className="flex items-center text-[#FFFDD0] hover:bg-[#663300]/50 px-4 py-2 rounded-lg"
              >
                <User className="h-5 w-5 mr-2" />
                <span className="hidden md:inline">
                  {userData ? (
                    <span className="flex flex-col items-start">
                      <span className="font-medium">
                        {userData.lastName.toUpperCase()} {userData.firstName}
                        {userData.role && ` - ${formatRole(userData.role)}`}
                        {userData.agency && ` - ${userData.agency}`}
                      </span>
                    </span>
                  ) : (
                    'Chargement...'
                  )}
                </span>
              </button>
              <button
                onClick={handleLogout}
                className="text-[#FFFDD0] hover:bg-[#663300]/50 p-2 rounded-lg"
                title="Déconnexion"
              >
                <LogOut className="h-5 w-5" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowAuthModal(true)}
              className="flex items-center text-[#FFFDD0] hover:bg-[#663300]/50 px-4 py-2 rounded-lg"
            >
              <User className="h-5 w-5 mr-2" />
              <span>Connexion</span>
            </button>
          )}
        </div>
      </div>

      {showAuthModal && (
        <AuthModal onClose={() => setShowAuthModal(false)} />
      )}

      {showProfileModal && (
        <UserProfile onClose={() => setShowProfileModal(false)} />
      )}
    </header>
  );
};

export default Header;