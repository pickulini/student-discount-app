import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { RouteLoadingView } from '../design/DottedPath';
import { MyEventsPanel } from './EventStats';
import { Tabs, Rule, Rule2, VRule, Leader, SectionLabel, SmallButton, PrimaryButton, Photo, Avatar, TextButton } from './merchant/kit';
import {
  WEEKDAYS_SHORT,
  MONTHS_NOM,
  startOfDay,
  addDays,
  dayKey,
  hhmm,
  dayTitle,
  occurrences,
  nextOccurrence,
  recurrenceLabel,
  eventPrice,
  priceLabel,
  shortName,
  loadEventMeta,
  goToEvent,
} from '../utils/events';

/**
 * D30 · Ивенты: табы, полоса из 12 дней, лента по дням
 * (время · обложка · описание · действие), справа — «Я иду», «Друзья идут»
 * и «Предложить ивент».
 */

const DAYS = 12;

const STATUS_LABEL = {
  draft: 'Черновик',
  pending_review: 'На модерации',
  rejected: 'Отклонён',
  published: 'Опубликован',
  expired: 'Прошёл',
  archived: 'В архиве',
};

const EventRow = ({ occ, meta, friends, onGo, busy, mine }) => {
  const e = occ.event;
  const price = eventPrice(e, meta);
  const status = meta?.my_status || e.my_attendee_status;
  const place = [meta?.company_name || e.address, recurrenceLabel(e)].filter(Boolean).join(' · ');
  const going = e.attendees_count || 0;

  let action;
  if (mine) {
    action = <span className="font-mono font-bold text-[11px] tracking-[0.04em] uppercase text-ink-soft text-right">{STATUS_LABEL[e.status] || e.status}</span>;
  } else if (status === 'going') {
    action = <span className="font-mono font-bold text-[12px] tracking-[0.04em] text-ink whitespace-nowrap">✓ Я ИДУ</span>;
  } else if (status === 'interested') {
    action = (
      <div className="flex flex-col items-end gap-2">
        <span className="font-mono font-bold text-[12px] tracking-[0.04em] text-ink-soft whitespace-nowrap">? ДУМАЮ</span>
        <SmallButton onClick={() => onGo(e)} disabled={busy}>{price > 0 ? `Билет ${Math.round(price)} ₽` : 'Пойду'}</SmallButton>
      </div>
    );
  } else {
    action = (
      <SmallButton onClick={() => onGo(e)} disabled={busy}>
        {busy ? '…' : price > 0 ? `Билет ${Math.round(price)} ₽` : 'Пойду'}
      </SmallButton>
    );
  }

  return (
    <div className="flex gap-4 sm:gap-6 items-start">
      <div className="w-[52px] sm:w-[64px] shrink-0 font-mono font-bold text-[15px] sm:text-[16px] text-ink">{hhmm(occ.start)}</div>
      <Link to={`/events/${e.id}`} className="hidden sm:block shrink-0">
        <Photo src={e.image_url} className="w-[160px] md:w-[200px] h-[104px] md:h-[130px] overflow-hidden" />
      </Link>
      <div className="flex-1 min-w-0 flex flex-col gap-2">
        <Link to={`/events/${e.id}`} className="font-display font-bold text-[17px] sm:text-[20px] leading-[1.2] tracking-[-0.01em] uppercase text-ink hover:text-accent transition">
          {e.title}
        </Link>
        {place && <div className="text-[14px] text-ink-soft">{place}</div>}
        {e.description && <p className="text-[14px] leading-[21px] text-ink-soft line-clamp-2">{e.description}</p>}
        <div className="flex gap-[14px] items-center font-mono text-[12px] tracking-[0.02em] whitespace-nowrap">
          <span className={`font-bold ${price > 0 ? 'text-ink' : 'text-accent'}`}>{priceLabel(price)}</span>
          <span className="text-ink-soft uppercase">
            Идут {going}
            {friends > 0 ? ` · друзей ${friends}` : ''}
          </span>
        </div>
        <div className="sm:hidden pt-1">{action}</div>
      </div>
      <div className="hidden sm:flex w-[120px] md:w-[140px] shrink-0 flex-col items-end">{action}</div>
    </div>
  );
};

/** Строка ленты на телефоне (макет 30): время · пунктир · название, место, цена/идут/«я иду» · обложка 64px. */
const MobileEventRow = ({ occ, meta, mine }) => {
  const e = occ.event;
  const price = eventPrice(e, meta);
  const status = meta?.my_status || e.my_attendee_status;
  const place = [meta?.company_name || e.address, recurrenceLabel(e)].filter(Boolean).join(' · ');
  return (
    <Link to={`/events/${e.id}`} className="flex gap-4 items-start">
      <span className="w-[46px] shrink-0 font-mono font-bold text-[14px] text-ink pt-[1px]">{hhmm(occ.start)}</span>
      <span className="w-px self-stretch border-l border-dashed border-line" />
      <span className="flex-1 min-w-0 flex flex-col gap-[6px]">
        <span className="font-display font-bold text-[15px] leading-[1.2] tracking-[-0.01em] uppercase text-ink">{e.title}</span>
        {place && <span className="text-[13px] text-ink-soft truncate">{place}</span>}
        <span className="flex gap-[10px] items-center font-mono text-[11px] tracking-[0.02em] whitespace-nowrap pt-[2px]">
          <span className={`font-bold ${price > 0 ? 'text-ink' : 'text-accent'}`}>{priceLabel(price)}</span>
          {mine ? (
            <span className="font-bold uppercase text-ink-soft">{STATUS_LABEL[e.status] || e.status}</span>
          ) : (
            <>
              <span className="text-ink-soft uppercase">Идут {e.attendees_count || 0}</span>
              {status === 'going' && <span className="font-bold text-ink">✓ Я ИДУ</span>}
              {status === 'interested' && <span className="font-bold text-ink-soft">? ДУМАЮ</span>}
            </>
          )}
        </span>
      </span>
      <Photo src={e.image_url} className="w-[64px] h-[64px] shrink-0" />
    </Link>
  );
};

const Events = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') || 'all';
  const [events, setEvents] = useState(null);
  const [mine, setMine] = useState([]);
  const [meta, setMeta] = useState({});
  const [friends, setFriends] = useState([]);
  const [windowStart, setWindowStart] = useState(() => startOfDay(addDays(new Date(), -1)));
  const [selected, setSelected] = useState(() => startOfDay(new Date()));
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');

  const load = async () => {
    const [all, my] = await Promise.all([
      api.get('/events', { params: { limit: 200 } }).then((r) => r.data || []).catch(() => []),
      user ? api.get('/events/my').then((r) => r.data || []).catch(() => []) : Promise.resolve([]),
    ]);
    setEvents(all);
    setMine(my);
    const ids = [...new Set([...all, ...my].map((e) => e.id))];
    setMeta(await loadEventMeta(ids));
    if (user) api.get('/events/friends').then((r) => setFriends(r.data || [])).catch(() => {});
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const statusOf = (e) => meta[e.id]?.my_status || e.my_attendee_status;
  const friendsBy = useMemo(() => {
    const m = {};
    friends.forEach((f) => {
      if (f.status === 'going') m[f.event_id] = (m[f.event_id] || 0) + 1;
    });
    return m;
  }, [friends]);

  const source = tab === 'mine' ? mine : events || [];
  const filtered = source.filter((e) => {
    if (tab === 'going') return statusOf(e) === 'going' || statusOf(e) === 'interested';
    if (tab === 'free') return eventPrice(e, meta[e.id]) === 0;
    return true;
  });

  const windowEnd = addDays(windowStart, DAYS);
  const all = useMemo(() => {
    const list = [];
    if (tab === 'mine') {
      // Свои ивенты показываем все, без привязки к дням: там и черновики.
      filtered.forEach((event) => list.push({ ...nextOccurrence(event), event }));
    } else {
      filtered.forEach((event) => occurrences(event, windowStart, windowEnd).forEach((o) => list.push({ ...o, event })));
    }
    return list.sort((a, b) => a.start - b.start);
  }, [filtered, windowStart, tab]); // eslint-disable-line react-hooks/exhaustive-deps

  const busyDays = new Set(all.map((o) => dayKey(o.start)));
  const visible = tab === 'mine' ? all : all.filter((o) => o.start >= selected);
  const byDay = [];
  visible.forEach((o) => {
    const k = dayKey(o.start);
    let g = byDay.find((x) => x.key === k);
    if (!g) {
      g = { key: k, date: startOfDay(o.start), items: [] };
      byDay.push(g);
    }
    g.items.push(o);
  });

  const goingList = (events || [])
    .filter((e) => statusOf(e) === 'going')
    .map((e) => ({ e, next: nextOccurrence(e) }))
    .filter((x) => x.next.end >= new Date())
    .sort((a, b) => a.next.start - b.next.start);

  const friendsGoing = friends.filter((f) => f.status === 'going');
  const eventById = Object.fromEntries((events || []).map((e) => [e.id, e]));

  const go = async (e) => {
    if (!user) return navigate('/login');
    const price = eventPrice(e, meta[e.id]);
    if (price > 0) return navigate(`/events/${e.id}`);
    setBusyId(e.id);
    setError('');
    try {
      await goToEvent(e.id);
      await load();
    } catch (err) {
      setError(err.response?.data?.error || 'Не получилось записаться');
    } finally {
      setBusyId(null);
    }
  };

  const shift = (n) => {
    const s = addDays(windowStart, n);
    setWindowStart(s);
    if (selected < s || selected >= addDays(s, DAYS)) setSelected(s);
  };

  if (events === null) return <RouteLoadingView label="Собираем афишу..." />;

  const setTab = (k) => setParams(k === 'all' ? {} : { tab: k }, { replace: true });
  const goingCount = (events || []).filter((e) => statusOf(e) === 'going').length;
  const monthOf = selected >= windowStart && selected < windowEnd ? selected : windowStart;

  return (
    <div className="flex flex-col lg:flex-row gap-10 lg:gap-12 items-start">
      <div className="flex-1 min-w-0 w-full flex flex-col gap-6">
        <h1 className="font-display font-bold text-[34px] md:text-[36px] leading-none tracking-[-0.02em] text-ink">ИВЕНТЫ</h1>
        <Tabs
          className="md:hidden"
          value={tab}
          onChange={setTab}
          items={[
            { key: 'all', label: 'Все' },
            ...(user ? [{ key: 'going', label: goingCount ? `Я иду · ${goingCount}` : 'Я иду' }] : []),
            ...(user ? [{ key: 'mine', label: 'Мои' }] : []),
            ...(user ? [] : [{ key: 'free', label: 'Бесплатные' }]),
          ]}
        />
        <div className="hidden md:flex items-center justify-between gap-4 flex-wrap">
          <Tabs
            value={tab}
            onChange={setTab}
            items={[
              { key: 'all', label: 'Все' },
              ...(user ? [{ key: 'going', label: goingCount ? `Я иду · ${goingCount}` : 'Я иду' }] : []),
              ...(user ? [{ key: 'mine', label: mine.length ? `Мои · ${mine.length}` : 'Мои' }] : []),
              { key: 'free', label: 'Бесплатные' },
            ]}
          />
          <div className="flex items-center gap-3 font-mono font-medium text-[11px] tracking-[0.04em] text-ink uppercase whitespace-nowrap">
            <span>
              {MONTHS_NOM[monthOf.getMonth()]} {monthOf.getFullYear()}
            </span>
            <button onClick={() => shift(-7)} className="px-1 hover:text-accent" aria-label="Раньше">←</button>
            <button onClick={() => shift(7)} className="px-1 hover:text-accent" aria-label="Позже">→</button>
          </div>
        </div>

        <div className={`${tab === 'mine' ? 'hidden' : 'md:hidden flex'} items-start overflow-x-auto no-scrollbar -mx-5 px-5`}>
          {Array.from({ length: DAYS }, (_, i) => addDays(windowStart, i)).map((d) => {
            const active = dayKey(d) === dayKey(selected);
            const has = busyDays.has(dayKey(d));
            return (
              <button
                key={dayKey(d)}
                onClick={() => setSelected(d)}
                className={`shrink-0 w-[50px] flex flex-col items-center gap-[2px] py-2 ${active ? 'bg-ink text-on-ink' : ''}`}
              >
                <span className={`font-mono text-[10px] tracking-[0.04em] ${active ? '' : 'text-ink-soft'}`}>{WEEKDAYS_SHORT[d.getDay()]}</span>
                <span className="font-display font-bold text-[20px] leading-tight">{d.getDate()}</span>
                <span className="font-mono text-[10px] leading-none h-[10px]">{has ? '•' : ' '}</span>
              </button>
            );
          })}
        </div>
        <div className={`hidden items-start justify-between overflow-x-auto -mx-1 ${tab === 'mine' ? '' : 'md:flex'}`}>
          {Array.from({ length: DAYS }, (_, i) => addDays(windowStart, i)).map((d) => {
            const active = dayKey(d) === dayKey(selected);
            const has = busyDays.has(dayKey(d));
            return (
              <button
                key={dayKey(d)}
                onClick={() => setSelected(d)}
                className={`shrink-0 flex flex-col items-center gap-[2px] px-[10px] py-2 transition ${active ? 'bg-ink text-on-ink' : 'hover:bg-surface-2'}`}
              >
                <span className={`font-mono text-[10px] tracking-[0.04em] ${active ? '' : 'text-ink-soft'}`}>{WEEKDAYS_SHORT[d.getDay()]}</span>
                <span className={`font-display font-bold text-[20px] leading-tight ${active ? '' : 'text-ink'}`}>{d.getDate()}</span>
                <span className={`font-mono text-[10px] leading-none h-[10px] ${active ? '' : 'text-ink'}`}>{has ? '•' : ' '}</span>
              </button>
            );
          })}
        </div>
        <Rule2 />

        {error && <div className="font-mono text-[12px] text-accent uppercase">{error}</div>}

        {tab === 'mine' ? (
          <MyEventsPanel />
        ) : byDay.length === 0 ? (
          <div className="flex flex-col items-start gap-3 py-2">
            <div className="text-[15px] text-ink-soft">
              {tab === 'mine' ? 'Вы ещё не предлагали ивентов.' : tab === 'going' ? 'В эти дни вы никуда не записаны.' : 'В эти дни ивентов нет.'}
            </div>
            <TextButton onClick={() => shift(7)}>Смотреть дальше →</TextButton>
          </div>
        ) : (
          byDay.map((g, gi) => (
            <React.Fragment key={g.key}>
              {gi > 0 && <Rule2 />}
              <SectionLabel>{dayTitle(g.date)}</SectionLabel>
              {g.items.map((o, i) => (
                <React.Fragment key={`${o.event.id}-${o.start.getTime()}`}>
                  {i > 0 && <Rule />}
                  <div className="md:hidden">
                    <MobileEventRow occ={o} meta={meta[o.event.id]} mine={tab === 'mine'} />
                  </div>
                  <div className="hidden md:block">
                    <EventRow occ={o} meta={meta[o.event.id]} friends={friendsBy[o.event.id] || 0} onGo={go} busy={busyId === o.event.id} mine={tab === 'mine'} />
                  </div>
                </React.Fragment>
              ))}
            </React.Fragment>
          ))
        )}
        <div className="md:hidden flex flex-col gap-6 pt-1">
          <Rule />
          <Link to={user ? '/events/new' : '/login'} className="btn-bracket self-center">+ Предложить ивент</Link>
        </div>
      </div>

      <VRule className="hidden lg:block" />

      <div className="hidden md:flex w-full lg:w-[340px] shrink-0 flex-col gap-6">
        {user && (
          <>
            <SectionLabel>Я иду · {goingList.length}</SectionLabel>
            {goingList.length ? (
              <div className="flex flex-col gap-[10px]">
                {goingList.slice(0, 6).map(({ e, next }) => (
                  <Link key={e.id} to={`/events/${e.id}`} className="hover:opacity-70">
                    <Leader label={e.title} value={`${WEEKDAYS_SHORT[next.start.getDay()]} ${hhmm(next.start)}`} />
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-[14px] text-ink-soft">Нажмите «Пойду» у ивента — он появится здесь.</div>
            )}
            <Rule />
            <SectionLabel>Друзья идут</SectionLabel>
            {friendsGoing.length ? (
              <div className="flex flex-col gap-[14px]">
                {friendsGoing.slice(0, 6).map((f) => {
                  const ev = eventById[f.event_id];
                  const next = ev ? nextOccurrence(ev) : null;
                  return (
                    <Link key={`${f.event_id}-${f.user.id}`} to={`/events/${f.event_id}`} className="flex gap-3 items-center hover:opacity-80">
                      <Avatar src={f.user.avatar_url} name={f.user.full_name} size={36} />
                      <span className="flex-1 min-w-0 flex flex-col gap-[2px]">
                        <span className="text-[14px] font-semibold text-ink truncate">{shortName(f.user.full_name)}</span>
                        <span className="font-mono text-[11px] tracking-[0.02em] text-ink-soft truncate">
                          {ev ? ev.title : 'Ивент'}
                          {next ? ` · ${WEEKDAYS_SHORT[next.start.getDay()]}` : ''}
                        </span>
                      </span>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="text-[14px] text-ink-soft">
                Пока никто из друзей не записался. <Link to="/friends" className="underline hover:text-ink">Найти друзей</Link>
              </div>
            )}
            <Rule2 />
          </>
        )}
        <p className="text-[14px] leading-[21px] text-ink-soft">Организуете что-то для студентов? Предложите ивент — после модерации он появится в ленте.</p>
        <PrimaryButton as={Link} to={user ? '/events/new' : '/login'} className="w-full">
          + Предложить ивент
        </PrimaryButton>
      </div>
    </div>
  );
};

export default Events;
