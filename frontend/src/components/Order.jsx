import React, { useState, useEffect } from 'react';
import api from '../api/client';

const Order = () => {
  const [offers, setOffers] = useState([]);
  const [selectedOffer, setSelectedOffer] = useState('');
  const [bonusPoints, setBonusPoints] = useState(0);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/offers')
      .then(res => {
        setOffers(Array.isArray(res.data) ? res.data : []);
      })
      .catch(err => {
        console.error('Failed to load offers for order:', err);
        setOffers([]);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/orders', {
        offer_id: Number(selectedOffer),
        bonus_points: bonusPoints,
      });
      setResult(res.data);
    } catch (err) {
      alert('Ошибка: ' + err.response?.data?.error || 'Неизвестная ошибка');
    }
  };

  if (loading) {
    return <div className="text-center py-8">Загрузка...</div>;
  }

  return (
    <div className="max-w-md mx-auto bg-white p-6 rounded shadow">
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
          Купить
        </button>
      </form>
      {result && (
        <div className="mt-4 p-2 bg-gray-100 rounded">
          <p><strong>Заказ №{result.id}</strong></p>
          <p>Сумма: {result.total_amount} ₽</p>
          <p>Скидка: {result.discount_amount} ₽</p>
          <p>Статус: {result.status}</p>
        </div>
      )}
    </div>
  );
};

export default Order;
