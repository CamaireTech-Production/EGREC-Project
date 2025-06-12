import React, { useState, useEffect } from 'react';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Plus, Search, Calendar, Download } from 'lucide-react';
import { useUser } from '../../context/UserContext';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import ExpenseForm from './expenses/ExpenseForm';
import { toast } from 'react-hot-toast';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

const ExpenseManagement: React.FC = () => {
  const { user } = useUser();
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({
    start: '',
    end: ''
  });
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const fetchExpenses = async () => {
      if (!user?.company || !user?.agencyName) return;

      try {
        let expensesQuery = query(
          collection(db, 'expenses'),
          where('company', '==', user.company),
          where('agencyName', '==', user.agencyName),
          orderBy('date', 'desc')
        );

        const snapshot = await getDocs(expensesQuery);
        const expensesData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          date: doc.data().date.toDate()
        }));

        setExpenses(expensesData);
      } catch (error) {
        console.error('Error fetching expenses:', error);
        toast.error('Erreur lors du chargement des dépenses');
      } finally {
        setLoading(false);
      }
    };

    fetchExpenses();
  }, [user]);

  const filteredExpenses = expenses.filter(expense => {
    const matchesSearch = expense.description.toLowerCase().includes(searchQuery.toLowerCase());
    const expenseDate = new Date(expense.date);
    const isInDateRange = (!dateRange.start || expenseDate >= new Date(dateRange.start)) &&
                         (!dateRange.end || expenseDate <= new Date(dateRange.end));
    return matchesSearch && isInDateRange;
  });

  const totalAmount = filteredExpenses.reduce((sum, expense) => sum + expense.amount, 0);

  const exportToPDF = () => {
    const doc = new jsPDF();
    
    // Add title
    doc.setFontSize(16);
    doc.text('Rapport des Dépenses', 14, 20);
    
    // Add agency info
    doc.setFontSize(12);
    doc.text(`Agence: ${user?.agencyName || ''}`, 14, 30);
    
    // Add date range if filtered
    if (dateRange.start && dateRange.end) {
      doc.text(`Période: du ${format(new Date(dateRange.start), 'dd/MM/yyyy')} au ${format(new Date(dateRange.end), 'dd/MM/yyyy')}`, 14, 40);
    }
    
    // Create table data
    const tableData = filteredExpenses.map(expense => [
      format(new Date(expense.date), 'dd/MM/yyyy HH:mm', { locale: fr }),
      expense.description,
      expense.type === 'operational' ? 'Opérationnelle' :
      expense.type === 'maintenance' ? 'Maintenance' :
      expense.type === 'supplies' ? 'Fournitures' : 'Autre',
      `${Math.round(expense.amount).toLocaleString()} Fcfa`
    ]);
    
    // Add table
    (doc as any).autoTable({
      startY: dateRange.start && dateRange.end ? 45 : 35,
      head: [['Date', 'Description', 'Type', 'Montant']],
      body: tableData,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [139, 69, 19] }
    });
    
    // Add total
    const finalY = (doc as any).lastAutoTable.finalY || 60;
    doc.text(`Total des dépenses: ${Math.round(totalAmount).toLocaleString()} Fcfa`, 14, finalY + 10);
    
    // Save PDF
    doc.save(`rapport-depenses-${user?.agencyName}-${format(new Date(), 'dd-MM-yyyy')}.pdf`);
    toast.success('Rapport PDF généré avec succès');
  };

  return (
    <div className="p-6 bg-gray-50">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-2xl font-bold text-[#8B4513]">Gestion des Dépenses</h2>
        <button
          onClick={() => setShowExpenseModal(true)}
          className="bg-[#8B4513] text-white px-6 py-3 rounded-xl flex items-center hover:bg-[#663300] transition-colors shadow-lg hover:shadow-xl"
        >
          <Plus className="h-5 w-5 mr-2" />
          Nouvelle Dépense
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="flex-grow">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Rechercher une dépense..."
                className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#8B4513] focus:border-transparent"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
          <div className="flex gap-4">
            <div className="relative">
              <Calendar className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="date"
                className="pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#8B4513] focus:border-transparent"
                value={dateRange.start}
                onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
              />
            </div>
            <div className="relative">
              <Calendar className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="date"
                className="pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#8B4513] focus:border-transparent"
                value={dateRange.end}
                onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
              />
            </div>
            <button
              onClick={exportToPDF}
              className="flex items-center px-4 py-2 bg-[#8B4513] text-white rounded-xl hover:bg-[#663300] transition-colors shadow-md"
            >
              <Download className="h-5 w-5 mr-2" />
              Exporter PDF
            </button>
          </div>
        </div>

        <div className="bg-[#8B4513]/5 rounded-xl p-4 mb-6">
          <div className="flex justify-between items-center">
            <span className="text-gray-600">Total des dépenses:</span>
            <span className="text-2xl font-bold text-[#8B4513]">{Math.round(totalAmount).toLocaleString()} Fcfa</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Date</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Description</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Type</th>
                <th className="px-6 py-4 text-right text-sm font-semibold text-gray-600">Montant</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Utilisateur</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredExpenses.map((expense) => (
                <tr key={expense.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 text-sm">
                    {format(expense.date, 'dd MMM yyyy', { locale: fr })}
                  </td>
                  <td className="px-6 py-4 text-sm">{expense.description}</td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      expense.type === 'operational' ? 'bg-blue-100 text-blue-800' :
                      expense.type === 'maintenance' ? 'bg-yellow-100 text-yellow-800' :
                      expense.type === 'supplies' ? 'bg-green-100 text-green-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {expense.type === 'operational' ? 'Opérationnelle' :
                       expense.type === 'maintenance' ? 'Maintenance' :
                       expense.type === 'supplies' ? 'Fournitures' : 'Autre'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right font-medium">
                    {Math.round(expense.amount).toLocaleString()} Fcfa
                  </td>
                  <td className="px-6 py-4 text-sm">{expense.userName}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showExpenseModal && (
        <ExpenseForm onClose={() => setShowExpenseModal(false)} />
      )}
    </div>
  );
};

export default ExpenseManagement;