import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { RouteLoadingView } from '../design/DottedPath';
import { Rule, Rule2, VRule, Leader, SectionLabel, TextButton, Table, CellMono, CellText, ddmm, ddmmyy, num, plural } from './merchant/kit';
import { loadOrdersWithOffers, savedOf, isSpent, MONTHS_NOM, MONTHS_SHORT, monthKey, downloadCSV } from '../utils/orders';

/**
 * D04 · Журнал экономии: слева итог за всё время, столбики по месяцам
 * и категории, где экономите больше всего; справа — операции по месяцам.
 */

const rub = (v) => `${num(v)} ₽`;
const CHART_H = 120;
const CHART_MONTHS = 8;
const MONTH_ROWS = 10;

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

const MonthChart = ({ months }) => {
  const max = Math.max(1, ...months.map((m) => m.saved));
  return (
    <div className="flex items-end gap-2 w-full">
      {months.map((m, i) => {
        const current = i === months.length - 1;
        const h = m.saved > 0 ? Math.max(6, Math.round((m.saved / max) * CHART_H)) : 2;
        return (
          <div key={m.key} className="flex-1 min-w-0 flex flex-col items-center gap-[6px]" title={`${MONTHS_NOM[m.month]}: ${rub(m.saved)}`}>
            {current && <span className="font-mono font-bold text-[10px] text-ink whitespace-nowrap">{num(m.saved)}</span>}
            <div className={`w-full ${current ? 'bg-ink' : 'border border-dashed border-ink'}`} style={{ height: h }} />
            <span className={`font-mono text-[10px] tracking-[0.04em] uppercase whitespace-nowrap ${current ? 'font-bold text-ink' : 'text-ink-soft'}`}>
              {MONTHS_SHORT[m.month]}
            </span>
          </div>
        );
      })}
    </div>
  );
};

const columns = [
  { key: 'date', label: 'Дата', width: 90, render: (o) => <CellMono>{ddmm(o.created_at)}</CellMono> },
  {
    key: 'place',
    label: 'Место',
    render: (o) => (
      <Link to={`/orders/${o.id}`} className="hover:text-accent">
        <CellText>{o.company_name || o.offer_title}</CellText>
      </Link>
    ),
  },
  { key: 'price', label: 'Цена', width: 110, render: (o) => <CellMono>{rub(o.subtotal)}</CellMono> },
  { key: 'paid', label: 'Оплачено', width: 110, render: (o) => <CellMono>{rub(o.total_amount)}</CellMono> },
  { key: 'saved', label: 'Экономия', width: 110, align: 'right', render: (o) => <CellMono>−{rub(savedOf(o))}</CellMono> },
];

