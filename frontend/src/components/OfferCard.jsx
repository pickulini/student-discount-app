import React from 'react';
import { Link } from 'react-router-dom';
import { Photo } from './merchant/kit';
import { formatDistance } from '../utils/geo';

/**
 * Карточка предложения (D01 · Главная): фото с подписью категории,
 * «№01» · название места · «категория · расстояние» · красная скидка,
 * строки «ЦЕНА … / ВАША ЦЕНА …», внизу срок и «[ Взять ]».
 * size="featured" — крупная (Популярное рядом), иначе — сетка по 3.
 */
const OfferCard = ({ offer, index = 0, size = 'default', distance = null, onTake }) => {
  const featured = size === 'featured';
  const base = offer.base_price || 0;
  const price = Math.max(0, offer.discount_type === 'percentage' ? base * (1 - offer.discount_value / 100) : base - offer.discount_value);
  const discount = offer.discount_type === 'percentage' ? `−${Number(offer.discount_value)}%` : `−${Math.round(offer.discount_value)} ₽`;
  const category = offer.tags?.[0]?.name || '';
  const meta = [...(offer.tags || []).slice(0, featured ? 2 : 1).map((t) => t.name), distance != null ? formatDistance(distance) : null]
    .filter(Boolean)
    .join(' · ');
  const name = offer.company_name || offer.title;
  const until = new Date(offer.end_at).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' });

  return (
    <div className="flex flex-col gap-3 w-full">
      <Link to={`/offers/${offer.id}`} className="block group">
        <Photo src={offer.image_url} className={`w-full ${featured ? 'h-[240px] sm:h-[320px]' : 'h-[190px]'} overflow-hidden`}>
          {category && (
            <span className="absolute left-[14px] bottom-[13px] font-mono text-[10px] tracking-[0.06em] uppercase text-white/85">{category}</span>
          )}
        </Photo>
      </Link>
      <div className="flex items-start gap-[10px]">
        <span className="font-mono text-[12px] tracking-[0.02em] text-ink-faint pt-[3px]">№{String(index + 1).padStart(2, '0')}</span>
        <Link to={`/offers/${offer.id}`} className="flex-1 min-w-0 flex flex-col gap-1 group">
          <span
            className={`font-display font-bold uppercase text-ink group-hover:text-accent transition leading-[1.25] ${
              featured ? 'text-[22px] tracking-[-0.01em]' : 'text-[16px] tracking-[-0.01em]'
            }`}
          >
            {name}
          </span>
          {meta && <span className="text-[13px] text-ink-soft truncate">{meta}</span>}
        </Link>
        <span className={`font-display font-bold text-accent whitespace-nowrap ${featured ? 'text-[24px]' : 'text-[18px]'}`}>{discount}</span>
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex items-end gap-2">
          <span className="font-mono text-[12px] tracking-[0.03em] uppercase text-ink">Цена</span>
          <span className="flex-1 min-w-[8px] border-t border-dashed border-ink-faint h-[4px]" />
          <span className="font-mono text-[12px] text-ink whitespace-nowrap">{base > 0 ? `${Math.round(base).toLocaleString('ru-RU')} ₽` : '—'}</span>
        </div>
        <div className="flex items-end gap-2">
          <span className="font-mono font-bold text-[13px] tracking-[0.03em] uppercase text-ink">Ваша цена</span>
          <span className="flex-1 min-w-[8px] border-t border-dashed border-ink-faint h-[4px]" />
          <span className="font-mono font-bold text-[13px] text-ink whitespace-nowrap">{base > 0 ? `${Math.round(price).toLocaleString('ru-RU')} ₽` : '—'}</span>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <span className="font-mono text-[11px] tracking-[0.04em] text-ink-soft">ДО {until}</span>
        {onTake ? (
          <button onClick={() => onTake(offer)} className="btn-bracket py-[6px] hover:opacity-70">Взять</button>
        ) : (
          <Link to={`/offers/${offer.id}`} className="btn-bracket py-[6px] hover:opacity-70">Взять</Link>
        )}
      </div>
    </div>
  );
};

export default OfferCard;
