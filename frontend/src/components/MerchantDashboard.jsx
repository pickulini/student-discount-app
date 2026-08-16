import React, { useState, useEffect } from 'react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

const MerchantDashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [companiesRes, statsRes] = await Promise.all([
          api.get('/merchant/companies'),
          api.get('/merchant/statistics/daily?days=30')
        ]);
        setCompanies(companiesRes.data || []);
        setStats(statsRes.data || { daily: [] });
      } catch (err) {
        console.error('Failed to load merchant data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) return <div>Загрузка...</div>;

  // Вычисляем итоговые цифры из daily (если есть)
  let totalOrders = 0;
  let totalRevenue = 0;
  if (stats && stats.daily && stats.daily.length > 0) {
    stats.daily.forEach(item => {
      totalOrders += item.orders || 0;
      totalRevenue += item.revenue || 0;
    });
  }

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Добро пожаловать, {user.full_name}!</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-blue-100 p-4 rounded shadow">
          <p className="text-sm text-gray-600">Компании</p>
          <p className="text-3xl font-bold">{companies.length}</p>
        </div>
        <div className="bg-green-100 p-4 rounded shadow">
          <p className="text-sm text-gray-600">Всего заказов</p>
          <p className="text-3xl font-bold">{totalOrders}</p>
        </div>
        <div className="bg-purple-100 p-4 rounded shadow">
          <p className="text-sm text-gray-600">Выручка</p>
          <p className="text-3xl font-bold">{totalRevenue} ₽</p>
        </div>
      </div>
      {stats && stats.daily && stats.daily.length > 0 && (
        <div className="bg-white p-4 rounded shadow">
          <h3 className="font-semibold mb-2">Данные за последние 30 дней</h3>
          <pre className="text-sm">{JSON.stringify(stats.daily.slice(0, 5), null, 2)}</pre>
        </div>
      )}
    </div>
  );
};

export default MerchantDashboard;
