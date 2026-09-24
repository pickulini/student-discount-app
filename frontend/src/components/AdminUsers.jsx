import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../api/client';
import { RouteLoadingView } from '../design/DottedPath';
import { Avatar, Tabs, TextButton, ddmmyy, num, plural } from './merchant/kit';
import { AdminHead } from './admin/shared';
import { downloadCSV } from '../utils/orders';

/** A06 · Пользователи: поиск, фильтры по ролям и статусу, страницы. */

export const STUDENT = {
  verified: { icon: '✓', label: 'Подтверждён', strong: true },
  pending: { icon: '◐', label: 'Ожидает', strong: true },
  expired: { icon: '▫', label: 'Истёк' },
  none: { icon: '○', label: 'Нет' },
};
export const ROLE = { student: 'Студент', merchant: 'Партнёр', admin: 'Админ' };

export const StudentMark = ({ status }) => {
  const s = STUDENT[status] || STUDENT.none;
  return (
    <span className={`font-mono text-[11px] tracking-[0.03em] uppercase whitespace-nowrap ${s.strong ? 'font-bold text-ink' : 'text-ink-soft'}`}>
      {s.icon} {s.label}
    </span>
  );
};

const PER_PAGE = 20;
const COLS = 'grid grid-cols-[minmax(0,1.4fr)_minmax(0,1.2fr)_70px_140px_100px_90px_24px] gap-4 items-center';

const pages = (cur, total) => {
  if (total <= 5) return Array.from({ length: total }, (_, i) => i + 1);
  const set = new Set([1, 2, 3, cur - 1, cur, cur + 1, total].filter((p) => p >= 1 && p <= total));
  const list = [...set].sort((a, b) => a - b);
  const out = [];
  list.forEach((p, i) => {
    if (i > 0 && p - list[i - 1] > 1) out.push('…');
    out.push(p);
  });
  return out;
};