const Savings = () => {
  const [data, setData] = useState(null);
  const [open, setOpen] = useState({});

  useEffect(() => {
    loadOrdersWithOffers()
      .then(setData)
      .catch(() => setData({ orders: [], offers: new Map() }));
  }, []);

  const stats = useMemo(() => {
    if (!data) return null;
    const spent = data.orders.filter((o) => isSpent(o) && savedOf(o) > 0);
    const total = spent.reduce((s, o) => s + savedOf(o), 0);
    const first = spent.length ? spent[spent.length - 1].created_at : null;

    const now = new Date();
    const months = [];
    for (let i = CHART_MONTHS - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = monthKey(d);
      months.push({ key, month: d.getMonth(), saved: spent.filter((o) => monthKey(o.created_at) === key).reduce((s, o) => s + savedOf(o), 0) });
    }

    const byCat = new Map();
    spent.forEach((o) => {
      const cat = data.offers.get(o.offer_id)?.tags?.[0]?.name || 'Другое';
      byCat.set(cat, (byCat.get(cat) || 0) + savedOf(o));
    });
    const cats = [...byCat.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);

    const groups = [];
    spent.forEach((o) => {
      const key = monthKey(o.created_at);
      let g = groups.find((x) => x.key === key);
      if (!g) {
        const d = new Date(o.created_at);
        g = { key, title: `${MONTHS_NOM[d.getMonth()]} ${d.getFullYear()}`, rows: [] };
        groups.push(g);
      }
      g.rows.push(o);
    });

    return { spent, total, first, months, cats, groups };
  }, [data]);

  if (!stats) return <RouteLoadingView label="Считаем экономию..." />;

  const exportCSV = () =>
    downloadCSV('zhurnal-ekonomii.csv', [
      ['Дата', 'Место', 'Предложение', 'Цена', 'Оплачено', 'Экономия'],
      ...stats.spent.map((o) => [ddmmyy(o.created_at), o.company_name || '', o.offer_title || '', o.subtotal, o.total_amount, savedOf(o)]),
    ]);

  const count = stats.spent.length;

  return (
    <div className="flex flex-col gap-8">
      <Crumbs items={[{ label: 'Профиль', to: '/profile' }, { label: 'Журнал экономии' }]} />
      <div className="flex flex-col lg:flex-row gap-10 lg:gap-14 items-start">
        <div className="w-full lg:w-[440px] shrink-0 flex flex-col gap-6">
          <h1 className="font-display font-bold text-[36px] leading-none tracking-[-0.02em] text-ink">ЖУРНАЛ</h1>
          <div className="font-mono font-medium text-[11px] tracking-[0.08em] uppercase text-ink-soft">Итого сэкономлено · всё время</div>
          <div className="font-display font-bold text-[44px] sm:text-[56px] leading-none tracking-[0.01em] text-accent whitespace-nowrap">{rub(stats.total)}</div>
          <div className="font-mono text-[11px] tracking-[0.03em] text-ink-soft uppercase">
            {stats.first ? `С ${ddmmyy(stats.first)} · ` : ''}
            {count} {plural(count, 'скидка', 'скидки', 'скидок')}
          </div>
          <Rule2 />
          <SectionLabel>По месяцам</SectionLabel>
          <MonthChart months={stats.months} />
          <Rule />
          <SectionLabel>Где экономите больше всего</SectionLabel>
          {stats.cats.length ? (
            <div className="flex flex-col gap-[10px]">
              {stats.cats.map(([name, v]) => (
                <Leader key={name} label={name} value={rub(v)} />
              ))}
            </div>
          ) : (
            <div className="text-[14px] text-ink-soft">Пока нечего считать.</div>
          )}
          <Rule />
          <div>
            <TextButton onClick={exportCSV} disabled={!count}>Экспорт в CSV</TextButton>
          </div>
        </div>

        <VRule className="hidden lg:block" />

        <div className="flex-1 min-w-0 w-full flex flex-col gap-6">
          {stats.groups.length === 0 && (
            <div className="flex flex-col items-start gap-3">
              <div className="text-[15px] text-ink-soft">Здесь появится каждая скидка, которой вы воспользовались.</div>
              <TextButton as={Link} to="/">К предложениям</TextButton>
            </div>
          )}
          {stats.groups.map((g, i) => (
            <React.Fragment key={g.key}>
              {i > 0 && <Rule2 />}
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-[13px] tracking-[0.08em] uppercase text-ink">{g.title}</span>
                  <span className="font-mono text-[11px] tracking-[0.04em] text-ink-soft">{g.rows.length} ОПЕР.</span>
                </div>
                <Table columns={columns} rows={open[g.key] ? g.rows : g.rows.slice(0, MONTH_ROWS)} minWidth={520} />
                {g.rows.length > MONTH_ROWS && !open[g.key] && (
                  <div className="flex justify-center">
                    <TextButton onClick={() => setOpen((x) => ({ ...x, [g.key]: true }))}>Показать все {g.rows.length}</TextButton>
                  </div>
                )}
                <div className="pt-1">
                  <div className="flex items-end gap-2">
                    <span className="font-mono font-bold text-[13px] tracking-[0.03em] uppercase text-ink whitespace-nowrap">Сэкономлено за месяц</span>
                    <span className="flex-1 min-w-[8px] border-t border-dashed border-ink-faint h-[4px]" />
                    <span className="font-mono font-bold text-[13px] text-ink whitespace-nowrap">{rub(g.rows.reduce((s, o) => s + savedOf(o), 0))}</span>
                  </div>
                </div>
              </div>
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Savings;
