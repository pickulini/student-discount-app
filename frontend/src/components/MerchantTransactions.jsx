import React, { useEffect, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import api from '../api/client';
import {
  PageHead, TextButton, Tabs, StatRow, Table, CellMono, CellText, Rule2, FieldLabel, Loading, ErrorLine,
  rub, pad6, ddmm, ddmmHHMM, plural, txOperation, txStatus,
} from './merchant/kit';

/** P08 · Транзакции */

const iso = (d) => {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

const pageList = (page, pages) => {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  const set = new Set([1, 2, 3, page - 1, page, page + 1, pages].filter((p) => p >= 1 && p <= pages));
  const sorted = [...set].sort((a, b) => a - b);
  const out = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push('…');
    out.push(p);
  });
  return out;
};

const MerchantTransactions = () => {
  const { scope } = useOutletContext();
  const today = new Date();
  const [type, setType] = useState('');
  const [from, setFrom] = useState(iso(new Date(today.getFullYear(), today.getMonth(), 1)));
  const [to, setTo] = useState(iso(today));
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [periodOpen, setPeriodOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const periodRef = useRef(null);

  useEffect(() => {
    setPage(1);
  }, [type, from, to, scope.company_id]);

  useEffect(() => {
    api
      .get('/merchant/cabinet/transactions', { params: { ...scope, type, from, to, page, per_page: 20 } })
      .then((r) => setData(r.data))
      .catch((e) => setError(e.response?.data?.error || 'Не удалось загрузить транзакции'));
  }, [scope.company_id, type, from, to, page]);

  useEffect(() => {
    const onClick = (e) => periodRef.current && !periodRef.current.contains(e.target) && setPeriodOpen(false);
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const exportCsv = async () => {
    setExporting(true);
    try {
      const r = await api.get('/merchant/cabinet/transactions', { params: { ...scope, type, from, to, page: 1, per_page: 1000 } });
      const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
      const lines = [
        ['Дата', 'Описание', 'Заказ', 'Компания', 'Сумма', 'Статус'].map(esc).join(';'),
        ...r.data.items.map((t) =>
          [
            new Date(t.created_at).toLocaleString('ru-RU'),
            txOperation(t, { long: true }),
            t.order_id ? pad6(t.order_id) : '',
            t.company_name,
            String(t.amount).replace('.', ','),
            t.type === 'refund' ? 'возврат' : t.status === 'pending' ? 'в обработке' : t.type === 'settlement' ? 'выплачено' : 'зачислено',
          ]
            .map(esc)
            .join(';')
        ),
      ];
      const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `transactions_${from}_${to}.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      setError('Не удалось выгрузить CSV');
    } finally {
      setExporting(false);
    }
  };

  if (error) return <ErrorLine>{error}</ErrorLine>;
  if (!data) return <Loading />;

  const s = data.summary;

  return (
    <div className="flex flex-col gap-7">
      <PageHead
        title="Транзакции"
        subtitle="Все движения денег по вашим компаниям"
        right={<TextButton onClick={exportCsv} disabled={exporting}>{exporting ? 'Готовим…' : 'Экспорт CSV'}</TextButton>}
      />
      <StatRow
        compact
        items={[
          { label: 'Начислено за 30 дней', value: rub(s.credited_30d, { sign: true }) },
          { label: 'Возвраты за 30 дней', value: rub(s.refunds_30d) },
          { label: 'Выплачено', value: rub(s.paid_out) },
          { label: 'На балансе', value: rub(s.balance), caption: `Выплата ${ddmm(s.next_payout_date)}` },
        ]}
      />
      <Rule2 />
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <Tabs
          value={type}
          onChange={setType}
          items={[
            { key: '', label: 'Все' },
            { key: 'earning', label: 'Заработок' },
            { key: 'payout', label: 'Выплаты' },
            { key: 'refund', label: 'Возвраты' },
          ]}
        />
        <div className="relative" ref={periodRef}>
          <button onClick={() => setPeriodOpen((v) => !v)} className="font-mono font-medium text-[11px] tracking-[0.04em] uppercase text-ink">
            Период: {ddmm(data.from)} — {ddmm(data.to)} ↓
          </button>
          {periodOpen && (
            <div className="absolute right-0 top-full mt-3 z-20 bg-bg border border-dashed border-ink p-4 flex gap-4">
              {[
                ['С', from, setFrom],
                ['По', to, setTo],
              ].map(([l, v, fn]) => (
                <label key={l} className="flex flex-col gap-2">
                  <FieldLabel>{l}</FieldLabel>
                  <input
                    type="date"
                    value={v}
                    onChange={(e) => fn(e.target.value)}
                    className="border-b border-dashed border-line bg-transparent outline-none font-mono text-[14px]"
                  />
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      <Table
        columns={[
          { key: 'd', label: 'Дата', width: 120, render: (t) => <CellMono>{ddmmHHMM(t.created_at)}</CellMono> },
          { key: 'o', label: 'Описание', render: (t) => <CellText>{txOperation(t, { long: true })}</CellText> },
          { key: 'n', label: 'Заказ', width: 110, render: (t) => <CellMono>{t.order_id ? `№ ${pad6(t.order_id)}` : '—'}</CellMono> },
          { key: 'c', label: 'Компания', width: 150, render: (t) => <CellText className="font-normal">{t.company_name}</CellText> },
          { key: 'a', label: 'Сумма', width: 110, render: (t) => <CellMono>{rub(t.amount, { sign: true })}</CellMono> },
          { key: 's', label: 'Статус', width: 140, render: txStatus },
        ]}
        rows={data.items}
        empty="За выбранный период операций нет."
        footer={
          data.total_count > 0 && (
            <div className="flex items-center gap-4 py-3">
              <span className="w-[120px] shrink-0" />
              <span className="flex-1 font-mono font-bold text-[12px] tracking-[0.03em] uppercase text-ink">
                Итого за период · {data.total_count} {plural(data.total_count, 'операция', 'операции', 'операций')}
              </span>
              <span className="w-[110px] shrink-0" />
              <span className="w-[150px] shrink-0" />
              <span className="w-[110px] shrink-0 font-mono font-bold text-[12px] text-ink">{rub(data.total_amount, { sign: true })}</span>
              <span className="w-[140px] shrink-0" />
            </div>
          )
        }
      />

      {data.pages > 1 && (
        <div className="flex items-center justify-center gap-5 font-mono text-[12px] tracking-[0.03em]">
          <button disabled={page === 1} onClick={() => setPage(page - 1)} className="disabled:text-ink-faint">←</button>
          {pageList(page, data.pages).map((p, i) =>
            p === '…' ? (
              <span key={`e${i}`} className="text-ink-soft">…</span>
            ) : (
              <button key={p} onClick={() => setPage(p)} className={p === page ? 'font-bold text-ink underline underline-offset-4' : 'text-ink-soft hover:text-ink'}>
                {p}
              </button>
            )
          )}
          <button disabled={page === data.pages} onClick={() => setPage(page + 1)} className="disabled:text-ink-faint">→</button>
        </div>
      )}
    </div>
  );
};

export default MerchantTransactions;
