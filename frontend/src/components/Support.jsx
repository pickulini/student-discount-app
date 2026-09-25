import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../api/client';
import { RouteLoadingView } from '../design/DottedPath';
import { useMobileTop } from '../context/MobileChrome';
import { Rule, Rule2, VRule, SectionLabel, PrimaryButton, SmallButton, TextButton } from './merchant/kit';

/** D55 · Поддержка: слева обращения, справа переписка или новое обращение. */

const pad4 = (n) => String(n).padStart(4, '0');
const ddmm = (d) => new Date(d).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
const hhmm = (d) => new Date(d).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
const isOpen = (t) => t.status === 'open' || t.status === 'in_progress';

const ago = (d) => {
  const min = Math.max(0, Math.round((Date.now() - new Date(d)) / 60000));
  if (min < 1) return 'ТОЛЬКО ЧТО';
  if (min < 60) return `${min} МИН НАЗАД`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} Ч НАЗАД`;
  return ddmm(d);
};

// Ссылки на загруженные файлы показываем кликабельными.
const FILE_RE = /(\/uploads\/[^\s]+|https?:\/\/[^\s]+)/g;
const IS_FILE = /^(\/uploads\/[^\s]+|https?:\/\/[^\s]+)$/;
const MessageText = ({ text }) =>
  String(text)
    .split(FILE_RE)
    .map((part, i) =>
      IS_FILE.test(part) ? (
        <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="underline break-all">
          {part.startsWith('/uploads/') ? 'Файл' : part}
        </a>
      ) : (
        <React.Fragment key={i}>{part}</React.Fragment>
      )
    );

const TicketItem = ({ t, active, onClick }) => {
  const open = isOpen(t);
  const fresh = open && t.last_from_staff;
  return (
    <button onClick={onClick} className={`w-full text-left flex flex-col gap-[6px] ${active ? 'md:border-l-[3px] md:border-ink md:pl-[14px]' : ''}`}>
      <span className={`flex items-center justify-between font-mono text-[11px] tracking-[0.04em] whitespace-nowrap ${open ? '' : 'text-ink-soft'}`}>
        <span className="text-ink-soft">№ {pad4(t.id)}</span>
        <span className={`font-bold ${open ? 'text-ink' : ''}`}>{open ? 'ОТКРЫТО' : 'ЗАКРЫТО'}</span>
      </span>
      <span className={`text-[15px] font-semibold ${open ? 'text-ink' : 'text-ink-soft'}`}>{t.subject}</span>
      <span className="flex gap-[10px] font-mono text-[11px] tracking-[0.02em] whitespace-nowrap">
        {open ? (
          <>
            <span className="text-ink-soft">
              {t.last_from_staff ? 'ОТВЕТ' : 'ОТПРАВЛЕНО'} {ago(t.last_message_at || t.updated_at)}
            </span>
            {fresh && <span className="font-bold text-ink">● НОВЫЙ ОТВЕТ</span>}
          </>
        ) : (
          <span className="text-ink-soft">{ddmm(t.closed_at || t.updated_at)} · РЕШЕНО</span>
        )}
      </span>
    </button>
  );
};

const Support = () => {
  const [params, setParams] = useSearchParams();
  const orderRef = params.get('order');
  const topic = params.get('topic');
  const prefill = orderRef
    ? `Проблема с заказом № ${String(orderRef).padStart(6, '0')}`
    : topic === 'verification'
      ? 'Верификация отклонена'
      : '';
  const [tickets, setTickets] = useState(null);
  const [activeId, setActiveId] = useState(null);
  const [creating, setCreating] = useState(Boolean(prefill));
  const [thread, setThread] = useState([]);
  const [text, setText] = useState('');
  const [subject, setSubject] = useState(prefill);
  const [first, setFirst] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef(null);
  const bottomRef = useRef(null);
  const formRef = useRef(null);
  const subjectRef = useRef(null);
  // Телефон: список обращений и переписка — отдельные экраны (макеты 55 и 56).
  const [chatOpen, setChatOpen] = useState(false);
  const activeStatus = tickets?.find((t) => t.id === activeId)?.status;
  const chatShown = chatOpen && !creating && activeStatus;
  useMobileTop(
    chatShown
      ? {
          label: 'Обращения',
          onBack: () => setChatOpen(false),
          right: (
            <span className="font-mono font-medium text-[11px] tracking-[0.06em] uppercase text-ink">
              {activeStatus === 'open' || activeStatus === 'in_progress' ? 'Открыто' : 'Закрыто'}
            </span>
          ),
        }
      : { back: '/profile', label: 'Профиль' },
    [chatShown, activeStatus]
  );

  const loadTickets = () =>
    api
      .get('/support/overview')
      .then((r) => {
        const list = r.data || [];
        setTickets(list);
        setActiveId((cur) => cur ?? (prefill ? null : list[0]?.id ?? null));
        if (!list.length) setCreating(true);
        return list;
      })
      .catch(() => setTickets([]));

  const loadThread = (id) =>
    id &&
    api
      .get(`/support/tickets/${id}/thread`)
      .then((r) => setThread(r.data || []))
      .catch(() => setThread([]));

  useEffect(() => {
    loadTickets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!activeId || creating) return undefined;
    loadThread(activeId);
    const t = setInterval(() => {
      loadThread(activeId);
      loadTickets();
    }, 20000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, creating]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'nearest' });
  }, [thread.length]);

  if (!tickets) return <RouteLoadingView label="Загружаем обращения..." />;

  const active = tickets.find((t) => t.id === activeId);

  const send = async (e) => {
    e?.preventDefault();
    const msg = text.trim();
    if (!msg || !active) return;
    setBusy(true);
    setError('');
    try {
      await api.post(`/support/tickets/${active.id}/messages`, { message: msg });
      setText('');
      await loadThread(active.id);
      loadTickets();
    } catch (err) {
      setError(err.response?.data?.error || 'Не отправилось');
    } finally {
      setBusy(false);
    }
  };

  const attach = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !active) return;
    if (file.size > 5 * 1024 * 1024) return setError('Файл больше 5 МБ');
    setBusy(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const r = await api.post('/users/upload-avatar', fd);
      await api.post(`/support/tickets/${active.id}/messages`, { message: `${text.trim() ? `${text.trim()}\n` : ''}${r.data.url}` });
      setText('');
      await loadThread(active.id);
      loadTickets();
    } catch (err) {
      setError(err.response?.data?.error || 'Не удалось прикрепить файл');
    } finally {
      setBusy(false);
    }
  };

  const create = async (e) => {
    e.preventDefault();
    if (!subject.trim() || !first.trim()) return setError('Заполните тему и сообщение');
    setBusy(true);
    setError('');
    try {
      const r = await api.post('/support/tickets', { subject: subject.trim(), first_message: first.trim() });
      setCreating(false);
      setSubject('');
      setFirst('');
      if (prefill) setParams({}, { replace: true });
      await loadTickets();
      setActiveId(r.data.id);
    } catch (err) {
      setError(err.response?.data?.error || 'Не удалось создать обращение');
    } finally {
      setBusy(false);
    }
  };

  const close = async () => {
    if (!active) return;
    setBusy(true);
    try {
      await api.post(`/support/tickets/${active.id}/close`);
      await loadTickets();
    } finally {
      setBusy(false);
    }
  };

  let lastDay = null;

  return (
    <div className="flex flex-col lg:flex-row gap-6 md:gap-10 lg:gap-12 items-start">
      <div className={`${chatShown ? 'hidden md:flex' : 'flex'} w-full lg:w-[400px] shrink-0 flex-col gap-6`}>
        <h1 className="font-display font-bold text-[34px] md:text-[30px] leading-none tracking-[-0.02em] text-ink">ПОДДЕРЖКА</h1>
        <p className="text-[14px] text-ink-soft -mt-2">Отвечаем с 9:00 до 23:00, обычно за 15 минут.</p>
        <PrimaryButton
          className="w-full"
          onClick={() => {
            setCreating(true);
            setChatOpen(false);
            setError('');
            // Форма может быть ниже списка обращений (на телефоне) — показываем её и ставим курсор в тему.
            setTimeout(() => {
              formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              subjectRef.current?.focus({ preventScroll: true });
            }, 50);
          }}
        >
          + Новое обращение
        </PrimaryButton>
        <Rule2 />
        <SectionLabel>Ваши обращения</SectionLabel>
        {tickets.length === 0 ? (
          <div className="text-[14px] text-ink-soft">Обращений пока не было.</div>
        ) : (
          tickets.map((t, i) => (
            <React.Fragment key={t.id}>
              {i > 0 && <Rule />}
              <TicketItem
                t={t}
                active={!creating && t.id === activeId}
                onClick={() => {
                  setCreating(false);
                  setActiveId(t.id);
                  setChatOpen(true);
                  setError('');
                  window.scrollTo(0, 0);
                }}
              />
            </React.Fragment>
          ))
        )}
      </div>

      <VRule className="hidden lg:block" />

      <div className={`${chatShown || creating || !active ? 'flex' : 'hidden md:flex'} flex-1 min-w-0 w-full flex-col gap-6`}>
        {creating || !active ? (
          <form ref={formRef} onSubmit={create} className="flex flex-col gap-6 scroll-mt-6">
            <Rule2 className="md:hidden" />
            <div className="font-mono text-[11px] tracking-[0.04em] text-ink-soft">
              НОВОЕ ОБРАЩЕНИЕ<span className="md:hidden"> — ФОРМА</span>
            </div>
            <label className="flex flex-col gap-2">
              <span className="font-mono font-medium text-[11px] tracking-[0.06em] uppercase text-ink-soft">Тема</span>
              <input
                ref={subjectRef}
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                maxLength={200}
                placeholder="Коротко: что случилось"
                className="bg-transparent pb-[10px] border-b border-dashed border-line focus:border-solid focus:border-ink outline-none text-[16px] text-ink placeholder:text-ink-faint"
              />
            </label>
            <label className="flex flex-col gap-2">
              <span className="font-mono font-medium text-[11px] tracking-[0.06em] uppercase text-ink-soft">Сообщение</span>
              <textarea
                value={first}
                onChange={(e) => setFirst(e.target.value)}
                rows={3}
                placeholder="Опишите проблему: номер заказа, место, что пошло не так"
                className="bg-transparent pb-[10px] border-b border-dashed border-line focus:border-solid focus:border-ink outline-none text-[16px] leading-[24px] text-ink placeholder:text-ink-faint resize-y"
              />
            </label>
            {error && <div className="font-mono text-[12px] text-accent uppercase">{error}</div>}
            <div className="flex items-center gap-6">
              <PrimaryButton type="submit" disabled={busy} className="flex-1 md:flex-none">
                {busy ? 'Отправляем…' : (
                  <>
                    <span className="md:hidden">Создать</span>
                    <span className="hidden md:inline">Отправить</span>
                  </>
                )}
              </PrimaryButton>
              {tickets.length > 0 && (
                <TextButton type="button" onClick={() => setCreating(false)}>
                  Отмена
                </TextButton>
              )}
            </div>
          </form>
        ) : (
          <>
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <span className="font-mono text-[11px] tracking-[0.04em] text-ink-soft">
                ОБРАЩЕНИЕ № {pad4(active.id)}<span className="hidden md:inline"> · {isOpen(active) ? 'ОТКРЫТО' : 'ЗАКРЫТО'}</span>
              </span>
              {isOpen(active) && <TextButton className="hidden md:inline-flex" onClick={close} disabled={busy}>Вопрос решён — закрыть</TextButton>}
            </div>
            <h2 className="font-display font-bold text-[20px] md:text-[24px] leading-tight -mt-3 md:mt-0 tracking-[-0.01em] text-ink">{active.subject}</h2>
            <Rule2 />
            <div className="flex flex-col gap-6">
              {thread.map((m) => {
                const day = new Date(m.created_at).toDateString();
                const sep = lastDay && day !== lastDay;
                lastDay = day;
                return (
                  <React.Fragment key={m.id}>
                    {sep && <div className="text-center font-mono text-[11px] tracking-[0.04em] text-ink-faint whitespace-pre">{`- - -  ${ddmm(m.created_at)}  - - -`}</div>}
                    {m.mine ? (
                      <div className="flex justify-end pl-8 md:pl-[120px] xl:pl-[240px]">
                        <div className="flex flex-col items-end gap-[6px] min-w-0">
                          <span className="font-mono font-bold text-[10px] tracking-[0.06em] text-ink-soft whitespace-nowrap">
                            ВЫ · {ddmm(m.created_at)} {hhmm(m.created_at)}
                          </span>
                          <p className="text-[15px] md:text-[16px] leading-[22px] md:leading-[24px] text-ink text-right whitespace-pre-line break-words">
                            <MessageText text={m.message} />
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-[14px] pr-6 md:pr-[120px] xl:pr-[240px]">
                        {/* Ответы поддержки — красной «второй краской», чтобы сразу отличались от своих. */}
                        <div className="w-px self-stretch border-l border-dashed border-accent" />
                        <div className="flex-1 min-w-0 flex flex-col gap-[6px]">
                          <span className="font-mono font-bold text-[10px] tracking-[0.06em] text-accent uppercase whitespace-nowrap">
                            Поддержка{m.author_name ? ` · ${m.author_name}` : ''} · {ddmm(m.created_at)} {hhmm(m.created_at)}
                          </span>
                          <p className="text-[15px] md:text-[16px] leading-[22px] md:leading-[24px] text-accent whitespace-pre-line break-words">
                            <MessageText text={m.message} />
                          </p>
                        </div>
                      </div>
                    )}
                  </React.Fragment>
                );
              })}
              <div ref={bottomRef} />
            </div>
            <Rule2 />
            {isOpen(active) ? (
              <form onSubmit={send} className="flex gap-4 items-center border-b border-ink pb-3">
                <input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Введите сообщение…"
                  className="flex-1 min-w-0 bg-transparent outline-none text-[16px] text-ink placeholder:text-ink-faint"
                />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={busy}
                  className="hidden md:inline font-mono text-[11px] tracking-[0.04em] text-ink-soft hover:text-ink whitespace-nowrap"
                >
                  + ФАЙЛ
                </button>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={attach} />
                <span className="hidden md:inline-flex">
                  <SmallButton type="submit" disabled={busy || !text.trim()}>
                    {busy ? '…' : 'Отправить'}
                  </SmallButton>
                </span>
                <button type="submit" disabled={busy || !text.trim()} className="md:hidden font-mono font-bold text-[11px] tracking-[0.04em] uppercase text-ink whitespace-nowrap disabled:text-ink-soft">
                  {busy ? '…' : 'Отправить →'}
                </button>
              </form>
            ) : (
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <span className="text-[14px] text-ink-soft">Обращение закрыто. Если вопрос остался — напишите новое.</span>
                <TextButton onClick={() => setCreating(true)}>Новое обращение</TextButton>
              </div>
            )}
            {error && <div className="font-mono text-[12px] text-accent uppercase">{error}</div>}
            {isOpen(active) && (
              <TextButton className="md:hidden self-center" onClick={close} disabled={busy}>
                Вопрос решён — закрыть
              </TextButton>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Support;
