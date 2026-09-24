import React, { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import api from '../api/client';
import {
  PageHead, SectionLabel, Meta, Segmented, StatRow, DayBars, Table, CellMono, CellText, Rule2, VRule, Loading, ErrorLine,
  rub, num, ddmm, monthDative, joinNames,
} from './merchant/kit';

/** P07 · Статистика */
const MerchantStatistics = () => {
  const { scope, companies, selected } = useOutletContext();
  const [period, setPeriod] = useState('30');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setData(null);
    api
      .get('/merchant/cabinet/stats', { params: { ...scope, period } })
      .then((r) => setData(r.data))
      .catch((e) => setError(e.response?.data?.error || 'Не удалось загрузить статистику'));
  }, [scope.company_id, period]);

  if (error) return <ErrorLine>{error}</ErrorLine>;

  const who = selected ? selected.name : companies.length === 2 ? 'Обе компании' : joinNames(companies.map((c) => c.name));
  const multi = !selected && companies.length > 1;

  const head = (
    <PageHead
      title="Статистика"
      subtitle={data ? `${who} · ${ddmm(data.from)} — ${ddmm(data.to)}` : who}
      right={
        <Segmented
          items={[{ key: '7', label: '7 дней' }, { key: '30', label: '30 дней' }, { key: '90', label: 'Квартал' }]}
          value={period}
          onChange={setPeriod}
        />
      }
    />
  );
  if (!data) return <div className="flex flex-col gap-7">{head}<Loading /></div>;

  const o = data.offers;
  const growth = data.uses_prev > 0 ? Math.round(((data.uses - data.uses_prev) / data.uses_prev) * 100) : null;
  const peak = data.daily.reduce((best, d) => (d.count > (best?.count ?? -1) ? d : best), null);
  const ev = data.events;

  return (
    <div className="flex flex-col gap-7">
      {head}
      <StatRow
        items={[
          { label: 'Предложений', value: num(o.total), caption: `${o.published} опубл. · ${o.pending} на модер. · ${o.draft} черн.` },
          {
            label: 'Использований',
            value: num(data.uses),
            caption: growth === null ? 'Нет данных для сравнения' : `${growth >= 0 ? '+' : '−'}${Math.abs(growth)}% к ${monthDative(new Date(new Date(data.prev_from).getTime() + (new Date(data.from) - new Date(data.prev_from)) / 2))}`,
          },
          { label: 'Ивентов', value: num(ev.total), caption: `Идут ${ev.going} · интерес ${ev.interested}` },
          { label: 'Средний чек', value: rub(data.avg_check), caption: `Скидка в среднем ${Math.round(data.avg_discount_pct)}%` },
        ]}
      />
      <Rule2 />
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <SectionLabel>Использования предложений по дням</SectionLabel>
        {peak && peak.count > 0 && <Meta>Макс. {peak.count} · {ddmm(peak.date)}</Meta>}
      </div>
      <DayBars days={data.daily} height={150} />
      <Rule2 />
      <div className="flex flex-col xl:flex-row gap-10 items-start">
        <div className="flex-1 min-w-0 w-full flex flex-col gap-5">
          <SectionLabel>Топ-5 предложений по использованию</SectionLabel>
          <Table
            rowKey="offer_id"
            columns={[
              { key: 'n', label: '№', width: 30, render: (r) => <CellMono>{data.top_offers.indexOf(r) + 1}</CellMono> },
              { key: 't', label: 'Предложение', render: (r) => <CellText>{multi ? `${r.title} · ${r.company_name}` : r.title}</CellText> },
              { key: 'c', label: 'Раз', width: 70, render: (r) => <CellMono>{num(r.count)}</CellMono> },
              { key: 'r', label: 'Выручка', width: 90, render: (r) => <CellMono>{rub(r.revenue)}</CellMono> },
            ]}
            rows={data.top_offers}
            empty="За период заказов не было."
          />
        </div>
        <VRule className="hidden xl:block" />
        <div className="flex-1 min-w-0 w-full flex flex-col gap-5">
          <SectionLabel>Топ-3 ивента по посещаемости</SectionLabel>
          <Table
            rowKey="event_id"
            columns={[
              { key: 'n', label: '№', width: 30, render: (r) => <CellMono>{ev.top_going.indexOf(r) + 1}</CellMono> },
              { key: 't', label: 'Ивент', render: (r) => <CellText>{r.title}</CellText> },
              { key: 'c', label: 'Идут', width: 70, render: (r) => <CellMono>{r.count}</CellMono> },
            ]}
            rows={ev.top_going}
            empty="Пока никто не отметил «Пойду»."
          />
          <SectionLabel className="mt-5">Топ-3 по интересу («может быть»)</SectionLabel>
          <Table
            rowKey="event_id"
            columns={[
              { key: 'n', label: '№', width: 30, render: (r) => <CellMono>{ev.top_interested.indexOf(r) + 1}</CellMono> },
              { key: 't', label: 'Ивент', render: (r) => <CellText>{r.title}</CellText> },
              { key: 'c', label: '?', width: 70, render: (r) => <CellMono>{r.count}</CellMono> },
            ]}
            rows={ev.top_interested}
            empty="Пока никто не отметил «Может быть»."
          />
        </div>
      </div>
    </div>
  );
};

export default MerchantStatistics;
