import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/client';
import { useMobileTop } from '../context/MobileChrome';
import { RouteLoadingView } from '../design/DottedPath';
import { Tabs, Rule, Rule2, VRule, Leader, SectionLabel, TextButton, SmallButton, Table, CellMono, CellText, pad6, ddmm, ddmmyy, hhmm, num } from './merchant/kit';
import { loadOrdersWithOffers, savedOf, isSpent, orderCode, MONTHS_NOM, monthKey } from '../utils/orders';

/**
 * D22 · Мои заказы: табы Активные / Использованные / Возвраты,
 * карточки активных заказов, таблица использованных, справа — итоги месяца.
 */

const PAGE = 5;
const rub = (v) => `${num(v)} ₽`;

const Crumbs = ({ items }) => (
  <div className="font-mono font-medium text-[11px] tracking-[0.06em] uppercase text-ink-soft whitespace-pre">
    {items.map((c, i) => (
      <React.Fragment key={i}>
        {i > 0 && '  /  '}
        {c.to ? <Link to={c.to} className="hover:text-ink">{c.label}</Link> : c.label}
      </React.Fragment>
    ))}
  </div>
);

const ActiveOrder = ({ order, offer, onPay, busy }) => {
  const paid = order.status === 'paid';
  const place = order.company_name || order.offer_title;
  const until = offer?.end_at ? ddmmyy(offer.end_at) : null;
  return (
    <div className="flex-1 min-w-0 flex flex-col gap-[10px]">
      <div className="flex items-center justify-between gap-3 font-mono text-[11px] tracking-[0.04em] whitespace-nowrap">
        <span className="text-ink-soft">№ {pad6(order.id)} · {ddmm(order.created_at)} {hhmm(order.created_at)}</span>
        <span className="font-bold text-ink">{paid ? 'ОПЛАЧЕН' : 'ЖДЁТ ОПЛАТЫ'}</span>
      </div>
      <div className="flex flex-col gap-[3px] min-w-0">
        <Link to={`/orders/${order.id}`} className="font-display font-bold text-[20px] tracking-[-0.01em] uppercase text-ink break-words md:truncate hover:text-accent">
          {place}
        </Link>
        {order.company_name && order.offer_title && <span className="text-[14px] text-ink-soft truncate">{order.offer_title}</span>}
      </div>
      {paid ? (
        <>
          <Leader label="Оплачено" value={rub(order.total_amount)} />
          <Leader label="Код" value={<b>{orderCode(order)}</b>} />
          <div className="flex items-center justify-between">
            <span className="font-mono text-[11px] tracking-[0.04em] text-ink-soft">{until ? `ДО ${until}` : ''}</span>
            <TextButton as={Link} to={`/orders/${order.id}`}>Показать чек</TextButton>
          </div>
        </>
      ) : (
        <>
          <Leader label="К оплате" value={rub(order.total_amount)} />
          <div className="flex items-center justify-between">
            <span className="font-mono text-[11px] tracking-[0.04em] text-ink-soft">КОД ПОСЛЕ ОПЛАТЫ</span>
            <SmallButton onClick={() => onPay(order)} disabled={busy}>
              {busy ? 'Оплачиваем…' : 'Оплатить'}
            </SmallButton>
          </div>
        </>
      )}
    </div>
  );
};

