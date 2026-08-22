import React, { useState, useEffect } from 'react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

const MerchantDashboard = () => {
  const { user } = useAuth();
  const [balance, setBalance] = useState({ total_balance: 0, companies: [] });
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [balanceRes, txRes] = await Promise.all([
          api.get('/merchant/balance'),
          api.get('/merchant/transactions?limit=20'),
        ]);
        setBalance(balanceRes.data);
        setTransactions(txRes.data || []);
      } catch (err) {
        console.error('Failed to load merchant data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) return <div>Загрузка...</div>;

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Добро пожаловать, {user.full_name}!</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-blue-100 p-4 rounded shadow">
          <p className="text-sm text-gray-600">Общий баланс</p>
          <p className="text-3xl font-bold">{balance.total_balance || 0} ₽</p>
        </div>
        <div className="bg-green-100 p-4 rounded shadow">
          <p className="text-sm text-gray-600">Количество компаний</p>
          <p className="text-3xl font-bold">{balance.companies?.length || 0}</p>
        </div>
      </div>

      {balance.companies && balance.companies.length > 0 && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-2">Баланс по компаниям</h3>
          <div className="bg-white rounded shadow overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-100">
                  <th className="p-3 text-left">Компания</th>
                  <th className="p-3 text-right">Баланс</th>
                </tr>
              </thead>
              <tbody>
                {balance.companies.map(c => (
                  <tr key={c.company_id} className="border-b">
                    <td className="p-3">{c.company_name}</td>
                    <td className="p-3 text-right">{c.balance} ₽</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div>
        <h3 className="text-lg font-semibold mb-2">Последние транзакции</h3>
        <div className="bg-white rounded shadow overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-100">
                <th className="p-3 text-left">Дата</th>
                <th className="p-3 text-left">Тип</th>
                <th className="p-3 text-right">Сумма</th>
                <th className="p-3 text-left">Статус</th>
              </tr>
            </thead>
            <tbody>
              {transactions.length === 0 ? (
                <tr><td colSpan="4" className="p-4 text-center text-gray-500">Нет транзакций</td></tr>
              ) : (
                transactions.slice(0, 10).map(tx => (
                  <tr key={tx.id} className="border-b">
                    <td className="p-3">{new Date(tx.created_at).toLocaleString()}</td>
                    <td className="p-3">{tx.type}</td>
                    <td className="p-3 text-right font-semibold text-green-600">+{tx.amount} ₽</td>
                    <td className="p-3">
                      <span className={`px-2 py-1 rounded text-white text-sm ${
                        tx.status === 'completed' ? 'bg-green-500' : 'bg-yellow-500'
                      }`}>
                        {tx.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default MerchantDashboard;
