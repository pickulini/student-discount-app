import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { RouteLoadingView } from '../design/DottedPath';
import { Tabs, Rule, Rule2, VRule, Leader, SectionLabel, PrimaryButton, Table, CellMono, CellText, num } from './merchant/kit';
import { savedOf, isSpent, MONTHS_NOM } from '../utils/orders';

/**
 * D40 · Кошелёк: слева баланс, бонусы и пополнение через СБП,
 * справа — операции за месяц с фильтром и итогами.
 */

const PRESETS = [300, 500, 1000, 2000];
const MIN_TOPUP = 10;
const MAX_TOPUP = 100000;

const monthLabel = (ym) => {
  const [y, m] = ym.split('-').map(Number);
  return `${MONTHS_NOM[m - 1]} ${y}`;
};
const ddmm = (d) => new Date(d).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
const signed = (v, unit) => {
  const s = v > 0 ? '+' : v < 0 ? '−' : '';
  return `${s}${num(Math.abs(v))} ${unit === 'BONUS' ? 'Б' : '₽'}`;
};

const LinkRow = ({ to, title, sub }) => (
  <Link to={to} className="flex gap-4 items-center group">
    <span className="flex-1 min-w-0 flex flex-col gap-[3px]">
      <span className="font-mono font-bold text-[12px] tracking-[0.04em] uppercase text-ink group-hover:text-accent transition">{title}</span>
      <span className="text-[13px] leading-[19px] text-ink-soft">{sub}</span>
    </span>
    <span className="font-mono text-[13px] text-ink">→</span>
  </Link>
);