const AdminUsers = () => {
  const [params, setParams] = useSearchParams();
  const filter = params.get('filter') || 'all';
  const page = Math.max(1, Number(params.get('page')) || 1);
  const q = params.get('q') || '';
  const [query, setQuery] = useState(q);
  const [data, setData] = useState(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    setData(null);
    api
      .get('/admin/users/list', { params: { filter, page, q, limit: PER_PAGE } })
      .then((r) => setData(r.data))
      .catch(() => setData({ items: [], total: 0, counts: {} }));
  }, [filter, page, q]);

  const set = (patch) => {
    const p = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => (v ? p.set(k, v) : p.delete(k)));
    if (!('page' in patch)) p.delete('page');
    setParams(p, { replace: true });
  };

  // Поиск по мере ввода с небольшой задержкой.
  useEffect(() => {
    if (query === q) return undefined;
    const t = setTimeout(() => set({ q: query.trim() }), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const exportCSV = async () => {
    setExporting(true);
    try {
      const r = await api.get('/admin/users/list', { params: { filter, q, limit: 5000 } });
      downloadCSV(`users-${new Date().toISOString().slice(0, 10)}.csv`, [
        ['ID', 'Имя', 'Username', 'Email', 'Вуз', 'Студент', 'Баланс', 'Роль', 'VIP', 'Заблокирован', 'Создан'],
        ...r.data.items.map((u) => [
          u.id,
          u.full_name,
          u.username || '',
          u.email,
          u.university,
          STUDENT[u.student]?.label || '',
          u.balance ?? '',
          ROLE[u.role] || u.role,
          u.is_vip ? 'да' : '',
          u.is_active ? '' : 'да',
          ddmmyy(u.created_at),
        ]),
      ]);
    } finally {
      setExporting(false);
    }
  };

  const c = data?.counts || {};
  const tabs = [
    { key: 'all', label: `Все · ${num(c.all ?? 0)}` },
    { key: 'students', label: `Студенты · ${num(c.students ?? 0)}` },
    { key: 'unverified', label: `Не верифицированы · ${num(c.unverified ?? 0)}` },
    { key: 'partners', label: `Партнёры · ${num(c.partners ?? 0)}` },
    { key: 'admins', label: `Админы · ${num(c.admins ?? 0)}` },
    { key: 'vip', label: `VIP · ${num(c.vip ?? 0)}` },
    ...(c.blocked ? [{ key: 'blocked', label: `Заблокированы · ${num(c.blocked)}` }] : []),
  ];
  const totalPages = Math.max(1, Math.ceil((data?.total || 0) / PER_PAGE));

  return (
    <div className="flex flex-col gap-7">
      <AdminHead
        title="Пользователи"
        subtitle={`${num(c.all ?? 0)} ${plural(c.all ?? 0, 'аккаунт', 'аккаунта', 'аккаунтов')}`}
        right={<TextButton onClick={exportCSV} disabled={exporting}>{exporting ? 'Готовим…' : 'Экспорт CSV'}</TextButton>}
      />
      <label className="flex gap-[10px] items-center border-b border-ink pb-[10px]">
        <span className="font-mono font-bold text-[12px] tracking-[0.04em] text-ink">ПОИСК:</span>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="имя, email, @username или ID"
          className="flex-1 min-w-0 bg-transparent outline-none text-[15px] text-ink placeholder:text-ink-faint"
        />
      </label>
      <Tabs items={tabs} value={filter} onChange={(v) => set({ filter: v === 'all' ? '' : v })} />

      {!data ? (
        <RouteLoadingView label="Загружаем пользователей..." />
      ) : (
        <div className="overflow-x-auto">
          <div className="min-w-[960px]">
            <div className={`${COLS} py-2 border-b border-ink font-mono font-medium text-[10px] tracking-[0.06em] uppercase text-ink-soft`}>
              <span>Пользователь</span>
              <span>Email</span>
              <span>Вуз</span>
              <span>Студент</span>
              <span>Баланс</span>
              <span>Роль</span>
              <span />
            </div>
            {data.items.length === 0 ? (
              <div className="py-6 text-[15px] text-ink-soft border-b border-dashed border-line">Никого не нашли.</div>
            ) : (
              data.items.map((u) => (
                <Link key={u.id} to={`/admin/users/${u.id}`} className={`${COLS} py-3 border-b border-dashed border-line group`}>
                  <span className="flex gap-3 items-center min-w-0">
                    <Avatar src={u.avatar_url} name={u.full_name} size={36} />
                    <span className="flex flex-col gap-[2px] min-w-0">
                      <span className={`text-[15px] font-medium truncate group-hover:text-accent ${u.is_active ? 'text-ink' : 'text-ink-soft line-through'}`}>
                        {u.full_name}
                      </span>
                      <span className="font-mono text-[11px] text-ink-soft truncate">
                        {[u.username ? `@${u.username}` : null, `ID ${u.id}`, u.is_vip ? '★ VIP' : null, u.is_active ? null : 'заблокирован']
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    </span>
                  </span>
                  <span className="text-[15px] text-ink truncate">{u.email}</span>
                  <span className="font-mono text-[12px] tracking-[0.02em] uppercase text-ink">
                    {u.university ? `${u.university}${u.domain_match ? '' : ' ?'}` : '—'}
                  </span>
                  <StudentMark status={u.student} />
                  <span className="font-mono text-[12px] text-ink whitespace-nowrap">{u.balance == null ? '—' : `${num(u.balance)} ₽`}</span>
                  <span className="font-mono text-[12px] tracking-[0.02em] uppercase text-ink">{ROLE[u.role] || u.role}</span>
                  <span className="font-mono text-[13px] text-ink">→</span>
                </Link>
              ))
            )}
          </div>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-5 font-mono text-[12px] tracking-[0.04em]">
          <button disabled={page <= 1} onClick={() => set({ page: String(page - 1) })} className="text-ink disabled:text-ink-faint">←</button>
          {pages(page, totalPages).map((p, i) =>
            p === '…' ? (
              <span key={`e${i}`} className="text-ink-soft">…</span>
            ) : (
              <button key={p} onClick={() => set({ page: String(p) })} className={p === page ? 'font-bold text-ink' : 'text-ink-soft hover:text-ink'}>
                {p}
              </button>
            )
          )}
          <button disabled={page >= totalPages} onClick={() => set({ page: String(page + 1) })} className="text-ink disabled:text-ink-faint">→</button>
        </div>
      )}
    </div>
  );
};

export default AdminUsers;
