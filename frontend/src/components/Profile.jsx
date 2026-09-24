import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Eyebrow, LeaderRow } from '../design/UI';
import { RouteLoadingView, RuleDashed, RuleDouble } from '../design/DottedPath';
import { Avatar, Rule, Rule2, plural } from './merchant/kit';
import { useMobileTop } from '../context/MobileChrome';
import { useNotifications } from '../context/NotificationContext';

/**
 * Профиль — точная структура Figma «Концепция «Чек», D50 · Профиль»
 * (desktop, светлая тема): слева карточка пользователя (аватар, статус,
 * статистика, список разделов), справа — сводка экономии, активные
 * заказы, ближайшие ивенты и друзья.
 */

const MONTHS_NOM = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];
const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

const pluralizeDiscount = (n) => {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'СКИДКА';
  if ([2, 3, 4].includes(mod10) && ![12, 13, 14].includes(mod100)) return 'СКИДКИ';
  return 'СКИДОК';
};

const isSameMonth = (d, ref) => d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth();

const SavingsBars = ({ values }) => {
  const max = Math.max(1, ...values);
  return (
    <div className="flex items-end gap-1.5 h-[84px]">
      {values.map((v, i) => {
        const last = i === values.length - 1;
        const h = Math.max(21, Math.round((v / max) * 84));
        return (
          <div
            key={i}
            className={last ? 'w-[22px] bg-ink' : 'w-[22px] border border-dashed border-ink'}
            style={{ height: `${h}px` }}
          />
        );
      })}
    </div>
  );
};

