import React, { useState } from 'react';
import { X, Minus, Plus, ShoppingCart, Trash2 } from 'lucide-react';
import { useCart } from '../../context/CartContext';

interface CartProps {
  onCheckout: () => void;
}

const Cart: React.FC<CartProps> = ({ onCheckout }) => {
  const { 
    items, 
    removeFromCart, 
    updateQuantity, 
    clearCart,
    subtotal,
    tax,
    total
  } = useCart();
  
  const [isExpanded, setIsExpanded] = useState(true);
  
  if (items.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6 text-center">
        <ShoppingCart className="h-12 w-12 mx-auto text-gray-300 mb-3" />
        <h3 className="text-lg font-semibold text-gray-500 mb-4">Votre panier est vide</h3>
        <p className="text-gray-400 mb-4">Ajoutez des produits pour commencer.</p>
      </div>
    );
  }
  
  const handleQuantityChange = (productId: string, value: string) => {
    const quantity = parseInt(value);
    if (!isNaN(quantity) && quantity >= 0) {
      updateQuantity(productId, quantity);
    }
  };
  
  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="bg-[#8B4513] text-white p-4 flex justify-between items-center">
        <h2 className="font-bold text-lg flex items-center">
          <ShoppingCart className="h-5 w-5 mr-2" />
          Panier ({items.length})
        </h2>
        <div className="flex items-center">
          <button
            className="text-white bg-[#663300] hover:bg-[#552200] p-2 rounded-lg mr-2"
            onClick={clearCart}
            title="Vider le panier"
          >
            <Trash2 className="h-5 w-5" />
          </button>
          <button
            className="text-white bg-transparent hover:bg-[#663300] p-1 rounded-lg"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            )}
          </button>
        </div>
      </div>
      
      <div className={`transition-all duration-300 ${isExpanded ? 'max-h-[calc(100vh-20rem)]' : 'max-h-0'} overflow-y-auto`}>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="px-4 py-2 text-left">Produit</th>
              <th className="px-4 py-2 text-right">Prix Unit.</th>
              <th className="px-4 py-2 text-center">Qté</th>
              <th className="px-4 py-2 text-right">Total</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.map((item) => {
              const lineTotal = Math.round(item.product.price * item.quantity);
              return (
                <tr key={item.product.id} className="border-b border-gray-200 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center">
                      <img
                        src={item.product.image}
                        alt={item.product.name}
                        className="w-12 h-12 object-cover rounded-md mr-3"
                      />
                      <div>
                        <div className="font-medium text-[#8B4513]">{item.product.name}</div>
                        <div className="text-xs text-gray-500">Réf: {item.product.reference}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">{Math.round(item.product.price)} Fcfa</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center">
                      <button
                        className="p-1 text-gray-500 hover:text-[#8B4513]"
                        onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <input
                        type="number"
                        min="0"
                        value={item.quantity}
                        onChange={(e) => handleQuantityChange(item.product.id, e.target.value)}
                        className="mx-2 w-16 text-center border border-gray-300 rounded-md focus:ring-[#8B4513] focus:border-[#8B4513]"
                      />
                      <button
                        className="p-1 text-gray-500 hover:text-[#8B4513]"
                        onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-medium">{lineTotal} Fcfa</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      className="p-1 text-gray-400 hover:text-red-500"
                      onClick={() => removeFromCart(item.product.id)}
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      
      <div className="p-4 bg-gray-50 border-t border-gray-100">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Sous-total HT:</span>
            <span className="font-medium">{Math.round(subtotal)} Fcfa</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">TVA (19.25%):</span>
            <span className="font-medium">{Math.round(tax)} Fcfa</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Sous-total TTC:</span>
            <span className="font-medium">{Math.round(total)} Fcfa</span>
          </div>
          <div className="pt-2 mt-2 border-t border-gray-200">
            <div className="flex justify-between font-bold text-lg text-[#8B4513]">
              <span>Total à payer:</span>
              <span>{Math.round(total)} Fcfa</span>
            </div>
          </div>
        </div>
        
        <button
          className="w-full mt-4 bg-[#FFD700] text-[#8B4513] py-3 rounded-lg font-bold text-lg transition-transform hover:bg-[#FFD700]/80 hover:scale-[1.02] shadow-md"
          onClick={onCheckout}
        >
          Paiement
        </button>
      </div>
    </div>
  );
};

export default Cart;