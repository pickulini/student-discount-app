import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { RouteLoadingView, RouteEmptyState } from '../design/DottedPath';
import { Rule, Rule2, VRule, Leader, SectionLabel, PrimaryButton, OutlineButton, TextButton, AlertBlock, Photo, Avatar, plural } from './merchant/kit';
import { yandexSearchUrl } from '../utils/mapLinks';
import { useMobileTop } from '../context/MobileChrome';
import { WEEKDAYS_SHORT, hhmm, ddmm, nextOccurrence, recurrenceLabel, eventPrice, loadEventMeta, goToEvent } from '../utils/events';

/** D31 · Ивент: обложка, описание, детали, «Пойду / Может быть», друзья, организатор. */

const sameDay = (a, b) => a.toDateString() === b.toDateString();

const EventDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [event, setEvent] = useState(null);
  const [meta, setMeta] = useState(null);
  const [friends, setFriends] = useState([]);
  const [subscribed, setSubscribed] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState(null);

  const load = async () => {
    try {
      const r = await api.get(`/events/${id}`);
      setEvent(r.data);
      const m = await loadEventMeta([Number(id)]);
      const mm = m[id] || m[Number(id)] || {};
      setMeta(mm);
      if (user) {
        api.get('/events/friends', { params: { event_id: id } }).then((f) => setFriends(f.data || [])).catch(() => {});
        if (mm.company_id) {
          api.get('/subscriptions/companies/ids').then((s) => setSubscribed((s.data || []).includes(mm.company_id))).catch(() => {});
        }
      }
    } catch {
      setNotFound(true);
    }
  };

  const [shared, setShared] = useState(false);
  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ title: document.title, url: window.location.href });
      else await navigator.clipboard.writeText(window.location.href);
      setShared(true);
      setTimeout(() => setShared(false), 1500);
    } catch {
      /* отмена */
    }
  };
  useMobileTop(
    {
      back: '/events',
      label: 'Ивенты',
      right: (
        <button onClick={share} className="btn-bracket text-[11px]">
          {shared ? 'Готово' : 'Поделиться'}
        </button>
      ),
    },
    [shared]
  );

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, user?.id]);

  if (notFound) return <RouteEmptyState title="Ивент не найден или скрыт" action={<Link to="/events" className="btn-bracket">Все ивенты</Link>} />;
  if (!event || !meta) return <RouteLoadingView label="Загружаем ивент..." />;

  const occ = nextOccurrence(event);
  const price = eventPrice(event, meta);
  const status = meta.my_status || event.my_attendee_status;
  const going = status === 'going';
  const interested = status === 'interested';
  const rec = recurrenceLabel(event);
  const place = meta.company_name || event.address || '';
  const photoCaption = [meta.company_name, event.address].filter(Boolean).join(' · ');
  const friendsGoing = friends.filter((f) => f.status === 'going' || f.status === 'interested');
  const published = event.status === 'published';
  const isOwner = user && event.organizer_id === user.id;

  const requireUser = () => {
    if (!user) {
      navigate('/login', { state: { from: { pathname: `/events/${id}` } } });
      return false;
    }
    return true;
  };

  const run = async (key, fn) => {
    if (!requireUser()) return;
    setBusy(key);
    setError(null);
    try {
      await fn();
      await load();
    } catch (e) {
      const msg = e.response?.data?.error || e.message || '';
      setError(
        /insufficient/i.test(msg)
          ? { title: 'Недостаточно средств', text: 'Пополните кошелёк и попробуйте ещё раз.', wallet: true }
          : { title: 'Не получилось', text: msg }
      );
    } finally {
      setBusy('');
    }
  };

  const onGo = () => run('go', () => goToEvent(event.id));
  const onMaybe = () => run('maybe', () => api.post(`/events/${event.id}/rsvp`, { status: interested ? 'none' : 'interested' }));
  const onLeave = () => run('leave', () => api.delete(`/events/${event.id}/schedule`));
  const onSubscribe = () =>
    run('sub', async () => {
      if (subscribed) await api.delete(`/companies/${meta.company_id}/subscribe`);
      else await api.post(`/companies/${meta.company_id}/subscribe`);
      setSubscribed(!subscribed);
    });

  const endLabel = sameDay(occ.start, occ.end) ? hhmm(occ.end) : `${WEEKDAYS_SHORT[occ.end.getDay()]} ${ddmm(occ.end)} · ${hhmm(occ.end)}`;
  const tags = (event.tags || []).map((t) => `#${String(t.name).replace(/\s+/g, '').toUpperCase()}`);

  const organizerName = meta.company_name || meta.organizer?.full_name || '';
  const friendNames = friendsGoing.map((f) => (f.user.full_name || '').split(' ')[0]).filter(Boolean);
  const friendsLine =
    friendNames.length > 2 ? `${friendNames.slice(0, 2).join(', ')} и ещё ${friendNames.length - 2}` : friendNames.join(' и ');

  const mobile = (
    <div className="md:hidden flex flex-col gap-5">
      <Photo src={event.image_url} className="w-full h-[240px] overflow-hidden">
        {photoCaption && <span className="absolute left-3 bottom-[12px] font-mono text-[10px] tracking-[0.06em] uppercase text-white/85">{photoCaption}</span>}
      </Photo>
      <div className="flex items-center justify-between font-mono text-[11px] tracking-[0.04em] whitespace-nowrap">
        <span className="text-ink-soft">ИВЕНТ № {String(event.id).padStart(4, '0')}</span>
        {rec && <span className="font-bold text-ink uppercase">{rec}</span>}
      </div>
      <h1 className="font-display font-bold text-[30px] leading-[1.15] tracking-[-0.02em] uppercase text-ink break-words">{event.title}</h1>
      {event.description && <p className="text-[15px] leading-[24px] text-ink-soft whitespace-pre-line">{event.description}</p>}
      {!published && (
        <AlertBlock title={event.status === 'pending_review' ? 'На модерации' : event.status === 'draft' ? 'Черновик' : 'Не опубликован'}>
          {event.status === 'pending_review' ? 'Ивент появится в ленте после проверки модератором.' : 'Ивент пока видите только вы.'}
        </AlertBlock>
      )}
      <Rule2 />
      <div className="flex flex-col gap-[10px]">
        <Leader label="Начало" value={`${WEEKDAYS_SHORT[occ.start.getDay()]} ${ddmm(occ.start)} · ${hhmm(occ.start)}`} />
        <Leader label="Окончание" value={endLabel} />
        {event.address && (
          <a href={yandexSearchUrl(event.address)} target="_blank" rel="noopener noreferrer">
            <Leader label="Место" value={`${event.address} →`} />
          </a>
        )}
        {organizerName && <Leader label="Организатор" value={organizerName} />}
        <Leader label={meta.max_uses ? 'Мест' : 'Идут'} value={meta.max_uses ? `${event.attendees_count || 0} / ${meta.max_uses}` : event.attendees_count || 0} />
        <div className="flex items-end gap-2">
          <span className="font-mono text-[12px] tracking-[0.03em] uppercase text-ink whitespace-nowrap">Вход студентам</span>
          <span className="flex-1 min-w-[8px] border-t border-dashed border-ink-faint h-[4px]" />
          <span className={`font-mono font-bold text-[12px] whitespace-nowrap ${price > 0 ? 'text-ink' : 'text-accent'}`}>
            {price > 0 ? `${Math.round(price).toLocaleString('ru-RU')} ₽` : 'БЕСПЛАТНО'}
          </span>
        </div>
      </div>
      <Rule2 />
      {user && friendsGoing.length > 0 && (
        <div className="flex items-center gap-4">
          <div className="flex -space-x-[10px] shrink-0">
            {friendsGoing.slice(0, 3).map((f) => (
              <span key={f.user.id} className="rounded-full ring-2 ring-bg">
                <Avatar src={f.user.avatar_url} name={f.user.full_name} size={34} />
              </span>
            ))}
          </div>
          <div className="flex-1 min-w-0 flex flex-col gap-[2px]">
            <span className="font-mono font-bold text-[11px] tracking-[0.06em] uppercase text-ink">Идут друзья</span>
            <span className="text-[13px] text-ink-soft truncate">{friendsLine}</span>
          </div>
        </div>
      )}
      {published && !isOwner && (
        <>
          <div className="grid grid-cols-2 gap-3">
            {going ? (
              <PrimaryButton className="w-full px-2 pointer-events-none">✓ Вы идёте</PrimaryButton>
            ) : (
              <PrimaryButton className="w-full px-2" onClick={onGo} disabled={busy !== ''}>
                {busy === 'go' ? '…' : price > 0 ? `Билет · ${Math.round(price).toLocaleString('ru-RU')} ₽` : '✓ Пойду'}
              </PrimaryButton>
            )}
            {going ? (
              price > 0 ? (
                <OutlineButton as={Link} to="/order" className="w-full px-2">Мой билет</OutlineButton>
              ) : (
                <OutlineButton className="w-full px-2" onClick={onLeave} disabled={busy !== ''}>
                  {busy === 'leave' ? '…' : 'Не пойду'}
                </OutlineButton>
              )
            ) : (
              <OutlineButton className="w-full px-2" onClick={onMaybe} disabled={busy !== ''}>
                {busy === 'maybe' ? '…' : interested ? '✓ Может быть' : 'Может быть'}
              </OutlineButton>
            )}
          </div>
          {error && (
            <AlertBlock title={error.title}>
              {error.text}{' '}
              {error.wallet && (
                <Link to="/wallet" className="underline text-on-ink">
                  В кошелёк
                </Link>
              )}
            </AlertBlock>
          )}
          <p className="text-[12px] text-ink-soft text-center">
            {price > 0 && !going ? 'Оплата с кошелька. ' : ''}Напомним за 2 часа до начала.
          </p>
        </>
      )}
      {isOwner && (
        <div className="text-[14px] text-ink-soft">
          Это ваш ивент. <Link to="/events?tab=mine" className="underline hover:text-ink">Все мои ивенты</Link>
        </div>
      )}
    </div>
  );

  return (
    <>
    {mobile}
    <div className="hidden md:flex flex-col gap-8">
      <div className="font-mono font-medium text-[11px] tracking-[0.06em] uppercase text-ink-soft whitespace-pre truncate">
        <Link to="/events" className="hover:text-ink">Ивенты</Link>
        {'  /  '}
        {WEEKDAYS_SHORT[occ.start.getDay()]} {ddmm(occ.start)}
        {'  /  '}
        {event.title.length > 28 ? `${event.title.slice(0, 28)}…` : event.title}
      </div>

      <div className="flex flex-col lg:flex-row gap-10 lg:gap-12 items-start">
        <div className="flex-1 min-w-0 w-full flex flex-col gap-6">
          <Photo src={event.image_url} className="w-full h-[240px] sm:h-[360px] lg:h-[440px] overflow-hidden">
            {photoCaption && (
              <span className="absolute left-[14px] bottom-[13px] font-mono text-[10px] tracking-[0.06em] uppercase text-white/85">{photoCaption}</span>
            )}
          </Photo>
          <div className="flex items-center justify-between font-mono text-[11px] tracking-[0.04em] whitespace-nowrap">
            <span className="text-ink-soft">ИВЕНТ № {String(event.id).padStart(4, '0')}</span>
            {rec && <span className="font-bold text-ink uppercase">{rec}</span>}
          </div>
          <h1 className="font-display font-bold text-[30px] sm:text-[44px] leading-[1.15] tracking-[-0.02em] uppercase text-ink">{event.title}</h1>
          {event.description && <p className="text-[17px] leading-[27px] text-ink-soft whitespace-pre-line">{event.description}</p>}
          {tags.length > 0 && <div className="font-mono text-[11px] tracking-[0.04em] text-ink-soft whitespace-pre-wrap">{tags.join('  ')}</div>}
          {!published && (
            <AlertBlock title={event.status === 'pending_review' ? 'На модерации' : event.status === 'draft' ? 'Черновик' : 'Не опубликован'}>
              {event.status === 'pending_review' ? 'Ивент появится в ленте после проверки модератором.' : 'Ивент пока видите только вы.'}
            </AlertBlock>
          )}
        </div>

        <VRule className="hidden lg:block" />

        <div className="w-full lg:w-[400px] shrink-0 flex flex-col gap-6">
          <SectionLabel>Детали</SectionLabel>
          <div className="flex flex-col gap-[10px]">
            <Leader label="Начало" value={`${WEEKDAYS_SHORT[occ.start.getDay()]} ${ddmm(occ.start)} · ${hhmm(occ.start)}`} />
            <Leader label="Окончание" value={endLabel} />
            {event.address && (
              <a href={yandexSearchUrl(event.address)} target="_blank" rel="noopener noreferrer" className="hover:opacity-70">
                <Leader label="Место" value={`${event.address} →`} />
              </a>
            )}
            <Leader label={meta.max_uses ? 'Мест' : 'Идут'} value={meta.max_uses ? `${event.attendees_count || 0} / ${meta.max_uses}` : event.attendees_count || 0} />
            <Rule />
            <div className="flex items-end gap-2">
              <span className="font-mono text-[13px] tracking-[0.03em] uppercase text-ink whitespace-nowrap">Вход студентам</span>
              <span className="flex-1 min-w-[8px] border-t border-dashed border-ink-faint h-[4px]" />
              <span className={`font-mono font-bold text-[13px] whitespace-nowrap ${price > 0 ? 'text-ink' : 'text-accent'}`}>
                {price > 0 ? `${Math.round(price).toLocaleString('ru-RU')} ₽` : 'БЕСПЛАТНО'}
              </span>
            </div>
          </div>

          {published && !isOwner && (
            <>
              {going ? (
                <PrimaryButton className="w-full pointer-events-none">✓ Вы идёте</PrimaryButton>
              ) : (
                <PrimaryButton className="w-full" onClick={onGo} disabled={busy !== ''}>
                  {busy === 'go' ? 'Записываем…' : price > 0 ? `Купить билет · ${Math.round(price).toLocaleString('ru-RU')} ₽` : '✓ Пойду'}
                </PrimaryButton>
              )}
              {going ? (
                price > 0 ? (
                  <OutlineButton as={Link} to="/order" className="w-full">Билет в заказах</OutlineButton>
                ) : (
                  <OutlineButton className="w-full" onClick={onLeave} disabled={busy !== ''}>
                    {busy === 'leave' ? '…' : 'Не пойду'}
                  </OutlineButton>
                )
              ) : (
                <OutlineButton className="w-full" onClick={onMaybe} disabled={busy !== ''}>
                  {busy === 'maybe' ? '…' : interested ? '✓ Может быть' : 'Может быть'}
                </OutlineButton>
              )}
              {error && (
                <AlertBlock title={error.title}>
                  {error.text}{' '}
                  {error.wallet && (
                    <Link to="/wallet" className="underline text-on-ink">
                      В кошелёк
                    </Link>
                  )}
                </AlertBlock>
              )}
              <p className="text-[12px] text-ink-soft text-center -mt-2">
                {price > 0 && !going ? 'Оплата с кошелька. ' : ''}Напомним за 2 часа до начала.
              </p>
            </>
          )}
          {isOwner && (
            <div className="text-[14px] text-ink-soft">
              Это ваш ивент. <Link to="/events?tab=mine" className="underline hover:text-ink">Все мои ивенты</Link>
            </div>
          )}

          {user && (
            <>
              <Rule2 />
              <SectionLabel>Идут друзья · {friendsGoing.length}</SectionLabel>
              {friendsGoing.length ? (
                <div className="flex flex-col gap-[14px]">
                  {friendsGoing.map((f) => (
                    <Link key={f.user.id} to={f.user.username ? `/@${f.user.username}` : '#'} className="flex gap-3 items-center hover:opacity-80">
                      <Avatar src={f.user.avatar_url} name={f.user.full_name} size={36} />
                      <span className="flex-1 min-w-0 flex flex-col gap-[2px]">
                        <span className="text-[14px] font-semibold text-ink truncate">{f.user.full_name}</span>
                        {f.user.username && <span className="font-mono text-[11px] text-ink-soft">@{f.user.username}</span>}
                      </span>
                      <span className="font-mono font-medium text-[11px] text-ink">{f.status === 'going' ? '✓' : '?'}</span>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-[14px] text-ink-soft">Из друзей пока никто не записался.</div>
              )}
            </>
          )}

          <Rule />
          {meta.company_id ? (
            <>
              <div className="flex gap-[14px] items-center">
                <Photo src={meta.company_logo || event.image_url} className="w-12 h-12 shrink-0 overflow-hidden" />
                <div className="flex-1 min-w-0 flex flex-col gap-[3px]">
                  <span className="font-display font-bold text-[14px] uppercase text-ink truncate">{meta.company_name}</span>
                  <span className="text-[13px] text-ink-soft">
                    {meta.company_events_week > 0
                      ? `${meta.company_events_week} ${plural(meta.company_events_week, 'ивент', 'ивента', 'ивентов')} на этой неделе`
                      : 'Место-партнёр'}
                  </span>
                </div>
              </div>
              {user && (
                <div>
                  <TextButton onClick={onSubscribe} disabled={busy === 'sub'}>{subscribed ? '✓ Вы подписаны' : '+ Подписаться'}</TextButton>
                </div>
              )}
            </>
          ) : (
            meta.organizer && (
              <Link to={meta.organizer.username ? `/@${meta.organizer.username}` : '#'} className="flex gap-[14px] items-center hover:opacity-80">
                <Avatar src={meta.organizer.avatar_url} name={meta.organizer.full_name} size={48} />
                <div className="flex-1 min-w-0 flex flex-col gap-[3px]">
                  <span className="font-display font-bold text-[14px] uppercase text-ink truncate">{meta.organizer.full_name}</span>
                  <span className="text-[13px] text-ink-soft">Организатор{meta.organizer.username ? ` · @${meta.organizer.username}` : ''}</span>
                </div>
              </Link>
            )
          )}
          {place && !meta.company_id && !meta.organizer && <div className="text-[14px] text-ink-soft">{place}</div>}
        </div>
      </div>
    </div>
    </>
  );
};

export default EventDetail;
