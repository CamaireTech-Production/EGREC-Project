import React from 'react';
import { Croissant, Store } from 'lucide-react';

interface DepartmentSelectorProps {
  selectedDepartment: 'Boulangerie' | 'Boutique';
  onDepartmentChange: (department: 'Boulangerie' | 'Boutique') => void;
  bakeryCount: number;
  storeCount: number;
}

const DepartmentSelector: React.FC<DepartmentSelectorProps> = ({
  selectedDepartment,
  onDepartmentChange,
  bakeryCount,
  storeCount
}) => {
  return (
    <div className="bg-[#FFFDD0] p-4 rounded-lg shadow-md mb-6">
      <div className="flex items-center justify-center">
        <div className="flex bg-white rounded-lg p-1 shadow-inner">
          <button
            onClick={() => onDepartmentChange('Boulangerie')}
            className={`flex items-center px-6 py-3 rounded-md text-sm font-medium transition-all duration-200 ${
              selectedDepartment === 'Boulangerie'
                ? 'bg-[#8B4513] text-white shadow-lg transform scale-105'
                : 'text-[#8B4513] hover:bg-[#8B4513]/10'
            }`}
          >
            <Croissant className="h-5 w-5 mr-2" />
            <span>Département Boulangerie</span>
            <span className={`ml-2 px-2 py-1 rounded-full text-xs font-bold ${
              selectedDepartment === 'Boulangerie'
                ? 'bg-white text-[#8B4513]'
                : 'bg-[#8B4513]/20 text-[#8B4513]'
            }`}>
              {bakeryCount}
            </span>
          </button>
          
          <button
            onClick={() => onDepartmentChange('Boutique')}
            className={`flex items-center px-6 py-3 rounded-md text-sm font-medium transition-all duration-200 ${
              selectedDepartment === 'Boutique'
                ? 'bg-[#8B4513] text-white shadow-lg transform scale-105'
                : 'text-[#8B4513] hover:bg-[#8B4513]/10'
            }`}
          >
            <Store className="h-5 w-5 mr-2" />
            <span>Département Boutique</span>
            <span className={`ml-2 px-2 py-1 rounded-full text-xs font-bold ${
              selectedDepartment === 'Boutique'
                ? 'bg-white text-[#8B4513]'
                : 'bg-[#8B4513]/20 text-[#8B4513]'
            }`}>
              {storeCount}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default DepartmentSelector;