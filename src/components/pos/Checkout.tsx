import React, { useState, useEffect } from 'react';
import { X, ArrowLeft, Printer, DollarSign, Wifi, WifiOff } from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { collection, addDoc, doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../../lib/firebase';
import { toast } from 'react-hot-toast';
import { saveOfflineSale } from '../../lib/db';
import { printReceipt } from '../../lib/receipt';
import { createSale } from '../../services/sales';

interface CheckoutProps {
  onClose: () => void;
  onComplete: () => void;
}

const Checkout: React.FC<CheckoutProps> = ({ onClose, onComplete }) => {
  const { items, total, subtotal, tax, clearCart } = useCart();
  const [cashReceived, setCashReceived] = useState('');
  const [paymentProcessed, setPaymentProcessed] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isPrinting, setIsPrinting] = useState(false);
  const [userData, setUserData] = useState<{
    company: string;
    agency: string;
    firstName: string;
    lastName: string;
    role: string;
  } | null>(null);
  
  useEffect(() => {
    const fetchUserData = async () => {
      if (!auth.currentUser) {
        toast.error('Vous devez être connecté pour effectuer une vente');
        onClose();
        return;
      }
      
      try {
        const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
        if (!userDoc.exists()) {
          toast.error('Erreur: Informations utilisateur manquantes');
          onClose();
          return;
        }

        const data = userDoc.data();
        if (!data.company || !data.role) {
          toast.error('Erreur: Informations entreprise ou rôle manquants');
          onClose();
          return;
        }

        if (!data.agencyName) {
          toast.error('Erreur: Aucune agence associée à votre compte. Impossible de procéder à la vente.');
          onClose();
          return;
        }

        setUserData({
          company: data.company,
          agency: data.agencyName,
          firstName: data.firstName || '',
          lastName: data.lastName || '',
          role: data.role
        });
      } catch (error) {
        console.error('Error fetching user data:', error);
        toast.error('Erreur lors du chargement des données utilisateur');
        onClose();
      }
    };

    fetchUserData();
  }, [onClose]);
  
  React.useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
  
  const handlePayment = async () => {
    if (!auth.currentUser) {
      toast.error('Vous devez être connecté pour effectuer une vente');
      return;
    }

    if (!userData) {
      toast.error('Erreur: Informations utilisateur manquantes');
      return;
    }

    if (!userData.agency) {
      toast.error('Erreur: Aucune agence associée à votre compte. Impossible de procéder à la vente.');
      return;
    }

    setProcessing(true);
    try {
      const saleData = {
        productName: items.map(item => item.product.name),
        quantity: items.map(item => item.quantity),
        unitPrice: items.map(item => item.product.price),
        productCategory: items.map(item => item.product.category),
        productReference: items.map(item => item.product.id),
        totalAmount: total,
        recordedBy: `${userData.firstName} ${userData.lastName}`,
        userRole: userData.role,
        userUID: auth.currentUser.uid,
        timestamp: new Date(),
        cashReceived: parseFloat(cashReceived),
        changeDue: parseFloat(cashReceived) - total,
        company: userData.company,
        agency: userData.agency,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      if (isOnline) {
        const result = await createSale(saleData);
        if (!result.success) {
          throw new Error(result.error);
        }
        toast.success('Vente enregistrée avec succès et stock mis à jour');
      } else {
        await saveOfflineSale(saleData);
        toast.success('Vente enregistrée localement. Le stock sera mis à jour automatiquement dès le retour de la connexion');
      }
      
      setPaymentProcessed(true);
    } catch (error) {
      console.error('Erreur lors de l\'enregistrement de la vente:', error);
      toast.error(error instanceof Error ? error.message : 'Une erreur s\'est produite. Veuillez réessayer ou vérifier votre connexion');
    } finally {
      setProcessing(false);
    }
  };
  
  const handleComplete = async () => {
    clearCart();
    onComplete();
  };

  const handlePrintReceipt = async () => {
    if (!userData) return;

    setIsPrinting(true);
    try {
      await printReceipt(
        items,
        total,
        subtotal,
        tax,
        parseFloat(cashReceived),
        parseFloat(cashReceived) - total,
        userData.company,
        userData.agency
      );
      toast.success('Impression du ticket en cours');
    } catch (error) {
      console.error('Erreur lors de l\'impression:', error);
      toast.error('Erreur lors de l\'impression');
    } finally {
      setIsPrinting(false);
    }
  };
  
  const cashReceivedValue = parseInt(cashReceived) || 0;
  const changeDue = cashReceivedValue > total ? cashReceivedValue - total : 0;
  
  const cashAmounts = [500, 1000, 1500, 2000, 5000, 10000];
  
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-auto">
        <div className="bg-[#8B4513] text-white p-4 flex justify-between items-center sticky top-0">
          <h2 className="font-bold text-xl flex items-center">
            {paymentProcessed ? 'Paiement Complété' : 'Paiement'}
            {isOnline ? (
              <Wifi className="ml-2 h-5 w-5 text-green-300" />
            ) : (
              <WifiOff className="ml-2 h-5 w-5 text-yellow-300" />
            )}
          </h2>
          <button
            onClick={onClose}
            className="text-white hover:bg-[#663300] p-2 rounded-full"
          >
            <X className="h-6 w-6" />
          </button>
        </div>
        
        {!isOnline && (
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
            <div className="flex items-center">
              <WifiOff className="h-5 w-5 text-yellow-400 mr-2" />
              <p className="text-sm text-yellow-700">
                Mode hors-ligne actif. Les ventes seront synchronisées automatiquement lors du retour de la connexion.
              </p>
            </div>
          </div>
        )}

        {userData && (
          <div className="bg-gray-50 p-4 border-b">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-gray-600">Agence</p>
                <p className="font-medium">{userData.agency}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Vendeur</p>
                <p className="font-medium">{userData.firstName} {userData.lastName}</p>
              </div>
            </div>
          </div>
        )}
        
        {!paymentProcessed ? (
          <div className="p-6">
            <div className="mb-6">
              <h3 className="font-bold text-lg mb-4 text-[#8B4513]">Récapitulatif</h3>
              <div className="mb-4 max-h-60 overflow-y-auto bg-gray-50 rounded-lg">
                {items.map(item => (
                  <div key={item.product.id} className="border-b border-gray-200 p-3 flex">
                    <div className="flex-grow">
                      <span className="font-medium">{item.product.name}</span>
                      <span className="text-gray-500 ml-2">x{item.quantity}</span>
                    </div>
                    <div className="text-right">
                      {Math.round(item.product.price * item.quantity)} Fcfa
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="bg-gray-100 p-4 rounded-lg">
                <div className="flex justify-between mb-2">
                  <span className="text-gray-600">Sous-total:</span>
                  <span>{Math.round(subtotal)} Fcfa</span>
                </div>
                <div className="flex justify-between mb-2">
                  <span className="text-gray-600">TVA (10%):</span>
                  <span>{Math.round(tax)} Fcfa</span>
                </div>
                <div className="flex justify-between font-bold text-lg">
                  <span>Total:</span>
                  <span>{Math.round(total)} Fcfa</span>
                </div>
              </div>
            </div>
            
            <div className="mb-6">
              <h3 className="font-bold text-lg mb-4 text-[#8B4513]">Paiement en Espèces</h3>
              
              <div className="mb-4">
                <label className="block text-gray-700 mb-2">Montant reçu</label>
                <div className="flex">
                  <div className="relative flex-grow">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">Fcfa</span>
                    <input
                      type="number"
                      className="w-full py-3 pl-14 pr-3 border border-gray-300 rounded-l-lg focus:ring-[#8B4513] focus:border-[#8B4513]"
                      value={cashReceived}
                      onChange={(e) => setCashReceived(e.target.value)}
                      placeholder="0"
                      min={0}
                    />
                  </div>
                  <button
                    className="bg-red-500 text-white px-4 rounded-r-lg hover:bg-red-600"
                    onClick={() => setCashReceived('')}
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-2 mb-4">
                {cashAmounts.map(amount => (
                  <button
                    key={amount}
                    className="bg-[#FFFDD0] text-[#8B4513] py-2 rounded-lg font-bold hover:bg-[#FFD700]/50"
                    onClick={() => setCashReceived(amount.toString())}
                  >
                    {amount} Fcfa
                  </button>
                ))}
              </div>
              
              {cashReceivedValue > 0 && (
                <div className="p-4 bg-gray-100 rounded-lg mb-4">
                  <div className="flex justify-between mb-2">
                    <span className="text-gray-600">Montant reçu:</span>
                    <span>{cashReceivedValue} Fcfa</span>
                  </div>
                  <div className="flex justify-between font-bold text-lg">
                    <span>Monnaie à rendre:</span>
                    <span className={changeDue > 0 ? 'text-green-600' : ''}>
                      {Math.round(changeDue)} Fcfa
                    </span>
                  </div>
                </div>
              )}
              
              <button
                className="w-full bg-[#8B4513] text-white py-3 rounded-lg font-bold text-lg flex items-center justify-center transition-colors hover:bg-[#663300] disabled:bg-gray-300 disabled:cursor-not-allowed"
                onClick={handlePayment}
                disabled={cashReceivedValue < total || processing || !userData}
              >
                <DollarSign className="mr-2 h-5 w-5" />
                {processing ? 'Traitement en cours...' : 'Encaisser'}
              </button>
            </div>
            
            <button
              className="w-full border border-gray-300 text-gray-600 py-3 rounded-lg font-medium flex items-center justify-center hover:bg-gray-100"
              onClick={onClose}
              disabled={processing}
            >
              <ArrowLeft className="mr-2 h-5 w-5" />
              Retour
            </button>
          </div>
        ) : (
          <div className="p-6 text-center">
            <div className="bg-green-100 text-green-700 p-4 rounded-lg mb-6">
              <svg className="mx-auto h-16 w-16 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <h3 className="text-xl font-bold mb-2">Paiement réussi!</h3>
              <p>Vente enregistrée avec succès.</p>
            </div>
            
            <div className="bg-gray-100 p-4 rounded-lg mb-6">
              <div className="flex justify-between mb-2">
                <span className="text-gray-600">Total:</span>
                <span>{Math.round(total)} Fcfa</span>
              </div>
              <div className="flex justify-between mb-2">
                <span className="text-gray-600">Montant reçu:</span>
                <span>{cashReceivedValue} Fcfa</span>
              </div>
              <div className="flex justify-between font-bold text-lg">
                <span>Monnaie rendue:</span>
                <span className="text-green-600">{Math.round(changeDue)} Fcfa</span>
              </div>
            </div>
            
            <div className="flex space-x-4 mb-6">
              <button
                className="flex-1 bg-[#8B4513] text-white py-3 rounded-lg font-bold flex items-center justify-center transition-colors hover:bg-[#663300]"
                onClick={handleComplete}
              >
                Nouvelle vente
              </button>
              <button
                className="flex-1 border border-gray-300 text-gray-600 py-3 rounded-lg font-medium flex items-center justify-center hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={handlePrintReceipt}
                disabled={isPrinting}
              >
                <Printer className="mr-2 h-5 w-5" />
                {isPrinting ? 'Impression...' : 'Imprimer reçu'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Checkout;