const Order = () => {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [tab, setTab] = useState('active');
  const [shown, setShown] = useState(PAGE);
  const [payingId, setPayingId] = useState(null);
  const [error, setError] = useState('');
  useMobileTop({ back: '/profile', label: 'Профиль' });

  const load = () =>
    loadOrdersWithOffers()
      .then(setData)
      .catch(() => setData({ orders: [], offers: new Map() }));
  useEffect(() => {
    load();
  }, []);

  const groups = useMemo(() => {
    const orders = data?.orders || [];
    return {
      active: orders.filter((o) => o.status === 'paid' || o.status === 'created'),
      used: orders.filter((o) => o.status === 'completed'),
      back: orders.filter((o) => o.status === 'refunded' || o.status === 'cancelled'),
    };
  }, [data]);

  const month = useMemo(() => {
    const now = new Date();
    const mk = monthKey(now);
    const inMonth = (data?.orders || []).filter((o) => isSpent(o) && monthKey(o.created_at) === mk);
    return {
      name: MONTHS_NOM[now.getMonth()],
      count: inMonth.length,
      paid: inMonth.reduce((s, o) => s + Number(o.total_amount || 0), 0),
      bonus: inMonth.reduce((s, o) => s + Number(o.bonus_amount || 0), 0),
      saved: inMonth.reduce((s, o) => s + savedOf(o), 0),
    };
  }, [data]);

  if (!data) return <RouteLoadingView label="Собираем заказы..." />;

  const pay = async (order) => {
    setPayingId(order.id);
    setError('');
    try {
      await api.post(`/orders/${order.id}/confirm`);
      navigate(`/orders/${order.id}`);
    } catch (e) {
      const msg = e.response?.data?.error || e.message || '';
      setError(msg.includes('insufficient') ? 'Недостаточно средств на кошельке — пополните его и попробуйте снова.' : `Не удалось оплатить: ${msg}`);
      setPayingId(null);
      load();
    }
  };

  const tableRows = tab === 'back' ? groups.back : groups.used;
  const rest = Math.max(0, tableRows.length - shown);
  const columns = [
    { key: 'date', label: 'Дата', width: 120, render: (o) => <CellMono>{ddmm(o.created_at)}</CellMono> },
    {
      key: 'place',
      label: 'Место',
      render: (o) => (
        <Link to={`/orders/${o.id}`} className="hover:text-accent">
          <CellText>{o.company_name || o.offer_title}</CellText>
        </Link>
      ),
    },
    { key: 'id', label: 'Заказ', width: 110, render: (o) => <CellMono>№ {pad6(o.id)}</CellMono> },
    { key: 'total', label: tab === 'back' ? 'Сумма' : 'Оплачено', width: 110, render: (o) => <CellMono>{rub(o.total_amount)}</CellMono> },
    tab === 'back'
      ? {
          key: 'st',
          label: 'Статус',
          width: 110,
          align: 'right',
          render: (o) => <CellMono>{o.status === 'refunded' ? '↺ Возврат' : '✕ Отменён'}</CellMono>,
        }
      : { key: 'saved', label: 'Экономия', width: 110, align: 'right', render: (o) => <CellMono>−{rub(savedOf(o))}</CellMono> },
  ];

  const pairs = [];
  for (let i = 0; i < groups.active.length; i += 2) pairs.push(groups.active.slice(i, i + 2));

  return (
    <div className="flex flex-col gap-8">
      <div className="hidden md:block">
        <Crumbs items={[{ label: 'Профиль', to: '/profile' }, { label: 'Заказы' }]} />
      </div>
      <div className="flex flex-col lg:flex-row gap-10 lg:gap-12 items-start">
        <div className="flex-1 min-w-0 w-full flex flex-col gap-6">
          <h1 className="font-display font-bold text-[30px] md:text-[36px] leading-none tracking-[-0.02em] text-ink">ЗАКАЗЫ</h1>
          <Tabs
            value={tab}
            onChange={(k) => {
              setTab(k);
              setShown(PAGE);
            }}
            items={[
              { key: 'active', label: `Активные · ${groups.active.length}` },
              { key: 'used', label: `Использованные · ${groups.used.length}` },
              { key: 'back', label: groups.back.length ? `Возвраты · ${groups.back.length}` : 'Возвраты' },
            ]}
          />
          <Rule2 />

          {tab === 'active' && (
            <>
              {groups.active.length === 0 ? (
                <div className="flex flex-col items-start gap-3">
                  <div className="text-[15px] text-ink-soft">Активных заказов нет. Возьмите скидку — чек с кодом появится здесь.</div>
                  <TextButton as={Link} to="/">К предложениям</TextButton>
                </div>
              ) : (
                pairs.map((pair, i) => (
                  <React.Fragment key={pair[0].id}>
                    {i > 0 && <Rule />}
                    <div className="flex flex-col sm:flex-row gap-6 sm:gap-8 items-stretch">
                      {pair.map((o, j) => (
                        <React.Fragment key={o.id}>
                          {j > 0 && <VRule className="hidden sm:block" />}
                          <ActiveOrder order={o} offer={data.offers.get(o.offer_id)} onPay={pay} busy={payingId === o.id} />
                        </React.Fragment>
                      ))}
                      {pair.length === 1 && (
                        <>
                          <VRule className="hidden sm:block invisible" />
                          <div className="hidden sm:block flex-1" />
                        </>
                      )}
                    </div>
                  </React.Fragment>
                ))
              )}
              {error && <div className="font-mono text-[12px] text-accent">{error}</div>}
              <Rule2 />
              <SectionLabel>
                <span className="md:hidden">Недавно использованные</span>
                <span className="hidden md:inline">Использованные</span>
              </SectionLabel>
            </>
          )}

          {/* Телефон: короткий список «дата · место … экономия». */}
          <div className="md:hidden flex flex-col gap-[10px]">
            {tableRows.length === 0 ? (
              <span className="text-[14px] text-ink-soft">{tab === 'back' ? 'Возвратов не было.' : 'Здесь появятся заказы, погашенные на кассе.'}</span>
            ) : (
              tableRows.slice(0, tab === 'active' ? 3 : shown).map((o) => (
                <Link key={o.id} to={`/orders/${o.id}`} className="flex items-end gap-2">
                  <span className="font-mono text-[12px] text-ink-soft whitespace-nowrap">{ddmm(o.created_at)}</span>
                  <span className="font-mono text-[12px] tracking-[0.03em] uppercase text-ink truncate max-w-[55%]">{o.company_name || o.offer_title}</span>
                  <span className="flex-1 min-w-[8px] border-t border-dashed border-ink-faint h-[4px]" />
                  <span className="font-mono text-[12px] text-ink whitespace-nowrap">
                    {tab === 'back' ? rub(o.total_amount) : `−${rub(savedOf(o))}`}
                  </span>
                </Link>
              ))
            )}
            {tab === 'active' ? (
              <TextButton as={Link} to="/savings" className="self-center mt-4">Весь журнал экономии</TextButton>
            ) : (
              rest > 0 && <TextButton onClick={() => setShown((n) => n + 10)} className="self-center mt-2">Показать ещё {Math.min(rest, 10)}</TextButton>
            )}
          </div>

          <div className="hidden md:block">
          <Table
            columns={columns}
            rows={tableRows.slice(0, shown)}
            minWidth={560}
            empty={tab === 'back' ? 'Возвратов не было.' : 'Здесь появятся заказы, погашенные на кассе.'}
          />
          {rest > 0 && (
            <div className="flex justify-center mt-6">
              <TextButton onClick={() => setShown((n) => n + 10)}>Показать ещё {Math.min(rest, 10)}</TextButton>
            </div>
          )}
          </div>
        </div>

        <VRule className="hidden lg:block" />

        <div className="hidden md:flex w-full lg:w-[360px] shrink-0 flex-col gap-6">
          <SectionLabel>{month.name}</SectionLabel>
          <div className="flex flex-col gap-[10px]">
            <Leader label="Заказов" value={month.count} />
            <Leader label="Оплачено" value={rub(month.paid)} />
            <Leader label="Бонусами" value={`${num(month.bonus)} Б`} />
            <Rule />
            <div className="flex items-end gap-2">
              <span className="font-mono font-bold text-[12px] tracking-[0.03em] uppercase text-ink whitespace-nowrap">Сэкономлено</span>
              <span className="flex-1 min-w-[8px] border-t border-dashed border-ink-faint h-[7px]" />
              <span className="font-display font-bold text-[22px] leading-none text-accent whitespace-nowrap">{rub(month.saved)}</span>
            </div>
          </div>
          <Rule />
          <div className="flex flex-col items-start gap-4">
            <TextButton as={Link} to="/savings">Журнал экономии →</TextButton>
            <TextButton as={Link} to="/support">Проблема с заказом</TextButton>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Order;
