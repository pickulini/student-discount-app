import React, { useState, useEffect } from 'react';
import api from '../api/client';
import OrderPaymentModal from './OrderPaymentModal';
import { Card, Button, Input, PageTitle } from '../design/UI';
import { RouteLoadingView } from '../design/DottedPath';

const statusColor = (status) =>
  status === 'paid' ? 'bg-accent/10 text-accent' :
  status === 'completed' ? 'bg-surface-2 text-ink' :
  status === 'cancelled' ? 'bg-danger/10 text-danger' :
  status === 'refunded' ? 'bg-surface-2 text-ink-faint' : 'bg-surface-2 text-ink-soft';

const Order = () => {
  const [offers, setOffers] = useState([]);
  const [selectedOffer, setSelectedOffer] = useState('');
  const [bonusPoints, setBonusPoints] = useState(0);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [paymentOrder, setPaymentOrder] = useState(null);
  const [error, setError] = useState('');

  const fetchOrders = async () => {
    try {
      const res = await api.get('/orders');
      setOrders(res.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    Promise.all([
      api.get('/offers'),
      api.get('/orders'),
    ])
      .then(([offersRes, ordersRes]) => {
        setOffers(Array.isArray(offersRes.data) ? offersRes.data : []);
        setOrders(ordersRes.data || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const res = await api.post('/orders', {
        offer_id: Number(selectedOffer),
        bonus_points: bonusPoints,
      });
      setSelectedOffer('');
      setBonusPoints(0);
      // Открываем модалку оплаты сразу
      setPaymentOrder(res.data);
      fetchOrders();
    } catch (err) {
      const msg = err.response?.data?.error || 'Неизвестная ошибка';
      if (msg.includes('insufficient balance')) {
        setError('Недостаточно средств. Пополните кошелёк.');
      } else {
        setError('Ошибка: ' + msg);
      }
    }
  };

  if (loading) {
    return <RouteLoadingView label="Загрузка..." />;
  }

  return (
    <div className="max-w-2xl mx-auto">
      <Card className="p-6 mb-6">
        <PageTitle className="mb-4">Оформить заказ</PageTitle>
        <form onSubmit={handleSubmit} className="space-y-3">
          <select
            className="w-full bg-surface border border-line focus:border-accent outline-none rounded-[var(--radius-sm)] px-3 py-2.5 text-ink transition"
            value={selectedOffer}
            onChange={e => setSelectedOffer(e.target.value)}
            required
          >
            <option value="">Выберите предложение</option>
            {offers.map(o => (
              <option key={o.id} value={o.id}>{o.title}</option>
            ))}
          </select>
          <Input
            type="number"
            placeholder="Бонусные баллы (0-200)"
            value={bonusPoints}
            onChange={e => setBonusPoints(Number(e.target.value))}
            min="0"
          />
          <Button type="submit" className="w-full">
            Создать и оплатить
          </Button>
        </form>
        {error && (
          <div className="mt-3 text-danger text-sm">
            {error}
            {error.includes('кошелёк') && (
              <a href="/wallet" className="ml-2 underline text-accent">Перейти в кошелёк</a>
            )}
          </div>
        )}
      </Card>

      <Card className="p-6">
        <PageTitle className="mb-4">Мои заказы</PageTitle>
        {orders.length === 0 ? (
          <p className="text-ink-soft">Нет заказов</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-line text-ink-soft">
                  <th className="p-2 text-left font-medium">ID</th>
                  <th className="p-2 text-left font-medium">Сумма</th>
                  <th className="p-2 text-left font-medium">Статус</th>
                  <th className="p-2 text-left font-medium">Действие</th>
                </tr>
              </thead>
              <tbody>
                {orders.map(o => (
                  <tr key={o.id} className="border-b border-line last:border-0">
                    <td className="p-2 text-ink">{o.id}</td>
                    <td className="p-2 text-ink">{o.total_amount} ₽</td>
                    <td className="p-2">
                      <span className={`px-2 py-1 rounded-[var(--radius-xs)] text-xs font-medium ${statusColor(o.status)}`}>
                        {o.status}
                      </span>
                    </td>
                    <td className="p-2">
                      {o.status === 'created' && (
                        <Button onClick={() => setPaymentOrder(o)} className="px-3 py-1 text-xs">
                          Оплатить
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {paymentOrder && (
        <OrderPaymentModal
          order={paymentOrder}
          onClose={() => setPaymentOrder(null)}
          onSuccess={fetchOrders}
        />
      )}
    </div>
  );
};

export default Order;
