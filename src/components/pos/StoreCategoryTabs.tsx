import React from 'react';
import { Package, Droplets, Palette, Map as Soap, Sparkles, Wheat } from 'lucide-react';

type StoreCategoryType = 'boisson' | 'margarine' | 'raffinerie' | 'savonnerie' | 'cosmetique' | 'champs';

interface StoreCategoryTabsProps {
  activeCategory: StoreCategoryType;
  onCategoryChange: (category: StoreCategoryType) => void;
  categoryCounts: Record<StoreCategoryType, number>;
}

const StoreCategoryTabs: React.FC<StoreCategoryTabsProps> = ({ 
  activeCategory, 
  onCategoryChange,
  categoryCounts 
}) => {
  const categories = [
    { id: 'boisson' as StoreCategoryType, name: 'Boissons', icon: Droplets, color: 'blue' },
    { id: 'margarine' as StoreCategoryType, name: 'Margarine', icon: Package, color: 'yellow' },
    { id: 'raffinerie' as StoreCategoryType, name: 'Raffinerie', icon: Package, color: 'orange' },
    { id: 'savonnerie' as StoreCategoryType, name: 'Savonnerie', icon: Soap, color: 'green' },
    { id: 'cosmetique' as StoreCategoryType, name: 'Cosmétique', icon: Sparkles, color: 'pink' },
    { id: 'champs' as StoreCategoryType, name: 'Champs', icon: Wheat, color: 'emerald' }
  ];

  const getColorClasses = (color: string, isActive: boolean) => {
    const colorMap = {
      blue: isActive ? 'bg-blue-600 text-white shadow-lg scale-[1.03]' : 'bg-blue-50 text-blue-700 hover:bg-blue-100',
      yellow: isActive ? 'bg-yellow-600 text-white shadow-lg scale-[1.03]' : 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100',
      orange: isActive ? 'bg-orange-600 text-white shadow-lg scale-[1.03]' : 'bg-orange-50 text-orange-700 hover:bg-orange-100',
      green: isActive ? 'bg-green-600 text-white shadow-lg scale-[1.03]' : 'bg-green-50 text-green-700 hover:bg-green-100',
      pink: isActive ? 'bg-pink-600 text-white shadow-lg scale-[1.03]' : 'bg-pink-50 text-pink-700 hover:bg-pink-100',
      emerald: isActive ? 'bg-emerald-600 text-white shadow-lg scale-[1.03]' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
    };
    return colorMap[color as keyof typeof colorMap] || colorMap.blue;
  };

  return (
    <div className="bg-[#FFFDD0] p-4 rounded-lg shadow-md mb-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {categories.map((category) => {
          const Icon = category.icon;
          const isActive = activeCategory === category.id;
          const count = categoryCounts[category.id] || 0;
          
          return (
            <button
              key={category.id}
              className={`flex flex-col items-center justify-center p-4 rounded-lg transition-all duration-200 transform hover:scale-105 ${
                getColorClasses(category.color, isActive)
              }`}
              onClick={() => onCategoryChange(category.id)}
            >
              <Icon className="h-8 w-8 mb-2" />
              <span className="font-medium text-sm text-center">{category.name}</span>
              <span className={`mt-1 px-2 py-1 rounded-full text-xs font-bold ${
                isActive 
                  ? 'bg-white/20 text-white' 
                  : 'bg-white text-gray-600'
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default StoreCategoryTabs;