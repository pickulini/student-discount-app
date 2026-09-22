import React, { useState } from 'react';
import api from '../api/client';
import { Button, ErrorText } from '../design/UI';

const OrderPaymentModal = ({ order, onClose, onSuccess }) => {
  const [step, setStep] = useState(2); // 2 = подтверждение, 3 = успех
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!order) return null;

  const handlePay = async () => {
    setLoading(true);
    setError('');
    try {
      await api.post(`/orders/${order.id}/confirm`);
      setStep(3);
      if (onSuccess) onSuccess();
    } catch (err) {
      setError(err.response?.data?.error || 'Ошибка оплаты');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-surface border border-line rounded-[var(--radius-lg)] max-w-lg w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="p-6">

          {/* Шаг 2: подтверждение оплаты */}
          {step === 2 && (
            <>
              <div className="flex justify-between items-start mb-4">
                <h2 className="text-editorial text-2xl text-ink uppercase">Оплата заказа №{order.id}</h2>
                <button onClick={onClose} className="text-ink-faint hover:text-ink text-2xl leading-none">✕</button>
              </div>

              <div className="space-y-3 border-b border-line pb-4 mb-4">
                <div className="flex justify-between">
                  <span className="text-ink-soft">Исходная стоимость:</span>
                  <span className="font-semibold text-ink">{order.subtotal} ₽</span>
                </div>
                <div className="flex justify-between text-accent">
                  <span>Скидка:</span>
                  <span className="font-semibold">−{order.discount_amount} ₽</span>
                </div>
                {order.bonus_amount > 0 && (
                  <div className="flex justify-between text-accent">
                    <span>Бонусы:</span>
                    <span className="font-semibold">−{order.bonus_amount} ₽</span>
                  </div>
                )}
                <div className="flex justify-between text-xl font-bold border-t border-line pt-3">
                  <span className="text-ink">К оплате:</span>
                  <span className="text-accent">{order.total_amount} ₽</span>
                </div>
              </div>

              <div className="bg-surface-2 p-3 rounded-[var(--radius-sm)] mb-4 text-sm">
                <p className="text-ink-soft">Способ оплаты</p>
                <p className="font-semibold text-ink">Баланс кошелька</p>
              </div>

              <ErrorText>{error}</ErrorText>

              <Button onClick={handlePay} disabled={loading} className="w-full py-3 font-semibold">
                {loading ? 'Обработка...' : `Оплатить ${order.total_amount} ₽`}
              </Button>

              <button
                onClick={onClose}
                className="w-full mt-2 text-ink-soft hover:text-ink text-sm transition"
              >
                Отменить
              </button>
            </>
          )}

          {/* Шаг 3: успех */}
          {step === 3 && (
            <div className="text-center py-4">
              <div className="text-accent text-6xl mb-4">✓</div>
              <h2 className="text-editorial text-2xl text-ink uppercase mb-2">Заказ оплачен!</h2>
              <p className="text-ink-soft mb-6">Заказ №{order.id} успешно оплачен.</p>
              <p className="text-sm text-ink-faint mb-6">Покажите этот номер партнёру для получения услуги.</p>
              <Button onClick={onClose} className="px-6">
                Закрыть
              </Button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default OrderPaymentModal;
