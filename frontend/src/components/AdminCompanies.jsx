import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { RouteLoadingView } from '../design/DottedPath';
import { Field, Leader, Photo, PrimaryButton, Rule, SectionLabel, SmallButton, TextButton, VRule, num, plural } from './merchant/kit';
import { AdminHead } from './admin/shared';

/** A08 · Компании и теги: список компаний, создание, теги и предложенные партнёрами. */

const COLS = 'grid grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_60px_110px_110px] gap-4 items-center';

const NewCompany = ({ onDone, onCancel }) => {
  const [f, setF] = useState({ name: '', description: '', owner: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.post('/admin/companies/create', f);
      onDone();
    } catch (err) {
      setError(err.response?.data?.error || 'Не получилось создать');
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit} className="border-l-[3px] border-ink pl-[18px] flex flex-col gap-5">
      <SectionLabel>Новая компания</SectionLabel>
      <div className="grid md:grid-cols-3 gap-6">
        <Field label="Название" value={f.name} onChange={set('name')} placeholder="Coffee Point" required />
        <Field label="Вид" value={f.description} onChange={set('description')} placeholder="Кофейня" />
        <Field label="Владелец" value={f.owner} onChange={set('owner')} placeholder="email, @username или ID" hint="Станет партнёром и получит кабинет" />
      </div>
      {error && <span className="font-mono text-[12px] uppercase text-accent">{error}</span>}
      <div className="flex gap-5 items-center">
        <PrimaryButton type="submit" disabled={busy}>{busy ? 'Создаём…' : 'Создать'}</PrimaryButton>
        <TextButton type="button" onClick={onCancel}>Отмена</TextButton>
      </div>
    </form>
  );
};

