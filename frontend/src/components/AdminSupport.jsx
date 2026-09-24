import React, { useEffect, useRef, useState } from 'react';
import { Link, useOutletContext, useSearchParams } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { RouteLoadingView } from '../design/DottedPath';
import { Avatar, Rule, Rule2, Segmented, Tabs, VRule, ddmm, hhmm, num } from './merchant/kit';

/** A09 · Поддержка: очередь обращений слева, переписка справа, шаблоны и служебные заметки. */

const TEMPLATES = [
  {
    label: 'Бонусы в течение суток',
    text: 'Здравствуйте! Бонусы за приглашённого друга начисляются в течение суток после того, как он пройдёт верификацию.',
  },
  { label: 'Нужен номер заказа', text: 'Здравствуйте! Пришлите, пожалуйста, номер заказа — он есть в чеке, в разделе «Заказы».' },
  { label: 'Передали партнёру', text: 'Передали вопрос партнёру. Как только он ответит, напишем вам здесь.' },
];

const STATUSES = [
  { key: 'open', label: 'Открыт' },
  { key: 'in_progress', label: 'В работе' },
  { key: 'resolved', label: 'Решён' },
  { key: 'closed', label: 'Закрыт' },
];

const FILE_RE = /(\/uploads\/[^\s]+|https?:\/\/[^\s]+)/g;
const IS_FILE = /^(\/uploads\/[^\s]+|https?:\/\/[^\s]+)$/;
const IS_IMAGE = /\.(jpe?g|png|gif|webp)$/i;
const MessageText = ({ text }) =>
  String(text)
    .split(FILE_RE)
    .map((part, i) =>
      IS_FILE.test(part) ? (
        part.startsWith('/uploads/') && IS_IMAGE.test(part) ? (
          <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="inline-block">
            <img src={part} alt="Вложение" className="max-w-[240px] max-h-[180px] object-cover border border-dashed border-line" />
          </a>
        ) : (
          <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="underline break-all">
            {part.startsWith('/uploads/') ? 'Файл' : part}
          </a>
        )
      ) : (
        <React.Fragment key={i}>{part}</React.Fragment>
      )
    );

