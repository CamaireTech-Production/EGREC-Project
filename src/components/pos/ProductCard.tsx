import React from 'react';
import { Plus, Minus, Star } from 'lucide-react';
import { Product } from '../../types';

interface ProductCardProps {
  product: Product;
  onAddToCart: (product: Product) => void;
  onToggleFavorite: (productId: string) => void;
  isInCart: boolean;
  quantity?: number;
  onUpdateQuantity?: (productId: string, quantity: number) => void;
  agencyStock: number;
}

const ProductCard: React.FC<ProductCardProps> = ({
  product,
  onAddToCart,
  onToggleFavorite,
  isInCart,
  quantity = 0,
  onUpdateQuantity,
  agencyStock
}) => {
  const handleAddClick = () => {
    onAddToCart(product);
  };

  const handleQuantityIncrease = () => {
    if (onUpdateQuantity) {
      onUpdateQuantity(product.id, quantity + 1);
    }
  };

  const handleQuantityDecrease = () => {
    if (onUpdateQuantity) {
      onUpdateQuantity(product.id, quantity - 1);
    }
  };

  return (
    <div className="bg-white rounded-lg overflow-hidden shadow-md transition-transform hover:shadow-lg hover:scale-[1.02]">
      {product.image && (
        <div className="relative h-40">
          <img 
            src={product.image} 
            alt={product.name} 
            className="w-full h-full object-cover"
          />
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onToggleFavorite(product.id);
            }}
            className={`absolute top-2 right-2 p-1.5 rounded-full transition-colors ${
              product.isFavorite 
                ? 'bg-[#FFD700] text-[#8B4513]' 
                : 'bg-white/80 text-gray-400 hover:text-[#FFD700]'
            }`}
          >
            <Star className="h-5 w-5" fill={product.isFavorite ? 'currentColor' : 'none'} />
          </button>
          {agencyStock <= (product.minStock || 5) && (
            <div className="absolute bottom-2 left-2 bg-red-500 text-white text-xs px-2 py-1 rounded-full">
              Stock: {agencyStock}
            </div>
          )}
        </div>
      )}
      
      <div className={`p-4 ${!product.image ? 'pt-3' : ''}`}>
        <div className="flex items-start justify-between mb-1">
          <h3 className="font-bold text-lg text-[#8B4513]">{product.name}</h3>
          {!product.image && (
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onToggleFavorite(product.id);
              }}
              className={`p-1.5 rounded-full transition-colors ${
                product.isFavorite 
                  ? 'bg-[#FFD700] text-[#8B4513]' 
                  : 'text-gray-400 hover:text-[#FFD700]'
              }`}
            >
              <Star className="h-5 w-5" fill={product.isFavorite ? 'currentColor' : 'none'} />
            </button>
          )}
        </div>

        <div className="flex justify-between items-center mb-2">
          <span className="text-lg font-semibold">{Math.round(product.price)} Fcfa</span>
          {!product.image && agencyStock <= (product.minStock || 5) && (
            <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full">
              Stock: {agencyStock}
            </span>
          )}
        </div>
        
        {product.allergens.length > 0 && (
          <div className="mb-3">
            <span className="text-xs text-gray-500">
              Allergènes: {product.allergens.join(', ')}
            </span>
          </div>
        )}
        
        {isInCart ? (
          <div className="flex items-center justify-between">
            <button 
              className="bg-[#8B4513] text-white p-2 rounded-full hover:bg-[#663300] transition-colors"
              onClick={handleQuantityDecrease}
              disabled={quantity <= 0}
            >
              <Minus size={16} />
            </button>
            <span className="font-bold text-lg">{quantity}</span>
            <button 
              className="bg-[#8B4513] text-white p-2 rounded-full hover:bg-[#663300] transition-colors"
              onClick={handleQuantityIncrease}
              disabled={quantity >= agencyStock}
            >
              <Plus size={16} />
            </button>
          </div>
        ) : (
          <button 
            className="w-full bg-[#8B4513] text-white py-2 rounded-lg flex items-center justify-center font-medium transition-colors hover:bg-[#663300] disabled:bg-gray-300 disabled:cursor-not-allowed"
            onClick={handleAddClick}
            disabled={agencyStock <= 0}
          >
            <Plus size={20} className="mr-1" />
            {agencyStock <= 0 ? 'Stock épuisé' : 'Ajouter'}
          </button>
        )}
      </div>
    </div>
  );
};

export default ProductCard;