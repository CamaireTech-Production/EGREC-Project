import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, onSnapshot, orderBy, limit, Timestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useUser } from '../../context/UserContext';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Line, Pie } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  ArcElement
} from 'chart.js';
import { Download, Filter, Calendar, TrendingUp, TrendingDown, Building2, X, Loader2, ChevronDown, ChevronUp, Printer, Eye } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import AgencyDetailsModal from './AgencyDetailsModal';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  ArcElement
);

interface AgencyStats {
  id: string;
  name: string;
  todaySales: number;
  yesterdaySales: number;
  percentageChange: number;
  hourlyData: number[];
  yesterdayHourlyData: number[];
}

interface FullscreenGraph {
  visible: boolean;
  data: any;
  agency?: string;
}

interface ProductInventory {
  id: string;
  name: string;
  stockParAgence: { [key: string]: number };
}

interface RevenueMetrics {
  totalToday: number;
  totalYesterday: number;
  percentageChange: number;
  distributionData: {
    labels: string[];
    values: number[];
  };
}

const CentralizedAdmin: React.FC = () => {
  const { user } = useUser();
  const [agencies, setAgencies] = useState<AgencyStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [inventoryLoading, setInventoryLoading] = useState(true);
  const [dateRange, setDateRange] = useState({
    start: format(subDays(new Date(), 7), 'yyyy-MM-dd'),
    end: format(new Date(), 'yyyy-MM-dd')
  });
  const [selectedAgencies, setSelectedAgencies] = useState<string[]>([]);
  const [fullscreenGraph, setFullscreenGraph] = useState<FullscreenGraph>({
    visible: false,
    data: null
  });
  const [inventory, setInventory] = useState<ProductInventory[]>([]);
  const [inventoryError, setInventoryError] = useState<string | null>(null);
  const [showInventory, setShowInventory] = useState(false);
  const [revenueMetrics, setRevenueMetrics] = useState<RevenueMetrics>({
    totalToday: 0,
    totalYesterday: 0,
    percentageChange: 0,
    distributionData: {
      labels: [],
      values: []
    }
  });
  const [selectedAgencyForDetails, setSelectedAgencyForDetails] = useState<string | null>(null);

  const generatePDF = () => {
    try {
      const doc = new jsPDF();
      const today = format(new Date(), 'dd/MM/yyyy');
      
      // Add title
      doc.setFontSize(18);
      doc.text('Rapport des Ventes par Agence', 14, 20);
      
      // Add date
      doc.setFontSize(12);
      doc.text(`Date du rapport: ${today}`, 14, 30);
      
      // Prepare table data
      const tableData = agencies.map(agency => [
        agency.name,
        `${Math.round(agency.todaySales).toLocaleString()} Fcfa`,
        `${Math.round(agency.yesterdaySales).toLocaleString()} Fcfa`,
        `${agency.percentageChange >= 0 ? '+' : ''}${agency.percentageChange.toFixed(1)}%`
      ]);
      
      // Add table
      doc.autoTable({
        head: [['Agence', "Ventes du jour", "Ventes d'hier", 'Variation']],
        body: tableData,
        startY: 40,
        styles: {
          fontSize: 10,
          cellPadding: 5
        },
        headStyles: {
          fillColor: [139, 69, 19],
          textColor: 255
        }
      });
      
      // Add totals
      const finalY = (doc as any).lastAutoTable.finalY || 150;
      doc.setFontSize(12);
      doc.text('Totaux:', 14, finalY + 10);
      doc.text(`Total des ventes du jour: ${Math.round(revenueMetrics.totalToday).toLocaleString()} Fcfa`, 14, finalY + 20);
      doc.text(`Total des ventes d'hier: ${Math.round(revenueMetrics.totalYesterday).toLocaleString()} Fcfa`, 14, finalY + 30);
      doc.text(`Variation totale: ${revenueMetrics.percentageChange >= 0 ? '+' : ''}${revenueMetrics.percentageChange.toFixed(1)}%`, 14, finalY + 40);
      
      doc.save(`rapport-ventes-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
      toast.success('Le rapport PDF a été généré avec succès');
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Erreur lors de la génération du PDF');
    }
  };

  const generateInventoryPDF = () => {
    try {
      const doc = new jsPDF();
      const today = format(new Date(), 'dd/MM/yyyy HH:mm');
      
      doc.setFontSize(18);
      doc.text('État des Stocks par Agence', 14, 20);
      
      doc.setFontSize(12);
      doc.text(`Rapport généré le ${today}`, 14, 30);
      doc.text(`Entreprise: ${user?.company || ''}`, 14, 40);
      
      const tableData = inventory.map(product => [
        product.name,
        ...agencies.map(agency => {
          const stock = product.stockParAgence[agency.name];
          return stock === 0 ? 'Aucun stock' : stock?.toLocaleString() || 'Aucun stock';
        })
      ]);
      
      doc.autoTable({
        head: [['Produit', ...agencies.map(a => a.name)]],
        body: tableData,
        startY: 50,
        styles: {
          fontSize: 10,
          cellPadding: 5
        },
        headStyles: {
          fillColor: [139, 69, 19],
          textColor: 255
        },
        columnStyles: {
          0: { cellWidth: 60 }
        }
      });
      
      doc.save(`etat-stocks-${format(new Date(), 'yyyy-MM-dd-HH-mm')}.pdf`);
      toast.success('Le rapport des stocks a été généré avec succès');
    } catch (error) {
      console.error('Error generating inventory PDF:', error);
      toast.error('Erreur lors de la génération du PDF des stocks');
    }
  };

  useEffect(() => {
    if (!user?.company) return;

    const fetchAgencies = async () => {
      try {
        const agenciesQuery = query(
          collection(db, 'users'),
          where('company', '==', user.company),
          orderBy('agencyName')
        );

        const snapshot = await getDocs(agenciesQuery);
        const uniqueAgencies = Array.from(new Set(
          snapshot.docs.map(doc => doc.data().agencyName).filter(Boolean)
        ));

        const agencyStats = await Promise.all(
          uniqueAgencies.map(async (agencyName) => {
            const today = new Date();
            const yesterday = subDays(today, 1);

            const todayQuery = query(
              collection(db, 'ventes'),
              where('company', '==', user.company),
              where('agency', '==', agencyName),
              where('timestamp', '>=', startOfDay(today)),
              where('timestamp', '<=', endOfDay(today))
            );

            const yesterdayQuery = query(
              collection(db, 'ventes'),
              where('company', '==', user.company),
              where('agency', '==', agencyName),
              where('timestamp', '>=', startOfDay(yesterday)),
              where('timestamp', '<=', endOfDay(yesterday))
            );

            const [todaySnap, yesterdaySnap] = await Promise.all([
              getDocs(todayQuery),
              getDocs(yesterdayQuery)
            ]);

            const hourlyDataToday = Array(24).fill(0);
            const hourlyDataYesterday = Array(24).fill(0);
            
            todaySnap.docs.forEach(doc => {
              const hour = doc.data().timestamp.toDate().getHours();
              hourlyDataToday[hour] += doc.data().totalAmount;
            });

            yesterdaySnap.docs.forEach(doc => {
              const hour = doc.data().timestamp.toDate().getHours();
              hourlyDataYesterday[hour] += doc.data().totalAmount;
            });

            const todaySales = todaySnap.docs.reduce((sum, doc) => sum + doc.data().totalAmount, 0);
            const yesterdaySales = yesterdaySnap.docs.reduce((sum, doc) => sum + doc.data().totalAmount, 0);

            return {
              id: agencyName,
              name: agencyName,
              todaySales,
              yesterdaySales,
              percentageChange: yesterdaySales ? ((todaySales - yesterdaySales) / yesterdaySales) * 100 : 0,
              hourlyData: hourlyDataToday,
              yesterdayHourlyData: hourlyDataYesterday
            };
          })
        );

        setAgencies(agencyStats);
        setSelectedAgencies(uniqueAgencies);

        // Calculate revenue metrics
        const totalToday = agencyStats.reduce((sum, agency) => sum + agency.todaySales, 0);
        const totalYesterday = agencyStats.reduce((sum, agency) => sum + agency.yesterdaySales, 0);
        const percentageChange = totalYesterday ? ((totalToday - totalYesterday) / totalYesterday) * 100 : 0;

        // Calculate revenue distribution
        const distributionData = {
          labels: agencyStats.map(agency => agency.name),
          values: agencyStats.map(agency => agency.todaySales)
        };

        setRevenueMetrics({
          totalToday,
          totalYesterday,
          percentageChange,
          distributionData
        });

      } catch (error) {
        console.error('Error fetching agencies:', error);
        toast.error('Erreur lors du chargement des données');
      } finally {
        setLoading(false);
      }
    };

    fetchAgencies();
  }, [user?.company]);

  useEffect(() => {
    if (!user?.company) return;

    setInventoryLoading(true);
    setInventoryError(null);

    const fetchInventory = async () => {
      try {
        const productsQuery = query(
          collection(db, 'products'),
          where('company', '==', user.company),
          orderBy('name')
        );

        const snapshot = await getDocs(productsQuery);
        const products = snapshot.docs.map(doc => ({
          id: doc.id,
          name: doc.data().name,
          stockParAgence: doc.data().stockParAgence || {}
        }));

        setInventory(products);
      } catch (error) {
        console.error('Error fetching inventory:', error);
        setInventoryError('Erreur lors du chargement des stocks');
      } finally {
        setInventoryLoading(false);
      }
    };

    fetchInventory();
  }, [user?.company]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: fullscreenGraph.visible ? false : true,
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
    plugins: {
      legend: {
        position: 'top' as const,
      },
      tooltip: {
        callbacks: {
          label: (context: any) => {
            return `${context.dataset.label}: ${context.parsed.y.toLocaleString()} Fcfa`;
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: (value: number) => `${value.toLocaleString()} Fcfa`
        }
      }
    }
  };

  const pieChartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'right' as const,
      },
      tooltip: {
        callbacks: {
          label: (context: any) => {
            const value = context.raw;
            const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0);
            const percentage = ((value / total) * 100).toFixed(1);
            return `${context.label}: ${percentage}% (${value.toLocaleString()} Fcfa)`;
          }
        }
      }
    }
  };

  const handleGraphClick = (agencyName?: string) => {
    if (fullscreenGraph.visible) {
      setFullscreenGraph({ visible: false, data: null });
    } else {
      const graphData = {
        labels: Array.from({ length: 24 }, (_, i) => `${i}h`),
        datasets: agencyName
          ? [
              {
                label: "Aujourd'hui",
                data: agencies.find(a => a.name === agencyName)?.hourlyData || [],
                borderColor: '#9333EA',
                backgroundColor: 'rgba(147, 51, 234, 0.1)',
                fill: true,
                tension: 0.4
              },
              {
                label: "Hier",
                data: agencies.find(a => a.name === agencyName)?.yesterdayHourlyData || [],
                borderColor: '#6366F1',
                backgroundColor: 'rgba(99, 102, 241, 0.1)',
                borderDash: [5, 5],
                fill: true,
                tension: 0.4
              }
            ]
          : agencies
              .filter(agency => selectedAgencies.includes(agency.id))
              .map((agency, index) => ({
                label: agency.name,
                data: agency.hourlyData,
                borderColor: `hsl(${index * 360 / agencies.length}, 70%, 50%)`,
                backgroundColor: `hsla(${index * 360 / agencies.length}, 70%, 50%, 0.1)`,
                fill: true,
                tension: 0.4
              }))
      };
      setFullscreenGraph({ visible: true, data: graphData, agency: agencyName });
    }
  };

  const handleAgencyClick = (agencyName: string) => {
    setSelectedAgencyForDetails(agencyName);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-[#8B4513]" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-[#8B4513]">Administration Centralisée</h2>
        <div className="flex gap-4">
          <button
            onClick={generatePDF}
            className="flex items-center px-4 py-2 bg-[#8B4513] text-white rounded-lg hover:bg-[#663300] transition-colors"
          >
            <Download className="h-5 w-5 mr-2" />
            Exporter PDF
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold mb-4">Chiffre d'affaires du jour</h3>
          <div className="text-2xl font-bold">{Math.round(revenueMetrics.totalToday).toLocaleString()} Fcfa</div>
          <div className="mt-2 flex items-center">
            {revenueMetrics.percentageChange !== 0 && (
              <>
                {revenueMetrics.percentageChange > 0 ? (
                  <TrendingUp className="h-5 w-5 text-green-500 mr-1" />
                ) : (
                  <TrendingDown className="h-5 w-5 text-red-500 mr-1" />
                )}
                <span className={revenueMetrics.percentageChange > 0 ? 'text-green-500' : 'text-red-500'}>
                  {Math.abs(revenueMetrics.percentageChange).toFixed(1)}% par rapport à hier
                </span>
              </>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold mb-4">Chiffre d'affaires d'hier</h3>
          <div className="text-2xl font-bold">{Math.round(revenueMetrics.totalYesterday).toLocaleString()} Fcfa</div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold mb-4">Distribution des revenus</h3>
          <div className="h-[200px]">
            <Pie
              key={`pie-${revenueMetrics.distributionData.values.join('-')}`}
              data={{
                labels: revenueMetrics.distributionData.labels,
                datasets: [{
                  data: revenueMetrics.distributionData.values,
                  backgroundColor: revenueMetrics.distributionData.labels.map(
                    (_, i) => `hsl(${i * 360 / revenueMetrics.distributionData.labels.length}, 70%, 50%)`
                  )
                }]
              }}
              options={pieChartOptions}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {agencies.map(agency => (
          <div key={agency.id} className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center">
                <Building2 className="h-6 w-6 text-[#8B4513] mr-2" />
                <button
                  onClick={() => handleAgencyClick(agency.name)}
                  className="font-bold text-lg hover:text-[#8B4513] transition-colors cursor-pointer"
                >
                  {agency.name}
                </button>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handleAgencyClick(agency.name)}
                  className="p-2 text-gray-600 hover:text-[#8B4513] transition-colors"
                  title="Voir les détails"
                >
                  <Eye className="h-5 w-5" />
                </button>
                <div className={`flex items-center ${
                  agency.percentageChange >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {agency.percentageChange >= 0 ? (
                    <TrendingUp className="h-5 w-5 mr-1" />
                  ) : (
                    <TrendingDown className="h-5 w-5 mr-1" />
                  )}
                  <span>{Math.abs(agency.percentageChange).toFixed(1)}%</span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div>
                <span className="text-gray-600">Ventes du jour:</span>
                <span className="float-right font-bold">
                  {Math.round(agency.todaySales).toLocaleString()} Fcfa
                </span>
              </div>
              <div>
                <span className="text-gray-600">Ventes d'hier:</span>
                <span className="float-right">
                  {Math.round(agency.yesterdaySales).toLocaleString()} Fcfa
                </span>
              </div>
            </div>

            <div className="mt-4 h-32 cursor-pointer" onClick={() => handleGraphClick(agency.name)}>
              <Line
                key={`line-${agency.name}-${agency.hourlyData.join('-')}`}
                data={{
                  labels: Array.from({ length: 24 }, (_, i) => `${i}h`),
                  datasets: [
                    {
                      label: "Aujourd'hui",
                      data: agency.hourlyData,
                      borderColor: '#9333EA',
                      backgroundColor: 'rgba(147, 51, 234, 0.1)',
                      fill: true,
                      tension: 0.4
                    },
                    {
                      label: "Hier",
                      data: agency.yesterdayHourlyData,
                      borderColor: '#6366F1',
                      backgroundColor: 'rgba(99, 102, 241, 0.1)',
                      borderDash: [5, 5],
                      fill: true,
                      tension: 0.4
                    }
                  ]
                }}
                options={chartOptions}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <div className="flex justify-between items-center mb-6">
          <button
            onClick={() => setShowInventory(!showInventory)}
            className="flex items-center text-[#8B4513] hover:text-[#663300] font-bold text-xl"
          >
            <h3>État des Stocks par Agence</h3>
            {showInventory ? (
              <ChevronUp className="h-6 w-6 ml-2" />
            ) : (
              <ChevronDown className="h-6 w-6 ml-2" />
            )}
          </button>
          {showInventory && (
            <button
              onClick={generateInventoryPDF}
              className="flex items-center px-4 py-2 bg-[#8B4513] text-white rounded-lg hover:bg-[#663300]"
            >
              <Printer className="h-5 w-5 mr-2" />
              Imprimer PDF
            </button>
          )}
        </div>
        
        {showInventory && (
          inventoryLoading ? (
            <div className="flex justify-center items-center h-32">
              <Loader2 className="h-8 w-8 animate-spin text-[#8B4513]" />
            </div>
          ) : inventoryError ? (
            <div className="bg-red-50 text-red-600 p-4 rounded-lg">
              {inventoryError}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-6 py-3 text-left text-gray-500 font-medium">Produit</th>
                    {agencies.map(agency => (
                      <th key={agency.id} className="px-6 py-3 text-right text-gray-500 font-medium">
                        {agency.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {inventory.map(product => (
                    <tr key={product.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 font-medium">{product.name}</td>
                      {agencies.map(agency => (
                        <td key={agency.id} className="px-6 py-4 text-right">
                          {product.stockParAgence[agency.name] === 0 ? (
                            <span className="text-red-600">No stock</span>
                          ) : (
                            product.stockParAgence[agency.name]?.toLocaleString() || 'No stock'
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="flex-grow">
            <label className="block text-gray-700 font-medium mb-2">
              Agences
            </label>
            <div className="flex flex-wrap gap-2">
              {agencies.map(agency => (
                <label key={agency.id} className="inline-flex items-center">
                  <input
                    type="checkbox"
                    checked={selectedAgencies.includes(agency.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedAgencies([...selectedAgencies, agency.id]);
                      } else {
                        setSelectedAgencies(selectedAgencies.filter(id => id !== agency.id));
                      }
                    }}
                    className="rounded border-gray-300 text-[#8B4513] focus:ring-[#8B4513]"
                  />
                  <span className="ml-2">{agency.name}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex gap-4">
            <div>
              <label className="block text-gray-700 font-medium mb-2">
                Date de début
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="date"
                  value={dateRange.start}
                  onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                  className="pl-10 p-2 border border-gray-300 rounded-lg focus:ring-[#8B4513] focus:border-[#8B4513]"
                />
              </div>
            </div>
            <div>
              <label className="block text-gray-700 font-medium mb-2">
                Date de fin
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="date"
                  value={dateRange.end}
                  onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                  className="pl-10 p-2 border border-gray-300 rounded-lg focus:ring-[#8B4513] focus:border-[#8B4513]"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="h-[400px] cursor-pointer" onClick={() => handleGraphClick()}>
          <Line
            key={`line-all-${selectedAgencies.join('-')}`}
            data={{
              labels: Array.from({ length: 24 }, (_, i) => `${i}h`),
              datasets: agencies
                .filter(agency => selectedAgencies.includes(agency.id))
                .map((agency, index) => ({
                  label: agency.name,
                  data: agency.hourlyData,
                  borderColor: `hsl(${index * 360 / agencies.length}, 70%, 50%)`,
                  backgroundColor: `hsla(${index * 360 / agencies.length}, 70%, 50%, 0.1)`,
                  fill: true,
                  tension: 0.4
                }))
            }}
            options={chartOptions}
          />
        </div>
      </div>

      {fullscreenGraph.visible && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-[95vw] h-[90vh] p-6 relative">
            <button
              onClick={() => setFullscreenGraph({ visible: false, data: null })}
              className="absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-full"
            >
              <X className="h-6 w-6" />
            </button>
            <h3 className="text-xl font-bold mb-4">
              {fullscreenGraph.agency ? 
                `Évolution des ventes - ${fullscreenGraph.agency}` : 
                'Comparaison des ventes par agence'}
            </h3>
            <div className="h-[calc(90vh-100px)]">
              <Line
                key={`fullscreen-${fullscreenGraph.agency || 'all'}`}
                data={fullscreenGraph.data}
                options={chartOptions}
              />
            </div>
          </div>
        </div>
      )}

      {selectedAgencyForDetails && (
        <AgencyDetailsModal
          agencyName={selectedAgencyForDetails}
          onClose={() => setSelectedAgencyForDetails(null)}
        />
      )}
    </div>
  );
};

export default CentralizedAdmin;