const no4 = (id) => `№ ${String(id).padStart(4, '0')}`;
const stamp = (d) => `${ddmm(d)} ${hhmm(d)}`;
const shortWait = (d) => {
  const m = Math.max(1, Math.floor((Date.now() - new Date(d).getTime()) / 60000));
  if (m < 60) return `${m} мин`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h} ч` : `${Math.floor(h / 24)} дн`;
};

const TicketItem = ({ t, active, onOpen }) => {
  const late = t.waiting && t.last_at && Date.now() - new Date(t.last_at).getTime() > 15 * 60 * 1000;
  return (
    <button onClick={onOpen} className={`text-left flex flex-col gap-2 ${active ? 'border-l-[3px] border-ink pl-4' : ''}`}>
      <span className="flex justify-between gap-3 font-mono text-[11px] tracking-[0.03em]">
        <span className="text-ink-soft truncate">
          {no4(t.id)} · {t.username ? `@${t.username}` : t.full_name}
        </span>
        {t.last_at && <span className="font-bold text-ink whitespace-nowrap uppercase">{shortWait(t.last_at)}</span>}
      </span>
      <span className="text-[16px] leading-[22px] text-ink">{t.subject}</span>
      {t.waiting && (
        <span className="font-mono font-bold text-[11px] tracking-[0.03em] uppercase text-ink">
          ● Ждёт ответа{late ? ' · > 15 мин' : ''}
        </span>
      )}
    </button>
  );
};

const Thread = ({ id, onChanged }) => {
  const { user } = useAuth();
  const [d, setD] = useState(null);
  const [text, setText] = useState('');
  const [note, setNote] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const endRef = useRef(null);

  const load = () =>
    api
      .get(`/admin/support/${id}`)
      .then((r) => setD(r.data))
      .catch(() => setError('Обращение не найдено'));

  useEffect(() => {
    setD(null);
    setText('');
    setNote(false);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'nearest' });
  }, [d]);

  if (!d) return error ? <span className="font-mono text-[12px] uppercase text-accent">{error}</span> : <RouteLoadingView label="Открываем переписку..." />;

  const t = d.ticket;
  const u = d.user || {};

  const setStatus = async (status) => {
    if (status === t.status) return;
    await api.put(`/admin/support/tickets/${t.id}/status`, { status }).catch(() => {});
    await load();
    onChanged();
  };

  const send = async (e) => {
    e?.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    setError('');
    try {
      if (note) await api.post(`/admin/support/${t.id}/note`, { message: text.trim() });
      else await api.post(`/admin/support/tickets/${t.id}/messages`, { message: text.trim() });
      setText('');
      setNote(false);
      await load();
      onChanged();
    } catch (err) {
      setError(err.response?.data?.error || 'Не отправилось');
    } finally {
      setBusy(false);
    }
  };

  const info = [
    u.university ? `${u.university}${u.student === 'verified' ? ' ✓' : ''}` : null,
    `${num(d.orders)} ${d.orders % 10 === 1 && d.orders % 100 !== 11 ? 'заказ' : 'заказов'}`,
    u.balance != null ? `баланс ${num(u.balance)} ₽` : null,
    d.referral ? `реферал @${d.referral.username}${d.referral.verified_at ? ` вериф. ${ddmm(d.referral.verified_at)}` : ''}` : null,
  ].filter(Boolean);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <span className="font-mono text-[11px] tracking-[0.04em] uppercase text-ink-soft">
          Обращение {no4(t.id)} · {stamp(t.created_at)}
        </span>
        <Segmented dense items={STATUSES} value={t.status} onChange={setStatus} />
      </div>
      <h2 className="font-display font-bold text-[24px] leading-[1.2] tracking-[-0.01em] text-ink">{t.subject}</h2>
      <div className="border-l border-ink pl-[14px] flex gap-3 items-center">
        <Avatar src={u.avatar_url} name={t.full_name} size={32} />
        <div className="flex-1 min-w-0 flex flex-col gap-[2px]">
          <span className="text-[15px] text-ink truncate">
            {t.full_name}
            {t.username ? ` · @${t.username}` : ''}
          </span>
          <span className="font-mono text-[10px] tracking-[0.04em] uppercase text-ink-soft truncate">{info.join(' · ')}</span>
        </div>
        <Link to={`/admin/users/${t.user_id}`} className="font-mono font-bold text-[11px] tracking-[0.04em] uppercase text-ink hover:text-accent whitespace-nowrap">
          Профиль →
        </Link>
      </div>
      <Rule2 />

      <div className="flex flex-col gap-6 max-h-[520px] overflow-y-auto pr-1">
        {d.messages.map((m) =>
          m.is_note ? (
            <div key={m.id} className="text-center font-mono text-[11px] tracking-[0.04em] uppercase text-ink-soft">
              - - - Служебная заметка: {m.message} - - -
            </div>
          ) : m.from_user ? (
            <div key={m.id} className="border-l border-dashed border-ink pl-[14px] flex flex-col gap-[6px] max-w-[75%]">
              <span className="font-mono font-bold text-[10px] tracking-[0.04em] uppercase text-ink">
                {t.username ? `@${t.username}` : t.full_name} · {stamp(m.created_at)}
              </span>
              <span className="text-[15px] leading-[23px] text-ink whitespace-pre-line"><MessageText text={m.message} /></span>
            </div>
          ) : (
            <div key={m.id} className="self-end text-right flex flex-col gap-[6px] max-w-[75%] ml-auto">
              <span className="font-mono text-[10px] tracking-[0.04em] uppercase text-ink-soft">
                {m.author_id === user?.id ? `Вы · ${m.author}` : m.author} · {stamp(m.created_at)}
              </span>
              <span className="text-[15px] leading-[23px] text-ink whitespace-pre-line"><MessageText text={m.message} /></span>
            </div>
          )
        )}
        <div ref={endRef} />
      </div>

      <Rule2 />
      <div className="flex gap-4 flex-wrap items-center font-mono text-[11px] tracking-[0.04em] uppercase">
        <span className="text-ink-soft">Шаблоны:</span>
        {TEMPLATES.map((x) => (
          <button key={x.label} type="button" onClick={() => setText(x.text)} className="font-bold uppercase text-ink hover:text-accent">
            [ {x.label} ]
          </button>
        ))}
      </div>
      <form onSubmit={send} className="flex gap-4 items-center border-b border-ink pb-[10px]">
        <textarea
          rows={1}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) send(e);
          }}
          placeholder={note ? 'Заметка для коллег — пользователь её не увидит' : 'Ответ…'}
          className="flex-1 min-w-0 bg-transparent outline-none resize-none text-[16px] leading-[24px] text-ink placeholder:text-ink-faint"
        />
        <button
          type="button"
          onClick={() => setNote((v) => !v)}
          className={`font-mono text-[11px] tracking-[0.04em] uppercase whitespace-nowrap ${note ? 'font-bold text-ink' : 'text-ink-soft hover:text-ink'}`}
        >
          {note ? '[×]' : '[ ]'} Заметка
        </button>
        <button
          type="submit"
          disabled={busy || !text.trim()}
          className="bg-ink text-on-ink font-mono font-bold text-[11px] tracking-[0.04em] uppercase px-[10px] py-[6px] disabled:opacity-40"
        >
          {busy ? '…' : 'Отправить'}
        </button>
      </form>
      {error && <span className="font-mono text-[12px] uppercase text-accent">{error}</span>}
    </div>
  );
};

const AdminSupport = () => {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') || 'open';
  const selected = params.get('id');
  const { refreshCounters } = useOutletContext() || {};
  const { events } = useNotifications();
  const [data, setData] = useState(null);

  const load = () =>
    api
      .get('/admin/support/queue', { params: { tab } })
      .then((r) => setData(r.data))
      .catch(() => setData({ items: [], counts: {} }));

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, events?.new_support_ticket?.ts, events?.support_message?.ts]);

  // Первое обращение открываем сразу.
  useEffect(() => {
    if (!selected && data?.items?.length) {
      const p = new URLSearchParams(params);
      p.set('id', data.items[0].id);
      setParams(p, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const open = (id) => {
    const p = new URLSearchParams(params);
    p.set('id', id);
    setParams(p, { replace: true });
  };

  const counts = data?.counts || {};
  const tabs = [
    { key: 'open', label: `Открыт · ${counts.open ?? 0}` },
    { key: 'in_progress', label: `В работе · ${counts.in_progress ?? 0}` },
    { key: 'resolved', label: 'Решён' },
    { key: 'all', label: 'Все' },
  ];

  return (
    <div className="flex flex-col xl:flex-row gap-10 items-start">
      <div className="w-full xl:w-[360px] shrink-0 flex flex-col gap-6">
        <h1 className="font-display font-bold text-[28px] sm:text-[32px] leading-none tracking-[-0.02em] text-ink uppercase">Поддержка</h1>
        <Tabs
          items={tabs}
          value={tab}
          onChange={(v) => {
            setParams({ tab: v }, { replace: true });
          }}
        />
        {!data ? (
          <RouteLoadingView label="Загружаем обращения..." />
        ) : data.items.length === 0 ? (
          <span className="text-[15px] text-ink-soft">{tab === 'open' ? 'Новых обращений нет.' : 'Здесь пусто.'}</span>
        ) : (
          data.items.map((t, i) => (
            <React.Fragment key={t.id}>
              {i > 0 && <Rule />}
              <TicketItem t={t} active={String(t.id) === selected} onOpen={() => open(t.id)} />
            </React.Fragment>
          ))
        )}
      </div>

      <VRule className="hidden xl:block" />

      <div className="flex-1 min-w-0 w-full">
        {selected ? (
          <Thread
            id={selected}
            onChanged={() => {
              load();
              refreshCounters?.();
            }}
          />
        ) : (
          <span className="text-[15px] text-ink-soft">Выберите обращение слева.</span>
        )}
      </div>
    </div>
  );
};

export default AdminSupport;
