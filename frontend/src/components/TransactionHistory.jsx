import React, { useState, useEffect } from 'react';
import api from '../api/client';
import { Card, PageTitle } from '../design/UI';
import { RouteLoadingView } from '../design/DottedPath';

const statusColor = (status) =>
  status === 'completed' ? 'bg-accent/10 text-accent' :
  status === 'pending' ? 'bg-surface-2 text-ink-soft' : 'bg-danger/10 text-danger';

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

  if (loading) return <RouteLoadingView label="Загрузка..." />;
  if (error) return <div className="text-center py-8 text-danger">{error}</div>;

  return (
    <div className="max-w-4xl mx-auto">
      <PageTitle>История операций</PageTitle>
      <Card className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-line text-ink-soft">
              <th className="p-3 text-left font-medium">Дата</th>
              <th className="p-3 text-left font-medium">Тип</th>
              <th className="p-3 text-left font-medium">Описание</th>
              <th className="p-3 text-right font-medium">Сумма</th>
              <th className="p-3 text-left font-medium">Статус</th>
            </tr>
          </thead>
          <tbody>
            {transactions.length === 0 ? (
              <tr><td colSpan="5" className="p-4 text-center text-ink-soft">Нет операций</td></tr>
            ) : (
              transactions.map(tx => (
                <tr key={tx.id} className="border-b border-line last:border-0 hover:bg-surface-2 transition">
                  <td className="p-3 text-ink">{new Date(tx.created_at).toLocaleString()}</td>
                  <td className="p-3 text-ink">{tx.type}</td>
                  <td className="p-3 text-ink-soft">{tx.description}</td>
                  <td className={`p-3 text-right font-semibold ${tx.amount >= 0 ? 'text-accent' : 'text-danger'}`}>
                    {tx.amount >= 0 ? '+' : ''}{tx.amount} ₽
                  </td>
                  <td className="p-3">
                    <span className={`px-2 py-1 rounded-[var(--radius-xs)] text-xs font-medium ${statusColor(tx.status)}`}>
                      {tx.status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
};

export default TransactionHistory;
