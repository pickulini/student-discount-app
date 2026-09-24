import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import OfferCard from './OfferCard';
import { MobileOfferCard, MobileMiniCard, MobileEventCard } from './mobile/cards';
import { RouteLoadingView, RouteEmptyState } from '../design/DottedPath';
import { SectionLabel, Meta, Leader, PrimaryButton, TextButton, Rule, Rule2, VRule, hhmm } from './merchant/kit';
import { distanceMeters, getKnownPosition, requestPosition } from '../utils/geo';

/**
 * D01 · Главная (Figma «Концепция «Чек»»).
 * Слева: «Вы сэкономили», поиск, категории, «Рядом», ближайшие ивенты.
 * Справа: «Популярное рядом» (2 крупные карточки) и «Все предложения»
 * (сетка по 3, сортировка Ближе / Выгоднее / Новые, «Печатать дальше»).
 */

const MONTHS = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];
const MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const PAGE = 6;

const benefit = (o) => {
  const base = o.base_price || 0;
  return o.discount_type === 'percentage' ? (base * o.discount_value) / 100 : o.discount_value;
};
const weekdayTime = (d) => {
  const x = new Date(d);
  return `${x.toLocaleDateString('ru-RU', { weekday: 'short' }).replace('.', '').toUpperCase()} ${hhmm(x)}`;
};
const rubInt = (v) => `${Math.round(v || 0).toLocaleString('ru-RU')} ₽`;

const Row = ({ label, value, active, onClick }) => (
  <button onClick={onClick} className="w-full flex items-end gap-2 text-left group">
    <span className={`font-mono text-[12px] tracking-[0.03em] uppercase whitespace-nowrap truncate ${active ? 'font-bold text-ink' : 'text-ink group-hover:text-accent'}`}>
      {label}
    </span>
    <span className="flex-1 min-w-[8px] border-t border-dashed border-ink-faint h-[4px]" />
    <span className="font-mono text-[12px] text-ink whitespace-nowrap">{value}</span>
  </button>
);

