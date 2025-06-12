import React from 'react';
import { Croissant, Cake, Heading as Bread } from 'lucide-react';

interface CategoryTabsProps {
  activeCategory: 'pains' | 'viennoiseries' | 'patisseries' | 'favoris';
  onCategoryChange: (category: 'pains' | 'viennoiseries' | 'patisseries' | 'favoris') => void;
}

const CategoryTabs: React.FC<CategoryTabsProps> = ({ 
  activeCategory, 
  onCategoryChange 
}) => {
  return (
    <div className="bg-[#FFFDD0] p-4 rounded-lg shadow-md mb-6">
      <div className="grid grid-cols-4 gap-4">
        <button
          className={`flex flex-col items-center justify-center p-4 rounded-lg transition-all ${
            activeCategory === 'pains'
              ? 'bg-[#8B4513] text-white shadow-lg scale-[1.03]'
              : 'bg-white text-[#8B4513] hover:bg-[#8B4513]/10'
          }`}
          onClick={() => onCategoryChange('pains')}
        >
          <Bread className="h-8 w-8 mb-2" />
          <span className="font-medium">Pains</span>
        </button>
        
        <button
          className={`flex flex-col items-center justify-center p-4 rounded-lg transition-all ${
            activeCategory === 'viennoiseries'
              ? 'bg-[#8B4513] text-white shadow-lg scale-[1.03]'
              : 'bg-white text-[#8B4513] hover:bg-[#8B4513]/10'
          }`}
          onClick={() => onCategoryChange('viennoiseries')}
        >
          <Croissant className="h-8 w-8 mb-2" />
          <span className="font-medium">Viennoiseries</span>
        </button>
        
        <button
          className={`flex flex-col items-center justify-center p-4 rounded-lg transition-all ${
            activeCategory === 'patisseries'
              ? 'bg-[#8B4513] text-white shadow-lg scale-[1.03]'
              : 'bg-white text-[#8B4513] hover:bg-[#8B4513]/10'
          }`}
          onClick={() => onCategoryChange('patisseries')}
        >
          <Cake className="h-8 w-8 mb-2" />
          <span className="font-medium">Pâtisseries</span>
        </button>
        
        <button
          className={`flex flex-col items-center justify-center p-4 rounded-lg transition-all ${
            activeCategory === 'favoris'
              ? 'bg-[#FFD700] text-[#8B4513] shadow-lg scale-[1.03]'
              : 'bg-white text-[#8B4513] hover:bg-[#FFD700]/20'
          }`}
          onClick={() => onCategoryChange('favoris')}
        >
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            className="h-8 w-8 mb-2" 
            fill={activeCategory === 'favoris' ? 'currentColor' : 'none'} 
            viewBox="0 0 24 24" 
            stroke="currentColor" 
            strokeWidth={2}
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" 
            />
          </svg>
          <span className="font-medium">Favoris</span>
        </button>
      </div>
    </div>
  );
};

export default CategoryTabs;