export interface Product {
  id: string;
  name: string;
  category: 'pains' | 'viennoiseries' | 'patisseries' | 'boisson' | 'margarine' | 'raffinerie' | 'savonnerie' | 'cosmetique' | 'champs';
  price: number;
  image: string;
  reference: string;
  description?: string;
  allergens: string[];
  stock: number;
  minStock: number;
  isFavorite: boolean;
  createdAt?: string;
  freshWeight: number;
  company?: string;
  stateByAgency?: { [agency: string]: 'active' | 'dormant' };
  stockParAgence?: { [agency: string]: number };
  department: 'Boulangerie' | 'Boutique';
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface User {
  id: string;
  name: string;
  role: 'admin' | 'cashier';
}