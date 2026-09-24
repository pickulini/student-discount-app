import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/client';
import { RouteLoadingView } from '../design/DottedPath';
import { Rule, Rule2, VRule, SectionLabel, SmallButton, TextButton } from './merchant/kit';
import { useNotifications } from '../context/NotificationContext';
import { useMobileTop } from '../context/MobileChrome';

/**
 * D54 · Уведомления: слева категории со счётчиками новых,
 * справа — лента по дням. Заявку в друзья можно принять прямо здесь.
 */

const PAGE = 30;

const CATS = [
  { key: 'orders', label: 'Заказы', types: ['order_paid', 'order_refunded'] },
  { key: 'offers', label: 'Офферы', types: ['new_offer', 'offer_admin_edited'] },
  { key: 'events', label: 'Ивенты', types: ['new_event', 'friend_going', 'event_reminder'] },
  { key: 'friends', label: 'Друзья', types: ['friend_request', 'friend_accepted'] },
  { key: 'verification', label: 'Верификация', types: ['verification_done', 'verification_rejected'] },
  { key: 'bonus', label: 'Бонусы', types: ['bonus_credited'] },
  { key: 'support', label: 'Поддержка', types: ['support_reply'] },
];
const catOf = (n) => CATS.find((c) => c.types.includes(n.type))?.key || 'other';
const catLabel = (n) => {
  const c = CATS.find((x) => x.types.includes(n.type));
  if (!c) return 'Сервис';
  if (c.key === 'offers') return 'Оффер';
  if (c.key === 'events') return 'Ивент';
  if (c.key === 'orders') return 'Заказ';
  return c.label;
};

const dayLabel = (d) => {
  const x = new Date(d);
  const today = new Date();
  const y = new Date();
  y.setDate(today.getDate() - 1);
  const dm = x.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
  if (x.toDateString() === today.toDateString()) return `Сегодня · ${dm}`;
  if (x.toDateString() === y.toDateString()) return `Вчера · ${dm}`;
  const wd = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'][x.getDay()];
  return `${wd} · ${x.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: x.getFullYear() !== today.getFullYear() ? '2-digit' : undefined })}`;
};
const hhmm = (d) => new Date(d).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

const Row = ({ n, onOpen, onAccept, onReject, requestState }) => {
  const unread = !n.read_at;
  const text = [n.title, n.body].filter(Boolean).join('. ').replace(/\.\./g, '.');
  const isRequest = n.type === 'friend_request' && n.reference_id;
  return (
    <div className="flex flex-col sm:flex-row gap-2 sm:gap-6 items-start py-1">
      <div className="flex gap-2 items-center w-[64px] shrink-0 whitespace-nowrap">
        <span className="font-mono text-[10px] text-ink w-[8px]">{unread ? '●' : ''}</span>
        <span className={`font-mono font-bold text-[13px] ${unread ? 'text-ink' : 'text-ink-soft'}`}>{hhmm(n.created_at)}</span>
      </div>
      <div className="sm:w-[170px] shrink-0 font-mono font-medium text-[11px] tracking-[0.06em] uppercase text-ink-soft truncate">{catLabel(n)}</div>
      <button onClick={() => onOpen(n)} className="flex-1 min-w-0 text-left">
        <span className={`block text-[15px] leading-[22px] ${unread ? 'font-medium text-ink' : 'text-ink-soft'} hover:text-accent transition`}>{text}</span>
      </button>
      {isRequest && requestState !== 'done' ? (
        <div className="flex gap-[14px] items-center shrink-0">
          <SmallButton onClick={() => onAccept(n)} disabled={requestState === 'busy'}>Принять</SmallButton>
          <button onClick={() => onReject(n)} disabled={requestState === 'busy'} className="font-mono text-[11px] tracking-[0.04em] text-ink-soft hover:text-accent">
            ОТКЛОНИТЬ
          </button>
        </div>
      ) : n.link ? (
        <button onClick={() => onOpen(n)} className="font-mono text-[13px] text-ink shrink-0 hover:text-accent" aria-label="Открыть">
          →
        </button>
      ) : null}
    </div>
  );
};

