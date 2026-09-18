import React, { useState, useEffect } from 'react';
import api from '../api/client';
import UserLink from './UserLink';

const UserStatsModal = ({ userId, onClose }) => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refundingId, setRefundingId] = useState(null);

  const fetchStats = () => {
    if (!userId) return;
    setLoading(true);
    api.get(`/admin/users/${userId}/stats`)
      .then(res => setStats(res.data))
      .catch(err => console.error('Failed to load user stats:', err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchStats();
  }, [userId]);

  const handleRefund = async (orderId) => {
    const reason = window.prompt('Причина возврата (например, "Услуга не оказана"):');
    if (reason === null) return;
    if (!reason.trim()) {
      alert('Укажите причину возврата');
      return;
    }
    if (!window.confirm(`Вернуть деньги за заказ №${orderId}? Действие необратимо.`)) return;
    setRefundingId(orderId);
    try {
      await api.post(`/orders/${orderId}/refund`, { reason });
      alert('Возврат выполнен');
      fetchStats();
    } catch (err) {
      alert('Ошибка возврата: ' + (err.response?.data?.error || err.message));
    } finally {
      setRefundingId(null);
    }
  };

  if (!userId) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="p-6">
          <div className="flex justify-between items-start">
            <h2 className="text-2xl font-bold">Статистика пользователя</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">✕</button>
          </div>

          {loading ? (
            <div className="py-8 text-center">Загрузка...</div>
          ) : stats ? (
            <>
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <strong>Имя:</strong> {stats.user.full_name}
                  {stats.user.username && (
                    <span className="ml-2"><UserLink username={stats.user.username} /></span>
                  )}
                </div>
                <div><strong>Email:</strong> {stats.user.email}</div>
                <div><strong>Статус студента:</strong> {stats.user.student_status}</div>
                <div><strong>Баланс:</strong> {stats.balance} ₽</div>
                <div><strong>Бонусный баланс:</strong> {stats.bonus_balance}</div>
              </div>

              <div className="mt-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <div className="bg-blue-100 p-3 rounded">
                  <strong className="text-sm">Пополнено</strong>
                  <div className="text-lg font-semibold">{stats.total_deposits} ₽</div>
                </div>
                <div className="bg-red-100 p-3 rounded">
                  <strong className="text-sm">Потрачено (gross)</strong>
                  <div className="text-lg font-semibold">{stats.total_purchases} ₽</div>
                </div>
                <div className="bg-orange-100 p-3 rounded">
                  <strong className="text-sm">Возвраты</strong>
                  <div className="text-lg font-semibold">-{stats.total_refunds ?? 0} ₽</div>
                </div>
                <div className="bg-green-100 p-3 rounded">
                  <strong className="text-sm">Чистыми</strong>
                  <div className="text-lg font-semibold">{stats.net_purchases ?? stats.total_purchases} ₽</div>
                </div>
                <div className="bg-purple-100 p-3 rounded">
                  <strong className="text-sm">Заказов</strong>
                  <div className="text-lg font-semibold">
                    {stats.total_orders}
                    {stats.refunded_orders > 0 && (
                      <span className="text-xs text-red-600 ml-1">(-{stats.refunded_orders})</span>
                    )}
                  </div>
                </div>
                <div className="bg-yellow-100 p-3 rounded">
                  <strong className="text-sm">Бонусов заработано</strong>
                  <div className="text-lg font-semibold">{stats.bonus_earned}</div>
                </div>
              </div>

              {/* Заказы с кнопкой возврата */}
              <h3 className="text-xl font-semibold mt-6 mb-2">Заказы</h3>
              <div className="overflow-x-auto mb-6">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="p-2 text-left">ID</th>
                      <th className="p-2 text-left">Дата</th>
                      <th className="p-2 text-right">Сумма</th>
                      <th className="p-2 text-left">Статус</th>
                      <th className="p-2 text-left">Действие</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.orders && stats.orders.length > 0 ? (
                      stats.orders.map(o => (
                        <tr key={o.id} className="border-b">
                          <td className="p-2">{o.id}</td>
                          <td className="p-2">{new Date(o.created_at).toLocaleString()}</td>
                          <td className="p-2 text-right">{o.total_amount} ₽</td>
                          <td className="p-2">
                            <span className={`px-2 py-1 rounded text-white text-xs ${
                              o.status === 'paid' ? 'bg-green-500' :
                              o.status === 'completed' ? 'bg-blue-500' :
                              o.status === 'cancelled' ? 'bg-red-500' :
                              o.status === 'refunded' ? 'bg-gray-500' : 'bg-yellow-500'
                            }`}>
                              {o.status}
                            </span>
                          </td>
                          <td className="p-2">
                            {(o.status === 'paid' || o.status === 'completed') && (
                              <button
                                onClick={() => handleRefund(o.id)}
                                disabled={refundingId === o.id}
                                className="bg-red-500 text-white px-2 py-1 rounded text-xs hover:bg-red-600 disabled:opacity-50"
                              >
                                {refundingId === o.id ? '...' : 'Вернуть'}
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr><td colSpan="5" className="p-4 text-center text-gray-500">Нет заказов</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* История транзакций */}
              <h3 className="text-xl font-semibold mt-6 mb-2">Последние операции</h3>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="p-2 text-left">Дата</th>
                      <th className="p-2 text-left">Тип</th>
                      <th className="p-2 text-left">Описание</th>
                      <th className="p-2 text-right">Сумма</th>
                      <th className="p-2 text-left">Статус</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.transactions && stats.transactions.length > 0 ? (
                      stats.transactions.map(tx => (
                        <tr key={tx.id} className="border-b">
                          <td className="p-2">{new Date(tx.created_at).toLocaleString()}</td>
                          <td className="p-2">{tx.type}</td>
                          <td className="p-2">{tx.description}</td>
                          <td className={`p-2 text-right font-semibold ${tx.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {tx.amount >= 0 ? '+' : ''}{tx.amount} ₽
                          </td>
                          <td className="p-2">{tx.status}</td>
                        </tr>
                      ))
                    ) : (
                      <tr><td colSpan="5" className="p-4 text-center text-gray-500">Нет операций</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="py-8 text-center text-red-500">Не удалось загрузить данные</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserStatsModal;
