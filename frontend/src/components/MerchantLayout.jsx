import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, NavLink, Outlet, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';
import { Avatar, PrimaryButton, TextButton, Rule, Rule2, VRule } from './merchant/kit';

/**
 * Кабинет партнёра — общий каркас по макету «Концепция «Чек», Партнёр · desktop»:
 * верхняя строка (логотип, «КАБИНЕТ ПАРТНЁРА», выбор компании, «← НА САЙТ», профиль),
 * двойная черта, слева меню 220px, пунктирная вертикаль, справа содержимое,
 * внизу линия отрыва и «служебный журнал».
 */

const NAV = [
  { to: '/merchant', label: 'Дашборд', end: true },
  { to: '/merchant/cashier', label: 'Касса' },
  { to: '/merchant/offers', label: 'Предложения', badge: 'waiting' },
  { to: '/merchant/events', label: 'Ивенты' },
  { to: '/merchant/statistics', label: 'Статистика' },
  { to: '/merchant/transactions', label: 'Транзакции' },
  { to: '/merchant/companies', label: 'Компании' },
];

const STORAGE_KEY = 'merchant.company';

const MerchantLayout = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [companies, setCompanies] = useState([]);
  const [companyId, setCompanyIdState] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) || 'all';
    } catch {
      return 'all';
    }
  });
  const [waiting, setWaiting] = useState(0);
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef(null);
  const [now, setNow] = useState(new Date());

  const setCompanyId = (v) => {
    setCompanyIdState(String(v));
    try {
      localStorage.setItem(STORAGE_KEY, String(v));
    } catch {
      /* ignore */
    }
  };

  const reload = useCallback(() => {
    api.get('/merchant/cabinet/companies').then((r) => setCompanies(r.data || [])).catch(() => setCompanies([]));
    api
      .get('/merchant/cabinet/offers')
      .then((r) => setWaiting((r.data || []).filter((o) => o.status === 'pending_partner_approval').length))
      .catch(() => setWaiting(0));
    setNow(new Date());
  }, []);

  useEffect(() => {
    if (user?.role === 'merchant') reload();
  }, [user, reload]);

  useEffect(() => {
    const onClick = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) setPickerOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  // Выбранная компания могла пропасть (отвязали) — возвращаемся к «Все».
  useEffect(() => {
    if (companyId !== 'all' && companies.length > 0 && !companies.some((c) => String(c.id) === companyId)) {
      setCompanyId('all');
    }
  }, [companies, companyId]);

  if (loading) return null;
  if (!user || user.role !== 'merchant') return <Navigate to="/" />;

  const selected = companies.find((c) => String(c.id) === companyId);
  const pickerLabel = selected ? selected.name : `Все (${companies.length})`;
  const scope = companyId === 'all' ? {} : { company_id: companyId };
  const displayName = user.full_name || user.nickname || '';

  const ctx = { companies, companyId, setCompanyId, scope, selected, reload, user };

  return (
    <div className="min-h-screen bg-bg text-ink flex flex-col">
      <div className="w-full max-w-[1440px] mx-auto px-4 sm:px-10 pt-6">
        {/* Верхняя строка */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <Link to="/" className="font-display font-bold text-[20px] tracking-[-0.02em] text-ink whitespace-nowrap">
              СТУДЕНТ−%
            </Link>
            <span className="bg-ink text-on-ink font-mono font-bold text-[11px] tracking-[0.06em] px-2 py-[3px] whitespace-nowrap">
              КАБИНЕТ ПАРТНЁРА
            </span>
          </div>
          <div className="flex items-center gap-6">
            <div className="relative" ref={pickerRef}>
              <button
                onClick={() => setPickerOpen((v) => !v)}
                className="font-mono font-medium text-[11px] tracking-[0.04em] uppercase text-ink whitespace-nowrap"
              >
                Компания: {pickerLabel} ↓
              </button>
              {pickerOpen && (
                <div className="absolute right-0 top-full mt-3 z-30 bg-bg border border-dashed border-ink min-w-[240px] py-2">
                  {[{ id: 'all', name: `Все (${companies.length})` }, ...companies].map((c) => (
                    <button
                      key={c.id}
                      onClick={() => {
                        setCompanyId(c.id);
                        setPickerOpen(false);
                      }}
                      className={`block w-full text-left px-4 py-2 font-mono text-[11px] tracking-[0.04em] uppercase hover:bg-surface-2 ${
                        String(c.id) === companyId ? 'font-bold text-ink' : 'text-ink-soft'
                      }`}
                    >
                      {String(c.id) === companyId ? '● ' : '○ '}
                      {c.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <Link to="/" className="hidden sm:inline font-mono text-[11px] tracking-[0.04em] uppercase text-ink-soft hover:text-ink whitespace-nowrap">
              ← На сайт
            </Link>
            <Link to="/profile" className="flex items-center gap-[10px]">
              <Avatar src={user.avatar_url} name={displayName} size={28} />
              <span className="hidden sm:inline font-mono font-medium text-[11px] tracking-[0.04em] uppercase text-ink whitespace-nowrap">
                {displayName}
              </span>
            </Link>
          </div>
        </div>
        <Rule2 className="mt-[18px]" />

        {/* Тело */}
        <div className="mt-7 flex flex-col lg:flex-row items-start gap-6 lg:gap-10">
          <aside className="w-full lg:w-[220px] shrink-0">
            <nav className="flex lg:flex-col gap-1 overflow-x-auto no-scrollbar">
              {NAV.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `flex items-center justify-between gap-3 py-[10px] whitespace-nowrap font-mono text-[12px] tracking-[0.04em] uppercase transition ${
                      isActive ? 'border-l-[3px] border-ink pl-3 font-bold text-ink' : 'text-ink-soft hover:text-ink pr-3 lg:pr-0'
                    }`
                  }
                >
                  <span>{item.label}</span>
                  {item.badge === 'waiting' && waiting > 0 && (
                    <span className="bg-ink text-on-ink font-mono font-bold text-[10px] px-[6px] py-px">{waiting}</span>
                  )}
                </NavLink>
              ))}
            </nav>
            <div className="hidden lg:flex flex-col gap-[14px] pt-[14px] items-start">
              <Rule className="w-full" />
              <PrimaryButton className="w-full" onClick={() => navigate('/merchant/offers/new')}>
                + Предложение
              </PrimaryButton>
              <TextButton onClick={() => navigate('/merchant/events/new')}>+ Ивент</TextButton>
            </div>
          </aside>

          <VRule className="hidden lg:block" />

          <main className="flex-1 min-w-0 w-full">
            <Outlet context={ctx} />
          </main>
        </div>
      </div>

      {/* Подвал */}
      <div className="w-full max-w-[1440px] mx-auto px-4 sm:px-10 mt-auto pt-7 pb-8">
        <div className="tear-edge" />
        <div className="mt-3 flex items-center justify-between gap-4 flex-wrap font-mono text-[11px] tracking-[0.04em] uppercase text-ink-soft">
          <span>
            СТУДЕНТ−% · Служебный журнал · {now.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' })}{' '}
            {now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
          </span>
          <span>
            <Link to="/support" className="hover:text-ink">Поддержка партнёров</Link> · <span>Правила модерации</span>
          </span>
        </div>
      </div>
    </div>
  );
};

export default MerchantLayout;
