import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';
import OrderPaymentModal from './OrderPaymentModal';
import SubscribeButton from './SubscribeButton';
import { yandexMapUrl, yandexSearchUrl } from '../utils/mapLinks';
import { Button, ErrorText } from '../design/UI';

const OfferDetailModal = ({ offer, onClose }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [order, setOrder] = useState(null);
  const [isSubscribed, setIsSubscribed] = useState(false);

  useEffect(() => {
    if (!offer || !user) return;
    api.get('/subscriptions/companies/ids')
      .then(res => setIsSubscribed((res.data || []).includes(offer.company_id)))
      .catch(() => {});
  }, [offer?.id, user]);

  if (!offer) return null;

  const basePrice = offer.base_price || 0;
  let finalPrice = basePrice;
  if (offer.discount_type === 'percentage') {
    finalPrice = basePrice * (1 - offer.discount_value / 100);
  } else {
    finalPrice = Math.max(0, basePrice - offer.discount_value);
  }
  const hasDiscount = basePrice > 0 && finalPrice < basePrice;

  const discountText = offer.discount_type === 'percentage'
    ? `−${offer.discount_value}%`
    : `−${offer.discount_value} ₽`;

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
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-surface border border-line rounded-[var(--radius-lg)] max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="p-6">
          <div className="flex justify-between items-start gap-3">
            <h2 className="text-editorial text-2xl text-ink uppercase">{offer.title}</h2>
            <button onClick={onClose} className="text-ink-faint hover:text-ink text-2xl leading-none">✕</button>
          </div>

          {/* Скидка — главный акцентный элемент, цена вторична (ТЗ, раздел 8-9). */}
          <div className="mt-3 flex flex-wrap items-baseline gap-3">
            {hasDiscount ? (
              <>
                <span className="text-editorial text-3xl text-accent">{discountText}</span>
                <span className="text-base text-ink">{finalPrice.toFixed(0)} ₽</span>
                <span className="text-sm text-ink-faint line-through">{basePrice.toFixed(0)} ₽</span>
              </>
            ) : basePrice > 0 ? (
              <span className="text-base text-ink">{basePrice.toFixed(0)} ₽</span>
            ) : (
              <span className="text-editorial text-2xl text-accent">Бесплатно</span>
            )}
            {offer.bonus_allowed && (
              <span className="inline-block bg-accent/10 text-accent text-sm font-medium px-3 py-1 rounded-[var(--radius-xs)]">
                Бонусы до {offer.max_bonus_percent}%
              </span>
            )}
            {user && offer.company_id && (
              <SubscribeButton
                companyId={offer.company_id}
                initialSubscribed={isSubscribed}
                onChange={setIsSubscribed}
              />
            )}
          </div>

          {imageSrc && (
            <div
              className="mt-4 w-full h-56 bg-cover bg-center rounded-[var(--radius-md)] bg-surface-2"
              style={{ backgroundImage: `url('${imageSrc}')` }}
            />
          )}

          <p className="mt-4 text-ink-soft">{offer.description}</p>

          <div className="mt-6 border-t border-line pt-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            {offer.address && (
              <div>
                <p className="font-semibold text-ink-soft">Адрес</p>
                <a
                  href={offer.latitude && offer.longitude
                    ? yandexMapUrl(offer.latitude, offer.longitude)
                    : yandexSearchUrl(offer.address)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent hover:underline"
                >
                  {offer.address}
                </a>
              </div>
            )}
            {offer.phone && (
              <div>
                <p className="font-semibold text-ink-soft">Телефон</p>
                <p className="text-ink">{offer.phone}</p>
              </div>
            )}
            {offer.website && (
              <div>
                <p className="font-semibold text-ink-soft">Сайт</p>
                <a
                  href={offer.website.startsWith('http') ? offer.website : `https://${offer.website}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent hover:underline"
                >
                  {offer.website}
                </a>
              </div>
            )}
            {offer.working_hours && (
              <div>
                <p className="font-semibold text-ink-soft">Часы работы</p>
                <p className="text-ink">{offer.working_hours}</p>
              </div>
            )}
            <div className="md:col-span-2">
              <p className="font-semibold text-ink-soft">Действует до</p>
              <p className="text-ink">{new Date(offer.end_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
            </div>
          </div>

          <ErrorText>{error}</ErrorText>

          <div className="mt-6 flex gap-3">
            <Button onClick={handleUse} disabled={loading} className="flex-1">
              {loading ? 'Создание заказа...' : 'Использовать предложение'}
            </Button>
            <Button variant="ghost" onClick={onClose} className="flex-1">
              Закрыть
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OfferDetailModal;
