import React, { useState, useEffect } from 'react';
import api from '../api/client';
import { Card, Button, Input, PageTitle, Eyebrow, Caption } from '../design/UI';

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

  if (error) return <div className="text-danger text-center py-8">{error}</div>;

  return (
    <Card className="max-w-md mx-auto p-6">
      <PageTitle className="mb-4">Кошелёк</PageTitle>
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="bg-surface-2 border border-line p-3 rounded-[var(--radius-sm)] text-center">
          <div className="text-editorial text-2xl text-ink">{balance} ₽</div>
          <Eyebrow className="mt-1">Денежный баланс</Eyebrow>
        </div>
        <div className="bg-surface-2 border border-line p-3 rounded-[var(--radius-sm)] text-center">
          <div className="text-editorial text-2xl text-accent">{bonus}</div>
          <Eyebrow className="mt-1">Бонусные баллы</Eyebrow>
        </div>
      </div>
      <div className="flex gap-2">
        <Input
          type="number"
          value={amount}
          onChange={e => setAmount(Number(e.target.value))}
          className="w-24"
          min="1"
        />
        <Button onClick={handleDeposit} disabled={loading}>
          {loading ? 'Обработка...' : 'Пополнить'}
        </Button>
      </div>
      <Caption className="mt-3">* Пополнение через СБП (эмуляция)</Caption>
    </Card>
  );
};

export default Wallet;
