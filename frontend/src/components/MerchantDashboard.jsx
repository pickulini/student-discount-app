import React, { useState, useEffect } from 'react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Card, PageTitle, Eyebrow, Badge } from '../design/UI';
import { RouteLoadingView } from '../design/DottedPath';

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

  if (loading) return <RouteLoadingView label="Загрузка..." />;

  return (
    <div>
      <PageTitle>Добро пожаловать, {user.full_name}!</PageTitle>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <Card className="p-4">
          <Eyebrow>Общий баланс</Eyebrow>
          <p className="text-editorial text-3xl text-ink mt-1">{balance.total_balance || 0} ₽</p>
        </Card>
        <Card className="p-4">
          <Eyebrow>Количество компаний</Eyebrow>
          <p className="text-editorial text-3xl text-ink mt-1">{balance.companies?.length || 0}</p>
        </Card>
      </div>

      {balance.companies && balance.companies.length > 0 && (
        <div className="mb-6">
          <Eyebrow className="mb-2">Баланс по компаниям</Eyebrow>
          <Card className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-line">
                  <th className="p-3 text-left text-eyebrow">Компания</th>
                  <th className="p-3 text-right text-eyebrow">Баланс</th>
                </tr>
              </thead>
              <tbody>
                {balance.companies.map(c => (
                  <tr key={c.company_id} className="border-b border-line last:border-0">
                    <td className="p-3 text-ink">{c.company_name}</td>
                    <td className="p-3 text-right text-caption text-ink">{c.balance} ₽</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      )}

      <div>
        <Eyebrow className="mb-2">Последние транзакции</Eyebrow>
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
                transactions.slice(0, 10).map(tx => (
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
    </div>
  );
};

export default MerchantDashboard;
