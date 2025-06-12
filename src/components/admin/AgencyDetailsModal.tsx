import React, { useState, useEffect } from 'react';
import { X, Calendar, TrendingUp, TrendingDown, DollarSign, Package, BarChart3, PieChart, ArrowLeft, Filter, Download } from 'lucide-react';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { fr } from 'date-fns/locale';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useUser } from '../../context/UserContext';
import { toast } from 'react-hot-toast';
import { Line, Doughnut, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  BarElement,
  Filler
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  BarElement,
  Filler
);

interface AgencyDetailsModalProps {
  agencyName: string;
  onClose: () => void;
}

interface DateRange {
  start: Date;
  end: Date;
}

interface AgencyData {
  revenue: number;
  costs: number;
  profit: number;
  profitMargin: number;
  unitsProduced: number;
  productTypes: number;
  costBreakdown: {
    materials: number;
    labor: number;
    operating: number;
    overhead: number;
  };
  dailyData: Array<{
    date: string;
    revenue: number;
    costs: number;
    profit: number;
  }>;
  productionData: Array<{
    product: string;
    quantity: number;
    revenue: number;
  }>;
}

const AgencyDetailsModal: React.FC<AgencyDetailsModalProps> = ({ agencyName, onClose }) => {
  const { user } = useUser();
  const [loading, setLoading] = useState(true);
  const [agencyData, setAgencyData] = useState<AgencyData | null>(null);
  const [dateRange, setDateRange] = useState<DateRange>({
    start: subDays(new Date(), 30),
    end: new Date()
  });
  const [activeTab, setActiveTab] = useState<'overview' | 'costs' | 'production' | 'trends'>('overview');

  const datePresets = [
    { label: '7 derniers jours', days: 7 },
    { label: '30 derniers jours', days: 30 },
    { label: '3 derniers mois', days: 90 },
    { label: '6 derniers mois', days: 180 }
  ];

  const fetchAgencyDetails = async (startDate: Date, endDate: Date) => {
    if (!user?.company) return;

    setLoading(true);
    try {
      // Fetch sales data
      const salesQuery = query(
        collection(db, 'ventes'),
        where('company', '==', user.company),
        where('agency', '==', agencyName),
        where('timestamp', '>=', startDate),
        where('timestamp', '<=', endDate),
        orderBy('timestamp', 'desc')
      );

      // Fetch production sheets
      const productionQuery = query(
        collection(db, 'fichesProduction'),
        where('company', '==', user.company),
        where('agency', '==', agencyName),
        where('dateProduction', '>=', startDate),
        where('dateProduction', '<=', endDate),
        orderBy('dateProduction', 'desc')
      );

      // Fetch expenses
      const expensesQuery = query(
        collection(db, 'expenses'),
        where('company', '==', user.company),
        where('agencyName', '==', agencyName),
        where('date', '>=', startDate),
        where('date', '<=', endDate),
        orderBy('date', 'desc')
      );

      const [salesSnapshot, productionSnapshot, expensesSnapshot] = await Promise.all([
        getDocs(salesQuery),
        getDocs(productionQuery),
        getDocs(expensesQuery)
      ]);

      // Process sales data
      const salesData = salesSnapshot.docs.map(doc => ({
        ...doc.data(),
        timestamp: doc.data().timestamp.toDate()
      }));

      // Process production data
      const productionData = productionSnapshot.docs.map(doc => ({
        ...doc.data(),
        dateProduction: doc.data().dateProduction.toDate()
      }));

      // Process expenses data
      const expensesData = expensesSnapshot.docs.map(doc => ({
        ...doc.data(),
        date: doc.data().date.toDate()
      }));

      // Calculate metrics
      const totalRevenue = salesData.reduce((sum, sale) => sum + sale.totalAmount, 0);
      const totalProductionCosts = productionData.reduce((sum, prod) => sum + prod.coutMatieres, 0);
      const totalExpenses = expensesData.reduce((sum, exp) => sum + exp.amount, 0);
      const totalCosts = totalProductionCosts + totalExpenses;
      const profit = totalRevenue - totalCosts;
      const profitMargin = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;

      // Calculate cost breakdown
      const materialsCosts = productionData.reduce((sum, prod) => sum + prod.coutMatieres, 0);
      const laborCosts = expensesData
        .filter(exp => exp.type === 'operational')
        .reduce((sum, exp) => sum + exp.amount, 0);
      const operatingCosts = expensesData
        .filter(exp => exp.type === 'supplies')
        .reduce((sum, exp) => sum + exp.amount, 0);
      const overheadCosts = expensesData
        .filter(exp => exp.type === 'maintenance')
        .reduce((sum, exp) => sum + exp.amount, 0);

      // Calculate daily data for trends
      const dailyMap = new Map();
      
      salesData.forEach(sale => {
        const dateKey = format(sale.timestamp, 'yyyy-MM-dd');
        if (!dailyMap.has(dateKey)) {
          dailyMap.set(dateKey, { revenue: 0, costs: 0, profit: 0 });
        }
        dailyMap.get(dateKey).revenue += sale.totalAmount;
      });

      productionData.forEach(prod => {
        const dateKey = format(prod.dateProduction, 'yyyy-MM-dd');
        if (!dailyMap.has(dateKey)) {
          dailyMap.set(dateKey, { revenue: 0, costs: 0, profit: 0 });
        }
        dailyMap.get(dateKey).costs += prod.coutMatieres;
      });

      expensesData.forEach(exp => {
        const dateKey = format(exp.date, 'yyyy-MM-dd');
        if (!dailyMap.has(dateKey)) {
          dailyMap.set(dateKey, { revenue: 0, costs: 0, profit: 0 });
        }
        dailyMap.get(dateKey).costs += exp.amount;
      });

      const dailyData = Array.from(dailyMap.entries()).map(([date, data]) => ({
        date,
        revenue: data.revenue,
        costs: data.costs,
        profit: data.revenue - data.costs
      })).sort((a, b) => a.date.localeCompare(b.date));

      // Calculate production summary
      const productionSummary = new Map();
      productionData.forEach(prod => {
        prod.productsProduced?.forEach((product: any) => {
          if (!productionSummary.has(product.productName)) {
            productionSummary.set(product.productName, { quantity: 0, revenue: 0 });
          }
          const current = productionSummary.get(product.productName);
          current.quantity += product.quantity;
          current.revenue += product.quantity * product.unitPrice;
        });
      });

      const productionDataArray = Array.from(productionSummary.entries()).map(([product, data]) => ({
        product,
        quantity: data.quantity,
        revenue: data.revenue
      }));

      const totalUnitsProduced = productionDataArray.reduce((sum, item) => sum + item.quantity, 0);
      const uniqueProducts = productionDataArray.length;

      setAgencyData({
        revenue: totalRevenue,
        costs: totalCosts,
        profit,
        profitMargin,
        unitsProduced: totalUnitsProduced,
        productTypes: uniqueProducts,
        costBreakdown: {
          materials: materialsCosts,
          labor: laborCosts,
          operating: operatingCosts,
          overhead: overheadCosts
        },
        dailyData,
        productionData: productionDataArray
      });

    } catch (error) {
      console.error('Error fetching agency details:', error);
      toast.error('Erreur lors du chargement des détails de l\'agence');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAgencyDetails(dateRange.start, dateRange.end);
  }, [dateRange, agencyName, user?.company]);

  const handleDatePreset = (days: number) => {
    const end = new Date();
    const start = subDays(end, days);
    setDateRange({ start, end });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XOF',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          font: {
            family: "'Inter', sans-serif",
            size: 12
          }
        }
      },
      tooltip: {
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        titleColor: '#1f2937',
        bodyColor: '#6b7280',
        borderColor: '#e5e7eb',
        borderWidth: 1,
        cornerRadius: 8,
        padding: 12
      }
    },
    scales: {
      x: {
        grid: {
          display: false
        },
        ticks: {
          font: {
            family: "'Inter', sans-serif",
            size: 11
          }
        }
      },
      y: {
        beginAtZero: true,
        grid: {
          color: 'rgba(0, 0, 0, 0.05)'
        },
        ticks: {
          font: {
            family: "'Inter', sans-serif",
            size: 11
          },
          callback: function(value: any) {
            return formatCurrency(Number(value));
          }
        }
      }
    }
  };

  const trendChartData = {
    labels: agencyData?.dailyData.map(d => format(new Date(d.date), 'dd/MM')) || [],
    datasets: [
      {
        label: 'Chiffre d\'affaires',
        data: agencyData?.dailyData.map(d => d.revenue) || [],
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        fill: true,
        tension: 0.4
      },
      {
        label: 'Coûts',
        data: agencyData?.dailyData.map(d => d.costs) || [],
        borderColor: '#ef4444',
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        fill: true,
        tension: 0.4
      },
      {
        label: 'Profit',
        data: agencyData?.dailyData.map(d => d.profit) || [],
        borderColor: '#10b981',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        fill: true,
        tension: 0.4
      }
    ]
  };

  const costBreakdownData = {
    labels: ['Matières premières', 'Main-d\'œuvre', 'Frais d\'exploitation', 'Frais généraux'],
    datasets: [
      {
        data: [
          agencyData?.costBreakdown.materials || 0,
          agencyData?.costBreakdown.labor || 0,
          agencyData?.costBreakdown.operating || 0,
          agencyData?.costBreakdown.overhead || 0
        ],
        backgroundColor: [
          '#ef4444',
          '#3b82f6',
          '#f59e0b',
          '#8b5cf6'
        ],
        borderWidth: 0
      }
    ]
  };

  const productionChartData = {
    labels: agencyData?.productionData.slice(0, 10).map(p => p.product) || [],
    datasets: [
      {
        label: 'Quantité produite',
        data: agencyData?.productionData.slice(0, 10).map(p => p.quantity) || [],
        backgroundColor: 'rgba(59, 130, 246, 0.8)',
        borderRadius: 8
      }
    ]
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="bg-white rounded-2xl p-8 shadow-2xl">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 text-center">Chargement des données...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-7xl h-[95vh] flex flex-col overflow-hidden">
        {/* Fixed Header */}
        <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-blue-800 text-white p-6 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/20 rounded-xl transition-colors"
              >
                <ArrowLeft className="h-6 w-6" />
              </button>
              <div>
                <h1 className="text-2xl font-bold">Détails de l'agence - {agencyName}</h1>
                <p className="text-blue-100 mt-1">
                  {format(dateRange.start, 'dd MMMM yyyy', { locale: fr })} - {format(dateRange.end, 'dd MMMM yyyy', { locale: fr })}
                </p>
              </div>
            </div>
            <button className="p-2 hover:bg-white/20 rounded-xl transition-colors">
              <Download className="h-6 w-6" />
            </button>
          </div>

          {/* Date Range Selector */}
          <div className="mt-6 flex flex-wrap items-center gap-4">
            <div className="flex items-center space-x-2 bg-white/20 rounded-xl px-4 py-2">
              <Calendar className="h-5 w-5" />
              <span className="font-medium">Période :</span>
              <input
                type="date"
                value={format(dateRange.start, 'yyyy-MM-dd')}
                onChange={(e) => setDateRange(prev => ({ ...prev, start: new Date(e.target.value) }))}
                className="bg-transparent border-none text-white placeholder-white/70 focus:outline-none"
              />
              <span>-</span>
              <input
                type="date"
                value={format(dateRange.end, 'yyyy-MM-dd')}
                onChange={(e) => setDateRange(prev => ({ ...prev, end: new Date(e.target.value) }))}
                className="bg-transparent border-none text-white placeholder-white/70 focus:outline-none"
              />
            </div>
            
            <div className="flex flex-wrap gap-2">
              {datePresets.map((preset) => (
                <button
                  key={preset.days}
                  onClick={() => handleDatePreset(preset.days)}
                  className="px-3 py-1 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 hover:scrollbar-thumb-gray-400">
          {/* Key Metrics */}
          <div className="p-6 bg-gray-50">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600 mb-1">Chiffre d'affaires</p>
                    <p className="text-2xl font-bold text-gray-900">{formatCurrency(agencyData?.revenue || 0)}</p>
                    <div className="flex items-center mt-2">
                      <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
                      <span className="text-sm text-green-600 font-medium">+12.5% vs hier</span>
                    </div>
                  </div>
                  <div className="p-3 bg-blue-100 rounded-xl">
                    <DollarSign className="h-6 w-6 text-blue-600" />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600 mb-1">Coûts de production</p>
                    <p className="text-2xl font-bold text-gray-900">{formatCurrency(agencyData?.costs || 0)}</p>
                    <p className="text-sm text-gray-500 mt-2">
                      {agencyData?.revenue ? ((agencyData.costs / agencyData.revenue) * 100).toFixed(1) : 0}% du CA
                    </p>
                  </div>
                  <div className="p-3 bg-red-100 rounded-xl">
                    <BarChart3 className="h-6 w-6 text-red-600" />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600 mb-1">Unités produites</p>
                    <p className="text-2xl font-bold text-gray-900">{agencyData?.unitsProduced || 0}</p>
                    <p className="text-sm text-gray-500 mt-2">{agencyData?.productTypes || 0} produits différents</p>
                  </div>
                  <div className="p-3 bg-orange-100 rounded-xl">
                    <Package className="h-6 w-6 text-orange-600" />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600 mb-1">Marge bénéficiaire</p>
                    <p className="text-2xl font-bold text-gray-900">{(agencyData?.profitMargin || 0).toFixed(1)}%</p>
                    <p className="text-sm text-green-600 font-medium mt-2">
                      {formatCurrency(agencyData?.profit || 0)} profit
                    </p>
                  </div>
                  <div className="p-3 bg-green-100 rounded-xl">
                    <PieChart className="h-6 w-6 text-green-600" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="px-6 bg-white border-b border-gray-200 sticky top-0 z-10">
            <div className="flex space-x-8">
              {[
                { id: 'overview', label: 'Vue d\'ensemble', icon: BarChart3 },
                { id: 'costs', label: 'Répartition des Coûts', icon: PieChart },
                { id: 'production', label: 'Détails Production', icon: Package },
                { id: 'trends', label: 'Tendances', icon: TrendingUp }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center space-x-2 py-4 px-2 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === tab.id
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <tab.icon className="h-5 w-5" />
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {activeTab === 'overview' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <DollarSign className="h-5 w-5 text-blue-600 mr-2" />
                    Répartition des Coûts de Production
                  </h3>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center p-3 bg-red-50 rounded-xl">
                      <div className="flex items-center">
                        <div className="w-3 h-3 bg-red-500 rounded-full mr-3"></div>
                        <span className="font-medium text-gray-700">Matières premières</span>
                        <span className="text-sm text-gray-500 ml-2">Coût des ingrédients</span>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-gray-900">{formatCurrency(agencyData?.costBreakdown.materials || 0)}</div>
                        <div className="text-sm text-gray-500">
                          {agencyData?.costs ? ((agencyData.costBreakdown.materials / agencyData.costs) * 100).toFixed(1) : 0}%
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-between items-center p-3 bg-blue-50 rounded-xl">
                      <div className="flex items-center">
                        <div className="w-3 h-3 bg-blue-500 rounded-full mr-3"></div>
                        <span className="font-medium text-gray-700">Coûts de main-d'œuvre</span>
                        <span className="text-sm text-gray-500 ml-2">Salaires et charges</span>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-gray-900">{formatCurrency(agencyData?.costBreakdown.labor || 0)}</div>
                        <div className="text-sm text-gray-500">
                          {agencyData?.costs ? ((agencyData.costBreakdown.labor / agencyData.costs) * 100).toFixed(1) : 0}%
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-between items-center p-3 bg-yellow-50 rounded-xl">
                      <div className="flex items-center">
                        <div className="w-3 h-3 bg-yellow-500 rounded-full mr-3"></div>
                        <span className="font-medium text-gray-700">Frais d'exploitation</span>
                        <span className="text-sm text-gray-500 ml-2">Fournitures et consommables</span>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-gray-900">{formatCurrency(agencyData?.costBreakdown.operating || 0)}</div>
                        <div className="text-sm text-gray-500">
                          {agencyData?.costs ? ((agencyData.costBreakdown.operating / agencyData.costs) * 100).toFixed(1) : 0}%
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-between items-center p-3 bg-purple-50 rounded-xl">
                      <div className="flex items-center">
                        <div className="w-3 h-3 bg-purple-500 rounded-full mr-3"></div>
                        <span className="font-medium text-gray-700">Frais généraux</span>
                        <span className="text-sm text-gray-500 ml-2">Maintenance et autres</span>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-gray-900">{formatCurrency(agencyData?.costBreakdown.overhead || 0)}</div>
                        <div className="text-sm text-gray-500">
                          {agencyData?.costs ? ((agencyData.costBreakdown.overhead / agencyData.costs) * 100).toFixed(1) : 0}%
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <PieChart className="h-5 w-5 text-purple-600 mr-2" />
                    Répartition Visuelle des Coûts
                  </h3>
                  <div className="h-80">
                    <Doughnut data={costBreakdownData} options={chartOptions} />
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-4">
                    <div className="flex items-center">
                      <div className="w-3 h-3 bg-red-500 rounded-full mr-2"></div>
                      <span className="text-sm text-gray-600">Matières premières</span>
                    </div>
                    <div className="flex items-center">
                      <div className="w-3 h-3 bg-blue-500 rounded-full mr-2"></div>
                      <span className="text-sm text-gray-600">Main-d'œuvre</span>
                    </div>
                    <div className="flex items-center">
                      <div className="w-3 h-3 bg-yellow-500 rounded-full mr-2"></div>
                      <span className="text-sm text-gray-600">Frais d'exploitation</span>
                    </div>
                    <div className="flex items-center">
                      <div className="w-3 h-3 bg-purple-500 rounded-full mr-2"></div>
                      <span className="text-sm text-gray-600">Frais généraux</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'costs' && (
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <h3 className="text-lg font-semibold text-gray-900 mb-6">Analyse Détaillée des Coûts</h3>
                <div className="h-96">
                  <Doughnut data={costBreakdownData} options={chartOptions} />
                </div>
              </div>
            )}

            {activeTab === 'production' && (
              <div className="space-y-6">
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                  <h3 className="text-lg font-semibold text-gray-900 mb-6">Production par Produit</h3>
                  <div className="h-80">
                    <Bar data={productionChartData} options={chartOptions} />
                  </div>
                </div>

                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Détails de Production</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="text-left py-3 px-4 font-medium text-gray-700">Produit</th>
                          <th className="text-right py-3 px-4 font-medium text-gray-700">Quantité</th>
                          <th className="text-right py-3 px-4 font-medium text-gray-700">Chiffre d'affaires</th>
                          <th className="text-right py-3 px-4 font-medium text-gray-700">CA par unité</th>
                        </tr>
                      </thead>
                      <tbody>
                        {agencyData?.productionData.map((item, index) => (
                          <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="py-3 px-4 font-medium">{item.product}</td>
                            <td className="py-3 px-4 text-right">{item.quantity}</td>
                            <td className="py-3 px-4 text-right font-medium">{formatCurrency(item.revenue)}</td>
                            <td className="py-3 px-4 text-right">{formatCurrency(item.revenue / item.quantity)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'trends' && (
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <h3 className="text-lg font-semibold text-gray-900 mb-6">Évolution des Performances</h3>
                <div className="h-96">
                  <Line data={trendChartData} options={chartOptions} />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AgencyDetailsModal;