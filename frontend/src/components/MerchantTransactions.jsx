import React, { useState, useEffect } from 'react';
import api from '../api/client';
import { Card, PageTitle, Badge } from '../design/UI';
import { RouteLoadingView } from '../design/DottedPath';

const MerchantTransactions = () => {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/merchant/transactions')
      .then(res => setTransactions(res.data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <RouteLoadingView label="Загрузка..." />;

  return (
    <div>
      <PageTitle>Все транзакции</PageTitle>
      <Card className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-line">
              <th className="p-3 text-left text-eyebrow">Дата</th>
              <th className="p-3 text-left text-eyebrow">Тип</th>
              <th className="p-3 text-right text-eyebrow">Сумма</th>
              <th className="p-3 text-left text-eyebrow">Статус</th>
            </tr>
          </thead>
          <tbody>
            {transactions.length === 0 ? (
              <tr><td colSpan="4" className="p-4 text-center text-ink-soft">Нет транзакций</td></tr>
            ) : (
              transactions.map(tx => (
                <tr key={tx.id} className="border-b border-line last:border-0">
                  <td className="p-3 text-caption text-ink">{new Date(tx.created_at).toLocaleString()}</td>
                  <td className="p-3 text-ink">{tx.type}</td>
                  <td className="p-3 text-right text-caption text-accent">+{tx.amount} ₽</td>
                  <td className="p-3">
                    <Badge filled={tx.status === 'completed'}>{tx.status}</Badge>
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

export default MerchantTransactions;
