import React, { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './lib/firebase';
import { CartProvider } from './context/CartContext';
import { UserProvider } from './context/UserContext';
import Header from './components/layout/Header';
import POSView from './components/pos/POSView';
import AdminView from './components/admin/AdminView';
import ProductionView from './components/production/ProductionView';
import AuthModal from './components/auth/AuthModal';
import { initDB } from './lib/db';
import { setupSyncListener } from './lib/sync';

function App() {
  const [currentView, setCurrentView] = useState<'pos' | 'admin' | 'production'>('pos');
  const [user, setUser] = useState(auth.currentUser);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Initialize IndexedDB
    initDB().catch(console.error);
    
    // Setup sync listener
    setupSyncListener();
    
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100">
        <div className="text-[#8B4513] text-xl">Chargement...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="w-full max-w-md p-6">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-[#8B4513] mb-2">EGREC GESTIONNAIRE</h1>
            <p className="text-gray-600">Connectez-vous pour accéder à l'application</p>
          </div>
          <AuthModal onClose={() => {}} />
        </div>
      </div>
    );
  }

  return (
    <UserProvider>
      <CartProvider>
        <div className="flex flex-col h-screen bg-gray-100">
          <Header onViewChange={setCurrentView} currentView={currentView} />
          <main className="flex-grow p-6 overflow-auto">
            <div className="container mx-auto h-full">
              {currentView === 'pos' && <POSView />}
              {currentView === 'admin' && <AdminView />}
              {currentView === 'production' && <ProductionView />}
            </div>
          </main>
        </div>
      </CartProvider>
    </UserProvider>
  );
}

export default App;