const AdminCompanies = () => {
  const [q, setQ] = useState('');
  const [data, setData] = useState(null);
  const [creating, setCreating] = useState(false);
  const [newTag, setNewTag] = useState('');
  const [busy, setBusy] = useState(null);
  const [msg, setMsg] = useState('');

  const load = (query = q) =>
    api
      .get('/admin/companies/list', { params: { q: query } })
      .then((r) => setData(r.data))
      .catch(() => setData({ items: [], meta: {}, tags: [] }));

  useEffect(() => {
    const t = setTimeout(() => load(q), q ? 300 : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const run = async (key, fn) => {
    setBusy(key);
    setMsg('');
    try {
      await fn();
      await load();
    } catch (e) {
      setMsg(e.response?.data?.error || 'Не получилось');
    } finally {
      setBusy(null);
    }
  };

  const addTag = (e) => {
    e.preventDefault();
    if (!newTag.trim()) return;
    run('tag', () => api.post('/admin/tags', { name: newTag })).then(() => setNewTag(''));
  };

  if (!data) return <RouteLoadingView label="Загружаем компании..." />;

  const meta = data.meta || {};
  const active = data.tags.filter((t) => t.status !== 'pending');
  const pending = data.tags.filter((t) => t.status === 'pending');

  return (
    <div className="flex flex-col gap-7">
      <AdminHead
        title="Компании"
        subtitle={`${num(meta.total)} ${plural(meta.total || 0, 'компания', 'компании', 'компаний')} · ${num(meta.week)} ${plural(
          meta.week || 0,
          'новая',
          'новых',
          'новых'
        )} за неделю`}
        right={!creating && <PrimaryButton onClick={() => setCreating(true)}>+ Создать компанию</PrimaryButton>}
      />
      {creating && (
        <NewCompany
          onCancel={() => setCreating(false)}
          onDone={() => {
            setCreating(false);
            load();
          }}
        />
      )}

      <div className="flex flex-col xl:flex-row gap-10 items-start">
        <div className="flex-1 min-w-0 w-full flex flex-col gap-6">
          <label className="flex gap-[10px] items-center border-b border-ink pb-[10px]">
            <span className="font-mono font-bold text-[12px] tracking-[0.04em] text-ink">ПОИСК:</span>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="название или владелец"
              className="flex-1 min-w-0 bg-transparent outline-none text-[15px] text-ink placeholder:text-ink-faint"
            />
          </label>
          <div className="overflow-x-auto">
            <div className="min-w-[640px]">
              <div className={`${COLS} py-2 border-b border-ink font-mono font-medium text-[10px] tracking-[0.06em] uppercase text-ink-soft`}>
                <span>Компания</span>
                <span>Владелец</span>
                <span>Офферы</span>
                <span className="text-right">Баланс</span>
                <span>Статус</span>
              </div>
              {data.items.length === 0 ? (
                <div className="py-6 text-[15px] text-ink-soft border-b border-dashed border-line">Ничего не нашли.</div>
              ) : (
                data.items.map((c) => (
                  <div key={c.id} className={`${COLS} py-3 border-b border-dashed border-line`}>
                    <span className="flex gap-3 items-center min-w-0">
                      <Photo src={c.cover} className="w-10 h-10 shrink-0" />
                      <span className="flex flex-col gap-[2px] min-w-0">
                        <span className="text-[15px] font-medium text-ink truncate">{c.name}</span>
                        <span className="font-mono text-[11px] tracking-[0.03em] uppercase text-ink-soft truncate">
                          {[
                            c.kind || null,
                            c.locations ? `${c.locations} ${plural(c.locations, 'точка', 'точки', 'точек')}` : null,
                            c.is_new ? 'новая' : null,
                          ]
                            .filter(Boolean)
                            .join(' · ') || '—'}
                        </span>
                      </span>
                    </span>
                    {c.owner_id ? (
                      <Link to={`/admin/users/${c.owner_id}`} className="text-[15px] text-ink truncate hover:text-accent">{c.owner}</Link>
                    ) : (
                      <span className="text-[15px] text-ink-soft">—</span>
                    )}
                    <span className="font-mono text-[12px] text-ink">{num(c.offers)}</span>
                    <span className="font-mono text-[12px] text-ink text-right whitespace-nowrap">{num(c.balance)} ₽</span>
                    <button
                      onClick={() => run(`c${c.id}`, () => api.put(`/admin/companies/${c.id}/active`, { active: !c.is_active }))}
                      disabled={busy !== null}
                      title={c.is_active ? 'Выключить компанию' : 'Включить компанию'}
                      className={`text-left font-mono text-[11px] tracking-[0.03em] uppercase whitespace-nowrap hover:text-accent ${
                        c.is_active ? 'text-ink' : 'text-ink-soft'
                      }`}
                    >
                      {c.is_active ? '● Активна' : '▫ Неактивна'}
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <VRule className="hidden xl:block" />

        <div className="w-full xl:w-[320px] shrink-0 flex flex-col gap-5">
          <SectionLabel>Теги</SectionLabel>
          <div className="flex flex-col gap-[10px] max-h-[260px] overflow-y-auto">
            {active.map((t) => (
              <Leader key={t.id} label={`#${t.name}`} value={num(t.offers)} />
            ))}
          </div>
          <Rule />
          <SectionLabel>Предложены партнёрами · {pending.length}</SectionLabel>
          {pending.length === 0 ? (
            <span className="text-[14px] text-ink-soft">Новых тегов нет.</span>
          ) : (
            pending.map((t) => (
              <div key={t.id} className="flex gap-3 items-center">
                <div className="flex-1 min-w-0 flex flex-col gap-[2px]">
                  <span className="font-mono font-bold text-[12px] tracking-[0.03em] uppercase text-ink">#{t.name}</span>
                  {t.source && <span className="text-[13px] text-ink-soft truncate">{t.source}</span>}
                </div>
                <SmallButton onClick={() => run(`t${t.id}`, () => api.post(`/admin/tags/${t.id}/approve`))} disabled={busy !== null}>
                  Одобрить
                </SmallButton>
                <button
                  onClick={() => run(`t${t.id}`, () => api.post(`/admin/tags/${t.id}/reject`))}
                  disabled={busy !== null}
                  className="font-mono font-bold text-[13px] text-ink-soft hover:text-accent"
                  aria-label="Отклонить"
                >
                  ✕
                </button>
              </div>
            ))
          )}
          <Rule />
          <form onSubmit={addTag} className="flex gap-3 items-center border-b border-dashed border-line pb-[10px]">
            <input
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              placeholder="#новый-тег"
              className="flex-1 min-w-0 bg-transparent outline-none font-mono text-[14px] text-ink placeholder:text-ink-faint"
            />
            <button type="submit" disabled={busy !== null} className="font-mono font-bold text-[11px] tracking-[0.04em] text-ink hover:text-accent">
              + ДОБАВИТЬ
            </button>
          </form>
          {msg && <span className="font-mono text-[11px] uppercase text-accent">{msg}</span>}
        </div>
      </div>
    </div>
  );
};

export default AdminCompanies;
