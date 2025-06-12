import React, { useState } from 'react';
import { Package2, Settings, FileText, ClipboardList, AlertTriangle } from 'lucide-react';
import RawMaterials from './RawMaterials';
import ProductionSheets from './ProductionSheets';
import WasteManagement from './WasteManagement';

const ProductionView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'materials' | 'recipes' | 'settings' | 'sheets' | 'waste'>('materials');
  
  const renderTabContent = () => {
    switch (activeTab) {
      case 'materials':
        return <RawMaterials />;
      case 'sheets':
        return <ProductionSheets />;
      case 'waste':
        return <WasteManagement />;
      case 'recipes':
        return <div className="p-6"><h2 className="text-2xl font-bold mb-6">Recettes</h2></div>;
      case 'settings':
        return <div className="p-6"><h2 className="text-2xl font-bold mb-6">Paramètres de Production</h2></div>;
      default:
        return <RawMaterials />;
    }
  };
  
  return (
    <div className="flex h-full">
      <div className="w-64 bg-[#8B4513] text-white">
        <div className="p-4 border-b border-[#663300]">
          <h2 className="font-bold text-xl">Production</h2>
        </div>
        <nav className="p-4">
          <ul className="space-y-2">
            <li>
              <button
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                  activeTab === 'materials' 
                    ? 'bg-white text-[#8B4513]' 
                    : 'text-white hover:bg-[#663300]'
                }`}
                onClick={() => setActiveTab('materials')}
              >
                <Package2 className="h-5 w-5" />
                <span>Matières Premières</span>
              </button>
            </li>
            <li>
              <button
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                  activeTab === 'sheets' 
                    ? 'bg-white text-[#8B4513]' 
                    : 'text-white hover:bg-[#663300]'
                }`}
                onClick={() => setActiveTab('sheets')}
              >
                <ClipboardList className="h-5 w-5" />
                <span>Fiches de Production</span>
              </button>
            </li>
            <li>
              <button
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                  activeTab === 'waste' 
                    ? 'bg-white text-[#8B4513]' 
                    : 'text-white hover:bg-[#663300]'
                }`}
                onClick={() => setActiveTab('waste')}
              >
                <AlertTriangle className="h-5 w-5" />
                <span>Avaries</span>
              </button>
            </li>
            <li>
              <button
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                  activeTab === 'recipes' 
                    ? 'bg-white text-[#8B4513]' 
                    : 'text-white hover:bg-[#663300]'
                }`}
                onClick={() => setActiveTab('recipes')}
              >
                <FileText className="h-5 w-5" />
                <span>Recettes</span>
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

export default ProductionView;