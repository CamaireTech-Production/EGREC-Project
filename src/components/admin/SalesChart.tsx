import React, { useState, useEffect } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ChartData,
  Filler
} from 'chart.js';
import { collection, query, where, getDocs, Timestamp, doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../../lib/firebase';
import { format, startOfDay, endOfDay, subDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import { TrendingUp, TrendingDown, Activity } from 'lucide-react';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const SalesChart: React.FC = () => {
  const [chartData, setChartData] = useState<ChartData<'line'>>({
    labels: [],
    datasets: []
  });
  const [todayTotal, setTodayTotal] = useState(0);
  const [yesterdayTotal, setYesterdayTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [userAgency, setUserAgency] = useState<string | null>(null);
  const [userCompany, setUserCompany] = useState<string | null>(null);

  // Fetch user data first
  useEffect(() => {
    const fetchUserData = async () => {
      if (!auth.currentUser) return;
      try {
        const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          setUserAgency(data.agencyName || null);
          setUserCompany(data.company || null);
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
      }
    };

    fetchUserData();
  }, []);

  useEffect(() => {
    const fetchSalesData = async () => {
      if (!userCompany || !userAgency) return;

      try {
        const today = new Date();
        const yesterday = subDays(today, 1);

        const hourlyDataToday = Array(24).fill(0);
        const hourlyDataYesterday = Array(24).fill(0);

        const todayStart = startOfDay(today);
        const todayEnd = endOfDay(today);
        const todayQuery = query(
          collection(db, 'ventes'),
          where('company', '==', userCompany),
          where('agency', '==', userAgency),
          where('timestamp', '>=', Timestamp.fromDate(todayStart)),
          where('timestamp', '<=', Timestamp.fromDate(todayEnd))
        );

        const yesterdayStart = startOfDay(yesterday);
        const yesterdayEnd = endOfDay(yesterday);
        const yesterdayQuery = query(
          collection(db, 'ventes'),
          where('company', '==', userCompany),
          where('agency', '==', userAgency),
          where('timestamp', '>=', Timestamp.fromDate(yesterdayStart)),
          where('timestamp', '<=', Timestamp.fromDate(yesterdayEnd))
        );

        const [todaySnapshot, yesterdaySnapshot] = await Promise.all([
          getDocs(todayQuery),
          getDocs(yesterdayQuery)
        ]);

        let todaySum = 0;
        todaySnapshot.forEach(doc => {
          const data = doc.data();
          const hour = new Date(data.timestamp.toDate()).getHours();
          const amount = data.totalAmount || 0;
          hourlyDataToday[hour] += amount;
          todaySum += amount;
        });

        let yesterdaySum = 0;
        yesterdaySnapshot.forEach(doc => {
          const data = doc.data();
          const hour = new Date(data.timestamp.toDate()).getHours();
          const amount = data.totalAmount || 0;
          hourlyDataYesterday[hour] += amount;
          yesterdaySum += amount;
        });

        setTodayTotal(todaySum);
        setYesterdayTotal(yesterdaySum);

        const labels = Array.from({ length: 24 }, (_, i) => `${i}h`);
        
        setChartData({
          labels,
          datasets: [
            {
              label: "Aujourd'hui",
              data: hourlyDataToday,
              borderColor: 'rgb(147, 51, 234)',
              backgroundColor: 'rgba(147, 51, 234, 0.1)',
              borderWidth: 2,
              tension: 0.4,
              fill: true,
              pointRadius: 0,
              pointHoverRadius: 4,
              pointHoverBackgroundColor: 'rgb(147, 51, 234)',
              pointHoverBorderColor: 'white',
              pointHoverBorderWidth: 2
            },
            {
              label: 'Hier',
              data: hourlyDataYesterday,
              borderColor: 'rgb(99, 102, 241)',
              backgroundColor: 'rgba(99, 102, 241, 0.1)',
              borderWidth: 2,
              tension: 0.4,
              fill: true,
              pointRadius: 0,
              pointHoverRadius: 4,
              pointHoverBackgroundColor: 'rgb(99, 102, 241)',
              pointHoverBorderColor: 'white',
              pointHoverBorderWidth: 2
            }
          ]
        });

        setLoading(false);
      } catch (error) {
        console.error('Error fetching sales data:', error);
        setLoading(false);
      }
    };

    fetchSalesData();
  }, [userCompany, userAgency]);

  const percentageChange = yesterdayTotal > 0 
    ? ((todayTotal - yesterdayTotal) / yesterdayTotal) * 100 
    : 0;
  
  const absoluteChange = todayTotal - yesterdayTotal;

  if (loading) {
    return (
      <div className="animate-pulse bg-white rounded-2xl shadow-sm p-6">
        <div className="h-[400px] bg-gray-100 rounded-xl"></div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm p-6">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <Activity className="h-6 w-6 text-purple-600" />
          <h3 className="font-semibold text-xl text-gray-900">Évolution des Ventes</h3>
        </div>
        <div className="text-sm text-gray-500">
          {format(new Date(), 'dd MMMM yyyy', { locale: fr })}
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 animate-fade-in">
        <div className="bg-gray-50 rounded-xl p-4 transform hover:scale-[1.02] transition-transform">
          <div className="text-sm font-medium text-gray-500 mb-2">Chiffre du jour</div>
          <div className="text-2xl font-semibold text-gray-900">
            {new Intl.NumberFormat('fr-FR', {
              style: 'currency',
              currency: 'XOF'
            }).format(todayTotal)}
          </div>
        </div>

        <div className="bg-gray-50 rounded-xl p-4 transform hover:scale-[1.02] transition-transform">
          <div className="text-sm font-medium text-gray-500 mb-2">Chiffre de la veille</div>
          <div className="text-2xl font-semibold text-gray-900">
            {new Intl.NumberFormat('fr-FR', {
              style: 'currency',
              currency: 'XOF'
            }).format(yesterdayTotal)}
          </div>
        </div>

        <div className={`rounded-xl p-4 transform hover:scale-[1.02] transition-transform ${
          percentageChange >= 0 ? 'bg-green-50' : 'bg-red-50'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-medium text-gray-500">Évolution</div>
            {percentageChange >= 0 ? (
              <TrendingUp className="h-5 w-5 text-green-600" />
            ) : (
              <TrendingDown className="h-5 w-5 text-red-600" />
            )}
          </div>
          <div className="space-y-1">
            <div className={`text-2xl font-semibold ${
              percentageChange >= 0 ? 'text-green-600' : 'text-red-600'
            }`}>
              {percentageChange.toFixed(1)}%
            </div>
            <div className={`text-sm font-medium ${
              percentageChange >= 0 ? 'text-green-600' : 'text-red-600'
            }`}>
              {absoluteChange >= 0 ? '+' : ''}
              {new Intl.NumberFormat('fr-FR', {
                style: 'currency',
                currency: 'XOF'
              }).format(absoluteChange)}
            </div>
          </div>
        </div>
      </div>

      <div className="h-[300px]">
        <Line
          data={chartData}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
              mode: 'index',
              intersect: false,
            },
            plugins: {
              legend: {
                position: 'top',
                align: 'end',
                labels: {
                  usePointStyle: true,
                  pointStyle: 'circle',
                  padding: 20,
                  font: {
                    family: "'Inter', sans-serif",
                    size: 12
                  }
                }
              },
              tooltip: {
                backgroundColor: 'white',
                titleColor: 'rgb(17, 24, 39)',
                bodyColor: 'rgb(107, 114, 128)',
                borderColor: 'rgb(229, 231, 235)',
                borderWidth: 1,
                padding: 12,
                bodyFont: {
                  family: "'Inter', sans-serif",
                  size: 12
                },
                titleFont: {
                  family: "'Inter', sans-serif",
                  size: 12,
                  weight: '600'
                },
                mode: 'index',
                intersect: false,
                callbacks: {
                  label: function(context) {
                    let label = context.dataset.label || '';
                    if (label) {
                      label += ': ';
                    }
                    if (context.parsed.y !== null) {
                      label += new Intl.NumberFormat('fr-FR', {
                        style: 'currency',
                        currency: 'XOF'
                      }).format(context.parsed.y);
                    }
                    return label;
                  }
                }
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
                    size: 12
                  }
                }
              },
              y: {
                beginAtZero: true,
                border: {
                  display: false
                },
                grid: {
                  color: 'rgb(243, 244, 246)'
                },
                ticks: {
                  font: {
                    family: "'Inter', sans-serif",
                    size: 12
                  },
                  callback: function(value) {
                    return new Intl.NumberFormat('fr-FR', {
                      style: 'currency',
                      currency: 'XOF',
                      notation: 'compact'
                    }).format(Number(value));
                  }
                }
              }
            }
          }}
        />
      </div>
    </div>
  );
};

export default SalesChart;