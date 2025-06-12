import React, { useState, useEffect } from 'react';
import { collection, query, where, orderBy, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { useUser } from '../../../context/UserContext';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { fr } from 'date-fns/locale';
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
import { Line, Bar, Pie } from 'react-chartjs-2';
import { Loader2, TrendingUp, TrendingDown } from 'lucide-react';
import { toast } from 'react-hot-toast';

// Register Chart.js components
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

const ExpenseDashboard: React.FC = () => {
  const { user } = useUser();
  const [loading, setLoading] = useState(true);
  const [todayTotal, setTodayTotal] = useState(0);
  const [yesterdayTotal, setYesterdayTotal] = useState(0);
  const [dateRange, setDateRange] = useState({
    start: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
    end: format(new Date(), 'yyyy-MM-dd')
  });
  const [expensesByType, setExpensesByType] = useState<{ [key: string]: number }>({});
  const [dailyExpenses, setDailyExpenses] = useState<{ date: string; amount: number }[]>([]);

  useEffect(() => {
    const fetchExpenseData = async () => {
      if (!user?.company || !user?.agencyName) return;

      setLoading(true);
      try {
        const today = new Date();
        const yesterday = subDays(today, 1);

        // Query for today's expenses
        const todayQuery = query(
          collection(db, 'expenses'),
          where('company', '==', user.company),
          where('agencyName', '==', user.agencyName),
          where('date', '>=', Timestamp.fromDate(startOfDay(today))),
          where('date', '<=', Timestamp.fromDate(endOfDay(today)))
        );

        // Query for yesterday's expenses
        const yesterdayQuery = query(
          collection(db, 'expenses'),
          where('company', '==', user.company),
          where('agencyName', '==', user.agencyName),
          where('date', '>=', Timestamp.fromDate(startOfDay(yesterday))),
          where('date', '<=', Timestamp.fromDate(endOfDay(yesterday)))
        );

        // Query for date range expenses
        const rangeStart = new Date(dateRange.start);
        const rangeEnd = new Date(dateRange.end);
        const rangeQuery = query(
          collection(db, 'expenses'),
          where('company', '==', user.company),
          where('agencyName', '==', user.agencyName),
          where('date', '>=', Timestamp.fromDate(startOfDay(rangeStart))),
          where('date', '<=', Timestamp.fromDate(endOfDay(rangeEnd))),
          orderBy('date', 'asc')
        );

        const [todaySnapshot, yesterdaySnapshot, rangeSnapshot] = await Promise.all([
          getDocs(todayQuery),
          getDocs(yesterdayQuery),
          getDocs(rangeQuery)
        ]);

        // Calculate totals
        const todaySum = todaySnapshot.docs.reduce((sum, doc) => sum + doc.data().amount, 0);
        const yesterdaySum = yesterdaySnapshot.docs.reduce((sum, doc) => sum + doc.data().amount, 0);

        // Process range data
        const expensesByDate = new Map<string, number>();
        const typeAmounts: { [key: string]: number } = {};

        rangeSnapshot.forEach(doc => {
          const data = doc.data();
          const date = format(data.date.toDate(), 'yyyy-MM-dd');
          expensesByDate.set(date, (expensesByDate.get(date) || 0) + data.amount);
          typeAmounts[data.type] = (typeAmounts[data.type] || 0) + data.amount;
        });

        const dailyData = Array.from(expensesByDate.entries())
          .map(([date, amount]) => ({ date, amount }))
          .sort((a, b) => a.date.localeCompare(b.date));

        setTodayTotal(todaySum);
        setYesterdayTotal(yesterdaySum);
        setDailyExpenses(dailyData);
        setExpensesByType(typeAmounts);
      } catch (error) {
        console.error('Error fetching expense data:', error);
        toast.error('Erreur lors du chargement des données');
      } finally {
        setLoading(false);
      }
    };

    fetchExpenseData();
  }, [user, dateRange]);

  const percentageChange = yesterdayTotal > 0 
    ? ((todayTotal - yesterdayTotal) / yesterdayTotal) * 100 
    : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-[#8B4513]" />
      </div>
    );
  }

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
      },
    },
  };

  const lineChartData = {
    labels: dailyExpenses.map(d => format(new Date(d.date), 'dd/MM')),
    datasets: [
      {
        label: 'Dépenses Journalières',
        data: dailyExpenses.map(d => d.amount),
        borderColor: '#8B4513',
        backgroundColor: 'rgba(139, 69, 19, 0.1)',
        fill: true,
      },
    ],
  };

  const pieChartData = {
    labels: Object.keys(expensesByType).map(type => {
      switch (type) {
        case 'operational': return 'Opérationnelle';
        case 'maintenance': return 'Maintenance';
        case 'supplies': return 'Fournitures';
        case 'other': return 'Autre';
        default: return type;
      }
    }),
    datasets: [
      {
        data: Object.values(expensesByType),
        backgroundColor: [
          '#8B4513',
          '#CD853F',
          '#DEB887',
          '#F4A460',
        ],
      },
    ],
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold mb-4">Dépenses du Jour</h3>
          <p className="text-2xl font-bold">{Math.round(todayTotal).toLocaleString()} Fcfa</p>
          <div className="mt-2 flex items-center">
            {percentageChange !== 0 && (
              <>
                {percentageChange > 0 ? (
                  <TrendingUp className="h-5 w-5 text-red-500 mr-1" />
                ) : (
                  <TrendingDown className="h-5 w-5 text-green-500 mr-1" />
                )}
                <span className={percentageChange > 0 ? 'text-red-500' : 'text-green-500'}>
                  {Math.abs(percentageChange).toFixed(1)}% par rapport à hier
                </span>
              </>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold mb-4">Période d'Analyse</h3>
          <div className="flex gap-4">
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
              className="flex-1 p-2 border border-gray-300 rounded-lg"
            />
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
              className="flex-1 p-2 border border-gray-300 rounded-lg"
            />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold mb-4">Total Période</h3>
          <p className="text-2xl font-bold">
            {dailyExpenses.reduce((sum, day) => sum + day.amount, 0).toLocaleString()} Fcfa
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold mb-4">Évolution des Dépenses</h3>
          <div className="h-[300px]">
            <Line data={lineChartData} options={chartOptions} />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold mb-4">Répartition par Type</h3>
          <div className="h-[300px]">
            <Pie data={pieChartData} options={chartOptions} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExpenseDashboard;