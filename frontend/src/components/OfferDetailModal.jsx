import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';

const OfferDetailModal = ({ offer, onClose }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [step, setStep] = useState(1); // 1 = детали, 2 = оплата, 3 = успех
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!offer) return null;

  const discountText = offer.discount_type === 'percentage'
    ? `${offer.discount_value}%`
    : `${offer.discount_value} ₽`;

  const handleUse = async () => {
    if (!user) {
      onClose();
      navigate('/login');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await api.post('/orders', {
        offer_id: offer.id,
        bonus_points: 0,
      });
      setOrder(res.data);
      setStep(2);
    } catch (err) {
      const msg = err.response?.data?.error || err.message;
      if (msg.includes('insufficient balance')) {
        setError('Недостаточно средств. Пополните кошелёк.');
      } else {
        setError('Ошибка: ' + msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePay = async () => {
    setLoading(true);
    setError('');
    try {
      await api.post(`/orders/${order.id}/confirm`);
      setStep(3);
    } catch (err) {
      setError(err.response?.data?.error || 'Ошибка оплаты');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (step === 3) {
      navigate('/order');
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" onClick={handleClose}>
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="p-6">

          {/* ===== Шаг 1: Детали предложения ===== */}
          {step === 1 && (
            <>
              <div className="flex justify-between items-start">
                <h2 className="text-2xl font-bold text-gray-800">{offer.title}</h2>
                <button onClick={handleClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">✕</button>
              </div>
              <div className="mt-2">
                <span className="inline-block bg-blue-100 text-blue-800 text-sm font-medium px-3 py-1 rounded-full">
                  {discountText}
                </span>
                {offer.bonus_allowed && (
                  <span className="ml-2 inline-block bg-green-100 text-green-800 text-sm font-medium px-3 py-1 rounded-full">
                    Бонусы до {offer.max_bonus_percent}%
                  </span>
                )}
              </div>
              <p className="mt-4 text-gray-700">{offer.description}</p>

              <div className="mt-6 border-t pt-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="font-semibold text-gray-600">Адрес</p>
                  <p className="text-gray-800">г. Москва, ул. Примерная, д. 1</p>
                </div>
                <div>
                  <p className="font-semibold text-gray-600">Телефон</p>
                  <p className="text-gray-800">+7 (999) 123-45-67</p>
                </div>
                <div className="md:col-span-2">
                  <p className="font-semibold text-gray-600">Условия</p>
                  <p className="text-gray-800">Действует при предъявлении студенческого билета.</p>
                </div>
                <div className="md:col-span-2">
                  <p className="font-semibold text-gray-600">Действует до</p>
                  <p className="text-gray-800">{new Date(offer.end_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                </div>
              </div>

              {error && <div className="mt-4 text-red-500 text-sm">{error}</div>}

              <div className="mt-6 flex gap-3">
                <button
                  onClick={handleUse}
                  disabled={loading}
                  className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
                >
                  {loading ? 'Создание заказа...' : 'Использовать предложение'}
                </button>
                <button
                  className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg hover:bg-gray-50 transition"
                  onClick={handleClose}
                >
                  Закрыть
                </button>
              </div>
            </>
          )}

          {/* ===== Шаг 2: Подтверждение оплаты ===== */}
          {step === 2 && order && (
            <>
              <h2 className="text-2xl font-bold mb-4">Оплата заказа №{order.id}</h2>

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
                onClick={handleClose}
                className="w-full mt-2 text-gray-600 hover:text-gray-800 text-sm"
              >
                Отменить
              </button>
            </>
          )}

          {/* ===== Шаг 3: Успех ===== */}
          {step === 3 && order && (
            <div className="text-center py-4">
              <div className="text-green-500 text-6xl mb-4">✓</div>
              <h2 className="text-2xl font-bold mb-2">Заказ оплачен!</h2>
              <p className="text-gray-600 mb-6">Заказ №{order.id} успешно оплачен.</p>
              <p className="text-sm text-gray-500 mb-6">Покажите этот номер партнёру для получения услуги.</p>
              <button
                onClick={handleClose}
                className="inline-block bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
              >
                Вернуться на главную
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default OfferDetailModal;
