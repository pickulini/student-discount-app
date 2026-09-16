import React, { useState, useEffect } from 'react';
import api from '../api/client';

const Order = () => {
  const [offers, setOffers] = useState([]);
  const [selectedOffer, setSelectedOffer] = useState('');
  const [bonusPoints, setBonusPoints] = useState(0);
  const [result, setResult] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

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

  const fetchOrders = async () => {
    try {
      const res = await api.get('/orders');
      setOrders(res.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/orders', {
        offer_id: Number(selectedOffer),
        bonus_points: bonusPoints,
      });
      setResult(res.data);
      fetchOrders();
    } catch (err) {
      alert('Ошибка: ' + (err.response?.data?.error || 'Неизвестная ошибка'));
    }
  };

  const handlePay = async (orderId) => {
    try {
      await api.post(`/orders/${orderId}/confirm`);
      alert('Заказ оплачен!');
      fetchOrders();
    } catch (err) {
      alert('Ошибка оплаты: ' + (err.response?.data?.error || err.message));
    }
  };

  if (loading) {
    return <div className="text-center py-8">Загрузка...</div>;
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white p-6 rounded shadow mb-6">
        <h2 className="text-2xl font-bold mb-4">Оформить заказ</h2>
        <form onSubmit={handleSubmit}>
          <select
            className="w-full p-2 border rounded mb-2"
            value={selectedOffer}
            onChange={e => setSelectedOffer(e.target.value)}
            required
          >
            <option value="">Выберите предложение</option>
            {offers.map(o => (
              <option key={o.id} value={o.id}>{o.title}</option>
            ))}
          </select>
          <input
            type="number"
            placeholder="Бонусные баллы (0-200)"
            className="w-full p-2 border rounded mb-2"
            value={bonusPoints}
            onChange={e => setBonusPoints(Number(e.target.value))}
            min="0"
          />
          <button type="submit" className="w-full bg-green-500 text-white py-2 rounded hover:bg-green-600">
            Создать заказ
          </button>
        </form>
        {result && (
          <div className="mt-4 p-3 bg-blue-50 rounded">
            <p><strong>Заказ №{result.id} создан</strong></p>
            <p>Сумма: {result.total_amount} ₽</p>
            <p>Статус: {result.status}</p>
          </div>
        )}
      </div>

      <div className="bg-white p-6 rounded shadow">
        <h2 className="text-2xl font-bold mb-4">Мои заказы</h2>
        {orders.length === 0 ? (
          <p className="text-gray-500">Нет заказов</p>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-100">
                <th className="p-2 text-left">ID</th>
                <th className="p-2 text-left">Сумма</th>
                <th className="p-2 text-left">Статус</th>
                <th className="p-2 text-left">Действие</th>
              </tr>
            </thead>
            <tbody>
              {orders.map(o => (
                <tr key={o.id} className="border-b">
                  <td className="p-2">{o.id}</td>
                  <td className="p-2">{o.total_amount} ₽</td>
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
                    {o.status === 'created' && (
                      <button
                        onClick={() => handlePay(o.id)}
                        className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700"
                      >
                        Оплатить
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default Order;
