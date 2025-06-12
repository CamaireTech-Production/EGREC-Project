import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Eye, FileText, Loader2, Filter, Croissant, Store } from 'lucide-react';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { toast } from 'react-hot-toast';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';

interface StockControl {
  id: string;
  timestamp: Date;
  userId: string;
  userName: string;
  company: string;
  agencyName: string;
  department?: 'Boulangerie' | 'Boutique';
  produits: Array<{
    productId: string;
    productName: string;
    stockInitial: number;
    stockTheorique: number;
    stockReel: number;
    dateHeureSaisie: string;
    ecart: number;
    department?: 'Boulangerie' | 'Boutique';
  }>;
  physicalCash?: number;
  theoreticalAmount?: number;
  cashDifference?: number;
}

interface StockControlHistoryProps {
  agencyName: string;
  company: string;
}

const StockControlHistory: React.FC<StockControlHistoryProps> = ({ agencyName, company }) => {
  const [controls, setControls] = useState<StockControl[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedControl, setSelectedControl] = useState<StockControl | null>(null);
  const [selectedDepartment, setSelectedDepartment] = useState<'all' | 'Boulangerie' | 'Boutique'>('all');

  useEffect(() => {
    const fetchControls = async () => {
      try {
        const controlsQuery = query(
          collection(db, 'controleStock'),
          where('company', '==', company),
          where('agencyName', '==', agencyName),
          where('timestamp', '>=', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)) // Last 30 days
        );

        const snapshot = await getDocs(controlsQuery);
        const controlsData = snapshot.docs
          .map(doc => ({
            id: doc.id,
            ...doc.data(),
            timestamp: doc.data().timestamp.toDate()
          }))
          .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()) as StockControl[];

        setControls(controlsData);
      } catch (error) {
        console.error('Error fetching controls:', error);
        toast.error('Erreur lors du chargement de l\'historique');
      } finally {
        setLoading(false);
      }
    };

    if (company && agencyName) {
      fetchControls();
    }
  }, [company, agencyName]);

  const generatePDF = async (control: StockControl) => {
    try {
      const doc = new jsPDF();
      
      // Add title
      doc.setFontSize(16);
      doc.text(
        `Contrôle de stock - ${format(control.timestamp, 'dd/MM/yyyy HH:mm', { locale: fr })}`,
        14,
        20
      );
      
      // Add company and agency info
      doc.setFontSize(12);
      doc.text(`Entreprise: ${control.company}`, 14, 30);
      doc.text(`Agence: ${control.agencyName}`, 14, 37);
      doc.text(`Contrôlé par: ${control.userName}`, 14, 44);
      
      // Add department info if available
      if (control.department) {
        doc.text(`Département: ${control.department}`, 14, 51);
      }

      // Add main table
      (doc as any).autoTable({
        startY: control.department ? 58 : 51,
        head: [
          [
            'Produit',
            'Stock Initial',
            'Stock Théorique',
            'Stock Réel',
            'Écart',
            'Date de saisie'
          ]
        ],
        body: control.produits.map(p => [
          p.productName,
          p.stockInitial,
          p.stockTheorique,
          p.stockReel,
          p.ecart,
          p.dateHeureSaisie
        ]),
        styles: { fontSize: 8 },
        headStyles: { fillColor: [139, 69, 19] }
      });

      // Add cash control section if available
      if (control.physicalCash !== undefined) {
        const finalY = (doc as any).lastAutoTable.finalY || 60;
        doc.text('Contrôle de caisse', 14, finalY + 20);

        (doc as any).autoTable({
          startY: finalY + 25,
          head: [['Description', 'Montant']],
          body: [
            ['Montant théorique', `${control.theoreticalAmount?.toFixed(2)} FCFA`],
            ['Montant en caisse', `${control.physicalCash?.toFixed(2)} FCFA`],
            ['Différence', `${control.cashDifference?.toFixed(2)} FCFA`]
          ],
          styles: { fontSize: 10 },
          headStyles: { fillColor: [139, 69, 19] },
          margin: { left: 14 },
          tableWidth: 100
        });
      }
      
      doc.save(`controle-stock-${control.department || ''}-${format(control.timestamp, 'dd-MM-yyyy-HH-mm')}.pdf`);
      toast.success('PDF généré avec succès');
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Erreur lors de la génération du PDF');
    }
  };

  // Filter controls by department
  const filteredControls = controls.filter(control => {
    if (selectedDepartment === 'all') return true;
    return control.department === selectedDepartment;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-[#8B4513]" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mt-8">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-[#8B4513]">Historique des contrôles</h2>
        
        {/* Department filter */}
        <div className="flex space-x-2">
          <button
            onClick={() => setSelectedDepartment('all')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              selectedDepartment === 'all'
                ? 'bg-gray-800 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Tous
          </button>
          <button
            onClick={() => setSelectedDepartment('Boulangerie')}
            className={`flex items-center px-4 py-2 rounded-lg transition-colors ${
              selectedDepartment === 'Boulangerie'
                ? 'bg-orange-500 text-white'
                : 'bg-orange-50 text-orange-700 hover:bg-orange-100'
            }`}
          >
            <Croissant className="h-4 w-4 mr-2" />
            Boulangerie
          </button>
          <button
            onClick={() => setSelectedDepartment('Boutique')}
            className={`flex items-center px-4 py-2 rounded-lg transition-colors ${
              selectedDepartment === 'Boutique'
                ? 'bg-blue-500 text-white'
                : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
            }`}
          >
            <Store className="h-4 w-4 mr-2" />
            Boutique
          </button>
        </div>
      </div>

      {filteredControls.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          {selectedDepartment === 'all' 
            ? 'Aucun contrôle enregistré' 
            : `Aucun contrôle enregistré pour le département ${selectedDepartment}`}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredControls.map(control => (
            <div key={control.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
              <div className="flex justify-between items-center">
                <div>
                  <div className="flex items-center">
                    <p className="font-medium text-gray-900">
                      {format(control.timestamp, 'dd MMMM yyyy à HH:mm', { locale: fr })}
                    </p>
                    {control.department && (
                      <span className={`ml-2 px-2 py-1 rounded-full text-xs font-medium ${
                        control.department === 'Boulangerie' 
                          ? 'bg-orange-100 text-orange-800' 
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {control.department}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500">
                    {control.produits.length} produit{control.produits.length > 1 ? 's' : ''} contrôlé{control.produits.length > 1 ? 's' : ''}
                  </p>
                  <p className="text-sm text-gray-500">
                    Par: {control.userName}
                  </p>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => setSelectedControl(control === selectedControl ? null : control)}
                    className="p-2 text-gray-600 hover:text-[#8B4513] transition-colors"
                    title="Voir les détails"
                  >
                    <Eye className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => generatePDF(control)}
                    className="p-2 text-gray-600 hover:text-[#8B4513] transition-colors"
                    title="Télécharger PDF"
                  >
                    <FileText className="h-5 w-5" />
                  </button>
                </div>
              </div>

              {selectedControl?.id === control.id && (
                <div className="mt-4">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="text-left bg-gray-100">
                            <th className="px-4 py-2">Produit</th>
                            <th className="px-4 py-2">Département</th>
                            <th className="px-4 py-2">Stock Initial</th>
                            <th className="px-4 py-2">Stock Théorique</th>
                            <th className="px-4 py-2">Stock Réel</th>
                            <th className="px-4 py-2">Écart</th>
                            <th className="px-4 py-2">Date de saisie</th>
                          </tr>
                        </thead>
                        <tbody>
                          {control.produits.map((produit, index) => (
                            <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                              <td className="px-4 py-2 font-medium">{produit.productName}</td>
                              <td className="px-4 py-2">
                                {produit.department && (
                                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                    produit.department === 'Boulangerie' 
                                      ? 'bg-orange-100 text-orange-800' 
                                      : 'bg-blue-100 text-blue-800'
                                  }`}>
                                    {produit.department}
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-2">{produit.stockInitial}</td>
                              <td className="px-4 py-2">{produit.stockTheorique}</td>
                              <td className="px-4 py-2">{produit.stockReel}</td>
                              <td className="px-4 py-2">
                                <span className={`font-medium ${
                                  produit.ecart > 0 ? 'text-green-600' :
                                  produit.ecart < 0 ? 'text-red-600' :
                                  'text-gray-600'
                                }`}>
                                  {produit.ecart > 0 ? '✅ +' : produit.ecart < 0 ? '❌ ' : ''}
                                  {produit.ecart}
                                </span>
                              </td>
                              <td className="px-4 py-2">{produit.dateHeureSaisie}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {control.physicalCash !== undefined && (
                      <div className="mt-4 p-4 bg-white rounded-lg">
                        <h3 className="font-medium mb-2">Contrôle de caisse</h3>
                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <p className="text-sm text-gray-600">Montant théorique</p>
                            <p className="font-medium">{control.theoreticalAmount?.toFixed(2)} FCFA</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-600">Montant en caisse</p>
                            <p className="font-medium">{control.physicalCash?.toFixed(2)} FCFA</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-600">Différence</p>
                            <p className={`font-medium ${
                              (control.cashDifference || 0) > 0 ? 'text-green-600' :
                              (control.cashDifference || 0) < 0 ? 'text-red-600' :
                              'text-gray-600'
                            }`}>
                              {(control.cashDifference || 0) > 0 ? '+' : ''}
                              {control.cashDifference?.toFixed(2)} FCFA
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default StockControlHistory;