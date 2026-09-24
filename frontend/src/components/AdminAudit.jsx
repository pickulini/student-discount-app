import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../api/client';
import { RouteLoadingView } from '../design/DottedPath';
import { Tabs, TextButton, ddmm, hhmm, num } from './merchant/kit';
import { AdminHead } from './admin/shared';
import { downloadCSV } from '../utils/orders';

/** A10 · Журнал действий: всё, что делали админы, партнёры и система. Только чтение. */

const GROUPS = [
  { key: 'all', label: 'Все' },
  { key: 'moderation', label: 'Модерация' },
  { key: 'verification', label: 'Верификации' },
  { key: 'refunds', label: 'Возвраты' },
  { key: 'roles', label: 'Роли' },
  { key: 'companies', label: 'Компании' },
  { key: 'system', label: 'Система' },
];

const PER_PAGE = 20;
const COLS = 'grid grid-cols-[110px_minmax(0,1fr)_140px_140px_130px] gap-4 items-center';

const objectLabel = (it) => {
  if (!it.entity_id) return it.entity_type.toUpperCase();
  const pad = it.entity_type === 'offer' || it.entity_type === 'order' ? 6 : it.entity_type === 'ticket' ? 4 : 0;
  return `${it.entity_type.toUpperCase()} ${pad ? String(it.entity_id).padStart(pad, '0') : it.entity_id}`;
};

const Dropdown = ({ label, value, children }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const off = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    document.addEventListener('mousedown', off);
    return () => document.removeEventListener('mousedown', off);
  }, []);
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((v) => !v)} className="font-mono font-medium text-[11px] tracking-[0.04em] uppercase text-ink whitespace-nowrap">
        {label}: {value} ↓
      </button>
      {open && (
        <div
          className="absolute right-0 top-full mt-3 z-30 bg-bg border border-dashed border-ink min-w-[220px] max-h-[320px] overflow-y-auto py-2"
          onClick={() => setOpen(false)}
        >
          {children}
        </div>
      )}
    </div>
  );
};

const DropItem = ({ active, onClick, children }) => (
  <button
    onClick={onClick}
    className={`block w-full text-left px-4 py-2 font-mono text-[11px] tracking-[0.04em] uppercase hover:bg-surface-2 ${active ? 'font-bold text-ink' : 'text-ink-soft'}`}
  >
    {active ? '● ' : '○ '}
    {children}
  </button>
);