const Home = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const tag = params.get('tag') || '';
  const [offers, setOffers] = useState(null);
  const [events, setEvents] = useState([]);
  const [orders, setOrders] = useState([]);
  const [wallet, setWallet] = useState(null);
  const [search, setSearch] = useState(() => params.get('q') || '');
  const [sort, setSort] = useState('benefit');
  const [radius, setRadius] = useState(null);
  const [me, setMe] = useState(null);
  const [shown, setShown] = useState(PAGE);
  const [loadedAt] = useState(new Date());

  useEffect(() => {
    api.get('/offers').then((r) => setOffers(Array.isArray(r.data) ? r.data : [])).catch(() => setOffers([]));
    getKnownPosition().then((p) => {
      if (p) {
        setMe(p);
        setSort('near');
      }
    });
  }, []);

  useEffect(() => {
    if (!user) return;
    api.get('/events?limit=10').then((r) => setEvents((r.data || []).filter((e) => new Date(e.start_at) > new Date()).slice(0, 3))).catch(() => {});
    api.get('/orders').then((r) => setOrders(r.data || [])).catch(() => {});
    api.get('/wallet').then((r) => setWallet(r.data)).catch(() => {});
  }, [user]);

  useEffect(() => setShown(PAGE), [tag, search, sort, radius]);

  const withDist = useMemo(
    () =>
      (offers || []).map((o) => ({
        o,
        d: me && o.latitude && o.longitude ? distanceMeters(me, { lat: o.latitude, lng: o.longitude }) : null,
      })),
    [offers, me]
  );

  const categories = useMemo(() => {
    const m = new Map();
    (offers || []).forEach((o) => (o.tags || []).forEach((t) => m.set(t.slug, { ...t, n: (m.get(t.slug)?.n || 0) + 1 })));
    return [...m.values()].sort((a, b) => b.n - a.n).slice(0, 8);
  }, [offers]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return withDist.filter(({ o, d }) => {
      if (tag && !(o.tags || []).some((t) => t.slug === tag)) return false;
      if (radius && (d == null || d > radius)) return false;
      if (!q) return true;
      return [o.title, o.description, o.company_name, o.address, ...(o.tags || []).map((t) => t.name)].some((s) => (s || '').toLowerCase().includes(q));
    });
  }, [withDist, tag, search, radius]);

  const popular = useMemo(() => {
    const pool = me ? filtered.filter((x) => x.d != null && x.d <= 2000) : filtered;
    return [...(pool.length >= 2 ? pool : filtered)].sort((a, b) => (b.o.current_uses || 0) - (a.o.current_uses || 0) || benefit(b.o) - benefit(a.o)).slice(0, 2);
  }, [filtered, me]);

  const rest = useMemo(() => {
    const ids = new Set(popular.map((x) => x.o.id));
    const list = filtered.filter((x) => !ids.has(x.o.id));
    const by = {
      near: (a, b) => (a.d ?? Infinity) - (b.d ?? Infinity),
      benefit: (a, b) => benefit(b.o) - benefit(a.o),
      new: (a, b) => new Date(b.o.created_at) - new Date(a.o.created_at),
    }[sort];
    return [...list].sort(by);
  }, [filtered, popular, sort]);

  const savings = useMemo(() => {
    const now = new Date();
    const paid = orders.filter((o) => ['paid', 'completed'].includes(o.status));
    const month = paid.filter((o) => {
      const d = new Date(o.created_at);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    const sum = (l) => l.reduce((s, o) => s + Number(o.discount_amount || 0) + Number(o.bonus_amount || 0), 0);
    const first = paid.reduce((min, o) => (!min || new Date(o.created_at) < min ? new Date(o.created_at) : min), null);
    return { month: sum(month), count: month.length, total: sum(paid), since: first };
  }, [orders]);

  const near = (m) => withDist.filter((x) => x.d != null && x.d <= m).length;

  const take = (o) => (user ? navigate(`/offers/${o.id}/checkout`) : navigate('/login'));
  const setTag = (slug) => {
    const next = new URLSearchParams(params);
    if (slug) next.set('tag', slug);
    else next.delete('tag');
    setParams(next, { replace: true });
  };
  const askLocation = () =>
    requestPosition().then((p) => {
      if (p) {
        setMe(p);
        setSort('near');
      }
    });

  const now = new Date();
  const visible = rest.slice(0, shown);
  const rows = [];
  for (let i = 0; i < visible.length; i += 3) rows.push(visible.slice(i, i + 3));

  const mobile = (
    <div className="md:hidden flex flex-col gap-5">
      {user && (
        <div className="flex justify-between font-mono text-[11px] tracking-[0.04em] text-ink-soft -mt-1">
          <span>ЧЕК № {String(user.id || 0).padStart(6, '0')}</span>
          <span className="whitespace-pre">
            {now.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' })}  {hhmm(now)}
          </span>
        </div>
      )}
      <Rule2 />
      {user && (
        <>
          <div className="flex flex-col gap-[10px]">
            <span className="font-mono font-medium text-[11px] tracking-[0.08em] uppercase text-ink-soft">Вы сэкономили · {MONTHS[now.getMonth()]}</span>
            <Link to="/savings" className="font-display font-bold text-[48px] leading-none tracking-[-0.03em] text-ink">{rubInt(savings.month)}</Link>
            <div className="flex flex-col gap-2 pt-1">
              <Leader label="Скидок использовано" value={savings.count} />
              <Leader label="Бонусов на счёте" value={Math.floor(wallet?.bonus || 0)} />
            </div>
          </div>
          <Rule />
        </>
      )}
      <label className="flex items-center gap-[10px] pb-2">
        <span className="font-mono font-bold text-[12px] tracking-[0.04em] text-ink">ПОИСК:</span>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="кофе, кино, спорт…"
          className="flex-1 min-w-0 bg-transparent outline-none text-[15px] text-ink placeholder:text-ink-faint"
        />
      </label>
      <div className="flex gap-4 items-start overflow-x-auto no-scrollbar -mx-5 px-5">
        {[{ slug: '', name: 'все' }, ...categories].map((c) =>
          (tag || '') === c.slug ? (
            <span key={c.slug || 'all'} className="bg-ink text-white font-mono font-bold text-[12px] tracking-[0.04em] uppercase px-[6px] py-[2px] whitespace-nowrap">
              #{c.name}
            </span>
          ) : (
            <button key={c.slug} onClick={() => setTag(c.slug)} className="font-mono text-[12px] tracking-[0.04em] uppercase text-ink-soft whitespace-nowrap py-[2px]">
              #{c.name}
            </button>
          )
        )}
      </div>
      <Rule2 />
      {offers === null ? (
        <RouteLoadingView label="Загрузка предложений..." />
      ) : filtered.length === 0 ? (
        <RouteEmptyState
          title={tag || search ? 'По выбранным условиям ничего нет' : 'Предложений пока нет'}
          action={(tag || search) && <TextButton onClick={() => { setTag(''); setSearch(''); }}>Сбросить</TextButton>}
        />
      ) : (
        <>
          <div className="flex items-center justify-between font-mono text-[11px] whitespace-nowrap">
            <span className="font-medium tracking-[0.08em] uppercase text-ink">{me ? 'Популярное рядом' : 'Популярное'}</span>
            {!me && (
              <button onClick={askLocation} className="tracking-[0.04em] uppercase text-ink-soft">Где я? →</button>
            )}
          </div>
          <div className="flex gap-[14px] items-stretch overflow-x-auto no-scrollbar -mx-5 px-5">
            {[...(me ? filtered : withDist)]
              .sort((a, b) => (me ? (a.d ?? Infinity) - (b.d ?? Infinity) : (b.o.current_uses || 0) - (a.o.current_uses || 0)))
              .slice(0, 6)
              .map((x, i) => (
                <React.Fragment key={x.o.id}>
                  {i > 0 && <span className="w-px shrink-0 self-stretch border-l border-dashed border-line" />}
                  <MobileMiniCard offer={x.o} distance={x.d} />
                </React.Fragment>
              ))}
          </div>
          <Rule2 />
          <div className="flex items-center justify-between font-mono text-[11px] whitespace-nowrap">
            <span className="font-medium tracking-[0.08em] uppercase text-ink">Все предложения</span>
            <span className="tracking-[0.04em] text-ink-soft">{filtered.length} ПОЗ.</span>
          </div>
          {[...filtered]
            .sort({ near: (a, b) => (a.d ?? Infinity) - (b.d ?? Infinity), benefit: (a, b) => benefit(b.o) - benefit(a.o), new: (a, b) => new Date(b.o.created_at) - new Date(a.o.created_at) }[sort])
            .slice(0, shown)
            .map((x, i) => (
              <React.Fragment key={x.o.id}>
                {i > 0 && <Rule />}
                <MobileOfferCard offer={x.o} index={i} distance={x.d} onTake={take} />
              </React.Fragment>
            ))}
          {user && events.length > 0 && (
            <>
              <Rule2 />
              <div className="flex items-center justify-between font-mono text-[11px] whitespace-nowrap">
                <span className="font-medium tracking-[0.08em] uppercase text-ink">Ивенты</span>
                <Link to="/events" className="tracking-[0.04em] uppercase text-ink-soft">Неделя</Link>
              </div>
              {events.slice(0, 2).map((e, i) => (
                <React.Fragment key={e.id}>
                  {i > 0 && <Rule />}
                  <MobileEventCard event={e} />
                </React.Fragment>
              ))}
            </>
          )}
          <div className="flex flex-col items-center gap-[14px] py-2">
            <Meta>
              Показано {Math.min(shown, filtered.length)} из {filtered.length}
            </Meta>
            {shown < filtered.length && (
              <PrimaryButton className="w-full" onClick={() => setShown(shown + PAGE)}>
                Печатать дальше
              </PrimaryButton>
            )}
          </div>
        </>
      )}
    </div>
  );

  return (
    <>
    {mobile}
    <div className="hidden md:flex flex-col lg:flex-row gap-10 items-start">
      {/* Колонка 1 */}
      <aside className="w-full lg:w-[300px] shrink-0 flex flex-col gap-6">
        {user && (
          <>
            <div className="font-mono font-medium text-[11px] tracking-[0.08em] uppercase text-ink-soft">Вы сэкономили · {MONTHS[now.getMonth()]}</div>
            <Link to="/savings" className="font-display font-bold text-[44px] tracking-[-0.03em] leading-none text-ink hover:text-accent">{rubInt(savings.month)}</Link>
            <div className="flex flex-col gap-2">
              <Leader label="Скидок" value={savings.count} />
              <Leader label="Бонусов" value={Math.floor(wallet?.bonus || 0)} />
              <Leader label={savings.since ? `Всего с ${MONTHS_GEN[savings.since.getMonth()]}` : 'Всего'} value={rubInt(savings.total)} />
            </div>
            <Rule />
          </>
        )}
        <label className="flex items-center gap-[10px] border-b border-ink pb-[10px]">
          <span className="font-mono font-bold text-[12px] tracking-[0.04em] text-ink">ПОИСК:</span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="кофе, кино…"
            className="flex-1 min-w-0 bg-transparent outline-none text-[15px] text-ink placeholder:text-ink-faint"
          />
        </label>
        <Rule />
        <SectionLabel>Категории</SectionLabel>
        <div className="flex flex-col gap-2">
          <Row label="Все" value={offers?.length ?? '…'} active={!tag} onClick={() => setTag('')} />
          {categories.map((c) => (
            <Row key={c.slug} label={c.name} value={c.n} active={tag === c.slug} onClick={() => setTag(tag === c.slug ? '' : c.slug)} />
          ))}
        </div>
        <Rule />
        <SectionLabel>Рядом</SectionLabel>
        {me ? (
          <div className="flex flex-col gap-2">
            <Row label="до 500 м" value={near(500)} active={radius === 500} onClick={() => setRadius(radius === 500 ? null : 500)} />
            <Row label="до 2 км" value={near(2000)} active={radius === 2000} onClick={() => setRadius(radius === 2000 ? null : 2000)} />
          </div>
        ) : (
          <div className="flex flex-col items-start gap-1">
            <span className="text-[13px] text-ink-soft">Покажем, что в шаге от вас.</span>
            <TextButton onClick={askLocation}>Где я?</TextButton>
          </div>
        )}
        {user && events.length > 0 && (
          <>
            <Rule />
            <SectionLabel>Ближайшие ивенты</SectionLabel>
            <div className="flex flex-col gap-2">
              {events.map((e) => (
                <Row key={e.id} label={e.title} value={weekdayTime(e.start_at)} onClick={() => navigate(`/events/${e.id}`)} />
              ))}
            </div>
          </>
        )}
      </aside>

      <VRule className="hidden lg:block" />

      {/* Колонка 2 */}
      <div className="flex-1 min-w-0 w-full">
        {offers === null ? (
          <RouteLoadingView label="Загрузка предложений..." />
        ) : filtered.length === 0 ? (
          <RouteEmptyState
            title={tag || search || radius ? 'По выбранным условиям ничего нет' : 'Предложений пока нет'}
            action={(tag || search || radius) && <TextButton onClick={() => { setTag(''); setSearch(''); setRadius(null); }}>Сбросить</TextButton>}
          />
        ) : (
          <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <SectionLabel>{me ? 'Популярное рядом' : 'Популярное'}</SectionLabel>
              <Meta>Обновлено {hhmm(loadedAt)}</Meta>
            </div>
            <div className="flex flex-col sm:flex-row gap-7 items-stretch">
              {popular.map((x, i) => (
                <React.Fragment key={x.o.id}>
                  {i > 0 && <VRule className="hidden sm:block" />}
                  <div className="flex-1 min-w-0">
                    <OfferCard offer={x.o} index={i} size="featured" distance={x.d} onTake={take} />
                  </div>
                </React.Fragment>
              ))}
            </div>

            {rest.length > 0 && (
              <>
                <Rule2 />
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <SectionLabel>Все предложения · {filtered.length}</SectionLabel>
                  <div className="flex items-center gap-[14px]">
                    <span className="font-mono font-medium text-[11px] tracking-[0.04em] text-ink-soft">СОРТ:</span>
                    <div className="flex items-center gap-4">
                      {[
                        ['near', 'Ближе'],
                        ['benefit', 'Выгоднее'],
                        ['new', 'Новые'],
                      ].map(([k, l]) =>
                        k === sort ? (
                          <span key={k} className="bg-ink text-white font-mono font-bold text-[12px] tracking-[0.04em] uppercase px-[6px] py-[2px]">{l}</span>
                        ) : (
                          <button
                            key={k}
                            onClick={() => (k === 'near' && !me ? askLocation() : setSort(k))}
                            className="font-mono text-[12px] tracking-[0.04em] uppercase text-ink-soft hover:text-ink"
                          >
                            {l}
                          </button>
                        )
                      )}
                    </div>
                  </div>
                </div>
                {rows.map((row, ri) => (
                  <React.Fragment key={ri}>
                    {ri > 0 && <Rule />}
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-[1fr_1px_1fr_1px_1fr] gap-7">
                      {row.map((x, i) => (
                        <React.Fragment key={x.o.id}>
                          {i > 0 && <VRule className="hidden xl:block" />}
                          <OfferCard offer={x.o} index={2 + ri * 3 + i} distance={x.d} onTake={take} />
                        </React.Fragment>
                      ))}
                    </div>
                  </React.Fragment>
                ))}
                <div className="flex flex-col items-center gap-[14px] pt-2">
                  <Meta>
                    Показано {Math.min(shown, rest.length) + popular.length} из {filtered.length}
                  </Meta>
                  {shown < rest.length && <PrimaryButton onClick={() => setShown(shown + PAGE)}>Печатать дальше</PrimaryButton>}
                </div>
              </>
            )}
          </div>
        )}
      </div>

    </div>
    </>
  );
};

export default Home;
