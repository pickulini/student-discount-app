import React, { useState, useEffect } from 'react';
import api from '../api/client';

const MerchantTransactions = () => {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/merchant/transactions')
      .then(res => setTransactions(res.data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div>Загрузка...</div>;

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Все транзакции</h2>
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
              transactions.map(tx => (
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
  );
};

export default MerchantTransactions;