const AdminAudit = () => {
  const [params, setParams] = useSearchParams();
  const group = params.get('group') || 'all';
  const actor = params.get('actor') || '';
  const day = params.get('day') || '';
  const page = Math.max(1, Number(params.get('page')) || 1);
  const [data, setData] = useState(null);
  const [exporting, setExporting] = useState(false);
  const dateRef = useRef(null);

  const query = { group: group === 'all' ? '' : group, actor, day };

  useEffect(() => {
    setData(null);
    api
      .get('/admin/journal', { params: { ...query, page, limit: PER_PAGE } })
      .then((r) => setData(r.data))
      .catch(() => setData({ items: [], total: 0, actors: [] }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group, actor, day, page]);

  const set = (patch) => {
    const p = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => (v ? p.set(k, v) : p.delete(k)));
    if (!('page' in patch)) p.delete('page');
    setParams(p, { replace: true });
  };

  const exportCSV = async () => {
    setExporting(true);
    try {
      const r = await api.get('/admin/journal', { params: { ...query, limit: 1000 } });
      downloadCSV(`journal-${new Date().toISOString().slice(0, 10)}.csv`, [
        ['Время', 'Действие', 'Тип', 'Объект', 'Кто'],
        ...r.data.items.map((it) => [`${ddmm(it.at)}.${new Date(it.at).getFullYear()} ${hhmm(it.at)}`, it.text, it.action, objectLabel(it), it.actor]),
      ]);
    } finally {
      setExporting(false);
    }
  };

  const actors = data?.actors || [];
  const actorName = actor === 'system' ? 'Система' : actor ? actors.find((a) => String(a.id) === actor)?.name || `ID ${actor}` : 'Все';
  const dayLabel = day ? day.split('-').reverse().slice(0, 2).join('.') : 'Всё';
  const totalPages = Math.max(1, Math.ceil((data?.total || 0) / PER_PAGE));

  return (
    <div className="flex flex-col gap-7">
      <AdminHead
        title="Журнал действий"
        subtitle="Каждое действие админов, партнёров и системы. Нельзя изменить или удалить."
        right={<TextButton onClick={exportCSV} disabled={exporting}>{exporting ? 'Готовим…' : 'Экспорт CSV'}</TextButton>}
      />
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <Tabs items={GROUPS} value={group} onChange={(v) => set({ group: v === 'all' ? '' : v })} />
        <div className="flex items-center gap-6">
          <Dropdown label="Кто" value={actorName}>
            <DropItem active={!actor} onClick={() => set({ actor: '' })}>Все</DropItem>
            <DropItem active={actor === 'system'} onClick={() => set({ actor: 'system' })}>Система</DropItem>
            {actors.map((a) => (
              <DropItem key={a.id} active={String(a.id) === actor} onClick={() => set({ actor: String(a.id) })}>
                {a.name} · {num(a.count)}
              </DropItem>
            ))}
          </Dropdown>
          <div className="relative">
            <button
              onClick={() => (dateRef.current?.showPicker ? dateRef.current.showPicker() : dateRef.current?.focus())}
              className="font-mono font-medium text-[11px] tracking-[0.04em] uppercase text-ink whitespace-nowrap"
            >
              Период: {dayLabel} ↓
            </button>
            <input
              ref={dateRef}
              type="date"
              value={day}
              onChange={(e) => set({ day: e.target.value })}
              className="absolute right-0 top-full w-0 h-0 opacity-0 pointer-events-none"
              tabIndex={-1}
            />
            {day && (
              <button onClick={() => set({ day: '' })} className="ml-2 font-mono text-[11px] text-ink-soft hover:text-ink" aria-label="Сбросить дату">
                ✕
              </button>
            )}
          </div>
        </div>
      </div>

      {!data ? (
        <RouteLoadingView label="Читаем журнал..." />
      ) : (
        <div className="overflow-x-auto">
          <div className="min-w-[860px]">
            <div className={`${COLS} py-2 border-b border-ink font-mono font-medium text-[10px] tracking-[0.06em] uppercase text-ink-soft`}>
              <span>Время</span>
              <span>Действие</span>
              <span>Тип</span>
              <span>Объект</span>
              <span>Кто</span>
            </div>
            {data.items.length === 0 ? (
              <div className="py-6 text-[15px] text-ink-soft border-b border-dashed border-line">За этот период записей нет.</div>
            ) : (
              data.items.map((it) => (
                <div key={it.id} className={`${COLS} py-3 border-b border-dashed border-line`}>
                  <span className="font-mono text-[12px] text-ink whitespace-nowrap">
                    {ddmm(it.at)} {hhmm(it.at)}
                  </span>
                  <span className="text-[15px] text-ink truncate" title={it.object_name ? `${it.text} · ${it.object_name}` : it.text}>
                    {it.text}
                  </span>
                  <span className="font-mono text-[12px] tracking-[0.02em] uppercase text-ink">{it.action}</span>
                  <span className="font-mono text-[12px] tracking-[0.02em] uppercase text-ink">{objectLabel(it)}</span>
                  <span className="font-mono text-[12px] tracking-[0.02em] uppercase text-ink truncate">{it.actor}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {data && totalPages > 1 && (
        <div className="flex justify-center items-center gap-6 font-mono text-[12px] tracking-[0.04em] uppercase">
          <button disabled={page <= 1} onClick={() => set({ page: String(page - 1) })} className="uppercase text-ink-soft hover:text-ink disabled:text-ink-faint">
            ← Новее
          </button>
          <span className="font-bold text-ink">
            Страница {page} из {num(totalPages)}
          </span>
          <button disabled={page >= totalPages} onClick={() => set({ page: String(page + 1) })} className="uppercase text-ink-soft hover:text-ink disabled:text-ink-faint">
            Старее →
          </button>
        </div>
      )}
    </div>
  );
};

export default AdminAudit;
