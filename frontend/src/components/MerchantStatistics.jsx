import React, { useState, useEffect } from 'react';
import api from '../api/client';
import { Link } from 'react-router-dom';
import { Card, PageTitle, Eyebrow, Caption, Badge } from '../design/UI';
import { RouteLoadingView } from '../design/DottedPath';

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

  if (loading) return <RouteLoadingView label="Загрузка..." />;
  if (!balance) return <div className="text-center py-8 text-danger">Не удалось загрузить данные</div>;

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

  const tabs = [
    { key: 'overview', label: 'Общая' },
    { key: 'events', label: `Ивенты${eventStats?.total_events > 0 ? ` (${eventStats.total_events})` : ''}` },
    { key: 'offers', label: `Предложения${offers.length > 0 ? ` (${offers.length})` : ''}` },
  ];

  return (
    <div>
      <PageTitle>Статистика партнёра</PageTitle>

      {/* Табы */}
      <div className="flex gap-1 border-b border-line mb-6">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm transition ${
              tab === t.key ? 'border-b-2 border-accent text-ink font-semibold' : 'text-ink-soft hover:text-ink'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* === ОБЩАЯ === */}
      {tab === 'overview' && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card className="p-4">
              <Eyebrow>Общий баланс</Eyebrow>
              <p className="text-editorial text-3xl text-ink mt-1">{balance.total_balance || 0} ₽</p>
            </Card>
            <Card className="p-4">
              <Eyebrow>Начислено за 30 дней</Eyebrow>
              <p className="text-editorial text-3xl text-ink mt-1">{recentGross.toFixed(0)} ₽</p>
            </Card>
            <Card className="p-4">
              <Eyebrow>Возвраты за 30 дней</Eyebrow>
              <p className="text-editorial text-3xl text-danger mt-1">-{recentRefunds.toFixed(0)} ₽</p>
            </Card>
            <Card className="p-4">
              <Eyebrow>Чистыми за 30 дней</Eyebrow>
              <p className={`text-editorial text-3xl mt-1 ${recentNet >= 0 ? 'text-accent' : 'text-danger'}`}>
                {recentNet.toFixed(0)} ₽
              </p>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card className="p-4">
              <Eyebrow>Предложений</Eyebrow>
              <p className="text-editorial text-2xl text-ink mt-1">{offers.length}</p>
              <Caption className="mt-1">
                {publishedOffers} опубл. · {pendingOffers} на модерации · {draftOffers} черновиков
              </Caption>
            </Card>
            <Card className="p-4">
              <Eyebrow>Ивентов</Eyebrow>
              <p className="text-editorial text-2xl text-ink mt-1">{eventStats?.total_events || 0}</p>
              <Caption className="mt-1">
                {eventStats?.published_events || 0} опубл. · {eventStats?.total_attendees || 0} участников
              </Caption>
            </Card>
            <Card className="p-4">
              <Eyebrow>Всего использований офферов</Eyebrow>
              <p className="text-editorial text-2xl text-ink mt-1">{totalUses}</p>
            </Card>
          </div>

          {/* Последние транзакции */}
          <Card className="p-4">
            <Eyebrow className="mb-3">Последние транзакции</Eyebrow>
            {transactions.length === 0 ? (
              <p className="text-ink-soft text-sm">Нет транзакций</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-line">
                      <th className="p-2 text-left text-eyebrow">Дата</th>
                      <th className="p-2 text-left text-eyebrow">Тип</th>
                      <th className="p-2 text-right text-eyebrow">Сумма</th>
                      <th className="p-2 text-left text-eyebrow">Статус</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.slice(0, 10).map(tx => (
                      <tr key={tx.id} className="border-b border-line last:border-0">
                        <td className="p-2 text-caption text-ink">{new Date(tx.created_at).toLocaleString('ru-RU')}</td>
                        <td className="p-2 text-ink">
                          {tx.type === 'order_earning' ? 'Заработок' :
                           tx.type === 'refund' ? 'Возврат' :
                           tx.type === 'settlement' ? 'Выплата' : tx.type}
                        </td>
                        <td className={`p-2 text-right text-caption font-semibold ${tx.amount >= 0 ? 'text-accent' : 'text-danger'}`}>
                          {tx.amount >= 0 ? '+' : ''}{tx.amount} ₽
                        </td>
                        <td className="p-2">
                          <Badge filled={tx.status === 'completed'}>{tx.status}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}

      {/* === ИВЕНТЫ === */}
      {tab === 'events' && eventStats && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
            <Card className="p-3">
              <Caption>Всего ивентов</Caption>
              <p className="text-editorial text-2xl text-ink mt-1">{eventStats.total_events}</p>
            </Card>
            <Card className="p-3">
              <Caption>Опубликовано</Caption>
              <p className="text-editorial text-2xl text-ink mt-1">{eventStats.published_events}</p>
            </Card>
            <Card className="p-3">
              <Caption>На модерации</Caption>
              <p className="text-editorial text-2xl text-ink mt-1">{eventStats.pending_events}</p>
            </Card>
            <Card className="p-3">
              <Caption>Идут</Caption>
              <p className="text-editorial text-2xl text-ink mt-1">{eventStats.total_attendees}</p>
            </Card>
            <Card className="p-3">
              <Caption>Интерес</Caption>
              <p className="text-editorial text-2xl text-ink mt-1">{eventStats.total_interested || 0}</p>
            </Card>
            <Card className="p-3">
              <Caption>Средний размер</Caption>
              <p className="text-editorial text-2xl text-ink mt-1">{(eventStats.avg_attendees || 0).toFixed(1)}</p>
            </Card>
          </div>

          {eventStats.rejected_events > 0 && (
            <div className="border border-danger/30 bg-danger/10 text-danger rounded-[var(--radius-sm)] p-3 mb-4 text-sm">
              Отклонено ивентов: <strong>{eventStats.rejected_events}</strong>
            </div>
          )}

          {eventStats.top_interested && eventStats.top_interested.length > 0 && eventStats.top_interested.some(e => e.interested_count > 0) && (
            <Card className="p-4 mb-6">
              <Eyebrow className="mb-3">Топ-3 по интересу</Eyebrow>
              <div className="space-y-3">
                {eventStats.top_interested.filter(e => e.interested_count > 0).map(e => (
                  <div key={e.id}>
                    <div className="flex justify-between text-sm mb-1">
                      <Link to="/events" className="text-accent hover:underline truncate mr-2">
                        {e.title}
                      </Link>
                      <span className="font-semibold whitespace-nowrap text-ink">{e.interested_count}</span>
                    </div>
                    <div className="w-full bg-surface-2 border border-line h-2">
                      <div
                        className="bg-accent h-2 transition-all"
                        style={{ width: `${((e.interested_count || 0) / Math.max(...eventStats.top_interested.map(x => x.interested_count || 0), 1)) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <Card className="p-4 mb-6">
            <Eyebrow className="mb-3">Топ-3 ивента по посещаемости</Eyebrow>
            {topEvents.length === 0 ? (
              <p className="text-ink-soft text-sm">Нет опубликованных ивентов</p>
            ) : (
              <div className="space-y-3">
                {topEvents.map(e => (
                  <div key={e.id}>
                    <div className="flex justify-between text-sm mb-1">
                      <Link to="/events" className="text-accent hover:underline truncate mr-2">
                        {e.title}
                      </Link>
                      <span className="font-semibold whitespace-nowrap text-ink">{e.attendees_count || 0} идут</span>
                    </div>
                    <div className="w-full bg-surface-2 border border-line h-2">
                      <div
                        className="bg-accent h-2 transition-all"
                        style={{ width: `${((e.attendees_count || 0) / maxEventAttendees) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {events.length > 0 && (
            <Card className="p-4">
              <Eyebrow className="mb-3">Все ивенты</Eyebrow>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-line">
                      <th className="p-2 text-left text-eyebrow">Дата</th>
                      <th className="p-2 text-left text-eyebrow">Название</th>
                      <th className="p-2 text-left text-eyebrow">Статус</th>
                      <th className="p-2 text-right text-eyebrow">Идут</th>
                      <th className="p-2 text-right text-eyebrow">Интерес</th>
                    </tr>
                  </thead>
                  <tbody>
                    {events.map(e => (
                      <tr key={e.id} className="border-b border-line last:border-0">
                        <td className="p-2 whitespace-nowrap text-caption text-ink">
                          {new Date(e.start_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: '2-digit' })}
                        </td>
                        <td className="p-2 max-w-xs truncate text-ink">{e.title}</td>
                        <td className="p-2">
                          <Badge filled={e.status === 'published'}>{e.status}</Badge>
                        </td>
                        <td className="p-2 text-right font-semibold text-ink">{e.attendees_count || 0}</td>
                        <td className="p-2 text-right font-semibold text-accent">{e.interested_count || 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      )}

      {/* === ПРЕДЛОЖЕНИЯ === */}
      {tab === 'offers' && (
        <>
          <div className="grid grid-cols-3 gap-4 mb-6">
            <Card className="p-3 text-center">
              <p className="text-editorial text-3xl text-accent">{publishedOffers}</p>
              <Caption className="mt-1">Опубликовано</Caption>
            </Card>
            <Card className="p-3 text-center">
              <p className="text-editorial text-3xl text-ink">{pendingOffers}</p>
              <Caption className="mt-1">На модерации</Caption>
            </Card>
            <Card className="p-3 text-center">
              <p className="text-editorial text-3xl text-ink-soft">{draftOffers}</p>
              <Caption className="mt-1">Черновиков</Caption>
            </Card>
          </div>

          <Card className="p-4">
            <Eyebrow className="mb-3">Топ-5 предложений по использованию</Eyebrow>
            {topOffers.length === 0 ? (
              <p className="text-ink-soft text-sm">Нет предложений</p>
            ) : (
              <div className="space-y-3">
                {topOffers.map(o => (
                  <div key={o.id}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-ink-soft truncate mr-2">{o.title}</span>
                      <span className="font-semibold whitespace-nowrap text-ink">{o.current_uses || 0} раз</span>
                    </div>
                    <div className="w-full bg-surface-2 border border-line h-2">
                      <div
                        className="bg-accent h-2 transition-all"
                        style={{ width: `${((o.current_uses || 0) / maxUses) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
};

export default MerchantStatistics;
