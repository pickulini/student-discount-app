import React, { useState, useEffect } from 'react';
import api from '../api/client';

const MerchantStatistics = () => {
  const [balance, setBalance] = useState(null);
  const [offers, setOffers] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/merchant/balance'),
      api.get('/merchant/offers'),
      api.get('/merchant/transactions?limit=20'),
    ])
      .then(([balanceRes, offersRes, txRes]) => {
        setBalance(balanceRes.data);
        setOffers(offersRes.data || []);
        setTransactions(txRes.data || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-center py-8">Загрузка...</div>;
  if (!balance) return <div className="text-center py-8 text-red-500">Не удалось загрузить данные</div>;

  // Агрегация по предложениям
  const totalUses = offers.reduce((sum, o) => sum + (o.current_uses || 0), 0);
  const publishedOffers = offers.filter(o => o.status === 'published').length;
  const pendingOffers = offers.filter(o => o.status === 'pending_review').length;
  const draftOffers = offers.filter(o => o.status === 'draft').length;

  // Топ-5 предложений по использованиям
  const topOffers = [...offers]
    .sort((a, b) => (b.current_uses || 0) - (a.current_uses || 0))
    .slice(0, 5);

  // Считаем gross / refunds / net за последние 30 дней
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const recentTx = transactions.filter(t => new Date(t.created_at) >= thirtyDaysAgo);

  const recentGross = recentTx
    .filter(t => t.type === 'order_earning')
    .reduce((sum, t) => sum + t.amount, 0);

  const recentRefunds = recentTx
    .filter(t => t.type === 'refund')
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);

  const recentNet = recentGross - recentRefunds;

  const maxUses = Math.max(...topOffers.map(o => o.current_uses || 0), 1);

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Статистика партнёра</h2>

      {/* Верхние карточки */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-blue-100 p-4 rounded shadow">
          <p className="text-sm text-gray-600">Общий баланс</p>
          <p className="text-3xl font-bold">{balance.total_balance || 0} ₽</p>
        </div>
        <div className="bg-green-100 p-4 rounded shadow">
          <p className="text-sm text-gray-600">Начислено за 30 дней</p>
          <p className="text-3xl font-bold">{recentGross.toFixed(0)} ₽</p>
        </div>
        <div className="bg-red-100 p-4 rounded shadow">
          <p className="text-sm text-gray-600">Возвраты за 30 дней</p>
          <p className="text-3xl font-bold">-{recentRefunds.toFixed(0)} ₽</p>
        </div>
        <div className="bg-purple-100 p-4 rounded shadow">
          <p className="text-sm text-gray-600">Чистыми за 30 дней</p>
          <p className={`text-3xl font-bold ${recentNet >= 0 ? 'text-green-700' : 'text-red-700'}`}>
            {recentNet.toFixed(0)} ₽
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-gray-100 p-4 rounded shadow">
          <p className="text-sm text-gray-600">Всего использований</p>
          <p className="text-2xl font-bold">{totalUses}</p>
        </div>
        <div className="bg-gray-100 p-4 rounded shadow">
          <p className="text-sm text-gray-600">Предложений</p>
          <p className="text-2xl font-bold">{offers.length}</p>
        </div>
      </div>

      {/* По компаниям */}
      {balance.companies && balance.companies.length > 0 && (
        <div className="bg-white rounded shadow p-4 mb-6">
          <h3 className="text-lg font-semibold mb-3">Баланс по компаниям</h3>
          <div className="space-y-2">
            {balance.companies.map(c => (
              <div key={c.company_id} className="flex justify-between items-center border-b pb-2">
                <span className="text-gray-700">{c.company_name}</span>
                <span className="font-semibold text-green-600">{c.balance} ₽</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Статусы предложений */}
      <div className="bg-white rounded shadow p-4 mb-6">
        <h3 className="text-lg font-semibold mb-3">Статусы предложений</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <p className="text-3xl font-bold text-green-600">{publishedOffers}</p>
            <p className="text-sm text-gray-600">Опубликовано</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-yellow-600">{pendingOffers}</p>
            <p className="text-sm text-gray-600">На модерации</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-gray-500">{draftOffers}</p>
            <p className="text-sm text-gray-600">Черновиков</p>
          </div>
        </div>
      </div>

      {/* Топ-5 предложений */}
      <div className="bg-white rounded shadow p-4 mb-6">
        <h3 className="text-lg font-semibold mb-3">Топ-5 предложений по использованию</h3>
        {topOffers.length === 0 ? (
          <p className="text-gray-500 text-sm">Нет предложений</p>
        ) : (
          <div className="space-y-3">
            {topOffers.map(o => (
              <div key={o.id}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-700 truncate mr-2">{o.title}</span>
                  <span className="font-semibold whitespace-nowrap">{o.current_uses || 0} раз</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full transition-all"
                    style={{ width: `${((o.current_uses || 0) / maxUses) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Последние транзакции */}
      <div className="bg-white rounded shadow p-4">
        <h3 className="text-lg font-semibold mb-3">Последние транзакции</h3>
        {transactions.length === 0 ? (
          <p className="text-gray-500 text-sm">Нет транзакций</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-gray-100">
                  <th className="p-2 text-left">Дата</th>
                  <th className="p-2 text-left">Тип</th>
                  <th className="p-2 text-right">Сумма</th>
                  <th className="p-2 text-left">Статус</th>
                </tr>
              </thead>
              <tbody>
                {transactions.slice(0, 10).map(tx => (
                  <tr key={tx.id} className="border-b">
                    <td className="p-2">{new Date(tx.created_at).toLocaleString('ru-RU')}</td>
                    <td className="p-2">
                      {tx.type === 'order_earning' ? '💰 Заработок' :
                       tx.type === 'refund' ? '↩️ Возврат' :
                       tx.type === 'settlement' ? '📤 Выплата' :
                       tx.type}
                    </td>
                    <td className={`p-2 text-right font-semibold ${
                      tx.amount >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {tx.amount >= 0 ? '+' : ''}{tx.amount} ₽
                    </td>
                    <td className="p-2">
                      <span className={`px-2 py-1 rounded text-white text-xs ${
                        tx.status === 'completed' ? 'bg-green-500' : 'bg-yellow-500'
                      }`}>
                        {tx.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default MerchantStatistics;