const Profile = () => {
  const { user, logout } = useAuth();
  const [wallet, setWallet] = useState(null);
  const [orders, setOrders] = useState([]);
  const [offersById, setOffersById] = useState({});
  const [friends, setFriends] = useState([]);
  const [incoming, setIncoming] = useState([]);
  const [subs, setSubs] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const { unreadCount } = useNotifications();
  useMobileTop({ tabRight: <Link to="/settings" className="btn-bracket text-[11px]">Настройки</Link> });

  useEffect(() => {
    Promise.all([
      api.get('/wallet').catch(() => ({ data: null })),
      api.get('/orders').catch(() => ({ data: [] })),
      api.get('/offers').catch(() => ({ data: [] })),
      api.get('/friends').catch(() => ({ data: [] })),
      api.get('/friends/requests/incoming').catch(() => ({ data: [] })),
      api.get('/subscriptions/companies').catch(() => ({ data: [] })),
      api.get('/events?limit=2').catch(() => ({ data: [] })),
    ]).then(([w, o, offers, f, inc, s, ev]) => {
      setWallet(w.data);
      setOrders(Array.isArray(o.data) ? o.data : []);
      const map = {};
      (Array.isArray(offers.data) ? offers.data : []).forEach((x) => { map[x.id] = x; });
      setOffersById(map);
      setFriends(Array.isArray(f.data) ? f.data : []);
      setIncoming(Array.isArray(inc.data) ? inc.data : []);
      setSubs(Array.isArray(s.data) ? s.data : []);
      setEvents((Array.isArray(ev.data) ? ev.data : []).slice(0, 2));
    }).finally(() => setLoading(false));
  }, []);

  const paidOrders = useMemo(
    () => orders.filter((o) => o.status === 'paid' || o.status === 'completed'),
    [orders]
  );
  const activeOrders = useMemo(
    () => orders.filter((o) => o.status === 'created' || o.status === 'paid'),
    [orders]
  );

  const now = new Date();
  const thisMonthSaved = useMemo(
    () => paidOrders.filter((o) => isSameMonth(new Date(o.created_at), now)).reduce((s, o) => s + (o.discount_amount || 0), 0),
    [paidOrders]
  );
  const totalSaved = useMemo(() => paidOrders.reduce((s, o) => s + (o.discount_amount || 0), 0), [paidOrders]);
  const sinceDate = user?.created_at ? new Date(user.created_at) : now;

  const monthlyBars = useMemo(() => {
    const bars = [];
    for (let i = 7; i >= 0; i -= 1) {
      const ref = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const total = paidOrders
        .filter((o) => isSameMonth(new Date(o.created_at), ref))
        .reduce((s, o) => s + (o.discount_amount || 0), 0);
      bars.push(total);
    }
    return bars;
  }, [paidOrders]);

  if (loading) return <RouteLoadingView label="Загрузка..." />;
  if (!user) return null;

  const displayName = user.nickname || user.full_name;
  const isVerified = user.student_status === 'verified';
  const verifiedUntil = user.student_verification_expires_at
    ? new Date(user.student_verification_expires_at).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' })
    : null;
  const publicProfileUrl = user.username ? `/@${user.username}` : '/profile';

  const links = [
    { to: '/order', label: 'Заказы', sub: activeOrders.length > 0 ? `${activeOrders.length} активных` : null },
    { to: '/history', label: 'Журнал экономии' },
    { to: '/friends', label: 'Друзья', badge: incoming.length > 0 ? incoming.length : null },
    { to: '/subscriptions', label: 'Подписки' },
    { to: '/referral', label: 'Рефералы' },
    { to: '/support', label: 'Поддержка' },
    { to: '/settings', label: 'Настройки' },
  ];

  const mobileLinks = [
    { to: '/order', label: 'Заказы', sub: activeOrders.length ? `${activeOrders.length} ${plural(activeOrders.length, 'активный чек', 'активных чека', 'активных чеков')}` : 'Активных чеков нет' },
    { to: '/savings', label: 'Журнал экономии' },
    { to: '/friends', label: 'Друзья', sub: incoming.length ? `${incoming.length} ${plural(incoming.length, 'новая заявка', 'новые заявки', 'новых заявок')}` : null, badge: incoming.length || null },
    { to: '/subscriptions', label: 'Подписки', sub: 'Компании, за которыми вы следите' },
    { to: '/notifications', label: 'Уведомления', badge: unreadCount || null },
    { to: '/referral', label: 'Рефералы', sub: '+100 бонусов за друга' },
    { to: '/support', label: 'Поддержка' },
  ];

  const mobile = (
    <div className="md:hidden flex flex-col gap-5">
      <div className="flex gap-5 items-center">
        <Avatar src={user.avatar_url} name={displayName} size={88} />
        <div className="flex-1 min-w-0 flex flex-col gap-[6px]">
          <h1 className="font-display font-bold text-[22px] leading-[1.15] tracking-[-0.01em] text-ink break-words">{displayName}</h1>
          {user.username && <span className="text-[13px] text-ink-soft truncate">@{user.username}</span>}
          {(user.university_short || user.course) && (
            <span className="text-[13px] text-ink-soft truncate">{[user.university_short, user.course && `${user.course} курс`].filter(Boolean).join(' · ')}</span>
          )}
        </div>
      </div>
      <div className="flex items-end gap-2 font-mono text-[12px] tracking-[0.03em] uppercase">
        <span className="text-ink whitespace-nowrap">Статус студента</span>
        <span className="flex-1 min-w-[8px] border-t border-dashed border-ink-faint h-[4px]" />
        {isVerified ? (
          <span className="font-bold text-ink whitespace-nowrap">✓ до {verifiedUntil || '—'}</span>
        ) : (
          <Link to="/verification" className="font-bold text-accent whitespace-nowrap">Подтвердить →</Link>
        )}
      </div>
      <div className="flex items-stretch gap-4">
        {[
          [friends.length, 'Друзей', false, '/friends'],
          [subs.length, 'Подписок', false, '/subscriptions'],
          [`${Math.round(totalSaved).toLocaleString('ru-RU')} ₽`, 'Сэкономлено', true, '/savings'],
        ].map(([v, l, accent, to], i) => (
          <React.Fragment key={l}>
            {i > 0 && <span className="w-px self-stretch border-l border-dashed border-line" />}
            <Link to={to} className={`${accent ? 'flex-[1.4]' : 'flex-1'} min-w-0 flex flex-col gap-1`}>
              <span className={`font-display font-bold text-[20px] tracking-[-0.01em] whitespace-nowrap ${accent ? 'text-accent' : 'text-ink'}`}>{v}</span>
              <span className="font-mono text-[10px] tracking-[0.04em] uppercase text-ink-soft">{l}</span>
            </Link>
          </React.Fragment>
        ))}
      </div>
      <Rule2 />
      <nav className="flex flex-col -mt-1">
        {mobileLinks.map((l, i) => (
          <React.Fragment key={l.to}>
            {i > 0 && <Rule />}
            <Link to={l.to} className="py-[14px] flex items-center justify-between gap-3">
              <span className="min-w-0 flex flex-col gap-[4px]">
                <span className="font-mono font-bold text-[12px] tracking-[0.04em] uppercase text-ink">{l.label}</span>
                {l.sub && <span className="text-[13px] text-ink-soft">{l.sub}</span>}
              </span>
              <span className="flex items-center gap-2 shrink-0 font-mono font-bold text-[12px] text-ink">
                {l.badge && <span>{l.badge}</span>}
                <span className="font-normal">→</span>
              </span>
            </Link>
          </React.Fragment>
        ))}
      </nav>
      <Rule2 className="-mt-1" />
      <div className="flex items-center justify-between">
        <Link to={publicProfileUrl} className="btn-bracket">Мой публичный профиль</Link>
        <button onClick={logout} className="btn-bracket uppercase">Выйти</button>
      </div>
    </div>
  );

  return (
    <>
    {mobile}
    <div className="hidden md:block lg:flex lg:items-start lg:gap-10">
      {/* Col 1 — карточка пользователя. */}
      <aside className="lg:w-[340px] lg:shrink-0">
        <Avatar src={user.avatar_url} name={displayName} size={120} />

        <h1 className="text-editorial text-3xl text-ink mt-5">{displayName}</h1>
        <div className="text-sm text-ink-soft mt-2">
          {[user.username && `@${user.username}`, user.university_short, user.course && `${user.course} курс`]
            .filter(Boolean)
            .join(' · ')}
        </div>

        <div className="mt-6 flex flex-col gap-1.5">
          <LeaderRow
            label="Статус студента"
            value={isVerified ? `✓ ДО ${verifiedUntil || '—'}` : 'НЕ ПОДТВЕРЖДЁН'}
            valueClassName={isVerified ? '' : 'text-ink-faint'}
          />
        </div>

        <div className="mt-6 flex">
          <div className="flex-1">
            <div className="text-editorial text-3xl text-ink">{friends.length}</div>
            <div className="text-caption text-xs text-ink-faint mt-1">ДРУЗЕЙ</div>
          </div>
          <div className="w-px self-stretch" style={{ borderLeft: '1px solid var(--color-line)' }} />
          <div className="flex-1 pl-5">
            <div className="text-editorial text-3xl text-ink">{subs.length}</div>
            <div className="text-caption text-xs text-ink-faint mt-1">ПОДПИСОК</div>
          </div>
        </div>

        <RuleDouble className="mt-6" />

        <nav className="flex flex-col">
          {links.map((link, i) => (
            <React.Fragment key={link.to}>
              <Link to={link.to} className="py-3 flex items-center justify-between gap-3 group">
                <div className="min-w-0">
                  <div className="font-mono font-bold text-[12px] tracking-[0.04em] uppercase text-ink group-hover:text-accent transition">{link.label}</div>
                  {link.sub && <div className="text-[14px] text-ink-soft mt-[3px]">{link.sub}</div>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {link.badge && <span className="text-ink-red text-sm">{link.badge}</span>}
                  <span className="text-ink-faint">→</span>
                </div>
              </Link>
              {i < links.length - 1 && <RuleDashed />}
            </React.Fragment>
          ))}
        </nav>

        <RuleDashed className="mt-1" />

        <div className="mt-5 flex items-center gap-6">
          <Link to={publicProfileUrl} className="btn-bracket">Публичный профиль</Link>
          <button onClick={logout} className="btn-bracket">Выйти</button>
        </div>
      </aside>

      <div className="hidden lg:block w-px self-stretch" style={{ borderLeft: '1px dashed var(--color-line)' }} />

      {/* Col 2 — сводка и лента. */}
      <div className="flex-1 min-w-0 mt-10 lg:mt-0">
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div>
            <Eyebrow>Вы сэкономили · {MONTHS_NOM[now.getMonth()]}</Eyebrow>
            <Link to="/savings" className="block font-display font-bold text-[56px] leading-[1.2] tracking-[-0.02em] text-accent mt-2 hover:opacity-80">{Math.round(thisMonthSaved).toLocaleString('ru-RU')} ₽</Link>
            <div className="text-caption text-xs text-ink-faint mt-3">
              ВСЕГО С {MONTHS[sinceDate.getMonth()].toUpperCase()} {Math.round(totalSaved).toLocaleString('ru-RU')} ₽ · {paidOrders.length} {pluralizeDiscount(paidOrders.length)}
            </div>
          </div>
          <SavingsBars values={monthlyBars} />
        </div>

        <RuleDouble className="mt-8" />

        <div className="mt-6 lg:flex lg:items-start lg:gap-10">
          {/* Активные заказы */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <Eyebrow>Активные заказы</Eyebrow>
              <Link to="/order" className="text-caption text-xs text-ink-faint hover:text-ink transition">ВСЕ →</Link>
            </div>

            {activeOrders.length === 0 ? (
              <div className="mt-4 text-sm text-ink-soft">Нет активных заказов</div>
            ) : (
              <div className="mt-4 flex flex-col">
                {activeOrders.map((o, i) => {
                  const offer = offersById[o.offer_id];
                  const isPaid = o.status === 'paid';
                  return (
                    <React.Fragment key={o.id}>
                      {i > 0 && <RuleDashed className="mb-4" />}
                      <div className="pb-4">
                        <div className="flex items-center justify-between">
                          <span className="text-caption text-xs text-ink-faint">
                            № {String(o.id).padStart(6, '0')} · {new Date(o.created_at).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })}
                          </span>
                          <span className={`text-caption text-xs font-bold ${isPaid ? 'text-ink' : 'text-ink-red'}`}>
                            {isPaid ? 'ОПЛАЧЕН' : 'ЖДЁТ ОПЛАТЫ'}
                          </span>
                        </div>
                        <div className="text-editorial text-lg text-ink uppercase mt-2">{o.company_name || offer?.title || o.offer_title || `Заказ №${o.id}`}</div>
                        <div className="mt-3">
                          {isPaid ? (
                            <LeaderRow label="Код" value={`${String(o.id % 10000).padStart(4, '0')} · ${o.redeem_code || ''}`} />
                          ) : (
                            <LeaderRow label="К оплате" value={`${Math.round(o.total_amount)} ₽`} />
                          )}
                        </div>
                        <div className="mt-3">
                          {isPaid ? (
                            <Link to={`/orders/${o.id}`} className="btn-bracket">Показать чек</Link>
                          ) : (
                            <Link to={`/orders/${o.id}`} className="inline-block bg-ink text-white px-[10px] py-[6px] text-[11px] font-mono font-bold uppercase tracking-[0.04em]">
                              Оплатить
                            </Link>
                          )}
                        </div>
                      </div>
                    </React.Fragment>
                  );
                })}
              </div>
            )}
          </div>

          <div className="hidden lg:block w-px self-stretch" style={{ borderLeft: '1px solid var(--color-line)' }} />

          {/* Ближайшие ивенты + друзья */}
          <div className="flex-1 min-w-0 mt-8 lg:mt-0">
            <div className="flex items-center justify-between">
              <Eyebrow>Ближайшие ивенты</Eyebrow>
              <Link to="/events" className="text-caption text-xs text-ink-faint hover:text-ink transition">ВСЕ →</Link>
            </div>

            {events.length === 0 ? (
              <div className="mt-4 text-sm text-ink-soft">Нет предстоящих ивентов</div>
            ) : (
              <div className="mt-4 flex flex-col">
                {events.map((ev, i) => (
                  <React.Fragment key={ev.id}>
                    {i > 0 && <RuleDashed className="mb-3" />}
                    <div className="pb-3 flex items-center gap-3">
                      {ev.image_url ? (
                        <div className="w-14 h-14 bg-cover bg-center bg-surface-2 shrink-0" style={{ backgroundImage: `url('${ev.image_url}')` }} />
                      ) : (
                        <div className="w-14 h-14 bg-surface-2 shrink-0" />
                      )}
                      <div className="min-w-0">
                        <div className="text-sm text-ink line-clamp-1">{ev.title}</div>
                        <div className="text-caption text-xs text-ink-faint mt-1">
                          {new Date(ev.start_at).toLocaleDateString('ru-RU', { weekday: 'short' }).toUpperCase().replace('.', '')} {new Date(ev.start_at).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })} · {new Date(ev.start_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                  </React.Fragment>
                ))}
              </div>
            )}

            <RuleDashed className="mt-1" />

            <div className="mt-4">
              <Eyebrow>Друзья недавно</Eyebrow>
              {friends.length === 0 ? (
                <div className="mt-3 text-sm text-ink-soft">Пока нет друзей</div>
              ) : (
                <div className="mt-3 flex flex-col gap-4">
                  {friends.slice(0, 2).map((f) => (
                    <div key={f.id} className="flex items-center gap-3">
                      {f.avatar_url ? (
                        <img src={f.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-surface-2 flex items-center justify-center text-accent font-bold">
                          {(f.nickname || f.full_name || '?')[0].toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="text-sm text-ink line-clamp-1">{f.nickname || f.full_name}</div>
                        {(f.username || f.university) && (
                          <div className="text-caption text-xs text-ink-faint mt-1 line-clamp-1">
                            {[f.username && `@${f.username}`, f.university].filter(Boolean).join(' · ')}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
    </>
  );
};

export default Profile;
