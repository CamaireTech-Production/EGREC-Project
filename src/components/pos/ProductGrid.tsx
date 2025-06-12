import React from 'react';
import { Product } from '../../types';
import ProductCard from './ProductCard';
import { useCart } from '../../context/CartContext';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { db, auth } from '../../lib/firebase';
import { toast } from 'react-hot-toast';
import { useUser } from '../../context/UserContext';

interface ProductGridProps {
  products: Product[];
}

const ProductGrid: React.FC<ProductGridProps> = ({ products }) => {
  const { items, addToCart, updateQuantity } = useCart();
  const { user } = useUser();
  
  const handleAddToCart = (product: Product) => {
    // Vérifier le stock avant d'ajouter
    const agencyStock = user?.agencyName ? 
      (product.stockParAgence?.[user.agencyName] ?? 0) : 
      0;
    
    if (agencyStock <= 0) {
      toast.error('Stock insuffisant pour ce produit');
      return;
    }
    
    // Vérifier si le produit est déjà dans le panier
    const existingItem = items.find(item => item.product.id === product.id);
    const currentCartQuantity = existingItem ? existingItem.quantity : 0;
    
    if (currentCartQuantity >= agencyStock) {
      toast.error('Quantité maximale atteinte pour ce produit');
      return;
    }
    
    addToCart(product, 1);
    toast.success(`${product.name} ajouté au panier`);
  };
  
  const handleToggleFavorite = async (productId: string) => {
    if (!auth.currentUser) {
      toast.error('Vous devez être connecté pour ajouter des favoris');
      return;
    }

    try {
      // Get current product data
      const productRef = doc(db, 'products', productId);
      const productSnap = await getDoc(productRef);
      
      if (!productSnap.exists()) {
        toast.error('Produit non trouvé');
        return;
      }

      const currentProduct = productSnap.data();
      const newFavoriteState = !currentProduct.isFavorite;

      // Update the product
      await updateDoc(productRef, {
        isFavorite: newFavoriteState,
        lastUpdated: new Date().toISOString()
      });

      // Show success message
      toast.success(
        newFavoriteState ? 'Ajouté aux favoris' : 'Retiré des favoris',
        { icon: '⭐' }
      );
    } catch (error) {
      console.error('Error toggling favorite:', error);
      toast.error('Erreur lors de la mise à jour des favoris');
    }
  };

  const handleUpdateQuantity = (productId: string, newQuantity: number) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    
    const agencyStock = user?.agencyName ? 
      (product.stockParAgence?.[user.agencyName] ?? 0) : 
      0;
    
    if (newQuantity > agencyStock) {
      toast.error('Quantité supérieure au stock disponible');
      return;
    }
    
    updateQuantity(productId, newQuantity);
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
      {products.map(product => {
        const cartItem = items.find(item => item.product.id === product.id);
        const isInCart = !!cartItem;
        const quantity = cartItem ? cartItem.quantity : 0;
        const agencyStock = user?.agencyName ? 
          (product.stockParAgence?.[user.agencyName] ?? 0) : 
          0;
        
        return (
          <ProductCard
            key={product.id}
            product={product}
            onAddToCart={handleAddToCart}
            onToggleFavorite={handleToggleFavorite}
            isInCart={isInCart}
            quantity={quantity}
            onUpdateQuantity={handleUpdateQuantity}
            agencyStock={agencyStock}
          />
        );
      })}
      
      {products.length === 0 && (
        <div className="col-span-full text-center p-8 bg-gray-100 rounded-lg">
          <p className="text-gray-500">Aucun produit trouvé dans cette catégorie.</p>
        </div>
      )}
    </div>
  );
};

export default ProductGrid;