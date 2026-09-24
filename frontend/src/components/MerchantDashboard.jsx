import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useOutletContext } from 'react-router-dom';
import api from '../api/client';
import {
  PageHead, Meta, SectionLabel, StatRow, DayBars, Table, CellMono, CellText, Rule, Rule2, VRule,
  NoteBlock, SmallButton, TextButton, PrimaryButton, FieldLabel, Leader, Loading, ErrorLine,
  rub, ddmm, ddmmHHMM, hhmm, plural, monthDative, txOperation, txStatus, greeting, joinNames,
} from './merchant/kit';

/** P01 · Дашборд */
const MerchantDashboard = () => {
  const { scope, companies, selected, user } = useOutletContext();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [code, setCode] = useState('');

  useEffect(() => {
    setData(null);
    setError('');
    api
      .get('/merchant/cabinet/overview', { params: scope })
      .then((r) => setData(r.data))
      .catch((e) => setError(e.response?.data?.error || 'Не удалось загрузить дашборд'));
  }, [scope.company_id]);

  const firstName = (user.full_name || '').split(' ')[0] || user.nickname || '';
  const names = selected ? [selected.name] : companies.map((c) => c.name);

  if (error) return <ErrorLine>{error}</ErrorLine>;
  if (!data) return <Loading />;

  const m = data.money;
  const growth = data.redeemed_prev > 0 ? Math.round(((data.redeemed_total - data.redeemed_prev) / data.redeemed_prev) * 100) : null;

  return (
    <div className="flex flex-col gap-7">
      <PageHead
        title={`${greeting()}, ${firstName}`}
        subtitle={`${joinNames(names) || 'Нет компаний'} · данные за 30 дней`}
        right={<Meta>Обновлено {hhmm(data.updated_at)}</Meta>}
      />

      <StatRow
        items={[
          { label: 'Общий баланс', value: rub(m.balance), caption: `К выплате ${ddmm(data.next_payout_date)}` },
          { label: 'Начислено', value: rub(m.credited, { sign: true }), caption: 'За 30 дней' },
          {
            label: 'Возвраты',
            value: rub(m.refunds),
            caption: `${m.refunds_count} ${plural(m.refunds_count, 'заказ', 'заказа', 'заказов')}`,
          },
          { label: 'Чистыми', value: rub(m.net), caption: `Средний чек ${rub(m.avg_check)}` },
        ]}
      />

      <Rule2 />

      <div className="flex flex-col xl:flex-row gap-10 items-start">
        {/* Колонка 1 — график и последние транзакции */}
        <div className="flex-1 min-w-0 w-full flex flex-col gap-5">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <SectionLabel>Погашено заказов по дням</SectionLabel>
            <Meta>
              Всего {data.redeemed_total}
              {growth !== null && ` · ${growth >= 0 ? '+' : '−'}${Math.abs(growth)}% к ${monthDative(new Date(new Date(data.prev_from).getTime() + 15 * 86400000))}`}
            </Meta>
          </div>
          <DayBars days={data.redeemed_daily} height={120} />
          <Rule />
          <div className="flex items-center justify-between">
            <SectionLabel>Последние транзакции</SectionLabel>
            <TextButton as={Link} to="/merchant/transactions">Все транзакции</TextButton>
          </div>
          <Table
            columns={[
              { key: 'date', label: 'Дата', width: 100, render: (t) => <CellMono>{ddmmHHMM(t.created_at)}</CellMono> },
              { key: 'op', label: 'Операция', render: (t) => <CellText>{txOperation(t)}</CellText> },
              { key: 'amount', label: 'Сумма', width: 90, align: 'right', render: (t) => <CellMono>{rub(t.amount, { sign: true })}</CellMono> },
              { key: 'status', label: 'Статус', width: 130, render: txStatus },
            ]}
            rows={data.transactions}
            empty="Операций пока не было — первые появятся после заказов студентов."
          />
        </div>

        <VRule className="hidden xl:block" />

        {/* Колонка 2 — внимание, касса, баланс */}
        <div className="w-full xl:w-[340px] shrink-0 flex flex-col gap-5">
          <SectionLabel>Требует внимания</SectionLabel>
          {data.attention.length === 0 ? (
            <div className="text-[14px] text-ink-soft">Всё в порядке — ничего не ждёт вашего решения.</div>
          ) : (
            data.attention.map((a) =>
              a.status === 'pending_partner_approval' ? (
                <NoteBlock
                  key={a.offer_id}
                  title="↺ Правки от администратора"
                  action={
                    <SmallButton as={Link} to={`/merchant/offers/${a.offer_id}/edits`}>
                      Посмотреть правки
                    </SmallButton>
                  }
                >
                  «{a.title}» — {a.note || 'модератор внёс правки'}. Согласуйте, чтобы опубликовать.
                </NoteBlock>
              ) : (
                <NoteBlock
                  key={a.offer_id}
                  title="✕ Отклонён"
                  action={<TextButton as={Link} to={`/merchant/offers/${a.offer_id}/edit`}>Исправить</TextButton>}
                >
                  «{a.title}» — {a.note || 'модератор отклонил предложение'}.
                </NoteBlock>
              )
            )
          )}

          <Rule2 />
          <SectionLabel>Касса · быстрая проверка</SectionLabel>
          <form
            className="flex flex-col gap-5"
            onSubmit={(e) => {
              e.preventDefault();
              navigate(`/merchant/cashier?code=${encodeURIComponent(code)}`);
            }}
          >
            <label className="flex flex-col gap-2">
              <FieldLabel>Код заказа</FieldLabel>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="0000 · XXXX"
                className="border-b border-dashed border-line focus:border-ink pb-[10px] bg-transparent outline-none font-mono text-[16px] tracking-[0.02em] text-ink placeholder:text-ink-faint"
              />
            </label>
            <PrimaryButton type="submit" className="w-full">
              Проверить код
            </PrimaryButton>
          </form>

          <Rule />
          <SectionLabel>Баланс по компаниям</SectionLabel>
          <div className="flex flex-col gap-[10px]">
            {data.companies.map((c) => (
              <Leader key={c.id} label={c.name} value={rub(c.balance)} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MerchantDashboard;
