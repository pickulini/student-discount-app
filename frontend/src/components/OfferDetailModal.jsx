import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';
import OrderPaymentModal from './OrderPaymentModal';

const OfferDetailModal = ({ offer, onClose }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [order, setOrder] = useState(null);

  if (!offer) return null;

  const discountText = offer.discount_type === 'percentage'
    ? `${offer.discount_value}%`
    : `${offer.discount_value} ₽`;

  const imageSrc = offer.image_url
    ? (offer.image_url.startsWith('http') ? offer.image_url : offer.image_url)
    : null;

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

  if (order) {
    return (
      <OrderPaymentModal
        order={order}
        onClose={() => {
          setOrder(null);
          onClose();
        }}
      />
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="p-6">
          <div className="flex justify-between items-start">
            <h2 className="text-2xl font-bold text-gray-800">{offer.title}</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">✕</button>
          </div>

          <div className="mt-2 flex flex-wrap gap-2">
            <span className="inline-block bg-blue-100 text-blue-800 text-sm font-medium px-3 py-1 rounded-full">
              {discountText}
            </span>
            {offer.bonus_allowed && (
              <span className="inline-block bg-green-100 text-green-800 text-sm font-medium px-3 py-1 rounded-full">
                Бонусы до {offer.max_bonus_percent}%
              </span>
            )}
          </div>

          {imageSrc && (
            <div
              className="mt-4 w-full h-56 bg-cover bg-center rounded-lg bg-gray-100"
              style={{ backgroundImage: `url('${imageSrc}')` }}
            />
          )}

          <p className="mt-4 text-gray-700">{offer.description}</p>

          <div className="mt-6 border-t pt-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            {offer.address && (
              <div>
                <p className="font-semibold text-gray-600">Адрес</p>
                <p className="text-gray-800">{offer.address}</p>
              </div>
            )}
            {offer.phone && (
              <div>
                <p className="font-semibold text-gray-600">Телефон</p>
                <p className="text-gray-800">{offer.phone}</p>
              </div>
            )}
            {offer.website && (
              <div>
                <p className="font-semibold text-gray-600">Сайт</p>
                <a
                  href={offer.website.startsWith('http') ? offer.website : `https://${offer.website}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  {offer.website}
                </a>
              </div>
            )}
            {offer.working_hours && (
              <div>
                <p className="font-semibold text-gray-600">Часы работы</p>
                <p className="text-gray-800">{offer.working_hours}</p>
              </div>
            )}
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
              onClick={onClose}
            >
              Закрыть
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OfferDetailModal;
