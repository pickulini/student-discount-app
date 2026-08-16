import React, { useState, useEffect } from 'react';
import api from '../api/client';

const TransactionHistory = () => {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/users/transactions')
      .then(res => { setTransactions(res.data || []); })
      .catch(err => { console.error('Failed to load transactions:', err); setError('Не удалось загрузить историю'); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-center py-8">Загрузка...</div>;
  if (error) return <div className="text-center py-8 text-red-500">{error}</div>;

  return (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-4">История операций</h2>
      <div className="bg-white rounded shadow overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-100">
              <th className="p-3 text-left">Дата</th>
              <th className="p-3 text-left">Тип</th>
              <th className="p-3 text-left">Описание</th>
              <th className="p-3 text-right">Сумма</th>
              <th className="p-3 text-left">Статус</th>
            </tr>
          </thead>
          <tbody>
            {transactions.length === 0 ? (
              <tr><td colSpan="5" className="p-4 text-center text-gray-500">Нет операций</td></tr>
            ) : (
              transactions.map(tx => (
                <tr key={tx.id} className="border-b hover:bg-gray-50">
                  <td className="p-3">{new Date(tx.created_at).toLocaleString()}</td>
                  <td className="p-3">{tx.type}</td>
                  <td className="p-3">{tx.description}</td>
                  <td className={`p-3 text-right font-semibold ${tx.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {tx.amount >= 0 ? '+' : ''}{tx.amount} ₽
                  </td>
                  <td className="p-3">
                    <span className={`px-2 py-1 rounded text-white text-sm ${
                      tx.status === 'completed' ? 'bg-green-500' :
                      tx.status === 'pending' ? 'bg-yellow-500' : 'bg-red-500'
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
  );
};

export default TransactionHistory;
