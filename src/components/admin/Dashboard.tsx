import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import "react-datepicker/dist/react-datepicker.css";
import { collection, query, where, getDocs, onSnapshot, orderBy, limit, Timestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useUser } from '../../context/UserContext';
import SalesChart from './SalesChart';

const Dashboard: React.FC = () => {
  const { user, loading: userLoading } = useUser();
  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>([new Date(), new Date()]);
  const [startDate, endDate] = dateRange;
  
  // State for dashboard data
  const [todaySales, setTodaySales] = useState(0);
  const [yesterdaySales, setYesterdaySales] = useState(0);
  const [salesChange, setSalesChange] = useState(0);
  const [totalItems, setTotalItems] = useState(0);
  const [totalTransactions, setTotalTransactions] = useState(0);
  const [topProducts, setTopProducts] = useState<Array<{name: string, quantity: number, revenue: number}>>([]);
  const [lowStockProducts, setLowStockProducts] = useState<Array<{name: string, stock: number}>>([]);
  const [recentSales, setRecentSales] = useState<Array<{time: string, amount: number, items: number}>>([]);
  const [categoryDistribution, setCategoryDistribution] = useState<{[key: string]: number}>({
    pains: 0,
    viennoiseries: 0,
    patisseries: 0
  });

  useEffect(() => {
    if (!user?.company || !user?.agencyName || userLoading) return;

    // Get today's and yesterday's date boundaries
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    // Query for today's sales with company and agency filter
    const salesQuery = query(
      collection(db, 'ventes'),
      where('company', '==', user.company),
      where('agency', '==', user.agencyName),
      where('timestamp', '>=', Timestamp.fromDate(today)),
      where('timestamp', '<', Timestamp.fromDate(tomorrow))
    );

    // Query for yesterday's sales
    const yesterdaySalesQuery = query(
      collection(db, 'ventes'),
      where('company', '==', user.company),
      where('agency', '==', user.agencyName),
      where('timestamp', '>=', Timestamp.fromDate(yesterday)),
      where('timestamp', '<', Timestamp.fromDate(today))
    );

    // Real-time listener for today's sales
    const unsubscribeToday = onSnapshot(salesQuery, (snapshot) => {
      const total = snapshot.docs.reduce((sum, doc) => sum + doc.data().totalAmount, 0);
      setTodaySales(total);
      setTotalTransactions(snapshot.size);
      
      // Calculate total items sold today
      const items = snapshot.docs.reduce((sum, doc) => {
        return sum + doc.data().quantity.reduce((itemSum: number, qty: number) => itemSum + qty, 0);
      }, 0);
      setTotalItems(items);
    });

    // Get yesterday's sales
    getDocs(yesterdaySalesQuery).then((snapshot) => {
      const total = snapshot.docs.reduce((sum, doc) => sum + doc.data().totalAmount, 0);
      setYesterdaySales(total);
      
      // Calculate sales change percentage
      if (total > 0) {
        const change = ((todaySales - total) / total) * 100;
        setSalesChange(change);
      }
    });

    // Query for top products
    const topProductsQuery = query(
      collection(db, 'products'),
      where('company', '==', user.company),
      orderBy('totalSales', 'desc'),
      limit(5)
    );

    const unsubscribeTopProducts = onSnapshot(topProductsQuery, (snapshot) => {
      const products = snapshot.docs.map(doc => ({
        name: doc.data().name,
        quantity: doc.data().totalQuantitySold || 0,
        revenue: doc.data().totalRevenue || 0
      }));
      setTopProducts(products);
    });

    // Query for low stock products
    const lowStockQuery = query(
      collection(db, 'products'),
      where('company', '==', user.company),
      where('stock', '<=', 8),
      orderBy('stock', 'asc'),
      limit(3)
    );

    const unsubscribeLowStock = onSnapshot(lowStockQuery, (snapshot) => {
      const products = snapshot.docs.map(doc => ({
        name: doc.data().name,
        stock: doc.data().stock
      }));
      setLowStockProducts(products);
    });

    // Query for recent sales
    const recentSalesQuery = query(
      collection(db, 'ventes'),
      where('company', '==', user.company),
      where('agency', '==', user.agencyName),
      orderBy('timestamp', 'desc'),
      limit(10)
    );

    const unsubscribeRecentSales = onSnapshot(recentSalesQuery, (snapshot) => {
      const sales = snapshot.docs.map(doc => {
        const data = doc.data();
        const date = data.timestamp instanceof Timestamp ? 
          data.timestamp.toDate() : 
          new Date(data.timestamp);
        
        return {
          time: format(date, 'HH:mm'),
          amount: data.totalAmount,
          items: data.quantity.reduce((sum: number, qty: number) => sum + qty, 0)
        };
      });
      setRecentSales(sales);
    });

    // Query for category distribution
    const unsubscribeCategories = onSnapshot(
      query(collection(db, 'products'), where('company', '==', user.company)), 
      (snapshot) => {
        const distribution = snapshot.docs.reduce((acc: {[key: string]: number}, doc) => {
          const category = doc.data().category;
          const sales = doc.data().totalQuantitySold || 0;
          acc[category] = (acc[category] || 0) + sales;
          return acc;
        }, {});

        const total = Object.values(distribution).reduce((sum, value) => sum + value, 0);
        if (total > 0) {
          Object.keys(distribution).forEach(key => {
            distribution[key] = (distribution[key] / total) * 100;
          });
        }

        setCategoryDistribution(distribution);
      }
    );

    return () => {
      unsubscribeToday();
      unsubscribeTopProducts();
      unsubscribeLowStock();
      unsubscribeRecentSales();
      unsubscribeCategories();
    };
  }, [user, userLoading, todaySales]);

  if (userLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#8B4513]"></div>
      </div>
    );
  }

  if (!user?.company || !user?.agencyName) {
    return (
      <div className="p-6">
        <div className="bg-yellow-50 text-yellow-700 p-4 rounded-lg">
          Informations entreprise ou agence manquantes
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-[#8B4513]">Tableau de Bord</h2>
      </div>
      
      <div className="mb-8">
        <SalesChart userCompany={user.company} />
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-lg text-[#8B4513]">Meilleures Ventes</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="pb-2">Produit</th>
                  <th className="pb-2">Qté</th>
                  <th className="pb-2">Revenu</th>
                </tr>
              </thead>
              <tbody>
                {topProducts.map((product, index) => (
                  <tr key={index} className="border-b border-gray-100">
                    <td className="py-3">{product.name}</td>
                    <td className="py-3">{product.quantity}</td>
                    <td className="py-3">{Math.round(product.revenue)} Fcfa</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-lg text-[#8B4513]">Ventes par Catégorie</h3>
          </div>
          <div className="flex items-center justify-center h-64">
            <div className="flex flex-col space-y-4 w-full">
              {Object.entries(categoryDistribution).map(([category, percentage]) => (
                <div key={category}>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm font-medium">{category}</span>
                    <span className="text-sm font-medium">{Math.round(percentage)}%</span>
                  </div>
                  <div className="bg-gray-200 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full ${
                        category === 'pains' ? 'bg-[#8B4513]' :
                        category === 'viennoiseries' ? 'bg-[#FFD700]' : 'bg-[#FF6B6B]'
                      }`} 
                      style={{ width: `${percentage}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-lg text-[#8B4513]">Stock Faible</h3>
            <span className="bg-red-100 text-red-800 text-xs font-medium px-2.5 py-0.5 rounded">Attention</span>
          </div>
          {lowStockProducts.length > 0 ? (
            <div className="space-y-4">
              {lowStockProducts.map((product, index) => (
                <div key={index} className="flex justify-between items-center p-3 bg-red-50 rounded-lg">
                  <span className="font-medium">{product.name}</span>
                  <span className="bg-red-100 text-red-800 text-xs font-medium px-2.5 py-0.5 rounded">
                    Stock: {product.stock}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center py-4 text-gray-500">Tous les stocks sont à des niveaux satisfaisants.</p>
          )}
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-lg text-[#8B4513]">Ventes Récentes</h3>
          </div>
          <div className="space-y-3">
            {recentSales.map((sale, index) => (
              <div key={index} className="flex justify-between items-center p-3 border-b last:border-0">
                <div>
                  <span className="text-gray-500">{sale.time}</span>
                  <p className="text-sm">{sale.items} article{sale.items > 1 ? 's' : ''}</p>
                </div>
                <span className="font-bold">{Math.round(sale.amount)} Fcfa</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;