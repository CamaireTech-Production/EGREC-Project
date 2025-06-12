import React, { useState } from 'react';
import { Search, ScanBarcode as BarcodeScan, Filter } from 'lucide-react';

interface SearchBarProps {
  onSearch: (query: string) => void;
}

const SearchBar: React.FC<SearchBarProps> = ({ onSearch }) => {
  const [query, setQuery] = useState('');
  
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(query);
  };
  
  return (
    <form 
      onSubmit={handleSearch} 
      className="mb-6 bg-white rounded-lg shadow-md p-3 flex items-center"
    >
      <div className="relative flex-grow">
        <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
          <Search className="h-5 w-5 text-gray-400" />
        </div>
        <input
          type="text"
          placeholder="Rechercher un produit..."
          className="block w-full py-3 pl-10 pr-4 rounded-lg border-0 ring-1 ring-inset ring-gray-300 placeholder-gray-400 focus:ring-2 focus:ring-[#8B4513]"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      
      <button
        type="button"
        className="ml-4 p-3 bg-[#FFFDD0] text-[#8B4513] rounded-lg flex items-center justify-center transition-colors hover:bg-[#FFD700]/50"
        title="Scanner un code-barres"
      >
        <BarcodeScan className="h-5 w-5" />
      </button>
      
      <button
        type="button"
        className="ml-2 p-3 bg-gray-100 text-gray-700 rounded-lg flex items-center justify-center transition-colors hover:bg-gray-200"
        title="Filtres avancés"
      >
        <Filter className="h-5 w-5" />
      </button>
      
      <button
        type="submit"
        className="ml-2 p-3 bg-[#8B4513] text-white rounded-lg flex items-center justify-center transition-colors hover:bg-[#663300] px-4"
      >
        Rechercher
      </button>
    </form>
  );
};

export default SearchBar;