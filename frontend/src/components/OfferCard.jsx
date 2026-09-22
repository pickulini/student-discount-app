import React from 'react';
import { yandexMapUrl, yandexSearchUrl } from '../utils/mapLinks';

/**
 * Безрамочная карточка предложения. `size="lg"` — крупный вариант для
 * основной вертикальной ленты (Яндекс.Афиша-стиль: немного карточек,
 * но каждая крупная и с акцентом на скидку). `size="md"` — компактный
 * вариант для горизонтальной карусели.
 */
const OfferCard = ({ offer, onClick, size = 'md' }) => {
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

  const imageSrc = offer.image_url || null;
  const isLg = size === 'lg';

  return (
    <div onClick={() => onClick(offer)} className="cursor-pointer group">
      {imageSrc ? (
        <div className="overflow-hidden rounded-[var(--radius-sm)]">
          <div
            className={`media-hover w-full ${isLg ? 'h-64 sm:h-80' : 'h-44 sm:h-48'} bg-cover bg-center bg-surface-2`}
            style={{ backgroundImage: `url('${imageSrc}')` }}
          />
        </div>
      ) : (
        <div className={`w-full ${isLg ? 'h-64 sm:h-80' : 'h-44 sm:h-48'} bg-surface-2 rounded-[var(--radius-sm)] flex items-center justify-center text-ink-soft text-sm font-medium px-4 text-center`}>
          {offer.title}
        </div>
      )}

      <div className="pt-3">
        {/* Скидка — главный акцентный элемент, не цена (ТЗ, раздел 8). */}
        <div className="flex justify-between items-start gap-3">
          <h3 className={`text-editorial ${isLg ? 'text-xl' : 'text-base'} text-ink uppercase group-hover:text-accent transition-colors line-clamp-1`}>
            {offer.title}
          </h3>
          {hasDiscount && (
            <span className={`text-editorial ${isLg ? 'text-2xl' : 'text-lg'} text-accent whitespace-nowrap`}>
              {discountText}
            </span>
          )}
        </div>

        {offer.tags && offer.tags.length > 0 && (
          <div className="text-caption text-xs text-ink-faint mt-1">
            {offer.tags.slice(0, 3).map(t => t.name).join(' · ')}
          </div>
        )}

        {isLg && (
          <p className="text-ink-soft text-sm mt-2 line-clamp-2">{offer.description}</p>
        )}

        {/* Цена и адрес — вторичная справочная строка, без иконок. */}
        <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm">
          {hasDiscount ? (
            <>
              <span className="text-ink">{finalPrice.toFixed(0)} ₽</span>
              <span className="text-xs text-ink-faint line-through">{basePrice.toFixed(0)} ₽</span>
            </>
          ) : basePrice > 0 ? (
            <span className="text-ink">{basePrice.toFixed(0)} ₽</span>
          ) : (
            <span className="text-accent">Бесплатно</span>
          )}
          {offer.address && (
            <>
              <span className="text-ink-faint">·</span>
              <a
                href={offer.latitude && offer.longitude
                  ? yandexMapUrl(offer.latitude, offer.longitude)
                  : yandexSearchUrl(offer.address)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-accent hover:underline line-clamp-1"
              >
                {offer.address}
              </a>
            </>
          )}
        </div>

        <div className="mt-1 text-xs text-ink-faint">
          До {new Date(offer.end_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
        </div>
      </div>
    </div>
  );
};

export default OfferCard;
