import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/client';
import { Rule, Rule2, Barcode, num, plural } from '../merchant/kit';

/**
 * Общая часть экранов D10 · Вход и D11 · Регистрация:
 * слева — крупный логотип, подводка, лучшие скидки сегодня и
 * «Студенты сэкономили за неделю»; справа — форма.
 */

const offerDiscount = (o) => {
  const base = Number(o.base_price || 0);
  const free =
    (o.discount_type === 'percentage' && Number(o.discount_value) >= 100) ||
    (o.discount_type !== 'percentage' && base > 0 && Number(o.discount_value) >= base);
  if (free) return 'БЕСПЛАТНО';
  return o.discount_type === 'percentage' ? `−${Number(o.discount_value)}%` : `−${num(o.discount_value)} ₽`;
};

// Сравнимая «сила» скидки, чтобы показать самые выгодные.
const strength = (o) => {
  const base = Number(o.base_price || 0);
  if (o.discount_type === 'percentage') return Number(o.discount_value);
  return base > 0 ? (Number(o.discount_value) / base) * 100 : 0;
};

const Row = ({ label, value, strong = false, accent = false }) => (
  <div className="flex items-end gap-2">
    <span className={`font-mono text-[14px] tracking-[0.03em] uppercase text-ink truncate ${strong ? 'font-bold' : ''}`}>{label}</span>
    <span className="flex-1 min-w-[8px] border-t border-dashed border-ink-faint h-[4px]" />
    <span className={`font-mono font-bold text-[14px] tracking-[0.01em] whitespace-nowrap ${accent ? 'text-accent' : 'text-ink'}`}>{value}</span>
  </div>
);

export const AuthAside = () => {
  const [stats, setStats] = useState(null);
  const [offers, setOffers] = useState([]);

  useEffect(() => {
    api.get('/stats/public').then((r) => setStats(r.data)).catch(() => {});
    api
      .get('/offers')
      .then((r) => {
        const list = Array.isArray(r.data) ? r.data : [];
        const seen = new Set();
        const top = list
          .slice()
          .sort((a, b) => strength(b) - strength(a))
          .filter((o) => {
            const k = o.company_name || o.title;
            if (seen.has(k)) return false;
            seen.add(k);
            return true;
          })
          .slice(0, 5);
        setOffers(top);
      })
      .catch(() => {});
  }, []);

  const places = stats?.places || 0;

  return (
    <div className="flex flex-col gap-6 pt-6">
      <div className="font-display font-bold text-[40px] sm:text-[64px] xl:text-[80px] leading-none tracking-[-0.04em] text-ink whitespace-nowrap">СТУДЕНТ−%</div>
      <p className="text-[18px] sm:text-[20px] leading-[30px] text-ink-soft">
        Скидки для студентов{places > 0 ? ` в ${num(places)} ${plural(places, 'месте', 'местах', 'местах')} города` : ''}: кофе, кино, спорт,
        книги и ивенты. Подтвердите статус один раз — и показывайте чек на кассе.
      </p>
      <Rule2 />
      {offers.length > 0 && (
        <>
          <div className="font-mono font-medium text-[11px] tracking-[0.08em] uppercase text-ink">Лучшие скидки сегодня</div>
          <div className="flex flex-col gap-3">
            {offers.map((o) => (
              <Link key={o.id} to={`/offers/${o.id}`} className="hover:opacity-70 transition">
                <Row label={o.company_name || o.title} value={offerDiscount(o)} accent />
              </Link>
            ))}
          </div>
          <Rule />
        </>
      )}
      {stats && <Row label="Студенты сэкономили за неделю" value={`${num(stats.week_saved)} ₽`} strong />}
      <Barcode seed={2026} width={260} height={30} className="text-ink" />
    </div>
  );
};

/** Поле формы в стиле чека: подпись, значение, пунктир снизу; ошибка — красным. */
export const AuthField = ({ label, right, error, hint, mono = false, inputRef, className = '', children, ...props }) => (
  <label className={`flex flex-col gap-2 ${className}`}>
    <span className="flex items-start justify-between gap-3">
      <span className={`font-mono font-medium text-[11px] tracking-[0.06em] uppercase ${error ? 'text-accent' : 'text-ink-soft'}`}>{label}</span>
      {right && <span className="font-mono text-[11px] tracking-[0.04em] text-ink-soft">{right}</span>}
    </span>
    <input
      ref={inputRef}
      className={`w-full bg-transparent pb-[10px] border-b outline-none text-[16px] text-ink placeholder:text-ink-faint transition ${
        mono ? 'font-mono tracking-[0.02em]' : ''
      } ${error ? 'border-solid border-accent' : 'border-dashed border-line focus:border-solid focus:border-ink'}`}
      {...props}
    />
    {children}
    {error && <span className="font-mono font-medium text-[12px] leading-[18px] text-accent uppercase">{error}</span>}
    {!error && hint && <span className="text-[12px] leading-[18px] text-ink-soft">{hint}</span>}
  </label>
);

/** Двухколоночная раскладка входа/регистрации. */
export const AuthLayout = ({ children }) => (
  <div className="flex flex-col lg:flex-row gap-10 lg:gap-20 items-start">
    <div className="hidden md:block order-2 lg:order-1 flex-1 min-w-0 w-full">
      <AuthAside />
    </div>
    <div className="hidden lg:block order-2 w-px self-stretch border-l border-dashed border-line" />
    <div className="order-1 lg:order-3 w-full lg:w-[440px] shrink-0 flex flex-col gap-6 pt-0 lg:pt-6">{children}</div>
  </div>
);

/** Телефон: шапка входа — логотип, «скидки для студентов · N мест», штрихкод. */
export const AuthBrandMobile = () => {
  const [places, setPlaces] = useState(0);
  useEffect(() => {
    api.get('/stats/public').then((r) => setPlaces(r.data?.places || 0)).catch(() => {});
  }, []);
  return (
    <div className="md:hidden flex flex-col items-center gap-3 pt-4">
      <div className="font-display font-bold text-[32px] leading-none tracking-[-0.03em] text-ink whitespace-nowrap">СТУДЕНТ−%</div>
      <div className="font-mono text-[11px] tracking-[0.06em] uppercase text-ink-soft">
        Скидки для студентов{places > 0 ? ` · ${num(places)} ${plural(places, 'место', 'места', 'мест')}` : ''}
      </div>
      <Barcode seed={2026} width={176} height={26} className="text-ink" />
      <Rule2 className="w-full mt-2" />
    </div>
  );
};
