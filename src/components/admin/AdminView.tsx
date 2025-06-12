import React, { useState } from 'react';
import { LayoutDashboard, Package2, Settings, Users, CreditCard, ClipboardList, AlertTriangle, DollarSign, Wallet, Building2, Truck } from 'lucide-react';
import Dashboard from './Dashboard';
import ProductManagement from './ProductManagement';
import UserManagement from './UserManagement';
import SalesRecords from './SalesRecords';
import StockControl from './StockControl';
import SalesManagement from './SalesManagement';
import ExpenseManagement from './ExpenseManagement';
import CentralizedAdmin from './CentralizedAdmin';
import StockMovement from './StockMovement';

const AdminView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'products' | 'users' | 'settings' | 'transactions' | 'stock' | 'sales' | 'expenses' | 'centralized' | 'movements'>('dashboard');
  
  const renderTabContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard />;
      case 'products':
        return <ProductManagement />;
      case 'users':
        return <UserManagement />;
      case 'settings':
        return <div className="p-6"><h2 className="text-2xl font-bold mb-6">Paramètres</h2></div>;
      case 'transactions':
        return <div className="p-6">
          <h2 className="text-2xl font-bold mb-6">Historique des Transactions</h2>
          <SalesRecords />
        </div>;
      case 'stock':
        return <StockControl />;
      case 'sales':
        return <SalesManagement />;
      case 'expenses':
        return <ExpenseManagement />;
      case 'centralized':
        return <CentralizedAdmin />;
      case 'movements':
        return <StockMovement />;
      default:
        return <Dashboard />;
    }
  };
  
  return (
    <div className="flex h-full">
      <div className="w-64 bg-[#8B4513] text-white">
        <div className="p-4 border-b border-[#663300]">
          <h2 className="font-bold text-xl">Administration</h2>
        </div>
        <nav className="p-4">
          <ul className="space-y-2">
            <li>
              <button
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                  activeTab === 'dashboard' 
                    ? 'bg-white text-[#8B4513]' 
                    : 'text-white hover:bg-[#663300]'
                }`}
                onClick={() => setActiveTab('dashboard')}
              >
                <LayoutDashboard className="h-5 w-5" />
                <span>Tableau de Bord</span>
              </button>
            </li>
            <li>
              <button
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                  activeTab === 'centralized' 
                    ? 'bg-white text-[#8B4513]' 
                    : 'text-white hover:bg-[#663300]'
                }`}
                onClick={() => setActiveTab('centralized')}
              >
                <Building2 className="h-5 w-5" />
                <span>Admin. Centralisée</span>
              </button>
            </li>
            <li>
              <button
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                  activeTab === 'products' 
                    ? 'bg-white text-[#8B4513]' 
                    : 'text-white hover:bg-[#663300]'
                }`}
                onClick={() => setActiveTab('products')}
              >
                <Package2 className="h-5 w-5" />
                <span>Produits</span>
              </button>
            </li>
            <li>
              <button
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                  activeTab === 'stock' 
                    ? 'bg-white text-[#8B4513]' 
                    : 'text-white hover:bg-[#663300]'
                }`}
                onClick={() => setActiveTab('stock')}
              >
                <ClipboardList className="h-5 w-5" />
                <span>Contrôle Stock</span>
              </button>
            </li>
            <li>
              <button
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                  activeTab === 'movements' 
                    ? 'bg-white text-[#8B4513]' 
                    : 'text-white hover:bg-[#663300]'
                }`}
                onClick={() => setActiveTab('movements')}
              >
                <Truck className="h-5 w-5" />
                <span>Mouvements Stock</span>
              </button>
            </li>
            <li>
              <button
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                  activeTab === 'sales' 
                    ? 'bg-white text-[#8B4513]' 
                    : 'text-white hover:bg-[#663300]'
                }`}
                onClick={() => setActiveTab('sales')}
              >
                <DollarSign className="h-5 w-5" />
                <span>Ventes</span>
              </button>
            </li>
            <li>
              <button
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                  activeTab === 'expenses' 
                    ? 'bg-white text-[#8B4513]' 
                    : 'text-white hover:bg-[#663300]'
                }`}
                onClick={() => setActiveTab('expenses')}
              >
                <Wallet className="h-5 w-5" />
                <span>Dépenses</span>
              </button>
            </li>
            <li>
              <button
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                  activeTab === 'transactions' 
                    ? 'bg-white text-[#8B4513]' 
                    : 'text-white hover:bg-[#663300]'
                }`}
                onClick={() => setActiveTab('transactions')}
              >
                <CreditCard className="h-5 w-5" />
                <span>Transactions</span>
              </button>
            </li>
            <li>
              <button
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                  activeTab === 'users' 
                    ? 'bg-white text-[#8B4513]' 
                    : 'text-white hover:bg-[#663300]'
                }`}
                onClick={() => setActiveTab('users')}
              >
                <Users className="h-5 w-5" />
                <span>Utilisateurs</span>
              </button>
            </li>
            <li>
              <button
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                  activeTab === 'settings' 
                    ? 'bg-white text-[#8B4513]' 
                    : 'text-white hover:bg-[#663300]'
                }`}
                onClick={() => setActiveTab('settings')}
              >
                <Settings className="h-5 w-5" />
                <span>Paramètres</span>
              </button>
            </li>
          </ul>
        </nav>
      </div>
      <div className="flex-grow bg-gray-100 overflow-auto">
        {renderTabContent()}
      </div>
    </div>
  );
};

export default AdminView;