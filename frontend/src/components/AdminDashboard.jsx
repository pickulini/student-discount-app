import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { RouteLoadingView } from '../design/DottedPath';
import { DayBars, Rule, Rule2, Segmented, SmallButton, StatRow, TextButton, SectionLabel, hhmm, num, ddmmyy } from './merchant/kit';
import { AdminHead, MONTHS_DAT, WEEKDAYS, durationLabel } from './admin/shared';

/** A01 · Сводка: показатели, очередь на разбор, заказы по дням, последние действия. */

const PERIODS = [
  { key: 'today', label: 'Сегодня' },
  { key: '30d', label: '30 дней' },
  { key: 'all', label: 'Всё время' },
];
const PERIOD_CAPTION = { today: 'сегодня', '30d': 'за 30 дней', all: 'за всё время' };

const money = (v) => {
  const n = Number(v || 0);
  if (n >= 1e6) return `${(n / 1e6).toLocaleString('ru-RU', { maximumFractionDigits: 1 })} млн ₽`;
  if (n >= 1e5) return `${Math.round(n / 1e3).toLocaleString('ru-RU')} тыс ₽`;
  return `${num(n)} ₽`;
};

const QueueRow = ({ count, title, hint, action, to }) => (
  <div className="border-l-[3px] border-ink pl-4 py-1 flex gap-5 items-center">
    <span className="font-display font-bold text-[40px] leading-none tracking-[-0.02em] text-ink w-[48px] shrink-0">{count}</span>
    <div className="flex-1 min-w-0 flex flex-col gap-1">
      <span className="font-mono font-bold text-[12px] tracking-[0.04em] uppercase text-ink">{title}</span>
      <span className="text-[14px] text-ink-soft">{hint}</span>
    </div>
    <SmallButton as={Link} to={to}>{action}</SmallButton>
  </div>
);

const AdminDashboard = () => {
  const [period, setPeriod] = useState('30d');
  const [d, setD] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get('/admin/dashboard', { params: { period } })
      .then((r) => setD(r.data))
      .catch((e) => setError(e.response?.data?.error || 'Не удалось загрузить сводку'));
  }, [period]);

  if (!d) return error ? <div className="font-mono text-[12px] text-accent uppercase">{error}</div> : <RouteLoadingView label="Собираем сводку..." />;

  const now = new Date();
  const c = d.counters || {};
  const wait = (t, one) => (t ? `${one} ${durationLabel(Date.now() - new Date(t).getTime())}` : 'Очередь пуста');
  const days = (d.days || []).map((x) => ({ date: x.day, count: x.count }));
  const prevMonth = MONTHS_DAT[(now.getMonth() + 11) % 12];
  const change =
    d.month_change == null ? '' : `${d.month_change >= 0 ? '+' : '−'}${Math.abs(Math.round(d.month_change))}% к ${prevMonth}`;

  return (
    <div className="flex flex-col gap-7">
      <AdminHead
        title="Сводка"
        subtitle={`${WEEKDAYS[now.getDay()]}, ${ddmmyy(now)} · ${hhmm(now)}`}
        right={<Segmented items={PERIODS} value={period} onChange={setPeriod} />}
      />

      <StatRow
        compact
        items={[
          { label: 'Пользователи', value: num(d.users), caption: `+${num(d.users_today)} сегодня` },
          { label: 'Компании', value: num(d.companies), caption: `+${num(d.companies_week)} за неделю` },
          { label: 'Предложения', value: num(d.offers), caption: `${num(d.offers_published)} опубликовано` },
          { label: 'Заказы', value: num(d.orders), caption: `+${num(d.orders_today)} сегодня` },
          { label: 'Комиссия', value: money(d.commission), caption: PERIOD_CAPTION[period] },
        ]}
      />

      <Rule2 />

      <div className="flex flex-col xl:flex-row gap-10 items-start">
        <div className="flex-1 min-w-0 w-full flex flex-col gap-5">
          <SectionLabel>Очередь</SectionLabel>
          <QueueRow
            count={c.moderation || 0}
            title="Предложения на модерации"
            hint={wait(d.oldest_offer, 'Самое старое ждёт')}
            action="Разобрать"
            to="/admin/moderation"
          />
          <QueueRow
            count={c.verifications || 0}
            title="Заявки на верификацию"
            hint={wait(d.oldest_verification, 'Самая старая ждёт')}
            action="Проверить"
            to="/admin/verifications"
          />
          <QueueRow
            count={c.support || 0}
            title="Обращения в поддержку"
            hint={
              d.support_late > 0
                ? `${d.support_late === 1 ? 'Одно' : num(d.support_late)} без ответа дольше 15 мин`
                : c.support > 0
                ? 'Все ждут меньше 15 минут'
                : 'Новых обращений нет'
            }
            action="Ответить"
            to="/admin/support"
          />
          <Rule />
          <div className="flex items-center justify-between gap-3 font-mono text-[11px] whitespace-nowrap">
            <span className="font-medium tracking-[0.08em] uppercase text-ink">Заказы по дням</span>
            {change && <span className="tracking-[0.04em] uppercase text-ink-soft">{change}</span>}
          </div>
          <DayBars days={days} height={140} />
        </div>

        <div className="hidden xl:block w-px self-stretch border-l border-dashed border-line" />

        <div className="w-full xl:w-[360px] shrink-0 flex flex-col gap-5">
          <SectionLabel>Последние действия</SectionLabel>
          {(d.recent || []).length === 0 ? (
            <span className="text-[14px] text-ink-soft">Журнал пока пуст.</span>
          ) : (
            d.recent.map((it, i) => (
              <React.Fragment key={it.id}>
                {i > 0 && <Rule />}
                <div className="flex gap-3 items-start">
                  <span className="font-mono font-bold text-[11px] tracking-[0.02em] text-ink whitespace-nowrap">{hhmm(it.at)}</span>
                  <div className="flex-1 min-w-0 flex flex-col gap-[2px]">
                    <span className="font-mono font-medium text-[10px] tracking-[0.04em] uppercase text-ink-soft">{it.actor}</span>
                    <span className="text-[13px] leading-[19px] text-ink">
                      {it.text.charAt(0).toLowerCase() + it.text.slice(1)}
                      {it.object_name && !it.text.includes(it.object_name) ? ` · ${it.object_name}` : ''}
                    </span>
                  </div>
                </div>
              </React.Fragment>
            ))
          )}
          <TextButton as={Link} to="/admin/journal" className="self-start">
            Весь журнал
          </TextButton>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