const Wallet = () => {
  const [wallet, setWallet] = useState(null);
  const [ops, setOps] = useState(null);
  const [months, setMonths] = useState([]);
  const [month, setMonth] = useState('');
  const [filter, setFilter] = useState('all');
  const [preset, setPreset] = useState(500);
  const [custom, setCustom] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [totalSaved, setTotalSaved] = useState(null);
  const [allOps, setAllOps] = useState(false);

  useEffect(() => {
    api.get('/wallet').then((r) => setWallet(r.data)).catch(() => setWallet({ balance: 0, bonus: 0 }));
    api
      .get('/orders')
      .then((r) => setTotalSaved((r.data || []).filter(isSpent).reduce((s, o) => s + savedOf(o), 0)))
      .catch(() => setTotalSaved(0));
  }, []);

  useEffect(() => {
    setOps(null);
    api
      .get('/wallet/operations', { params: month ? { month } : {} })
      .then((r) => {
        setOps(r.data.operations || []);
        setMonths(r.data.months?.length ? r.data.months : [r.data.month]);
        if (!month) setMonth(r.data.month);
      })
      .catch(() => setOps([]));
  }, [month]);

  const amount = preset === 'custom' ? Math.floor(Number(String(custom).replace(/\s/g, '').replace(',', '.')) || 0) : preset;
  const amountOk = amount >= MIN_TOPUP && amount <= MAX_TOPUP;

  const topUp = async () => {
    if (!amountOk) return setError(`Сумма от ${MIN_TOPUP} до ${num(MAX_TOPUP)} ₽`);
    setBusy(true);
    setError('');
    try {
      const r = await api.post('/payments/init', { amount });
      window.location.href = r.data.payment_url;
    } catch (e) {
      setError(e.response?.data?.error || 'Не удалось начать оплату через СБП');
      setBusy(false);
    }
  };

  const visible = useMemo(() => {
    const list = ops || [];
    if (filter === 'topup') return list.filter((o) => o.kind === 'topup');
    if (filter === 'orders') return list.filter((o) => o.kind === 'order' || o.kind === 'refund');
    if (filter === 'bonus') return list.filter((o) => o.unit === 'BONUS');
    return list;
  }, [ops, filter]);

  const totals = useMemo(() => {
    const list = ops || [];
    const rub = list.filter((o) => o.unit === 'RUB');
    const bon = list.filter((o) => o.unit === 'BONUS');
    return {
      in: rub.filter((o) => o.kind === 'topup').reduce((s, o) => s + o.amount, 0),
      // Потрачено — заказы минус возвраты по ним.
      out: rub.filter((o) => o.kind !== 'topup').reduce((s, o) => s + o.amount, 0),
      bonusIn: bon.filter((o) => o.amount > 0).reduce((s, o) => s + o.amount, 0),
      bonusOut: bon.filter((o) => o.amount < 0).reduce((s, o) => s + o.amount, 0),
    };
  }, [ops]);

  if (!wallet) return <RouteLoadingView label="Открываем кошелёк..." />;

  const columns = [
    { key: 'date', label: 'Дата', width: 90, render: (o) => <CellMono>{ddmm(o.created_at)}</CellMono> },
    {
      key: 'title',
      label: 'Операция',
      render: (o) =>
        o.order_id ? (
          <Link to={`/orders/${o.order_id}`} className="hover:text-accent">
            <CellText>{o.title}</CellText>
          </Link>
        ) : (
          <CellText>{o.title}</CellText>
        ),
    },
    { key: 'method', label: 'Способ', width: 150, render: (o) => <CellMono>{o.method}</CellMono> },
    { key: 'amount', label: 'Сумма', width: 120, align: 'right', render: (o) => <CellMono>{signed(o.amount, o.unit)}</CellMono> },
  ];

  const monthIdx = months.indexOf(month);

  return (
    <div className="flex flex-col lg:flex-row gap-10 lg:gap-14 items-start">
      <div className="w-full lg:w-[420px] shrink-0 flex flex-col gap-6">
        <h1 className="font-display font-bold text-[34px] md:text-[36px] leading-none tracking-[-0.02em] text-ink">КОШЕЛЁК</h1>
        <div className="font-mono font-medium text-[11px] tracking-[0.08em] uppercase text-ink-soft">Денежный баланс</div>
        <div className="font-display font-bold text-[48px] sm:text-[56px] leading-none tracking-[-0.03em] text-ink whitespace-nowrap">
          {num(wallet.balance)} ₽
        </div>
        <Leader label="Бонусные баллы" value={<b>{num(wallet.bonus)} Б</b>} />
        <p className="text-[14px] leading-[21px] text-ink-soft">1 балл = 1 ₽. Бонусами можно оплатить часть заказа — лимит указан в каждом предложении.</p>
        <Rule2 />
        <div className="flex items-center justify-between font-mono text-[11px] whitespace-nowrap">
          <span className="font-medium tracking-[0.08em] uppercase text-ink">Пополнить</span>
          <span className="tracking-[0.04em] text-ink-soft">ЧЕРЕЗ СБП</span>
        </div>
        <Tabs
          value={preset}
          onChange={(v) => {
            setPreset(v);
            setError('');
          }}
          items={[...PRESETS.map((p) => ({ key: p, label: num(p) })), { key: 'custom', label: 'Другая' }]}
        />
        <label className="flex flex-col gap-2">
          <span className="font-mono font-medium text-[11px] tracking-[0.06em] text-ink-soft">СУММА</span>
          {preset === 'custom' ? (
            <span className="flex items-baseline gap-2 border-b border-ink pb-[10px]">
              <input
                autoFocus
                inputMode="numeric"
                value={custom}
                onChange={(e) => setCustom(e.target.value.replace(/[^\d]/g, ''))}
                placeholder="0"
                className="flex-1 min-w-0 bg-transparent outline-none font-display font-bold text-[28px] text-ink placeholder:text-ink-faint"
              />
              <span className="font-display font-bold text-[28px] text-ink">₽</span>
            </span>
          ) : (
            <span className="border-b border-ink pb-[10px] font-display font-bold text-[28px] text-ink">{num(amount)} ₽</span>
          )}
        </label>
        {error && <div className="font-mono text-[12px] text-accent uppercase -mt-2">{error}</div>}
        <PrimaryButton className="w-full" onClick={topUp} disabled={busy || !amountOk}>
          {busy ? 'Переходим к оплате…' : `Пополнить на ${num(amount)} ₽`}
        </PrimaryButton>
        <div className="md:hidden flex flex-col gap-[14px]">
          <Rule2 className="mb-[6px]" />
          <div className="flex items-center justify-between font-mono text-[11px] whitespace-nowrap">
            <span className="font-medium tracking-[0.08em] uppercase text-ink">Последние операции</span>
            {(ops || []).length > 4 && (
              <button onClick={() => setAllOps((v) => !v)} className="tracking-[0.04em] uppercase text-ink-soft">
                {allOps ? 'Свернуть ↑' : 'Все →'}
              </button>
            )}
          </div>
          {ops === null ? (
            <div className="font-mono text-[11px] text-ink-soft uppercase">Загружаем…</div>
          ) : ops.length === 0 ? (
            <div className="text-[13px] text-ink-soft">В этом месяце операций не было.</div>
          ) : (
            (allOps ? ops : ops.slice(0, 4)).map((o, i) => {
              const row = (
                <span className="flex items-end gap-2 font-mono text-[12px] tracking-[0.02em] uppercase text-ink">
                  <span className="text-ink-soft whitespace-nowrap">{ddmm(o.created_at)}</span>
                  <span className="truncate">{String(o.title).split(' · ')[0]}</span>
                  <span className="flex-1 min-w-[8px] border-t border-dashed border-ink-faint h-[4px]" />
                  <span className="whitespace-nowrap">{signed(o.amount, o.unit)}</span>
                </span>
              );
              return o.order_id ? (
                <Link key={i} to={`/orders/${o.order_id}`}>{row}</Link>
              ) : (
                <div key={i}>{row}</div>
              );
            })
          )}
        </div>
        <Rule />
        <div className="flex flex-col gap-[14px]">
          <LinkRow to="/savings" title="Журнал экономии" sub={totalSaved === null ? '…' : `${num(totalSaved)} ₽ за всё время`} />
          <LinkRow to="/referral" title="Пригласить друзей" sub="+100 бонусов за каждого" />
        </div>
      </div>

      <VRule className="hidden lg:block" />

      <div className="hidden md:flex flex-1 min-w-0 w-full flex-col gap-6">
        <SectionLabel>Операции</SectionLabel>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <Tabs
            value={filter}
            onChange={setFilter}
            items={[
              { key: 'all', label: 'Все' },
              { key: 'topup', label: 'Пополнения' },
              { key: 'orders', label: 'Заказы' },
              { key: 'bonus', label: 'Бонусы' },
            ]}
          />
          {month && (
            <div className="flex items-center gap-3 font-mono font-medium text-[11px] tracking-[0.04em] uppercase text-ink whitespace-nowrap">
              <button
                onClick={() => setMonth(months[monthIdx + 1])}
                disabled={monthIdx < 0 || monthIdx >= months.length - 1}
                className="px-1 hover:text-accent disabled:opacity-30"
                aria-label="Предыдущий месяц"
              >
                ←
              </button>
              <span>{monthLabel(month)}</span>
              <button onClick={() => setMonth(months[monthIdx - 1])} disabled={monthIdx <= 0} className="px-1 hover:text-accent disabled:opacity-30" aria-label="Следующий месяц">
                →
              </button>
            </div>
          )}
        </div>
        {ops === null ? (
          <div className="font-mono text-[12px] text-ink-soft uppercase">Загружаем операции…</div>
        ) : (
          <Table columns={columns} rows={visible} rowKey="__none" minWidth={560} empty="В этом месяце операций не было." />
        )}
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-10 pt-[6px]">
          <div className="flex-1 min-w-0 flex flex-col gap-2">
            <Leader label="Пополнено" value={signed(totals.in, 'RUB')} />
            <Leader label="Потрачено" value={signed(totals.out, 'RUB')} />
          </div>
          <div className="flex-1 min-w-0 flex flex-col gap-2">
            <Leader label="Бонусов получено" value={signed(totals.bonusIn, 'BONUS')} />
            <Leader label="Бонусов списано" value={signed(totals.bonusOut, 'BONUS')} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Wallet;
