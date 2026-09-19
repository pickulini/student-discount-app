import React, { useState, useEffect } from 'react';
import api from '../api/client';
import { Link } from 'react-router-dom';

const MerchantStatistics = () => {
  const [tab, setTab] = useState('overview'); // overview | events | offers
  const [balance, setBalance] = useState(null);
  const [offers, setOffers] = useState([]);
  const [events, setEvents] = useState([]);
  const [eventStats, setEventStats] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/merchant/balance').catch(() => ({ data: null })),
      api.get('/merchant/offers').catch(() => ({ data: [] })),
      api.get('/merchant/events').catch(() => ({ data: [] })),
      api.get('/merchant/events/stats').catch(() => ({ data: null })),
      api.get('/merchant/transactions?limit=20').catch(() => ({ data: [] })),
    ])
      .then(([b, o, e, es, tx]) => {
        setBalance(b.data);
        setOffers(o.data || []);
        setEvents(e.data || []);
        setEventStats(es.data);
        setTransactions(tx.data || []);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-center py-8">Загрузка...</div>;
  if (!balance) return <div className="text-center py-8 text-red-500">Не удалось загрузить данные</div>;

  // ---- Общая ----
  const totalUses = offers.reduce((sum, o) => sum + (o.current_uses || 0), 0);
  const publishedOffers = offers.filter(o => o.status === 'published').length;
  const pendingOffers = offers.filter(o => o.status === 'pending_review').length;
  const draftOffers = offers.filter(o => o.status === 'draft').length;

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

  const topOffers = [...offers]
    .sort((a, b) => (b.current_uses || 0) - (a.current_uses || 0))
    .slice(0, 5);
  const maxUses = Math.max(...topOffers.map(o => o.current_uses || 0), 1);

  const topEvents = eventStats?.top_events || [];
  const maxEventAttendees = Math.max(...topEvents.map(e => e.attendees_count || 0), 1);

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Статистика партнёра</h2>

      {/* Табы */}
      <div className="flex gap-1 border-b mb-6">
        <button
          onClick={() => setTab('overview')}
          className={`px-4 py-2 text-sm ${tab === 'overview' ? 'border-b-2 border-blue-600 text-blue-600 font-semibold' : 'text-gray-600'}`}
        >
          Общая
        </button>
        <button
          onClick={() => setTab('events')}
          className={`px-4 py-2 text-sm ${tab === 'events' ? 'border-b-2 border-blue-600 text-blue-600 font-semibold' : 'text-gray-600'}`}
        >
          📅 Ивенты {eventStats?.total_events > 0 && `(${eventStats.total_events})`}
        </button>
        <button
          onClick={() => setTab('offers')}
          className={`px-4 py-2 text-sm ${tab === 'offers' ? 'border-b-2 border-blue-600 text-blue-600 font-semibold' : 'text-gray-600'}`}
        >
          🎁 Предложения {offers.length > 0 && `(${offers.length})`}
        </button>
      </div>

      {/* === ОБЩАЯ === */}
      {tab === 'overview' && (
        <>
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

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-white p-4 rounded shadow">
              <p className="text-sm text-gray-600">Предложений</p>
              <p className="text-2xl font-bold">{offers.length}</p>
              <p className="text-xs text-gray-500 mt-1">
                ✓ {publishedOffers} · ⏳ {pendingOffers} · 📝 {draftOffers}
              </p>
            </div>
            <div className="bg-white p-4 rounded shadow">
              <p className="text-sm text-gray-600">Ивентов</p>
              <p className="text-2xl font-bold">{eventStats?.total_events || 0}</p>
              <p className="text-xs text-gray-500 mt-1">
                ✓ {eventStats?.published_events || 0} · 👥 {eventStats?.total_attendees || 0} участников
              </p>
            </div>
            <div className="bg-white p-4 rounded shadow">
              <p className="text-sm text-gray-600">Всего использований офферов</p>
              <p className="text-2xl font-bold">{totalUses}</p>
            </div>
          </div>

          {/* Последние транзакции */}
          <div className="bg-white rounded shadow p-4">
            <h3 className="text-lg font-semibold mb-3">Последние транзакции</h3>
            {transactions.length === 0 ? (
              <p className="text-gray-500 text-sm">Нет транзакций</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
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
                           tx.type === 'settlement' ? '📤 Выплата' : tx.type}
                        </td>
                        <td className={`p-2 text-right font-semibold ${tx.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {tx.amount >= 0 ? '+' : ''}{tx.amount} ₽
                        </td>
                        <td className="p-2">
                          <span className={`px-2 py-1 rounded text-white text-xs ${tx.status === 'completed' ? 'bg-green-500' : 'bg-yellow-500'}`}>
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
        </>
      )}

      {/* === ИВЕНТЫ === */}
      {tab === 'events' && eventStats && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            <div className="bg-blue-100 p-3 rounded shadow">
              <p className="text-xs text-gray-600">Всего ивентов</p>
              <p className="text-2xl font-bold">{eventStats.total_events}</p>
            </div>
            <div className="bg-green-100 p-3 rounded shadow">
              <p className="text-xs text-gray-600">Опубликовано</p>
              <p className="text-2xl font-bold">{eventStats.published_events}</p>
            </div>
            <div className="bg-yellow-100 p-3 rounded shadow">
              <p className="text-xs text-gray-600">На модерации</p>
              <p className="text-2xl font-bold">{eventStats.pending_events}</p>
            </div>
            <div className="bg-purple-100 p-3 rounded shadow">
              <p className="text-xs text-gray-600">Участников</p>
              <p className="text-2xl font-bold">{eventStats.total_attendees}</p>
            </div>
            <div className="bg-gray-100 p-3 rounded shadow">
              <p className="text-xs text-gray-600">Средний размер</p>
              <p className="text-2xl font-bold">{(eventStats.avg_attendees || 0).toFixed(1)}</p>
            </div>
          </div>

          {eventStats.rejected_events > 0 && (
            <div className="bg-red-50 border border-red-200 text-red-800 rounded p-3 mb-4 text-sm">
              Отклонено ивентов: <strong>{eventStats.rejected_events}</strong>
            </div>
          )}

          <div className="bg-white rounded shadow p-4 mb-6">
            <h3 className="text-lg font-semibold mb-3">Топ-3 ивента по посещаемости</h3>
            {topEvents.length === 0 ? (
              <p className="text-gray-500 text-sm">Нет опубликованных ивентов</p>
            ) : (
              <div className="space-y-3">
                {topEvents.map(e => (
                  <div key={e.id}>
                    <div className="flex justify-between text-sm mb-1">
                      <Link to={`/events`} className="text-blue-600 hover:underline truncate mr-2">
                        {e.title}
                      </Link>
                      <span className="font-semibold whitespace-nowrap">{e.attendees_count || 0} идут</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-purple-500 h-2 rounded-full transition-all"
                        style={{ width: `${((e.attendees_count || 0) / maxEventAttendees) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {events.length > 0 && (
            <div className="bg-white rounded shadow p-4">
              <h3 className="text-lg font-semibold mb-3">Все ивенты</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="p-2 text-left">Дата</th>
                      <th className="p-2 text-left">Название</th>
                      <th className="p-2 text-left">Статус</th>
                      <th className="p-2 text-right">Идут</th>
                    </tr>
                  </thead>
                  <tbody>
                    {events.map(e => (
                      <tr key={e.id} className="border-b">
                        <td className="p-2 whitespace-nowrap">
                          {new Date(e.start_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: '2-digit' })}
                        </td>
                        <td className="p-2 max-w-xs truncate">{e.title}</td>
                        <td className="p-2">
                          <span className={`px-2 py-1 rounded text-white text-xs ${
                            e.status === 'published' ? 'bg-green-500' :
                            e.status === 'pending_review' ? 'bg-yellow-500' :
                            e.status === 'pending_partner_approval' ? 'bg-purple-500' :
                            e.status === 'rejected' ? 'bg-red-500' :
                            e.status === 'archived' ? 'bg-gray-500' : 'bg-gray-400'
                          }`}>
                            {e.status}
                          </span>
                        </td>
                        <td className="p-2 text-right font-semibold">{e.attendees_count || 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* === ПРЕДЛОЖЕНИЯ === */}
      {tab === 'offers' && (
        <>
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-green-100 p-3 rounded shadow text-center">
              <p className="text-3xl font-bold text-green-700">{publishedOffers}</p>
              <p className="text-sm text-gray-600">Опубликовано</p>
            </div>
            <div className="bg-yellow-100 p-3 rounded shadow text-center">
              <p className="text-3xl font-bold text-yellow-700">{pendingOffers}</p>
              <p className="text-sm text-gray-600">На модерации</p>
            </div>
            <div className="bg-gray-100 p-3 rounded shadow text-center">
              <p className="text-3xl font-bold text-gray-700">{draftOffers}</p>
              <p className="text-sm text-gray-600">Черновиков</p>
            </div>
          </div>

          <div className="bg-white rounded shadow p-4">
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
        </>
      )}
    </div>
  );
};

export default MerchantStatistics;
