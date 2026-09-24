import React from 'react';
import { Link } from 'react-router-dom';
import { Photo } from '../merchant/kit';
import { formatDistance } from '../../utils/geo';

/** Карточки ленты для телефона (макет «01 · Главная», 390px). */

const rub = (v) => `${Math.round(v || 0).toLocaleString('ru-RU')} ₽`;
export const discountOf = (o) => (o.discount_type === 'percentage' ? `−${Number(o.discount_value)}%` : `−${Math.round(o.discount_value)} ₽`);
export const priceOf = (o) => {
  const base = Number(o.base_price || 0);
  return Math.max(0, o.discount_type === 'percentage' ? base * (1 - o.discount_value / 100) : base - o.discount_value);
};

const Lead = ({ label, value, strong = false, valueClass = '' }) => (
  <div className="flex items-end gap-2">
    <span className={`font-mono tracking-[0.03em] uppercase text-ink whitespace-nowrap ${strong ? 'font-bold text-[13px]' : 'text-[12px]'}`}>{label}</span>
    <span className="flex-1 min-w-[8px] border-t border-dashed border-ink-faint h-[4px]" />
    <span className={`font-mono whitespace-nowrap ${strong ? 'font-bold text-[13px]' : 'text-[12px]'} ${valueClass || 'text-ink'}`}>{value}</span>
  </div>
);

/** Крупная карточка предложения: фото 210px, №, название, скидка, три строки, срок и «[ Взять ]». */
export const MobileOfferCard = ({ offer, index = 0, distance = null, onTake }) => {
  const base = Number(offer.base_price || 0);
  const tags = (offer.tags || []).map((t) => t.name);
  const meta = [...tags.slice(0, 2), distance != null ? formatDistance(distance) : null].filter(Boolean).join(' · ');
  const until = offer.end_at
    ? `ДО ${new Date(offer.end_at).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' })}`
    : 'БЕЗ СРОКА';
  return (
    <div className="flex flex-col gap-3">
      <Link to={`/offers/${offer.id}`}>
        <Photo src={offer.image_url} className="w-full h-[210px] overflow-hidden">
          {tags[0] && <span className="absolute left-3 bottom-[12px] font-mono text-[10px] tracking-[0.06em] uppercase text-white/85">{tags[0]}</span>}
        </Photo>
      </Link>
      <div className="flex items-start gap-[10px]">
        <span className="font-mono text-[12px] tracking-[0.02em] text-ink-faint pt-[3px]">№{String(index + 1).padStart(2, '0')}</span>
        <Link to={`/offers/${offer.id}`} className="flex-1 min-w-0 flex flex-col gap-1">
          <span className="font-display font-bold text-[18px] leading-[1.2] tracking-[-0.01em] uppercase text-ink">{offer.company_name || offer.title}</span>
          {meta && <span className="text-[13px] text-ink-soft truncate">{meta}</span>}
        </Link>
        {offer.discount_value > 0 && <span className="font-display font-bold text-[20px] text-accent whitespace-nowrap">{discountOf(offer)}</span>}
      </div>
      <div className="flex flex-col gap-2 pt-[2px]">
        <Lead label="Цена" value={base > 0 ? rub(base) : '—'} />
        <Lead label="Студентам" value={offer.discount_value > 0 ? discountOf(offer) : '—'} valueClass="font-bold text-ink" />
        <Lead label="Ваша цена" value={base > 0 ? rub(priceOf(offer)) : '—'} strong />
      </div>
      <div className="flex items-center justify-between">
        <span className="font-mono text-[11px] tracking-[0.04em] text-ink-soft">{until}</span>
        {onTake ? (
          <button onClick={() => onTake(offer)} className="btn-bracket py-[6px] uppercase">Взять</button>
        ) : (
          <Link to={`/offers/${offer.id}`} className="btn-bracket py-[6px]">Взять</Link>
        )}
      </div>
    </div>
  );
};

/** Мини-карточка ленты «Популярное рядом»: 150px, фото 110px. */
export const MobileMiniCard = ({ offer, distance = null }) => (
  <Link to={`/offers/${offer.id}`} className="w-[150px] shrink-0 flex flex-col gap-2">
    <Photo src={offer.image_url} className="w-[150px] h-[110px]" />
    <span className="font-display font-medium text-[12px] uppercase text-ink truncate">{offer.company_name || offer.title}</span>
    <span className="flex gap-2 items-center font-mono text-[11px] whitespace-nowrap">
      {offer.discount_value > 0 && <span className="font-bold text-accent">{discountOf(offer)}</span>}
      {distance != null && <span className="text-ink-soft">{formatDistance(distance)}</span>}
    </span>
  </Link>
);

const MONTHS = ['ЯНВ', 'ФЕВ', 'МАР', 'АПР', 'МАЙ', 'ИЮН', 'ИЮЛ', 'АВГ', 'СЕН', 'ОКТ', 'НОЯ', 'ДЕК'];

/** Карточка ивента: фото 180px, число и месяц, название, «вход студентам», «идут · [ Пойду ]». */
export const MobileEventCard = ({ event, friends = 0 }) => {
  const d = new Date(event.start_at);
  const time = d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  const price = Number(event.special_price || 0);
  const kind = (event.tags || [])[0]?.name || '';
  const going = event.attendees_count || 0;
  return (
    <div className="flex flex-col gap-3">
      <Link to={`/events/${event.id}`}>
        <Photo src={event.image_url} className="w-full h-[180px] overflow-hidden">
          {kind && <span className="absolute left-3 bottom-[12px] font-mono text-[10px] tracking-[0.06em] uppercase text-white/85">{kind}</span>}
        </Photo>
      </Link>
      <Link to={`/events/${event.id}`} className="flex gap-[14px] items-start">
        <span className="flex flex-col items-center gap-[2px] shrink-0">
          <span className="font-display font-bold text-[26px] leading-none text-ink">{d.getDate()}</span>
          <span className="font-mono font-medium text-[10px] tracking-[0.08em] text-ink-soft">{MONTHS[d.getMonth()]}</span>
        </span>
        <span className="w-px self-stretch border-l border-dashed border-line" />
        <span className="flex-1 min-w-0 flex flex-col gap-1">
          <span className="font-display font-bold text-[16px] leading-[1.2] tracking-[-0.01em] uppercase text-ink">{event.title}</span>
          <span className="text-[13px] text-ink-soft truncate">
            {time}
            {event.address ? ` · ${event.address}` : ''}
          </span>
        </span>
      </Link>
      <Lead label="Вход студентам" value={price > 0 ? rub(price) : 'Бесплатно'} valueClass={price > 0 ? 'font-bold text-ink' : 'font-bold text-accent'} />
      <div className="flex items-center justify-between">
        <span className="font-mono text-[11px] tracking-[0.04em] text-ink-soft uppercase">
          Идут {going}
          {friends > 0 ? ` · друзья ${friends}` : ''}
        </span>
        <Link to={`/events/${event.id}`} className="btn-bracket py-[6px]">Пойду</Link>
      </div>
    </div>
  );
};
