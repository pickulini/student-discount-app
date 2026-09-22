import React from 'react';
import { yandexMapUrl, yandexSearchUrl } from '../utils/mapLinks';

const OfferCard = ({ offer, onClick, subscribed = false }) => {
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

  return (
    <div
      onClick={() => onClick(offer)}
      className="relative bg-surface rounded-[var(--radius-md)] border border-line hover:border-ink-faint transition-colors duration-200 cursor-pointer overflow-hidden flex flex-col h-full"
    >
      {imageSrc ? (
        <div
          className="w-full h-40 bg-cover bg-center bg-surface-2"
          style={{ backgroundImage: `url('${imageSrc}')` }}
        />
      ) : (
        <div className="w-full h-40 bg-surface-2 flex items-center justify-center text-ink-soft text-sm font-medium px-4 text-center">
          {offer.title}
        </div>
      )}
      {subscribed && (
        <span
          title="Вы подписаны на компанию"
          className="absolute top-2 right-2 bg-accent text-accent-ink rounded-full w-7 h-7 flex items-center justify-center shadow z-10 text-sm"
        >
          ★
        </span>
      )}
      <div className="p-4 flex flex-col flex-1">
        {/* Скидка — главный акцентный элемент карточки, не цена (см. ТЗ, раздел 8). */}
        <div className="flex justify-between items-start gap-3">
          <h3 className="text-editorial text-base text-ink uppercase line-clamp-1">{offer.title}</h3>
          {hasDiscount && (
            <span className="text-editorial text-xl text-accent whitespace-nowrap">
              {discountText}
            </span>
          )}
        </div>

        {offer.tags && offer.tags.length > 0 && (
          <div className="text-caption text-xs text-ink-faint mt-1">
            {offer.tags.slice(0, 3).map(t => t.name).join(' · ')}
          </div>
        )}

        <p className="text-ink-soft text-sm mt-2 line-clamp-2 flex-1">{offer.description}</p>

        {/* Цена — вторична, просто справочная информация. */}
        <div className="mt-2 flex items-baseline gap-2">
          {hasDiscount ? (
            <>
              <span className="text-sm text-ink">{finalPrice.toFixed(0)} ₽</span>
              <span className="text-xs text-ink-faint line-through">{basePrice.toFixed(0)} ₽</span>
            </>
          ) : basePrice > 0 ? (
            <span className="text-sm text-ink">{basePrice.toFixed(0)} ₽</span>
          ) : (
            <span className="text-sm text-accent">Бесплатно</span>
          )}
        </div>

        {offer.address && (
          <div className="mt-1 flex items-start gap-1 text-xs text-ink-faint line-clamp-2">
            <svg className="w-3 h-3 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            </svg>
            <a
              href={offer.latitude && offer.longitude
                ? yandexMapUrl(offer.latitude, offer.longitude)
                : yandexSearchUrl(offer.address)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-accent hover:underline"
            >
              {offer.address}
            </a>
          </div>
        )}

        <div className="mt-3 flex items-center justify-between text-xs text-ink-faint">
          <span>До {new Date(offer.end_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}</span>
          <span className="flex items-center gap-1 text-accent">
            Подробнее
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
            </svg>
          </span>
        </div>
      </div>
    </div>
  );
};

export default OfferCard;
