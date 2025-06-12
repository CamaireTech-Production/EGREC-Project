import React from 'react';
import { Croissant, Store } from 'lucide-react';

interface ProductTypeSelectorProps {
  selectedType: 'bakery' | 'store';
  onTypeChange: (type: 'bakery' | 'store') => void;
  bakeryCount: number;
  storeCount: number;
}

const ProductTypeSelector: React.FC<ProductTypeSelectorProps> = ({
  selectedType,
  onTypeChange,
  bakeryCount,
  storeCount
}) => {
  return (
    <div className="bg-white rounded-lg shadow-md p-4 mb-6">
      <div className="flex items-center justify-center">
        <div className="flex bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => onTypeChange('bakery')}
            className={`flex items-center px-6 py-3 rounded-md text-sm font-medium transition-all duration-200 ${
              selectedType === 'bakery'
                ? 'bg-[#8B4513] text-white shadow-md transform scale-105'
                : 'text-gray-600 hover:text-[#8B4513] hover:bg-gray-50'
            }`}
          >
            <Croissant className="h-5 w-5 mr-2" />
            <span>Produits Boulangerie</span>
            <span className={`ml-2 px-2 py-1 rounded-full text-xs font-bold ${
              selectedType === 'bakery'
                ? 'bg-white text-[#8B4513]'
                : 'bg-gray-200 text-gray-600'
            }`}>
              {bakeryCount}
            </span>
          </button>
          
          <button
            onClick={() => onTypeChange('store')}
            className={`flex items-center px-6 py-3 rounded-md text-sm font-medium transition-all duration-200 ${
              selectedType === 'store'
                ? 'bg-[#8B4513] text-white shadow-md transform scale-105'
                : 'text-gray-600 hover:text-[#8B4513] hover:bg-gray-50'
            }`}
          >
            <Store className="h-5 w-5 mr-2" />
            <span>Produits Boutique</span>
            <span className={`ml-2 px-2 py-1 rounded-full text-xs font-bold ${
              selectedType === 'store'
                ? 'bg-white text-[#8B4513]'
                : 'bg-gray-200 text-gray-600'
            }`}>
              {storeCount}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProductTypeSelector;