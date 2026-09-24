import React, { useEffect, useRef, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { RouteLoadingView, RouteEmptyState } from '../design/DottedPath';
import { Rule, Rule2, VRule, Leader, SectionLabel, PrimaryButton, OutlineButton, TextButton, Photo, Avatar, num } from './merchant/kit';
import { WEEKDAYS_SHORT, hhmm, ddmm, nextOccurrence, eventPrice, priceLabel } from '../utils/events';

/** D51 · Публичный профиль: слева человек и действия, справа — куда идёт и на что подписан. */

const Stat = ({ value, label }) => (
  <div className="flex-1 min-w-0 flex flex-col gap-1">
    <span className="font-display font-bold text-[22px] tracking-[-0.01em] text-ink">{value}</span>
    <span className="font-mono text-[10px] tracking-[0.04em] uppercase text-ink-soft">{label}</span>
  </div>
);

const Menu = ({ items }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const close = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);
  if (!items.length) return null;
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((v) => !v)} className="font-mono font-bold text-[14px] text-ink px-2 py-2 hover:text-accent" aria-label="Ещё">
        ···
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-20 bg-surface border border-ink min-w-[200px] py-1">
          {items.map((it) => (
            <button
              key={it.label}
              onClick={() => {
                setOpen(false);
                it.onClick();
              }}
              className="block w-full text-left px-4 py-2 font-mono text-[11px] tracking-[0.04em] uppercase text-ink hover:bg-surface-2"
            >
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const PublicProfile = () => {
  const { handle } = useParams();
  const navigate = useNavigate();
  const { user: me } = useAuth();
  const username = (handle || '').startsWith('@') ? handle.slice(1) : null;
  const [profile, setProfile] = useState(null);
  const [extras, setExtras] = useState(null);
  const [events, setEvents] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [status, setStatus] = useState(null);
  const [notFound, setNotFound] = useState(!username);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const loadStatus = (id) => {
    if (!me || !id || me.id === id) return;
    api.get(`/friends/status/${id}`).then((r) => setStatus(r.data)).catch(() => {});
  };

  const load = () => {
    if (!username) return;
    const u = encodeURIComponent(username);
    api
      .get(`/users/by-username/${u}`)
      .then((r) => {
        setProfile(r.data);
        loadStatus(r.data.id);
      })
      .catch(() => setNotFound(true));
    api.get(`/users/by-username/${u}/extras`).then((r) => setExtras(r.data)).catch(() => setExtras({}));
    api.get(`/users/by-username/${u}/attending`).then((r) => setEvents(r.data || [])).catch(() => setEvents([]));
    api
      .get(`/users/by-username/${u}/companies`)
      .then(async (r) => {
        let list = r.data || [];
        if (me && list.length) {
          // Эндпоинт компаний публичный и не знает зрителя — отмечаем подписки сами.
          const ids = await api.get('/subscriptions/companies/ids').then((x) => new Set(x.data || [])).catch(() => new Set());
          list = list.map((c) => ({ ...c, is_subscribed: ids.has(c.id) }));
        }
        setCompanies(list);
      })
      .catch(() => setCompanies([]));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username, me?.id]);

  if (notFound) return <RouteEmptyState title="Пользователь не найден" action={<Link to="/friends" className="btn-bracket">К друзьям</Link>} />;
  if (!profile || !extras) return <RouteLoadingView label="Загружаем профиль..." />;

  const name = profile.nickname || profile.full_name;
  const firstName = (name || '').split(' ')[0];
  const isSelf = me && me.id === profile.id;
  const st = status?.status || 'none';

  const act = async (fn) => {
    if (!me) return navigate('/login', { state: { from: { pathname: `/@${username}` } } });
    setBusy(true);
    setError('');
    try {
      await fn();
      loadStatus(profile.id);
      api.get(`/users/by-username/${encodeURIComponent(username)}/extras`).then((r) => setExtras(r.data)).catch(() => {});
    } catch (e) {
      setError(e.response?.data?.error || 'Не получилось');
    } finally {
      setBusy(false);
    }
  };

  const add = () => act(() => api.post('/friends/requests', { user_id: profile.id }));
  const accept = () => act(() => api.post(`/friends/requests/${status.friendship_id}/accept`));
  const reject = () => act(() => api.post(`/friends/requests/${status.friendship_id}/reject`));
  const cancel = () => act(() => api.post(`/friends/requests/${status.friendship_id}/cancel`));
  const remove = () => act(() => api.delete(`/friends/${profile.id}`));

  let primary;
  let menu = [];
  if (isSelf) {
    primary = <OutlineButton as={Link} to="/settings/profile" className="flex-1">Редактировать профиль</OutlineButton>;
  } else if (st === 'friends') {
    primary = <OutlineButton className="flex-1 pointer-events-none">✓ В друзьях</OutlineButton>;
    menu = [{ label: 'Удалить из друзей', onClick: remove }];
  } else if (st === 'pending_outgoing') {
    primary = <OutlineButton className="flex-1 pointer-events-none">Заявка отправлена</OutlineButton>;
    menu = [{ label: 'Отменить заявку', onClick: cancel }];
  } else if (st === 'pending_incoming') {
    primary = (
      <PrimaryButton className="flex-1" onClick={accept} disabled={busy}>
        Принять заявку
      </PrimaryButton>
    );
    menu = [{ label: 'Отклонить', onClick: reject }];
  } else {
    primary = (
      <PrimaryButton className="flex-1" onClick={add} disabled={busy}>
        + В друзья
      </PrimaryButton>
    );
  }

  const upcoming = events
    .map((e) => ({ e, next: nextOccurrence(e) }))
    .filter((x) => x.next.end >= new Date())
    .sort((a, b) => a.next.start - b.next.start)
    .slice(0, 5);

  const handleLine = [`@${profile.username}`, extras.university].filter(Boolean).join(' · ');

  return (
    <div className="flex flex-col gap-8">
      <div className="font-mono font-medium text-[11px] tracking-[0.06em] uppercase text-ink-soft whitespace-pre">
        <Link to="/friends" className="hover:text-ink">Друзья</Link>
        {'  /  '}@{profile.username}
      </div>
      <div className="flex flex-col lg:flex-row gap-10 lg:gap-14 items-start">
        <div className="w-full lg:w-[340px] shrink-0 flex flex-col gap-6">
          <Avatar src={extras.avatar_url} name={name} size={120} />
          <h1 className="font-display font-bold text-[24px] sm:text-[26px] leading-tight tracking-[-0.01em] text-ink break-words">{name}</h1>
          <div className="font-mono text-[12px] tracking-[0.02em] text-ink-soft -mt-3">{handleLine}</div>
          <div className="flex gap-4 items-center">
            {primary}
            <Menu items={menu} />
          </div>
          {error && <div className="font-mono text-[12px] text-accent uppercase -mt-3">{error}</div>}
          <div className="flex gap-4 items-stretch">
            <Stat value={extras.friends_count != null ? num(extras.friends_count) : '—'} label="Друзей" />
            <VRule />
            <Stat value={isSelf ? '—' : num(extras.mutual_count || 0)} label="Общих" />
            <VRule />
            <Stat value={extras.subscriptions_count != null ? num(extras.subscriptions_count) : '—'} label="Подписок" />
          </div>
          {!isSelf && extras.mutual?.length > 0 && (
            <>
              <Rule />
              <SectionLabel>Общие друзья</SectionLabel>
              <div className="flex items-center">
                {extras.mutual.map((m, i) => (
                  <Link
                    key={m.id}
                    to={m.username ? `/@${m.username}` : '#'}
                    title={m.full_name}
                    className={`rounded-full ring-2 ring-surface ${i > 0 ? '-ml-[10px]' : ''} hover:z-10`}
                  >
                    <Avatar src={m.avatar_url} name={m.full_name} size={36} />
                  </Link>
                ))}
              </div>
            </>
          )}
          <Rule />
          {extras.saved_hidden ? (
            <>
              <Leader label="Сэкономлено" value={<span className="text-ink-soft">СКРЫТО</span>} />
              <p className="text-[13px] leading-[19px] text-ink-soft -mt-3">{firstName} скрыл(а) это в настройках приватности.</p>
            </>
          ) : (
            <Leader label="Сэкономлено" value={<b>{num(extras.saved_total || 0)} ₽</b>} />
          )}
        </div>

        <VRule className="hidden lg:block" />

        <div className="flex-1 min-w-0 w-full flex flex-col gap-6">
          <SectionLabel>Планирует посетить</SectionLabel>
          {upcoming.length === 0 ? (
            <div className="text-[14px] text-ink-soft">
              {profile.attending_events_visible === false ? 'Список скрыт настройками приватности.' : 'Пока никуда не собирается.'}
            </div>
          ) : (
            upcoming.map(({ e, next }, i) => {
              const price = eventPrice(e);
              return (
                <React.Fragment key={e.id}>
                  {i > 0 && <Rule />}
                  <Link to={`/events/${e.id}`} className="flex gap-4 sm:gap-5 items-center group">
                    <Photo src={e.image_url} className="w-[96px] sm:w-[120px] h-[64px] sm:h-[80px] shrink-0 overflow-hidden" />
                    <span className="flex-1 min-w-0 flex flex-col gap-[6px]">
                      <span className="font-display font-bold text-[15px] sm:text-[16px] leading-tight tracking-[-0.01em] uppercase text-ink group-hover:text-accent truncate">
                        {e.title}
                      </span>
                      <span className="font-mono text-[11px] tracking-[0.03em] text-ink-soft">
                        {WEEKDAYS_SHORT[next.start.getDay()]} {ddmm(next.start)} · {hhmm(next.start)}
                      </span>
                    </span>
                    <span className={`font-mono font-bold text-[12px] whitespace-nowrap ${price > 0 ? 'text-ink' : 'text-accent'}`}>{priceLabel(price)}</span>
                  </Link>
                </React.Fragment>
              );
            })
          )}

          <Rule2 />
          <SectionLabel>Подписки{extras.subscriptions_count != null ? ` · ${extras.subscriptions_count}` : ''}</SectionLabel>
          {extras.subscriptions_count == null ? (
            <div className="text-[14px] text-ink-soft">Подписки скрыты настройками приватности.</div>
          ) : extras.subscriptions.length === 0 ? (
            <div className="text-[14px] text-ink-soft">Пока ни на кого не подписан(а).</div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-6">
              {extras.subscriptions.slice(0, 10).map((s) => (
                <div key={s.id} className="flex flex-col gap-2 min-w-0">
                  <Photo src={s.cover} className="w-full h-[80px] overflow-hidden" />
                  <span className="font-mono font-bold text-[11px] tracking-[0.03em] uppercase text-ink truncate">{s.name}</span>
                </div>
              ))}
            </div>
          )}

          {companies.length > 0 && (
            <>
              <Rule2 />
              <SectionLabel>Компании · {companies.length}</SectionLabel>
              <div className="flex flex-col gap-3">
                {companies.map((c) => (
                  <div key={c.id} className="flex items-center gap-3">
                    <span className="flex-1 min-w-0 flex flex-col gap-[2px]">
                      <span className="font-display font-bold text-[14px] uppercase text-ink truncate">{c.name}</span>
                      {c.description && <span className="text-[13px] text-ink-soft truncate">{c.description}</span>}
                    </span>
                    {me && !isSelf && (
                      <TextButton
                        onClick={() =>
                          act(async () => {
                            if (c.is_subscribed) await api.delete(`/companies/${c.id}/subscribe`);
                            else await api.post(`/companies/${c.id}/subscribe`);
                            setCompanies((list) => list.map((x) => (x.id === c.id ? { ...x, is_subscribed: !x.is_subscribed } : x)));
                          })
                        }
                      >
                        {c.is_subscribed ? '✓ Подписаны' : '+ Подписаться'}
                      </TextButton>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default PublicProfile;