/** Строка на телефоне (макет 54): время и точка слева, категория, текст, кнопки заявки. */
const MobileRow = ({ n, onOpen, onAccept, onReject, requestState }) => {
  const unread = !n.read_at;
  const text = [n.title, n.body].filter(Boolean).join('. ').replace(/\.\./g, '.');
  const isRequest = n.type === 'friend_request' && n.reference_id;
  return (
    <div className="flex gap-4 items-start">
      <div className="w-[42px] shrink-0 flex flex-col gap-[6px]">
        <span className={`font-mono font-bold text-[13px] ${unread ? 'text-ink' : 'text-ink-soft'}`}>{hhmm(n.created_at)}</span>
        {unread && <span className="w-[5px] h-[5px] rounded-full bg-ink" />}
      </div>
      <div className="flex-1 min-w-0 flex flex-col gap-[6px]">
        <span className="font-mono font-medium text-[10px] tracking-[0.06em] uppercase text-ink-soft truncate">{catLabel(n)}</span>
        <button onClick={() => onOpen(n)} className="text-left">
          <span className={`block text-[15px] leading-[22px] ${unread ? 'text-ink' : 'text-ink-soft'}`}>{text}</span>
        </button>
        {isRequest && requestState !== 'done' && (
          <div className="flex gap-[14px] items-center pt-1">
            <SmallButton onClick={() => onAccept(n)} disabled={requestState === 'busy'}>Принять</SmallButton>
            <button onClick={() => onReject(n)} disabled={requestState === 'busy'} className="font-mono text-[11px] tracking-[0.04em] text-ink-soft">
              ОТКЛОНИТЬ
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

const Notifications = () => {
  const navigate = useNavigate();
  const { refreshCount } = useNotifications();
  const [items, setItems] = useState(null);
  const [more, setMore] = useState(true);
  const [cat, setCat] = useState('all');
  const [req, setReq] = useState({});
  const [error, setError] = useState('');
  const readAllRef = useRef(null);
  useMobileTop({
    back: '/profile',
    label: 'Профиль',
    right: (
      <button onClick={() => readAllRef.current?.()} className="btn-bracket text-[11px]">
        Прочитать все
      </button>
    ),
  });

  const load = async (offset = 0) => {
    const r = await api.get('/notifications', { params: { limit: PAGE, offset } }).catch(() => ({ data: [] }));
    const list = r.data || [];
    setItems((prev) => (offset ? [...(prev || []), ...list] : list));
    setMore(list.length === PAGE);
  };

  useEffect(() => {
    load();
  }, []);

  const unreadBy = useMemo(() => {
    const m = { all: 0 };
    (items || []).forEach((n) => {
      if (!n.read_at) {
        m.all += 1;
        const k = catOf(n);
        m[k] = (m[k] || 0) + 1;
      }
    });
    return m;
  }, [items]);

  if (!items) return <RouteLoadingView label="Загружаем уведомления..." />;

  const markRead = (n) => {
    if (n.read_at) return;
    setItems((list) => list.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)));
    api.post(`/notifications/${n.id}/read`).then(() => refreshCount()).catch(() => {});
  };

  const open = (n) => {
    markRead(n);
    if (n.link) navigate(n.link);
  };

  const respond = async (n, accept) => {
    setReq((s) => ({ ...s, [n.id]: 'busy' }));
    setError('');
    try {
      await api.post(`/friends/requests/${n.reference_id}/${accept ? 'accept' : 'reject'}`);
      setReq((s) => ({ ...s, [n.id]: 'done' }));
      markRead(n);
    } catch (e) {
      // Заявку уже обработали в другом месте — просто прячем кнопки.
      setReq((s) => ({ ...s, [n.id]: 'done' }));
      const msg = e.response?.data?.error || '';
      if (!/обработана|не найдена/.test(msg)) setError(msg || 'Не получилось');
    }
  };

  const readAll = async () => {
    await api.post('/notifications/read-all').catch(() => {});
    const now = new Date().toISOString();
    setItems((list) => list.map((x) => ({ ...x, read_at: x.read_at || now })));
    refreshCount();
  };

  readAllRef.current = readAll;

  const visible = cat === 'all' ? items : items.filter((n) => catOf(n) === cat);
  const groups = [];
  visible.forEach((n) => {
    const k = new Date(n.created_at).toDateString();
    let g = groups.find((x) => x.key === k);
    if (!g) {
      g = { key: k, label: dayLabel(n.created_at), items: [] };
      groups.push(g);
    }
    g.items.push(n);
  });

  const CatRow = ({ k, label }) => {
    const active = cat === k;
    const count = unreadBy[k] || 0;
    return (
      <button onClick={() => setCat(k)} className="flex items-end gap-2 w-full text-left group">
        <span className={`font-mono text-[12px] tracking-[0.03em] uppercase whitespace-nowrap ${active ? 'font-bold text-ink' : 'text-ink group-hover:text-accent'}`}>{label}</span>
        <span className="flex-1 min-w-[8px] border-t border-dashed border-ink-faint h-[4px]" />
        <span className={`font-mono text-[12px] whitespace-nowrap ${active ? 'font-bold' : ''} text-ink`}>{k === 'all' ? `${count} нов.` : count}</span>
      </button>
    );
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 md:gap-10 lg:gap-14 items-start">
      <div className="md:hidden w-full flex flex-col gap-6">
        <h1 className="font-display font-bold text-[34px] leading-none tracking-[-0.02em] text-ink">УВЕДОМЛЕНИЯ</h1>
        <div className="flex items-center gap-4 overflow-x-auto no-scrollbar -mx-5 px-5">
          {[{ key: 'all', label: unreadBy.all ? `Все · ${unreadBy.all}` : 'Все' }, ...CATS].map((c) =>
            c.key === cat ? (
              <span key={c.key} className="shrink-0 bg-ink text-white font-mono font-bold text-[12px] tracking-[0.04em] uppercase px-[6px] py-[2px] whitespace-nowrap">
                {c.label}
              </span>
            ) : (
              <button key={c.key} onClick={() => setCat(c.key)} className="shrink-0 font-mono text-[12px] tracking-[0.04em] uppercase text-ink-soft whitespace-nowrap">
                {c.label}
              </button>
            )
          )}
        </div>
        <Rule2 />
      </div>
      <div className="hidden md:flex w-full lg:w-[280px] shrink-0 flex-col gap-6">
        <h1 className="font-display font-bold text-[26px] leading-none tracking-[-0.02em] text-ink">УВЕДОМЛЕНИЯ</h1>
        <div className="flex flex-col gap-[10px]">
          <CatRow k="all" label="Все" />
          {CATS.map((c) => (
            <CatRow key={c.key} k={c.key} label={c.label} />
          ))}
        </div>
        <Rule />
        <div className="flex flex-col items-start gap-3">
          <TextButton onClick={readAll} disabled={!unreadBy.all}>Прочитать все</TextButton>
          <TextButton as={Link} to="/settings/notifications">Настроить уведомления</TextButton>
        </div>
      </div>

      <VRule className="hidden lg:block" />

      <div className="flex-1 min-w-0 w-full flex flex-col gap-6">
        {error && <div className="font-mono text-[12px] text-accent uppercase">{error}</div>}
        {groups.length === 0 ? (
          <div className="text-[15px] text-ink-soft">{cat === 'all' ? 'Уведомлений пока нет.' : 'В этой категории пока пусто.'}</div>
        ) : (
          groups.map((g, gi) => (
            <React.Fragment key={g.key}>
              {gi > 0 && <Rule2 />}
              <SectionLabel>{g.label}</SectionLabel>
              <div className="flex flex-col gap-[14px]">
                {g.items.map((n, i) => (
                  <React.Fragment key={n.id}>
                    {i > 0 && <Rule />}
                    <div className="md:hidden">
                      <MobileRow n={n} onOpen={open} onAccept={(x) => respond(x, true)} onReject={(x) => respond(x, false)} requestState={req[n.id]} />
                    </div>
                    <div className="hidden md:block">
                      <Row n={n} onOpen={open} onAccept={(x) => respond(x, true)} onReject={(x) => respond(x, false)} requestState={req[n.id]} />
                    </div>
                  </React.Fragment>
                ))}
              </div>
            </React.Fragment>
          ))
        )}
        {more && (
          <div className="flex justify-center">
            <TextButton onClick={() => load(items.length)}>Показать ещё</TextButton>
          </div>
        )}
      </div>
    </div>
  );
};

export default Notifications;
