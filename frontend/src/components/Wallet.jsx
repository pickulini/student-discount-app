import React, { useState, useEffect } from 'react';
import api from '../api/client';

const Wallet = () => {
  const [balance, setBalance] = useState(0);
  const [bonus, setBonus] = useState(0);
  const [amount, setAmount] = useState(100);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchWallet = async () => {
    try {
      const res = await api.get('/wallet');
      setBalance(res.data.balance || 0);
      setBonus(res.data.bonus || 0);
    } catch (err) {
      console.error('Failed to load wallet:', err);
      setError('Не удалось загрузить кошелёк');
    }
  };

  const handleDeposit = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.post('/payments/init', { amount });
      // Редирект на страницу оплаты
      window.location.href = res.data.payment_url;
    } catch (err) {
      setError('Ошибка инициализации платежа: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWallet();
  }, []);

  if (error) return <div className="text-red-500">{error}</div>;

  return (
    <div className="max-w-md mx-auto bg-white p-6 rounded shadow">
      <h2 className="text-2xl font-bold mb-4">Кошелёк</h2>
      <div className="mb-4">
        <p><strong>Денежный баланс:</strong> {balance} ₽</p>
        <p><strong>Бонусные баллы:</strong> {bonus}</p>
      </div>
      <div className="flex gap-2">
        <input
          type="number"
          value={amount}
          onChange={e => setAmount(Number(e.target.value))}
          className="border p-2 rounded w-24"
          min="1"
        />
        <button
          onClick={handleDeposit}
          disabled={loading}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:opacity-50"
        >
          {loading ? 'Обработка...' : 'Пополнить'}
        </button>
      </div>
      <p className="text-xs text-gray-500 mt-2">* Пополнение через СБП (эмуляция)</p>
    </div>
  );
};

export default Wallet;
