import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { RouteLoadingView } from '../design/DottedPath';
import { Rule, Rule2, VRule, TextButton, Photo, num, plural } from './merchant/kit';

/** D53 · Подписки: карточки мест по 4 в ряд, отписка прямо с карточки. */

const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : '');

const Card = ({ c, subscribed, onToggle, busy }) => {
  const kind = cap((c.description || c.category || '').split(/[.,\n]/)[0].trim()).slice(0, 40);
  const sub = [kind, c.locations > 1 ? `${c.locations} ${plural(c.locations, 'точка', 'точки', 'точек')}` : null].filter(Boolean).join(' · ');
  const counts = [
    c.offers > 0 ? `${c.offers} ${plural(c.offers, 'оффер', 'оффера', 'офферов')}` : null,
    c.events > 0 ? `${c.events} ${plural(c.events, 'ивент', 'ивента', 'ивентов')}` : null,
  ].filter(Boolean);
  const best = c.best_percent > 0 ? `−${num(c.best_percent)}%` : c.best_fixed > 0 ? `−${num(c.best_fixed)} ₽` : '';
  const bestLabel = best && c.offers > 1 ? `ДО ${best}` : best;

  return (
    <div className="flex-1 min-w-0 flex flex-col gap-3">
      <Link to={`/?q=${encodeURIComponent(c.name)}`} className="block">
        <Photo src={c.cover} className="w-full h-[150px] overflow-hidden" />
      </Link>
      <span className="font-display font-bold text-[16px] tracking-[-0.01em] uppercase text-ink truncate">{c.name}</span>
      {sub && <span className="text-[13px] text-ink-soft truncate -mt-1">{sub}</span>}
      <div className="flex gap-[10px] font-mono text-[11px] tracking-[0.03em] uppercase whitespace-nowrap">
        <span className="text-ink">{counts.length ? counts.join(' · ') : 'Сейчас нет акций'}</span>
        {bestLabel && <span className="font-bold text-accent">{bestLabel}</span>}
      </div>
      <div className="flex items-center justify-between font-mono text-[11px] tracking-[0.04em] whitespace-nowrap">
        {subscribed ? (
          <>
            <span className="font-bold text-ink">✓ ПОДПИСАНЫ</span>
            <button onClick={onToggle} disabled={busy} className="text-ink-soft hover:text-accent disabled:opacity-40">
              ОТПИСАТЬСЯ
            </button>
          </>
        ) : (
          <>
            <span className="text-ink-soft">ВЫ ОТПИСАЛИСЬ</span>
            <button onClick={onToggle} disabled={busy} className="font-bold text-ink hover:text-accent disabled:opacity-40">
              + ВЕРНУТЬ
            </button>
          </>
        )}
      </div>
    </div>
  );
};

const Subscriptions = () => {
  const [list, setList] = useState(null);
  const [off, setOff] = useState(new Set());
  const [busy, setBusy] = useState(null);

  useEffect(() => {
    api
      .get('/subscriptions/overview')
      .then((r) => setList(r.data || []))
      .catch(() => setList([]));
  }, []);

  if (!list) return <RouteLoadingView label="Загружаем подписки..." />;

  const toggle = async (c) => {
    setBusy(c.id);
    try {
      if (off.has(c.id)) {
        await api.post(`/companies/${c.id}/subscribe`);
        setOff((s) => {
          const n = new Set(s);
          n.delete(c.id);
          return n;
        });
      } else {
        await api.delete(`/companies/${c.id}/subscribe`);
        setOff((s) => new Set(s).add(c.id));
      }
    } catch {
      /* оставляем как было */
    } finally {
      setBusy(null);
    }
  };

  const active = list.length - off.size;
  const rows = [];
  for (let i = 0; i < list.length; i += 4) rows.push(list.slice(i, i + 4));

  return (
    <div className="flex flex-col gap-8">
      <div className="font-mono font-medium text-[11px] tracking-[0.06em] uppercase text-ink-soft whitespace-pre">
        <Link to="/profile" className="hover:text-ink">Профиль</Link>
        {'  /  '}Подписки
      </div>
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="font-display font-bold text-[30px] sm:text-[36px] leading-none tracking-[-0.02em] text-ink">ПОДПИСКИ · {active}</h1>
        <TextButton as={Link} to="/">Найти ещё места</TextButton>
      </div>
      <p className="text-[16px] text-ink-soft -mt-2">Первыми узнаёте о новых скидках и ивентах этих мест.</p>
      <Rule2 />
      {list.length === 0 ? (
        <div className="flex flex-col items-start gap-3">
          <div className="text-[15px] text-ink-soft">Вы пока ни на кого не подписаны. Откройте предложение и нажмите «Подписаться» у места.</div>
          <TextButton as={Link} to="/">К предложениям</TextButton>
        </div>
      ) : (
        rows.map((row, i) => (
          <React.Fragment key={row[0].id}>
            {i > 0 && <Rule />}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex gap-8 items-stretch">
              {row.map((c, j) => (
                <React.Fragment key={c.id}>
                  {j > 0 && <VRule className="hidden lg:block" />}
                  <Card c={c} subscribed={!off.has(c.id)} onToggle={() => toggle(c)} busy={busy === c.id} />
                </React.Fragment>
              ))}
              {Array.from({ length: 4 - row.length }).map((_, k) => (
                <React.Fragment key={`pad-${k}`}>
                  <VRule className="hidden lg:block invisible" />
                  <div className="hidden lg:block flex-1" />
                </React.Fragment>
              ))}
            </div>
          </React.Fragment>
        ))
      )}
    </div>
  );
};

export default Subscriptions;
