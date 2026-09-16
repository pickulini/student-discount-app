import React, { useState } from 'react';
import api from '../api/client';

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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="p-6">

          {/* Шаг 2: подтверждение оплаты */}
          {step === 2 && (
            <>
              <div className="flex justify-between items-start mb-4">
                <h2 className="text-2xl font-bold">Оплата заказа №{order.id}</h2>
                <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">✕</button>
              </div>

              <div className="space-y-3 border-b pb-4 mb-4">
                <div className="flex justify-between">
                  <span className="text-gray-600">Исходная стоимость:</span>
                  <span className="font-semibold">{order.subtotal} ₽</span>
                </div>
                <div className="flex justify-between text-green-600">
                  <span>Скидка:</span>
                  <span className="font-semibold">−{order.discount_amount} ₽</span>
                </div>
                {order.bonus_amount > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Бонусы:</span>
                    <span className="font-semibold">−{order.bonus_amount} ₽</span>
                  </div>
                )}
                <div className="flex justify-between text-xl font-bold border-t pt-3">
                  <span>К оплате:</span>
                  <span className="text-blue-600">{order.total_amount} ₽</span>
                </div>
              </div>

              <div className="bg-gray-50 p-3 rounded mb-4 text-sm">
                <p className="text-gray-600">Способ оплаты</p>
                <p className="font-semibold">Баланс кошелька</p>
              </div>

              {error && <div className="text-red-500 mb-3 text-sm">{error}</div>}

              <button
                onClick={handlePay}
                disabled={loading}
                className="w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 transition disabled:opacity-50 font-semibold"
              >
                {loading ? 'Обработка...' : `Оплатить ${order.total_amount} ₽`}
              </button>

              <button
                onClick={onClose}
                className="w-full mt-2 text-gray-600 hover:text-gray-800 text-sm"
              >
                Отменить
              </button>
            </>
          )}

          {/* Шаг 3: успех */}
          {step === 3 && (
            <div className="text-center py-4">
              <div className="text-green-500 text-6xl mb-4">✓</div>
              <h2 className="text-2xl font-bold mb-2">Заказ оплачен!</h2>
              <p className="text-gray-600 mb-6">Заказ №{order.id} успешно оплачен.</p>
              <p className="text-sm text-gray-500 mb-6">Покажите этот номер партнёру для получения услуги.</p>
              <button
                onClick={onClose}
                className="inline-block bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
              >
                Закрыть
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default OrderPaymentModal;
