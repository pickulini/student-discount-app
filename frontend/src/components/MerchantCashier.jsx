import React, { useEffect, useRef, useState, useMemo } from 'react';
import { useOutletContext, useSearchParams } from 'react-router-dom';
import api from '../api/client';
import {
  PageHead, SectionLabel, Meta, FieldLabel, PrimaryButton, TextButton, OutlineButton, Rule, Rule2, VRule,
  AlertBlock, Table, CellMono, CellText, Avatar, ErrorLine, rub, pad6, ddmm, ddmmyy, hhmm,
} from './merchant/kit';

/** P02 · Касса */

const formatCode = (raw) => {
  const s = (raw || '').toUpperCase().replace(/[^0-9A-Z]/g, '').slice(0, 8);
  return s.length > 4 ? `${s.slice(0, 4)} · ${s.slice(4)}` : s;
};

const money2 = (v) => Number(v || 0).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const Receipt = ({ result, redeemed }) => {
  const o = result?.order;
  if (!o) {
    return (
      <div className="bg-desk p-7">
        <div className="bg-white px-6 pt-6 pb-5 flex flex-col items-center gap-3 min-h-[260px] justify-center">
          <div className="font-mono text-[11px] tracking-[0.04em] text-ink-soft">ЗАКАЗ № ——————</div>
          <div className="font-display font-bold text-[22px] text-ink-faint">ВВЕДИТЕ КОД</div>
          <div className="font-mono text-[11px] tracking-[0.04em] text-ink-soft text-center">
            ЗДЕСЬ ПОЯВИТСЯ ЧЕК СТУДЕНТА
          </div>
        </div>
        <div className="tear-paper" />
      </div>
    );
  }
  const status = redeemed
    ? '✓ ПОГАШЕН'
    : result.error_code === 'already_redeemed'
      ? '✕ УЖЕ ПОГАШЕН'
      : result.error_code === 'not_paid'
        ? '✕ НЕ ОПЛАЧЕН'
        : result.error_code === 'cancelled'
          ? '✕ ОТМЕНЁН'
          : result.error_code === 'other_location'
            ? '✕ ДРУГАЯ ТОЧКА'
            : '✓ ДЕЙСТВИТЕЛЕН';
  const pct = o.discount_type === 'percentage' ? ` ${Number(o.discount_value)}%` : '';
  return (
    <div className="bg-desk p-7">
      <div className="bg-white px-6 pt-6 pb-5 flex flex-col items-center gap-3">
        <div className="font-mono text-[11px] tracking-[0.04em] text-ink-soft">ЗАКАЗ № {pad6(o.id)}</div>
        <div className={`font-display font-bold text-[22px] tracking-[-0.01em] ${status.startsWith('✕') ? 'text-accent' : 'text-ink'}`}>
          {status}
        </div>
        <div className="font-mono text-[11px] tracking-[0.04em] text-ink-soft text-center">
          {redeemed || o.redeemed_at
            ? `ПОГАШЕН ${ddmm(o.redeemed_at || new Date())} · ${hhmm(o.redeemed_at || new Date())}`
            : `ОПЛАЧЕН ${ddmm(o.paid_at)} · ${hhmm(o.paid_at)} · ДО ${ddmmyy(o.offer_end_at)}`}
        </div>
        <Rule2 className="w-full" />
        <div className="w-full flex items-center gap-3">
          <Avatar src={o.student_avatar} name={o.student_name} size={40} />
          <div className="min-w-0 flex flex-col gap-[2px]">
            <div className="text-[15px] font-semibold text-ink truncate">{o.student_name}</div>
            <div className="font-mono text-[11px] tracking-[0.02em] text-ink-soft uppercase">
              {o.student_verified ? 'Студент ✓' : 'Статус не подтверждён'}
              {o.student_university && ` ${o.student_university}`}
              {o.student_verified_until && ` · до ${ddmmyy(o.student_verified_until)}`}
            </div>
          </div>
        </div>
        <Rule className="w-full" />
        <div className="w-full flex flex-col gap-[9px]">
          <ReceiptRow label={o.offer_title} value={money2(o.subtotal)} />
          {o.discount_amount > 0 && <ReceiptRow label={`Скидка студента${pct}`} value={`−${money2(o.discount_amount)}`} />}
          {o.bonus_amount > 0 && <ReceiptRow label="Бонусы студента" value={`−${money2(o.bonus_amount)}`} />}
        </div>
        <Rule2 className="w-full" />
        <div className="w-full flex items-end gap-2">
          <span className="font-mono font-bold text-[12px] tracking-[0.03em] uppercase text-ink whitespace-nowrap">Выдать на</span>
          <span className="flex-1 border-t border-dashed border-ink-faint h-[9px]" />
          <span className="font-display font-bold text-[26px] leading-none text-ink whitespace-nowrap">{rub(o.subtotal)}</span>
        </div>
        <ReceiptRow soft label="Вам зачислим" value={rub(o.merchant_amount)} />
        <div className="text-[13px] leading-[19px] text-ink-soft text-center">
          Студент уже оплатил {rub(o.total_amount)} в приложении. С него ничего не берите.
        </div>
      </div>
      <div className="tear-paper" />
    </div>
  );
};

const ReceiptRow = ({ label, value, soft = false }) => (
  <div className="w-full flex items-end gap-2">
    <span className={`font-mono text-[12px] tracking-[0.03em] uppercase whitespace-nowrap truncate ${soft ? 'text-ink-soft' : 'text-ink'}`}>{label}</span>
    <span className="flex-1 min-w-[8px] border-t border-dashed border-ink-faint h-[4px]" />
    <span className={`font-mono text-[12px] tracking-[0.01em] whitespace-nowrap ${soft ? 'text-ink-soft' : 'text-ink'}`}>{value}</span>
  </div>
);

const MerchantCashier = () => {
  const { scope, companies, selected } = useOutletContext();
  const [params] = useSearchParams();
  const [code, setCode] = useState(formatCode(params.get('code')));
  const [result, setResult] = useState(null);
  const [redeemed, setRedeemed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [today, setToday] = useState({ count: 0, sum: 0, items: [] });
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [scanning, setScanning] = useState(false);
  const [pointOpen, setPointOpen] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const locations = useMemo(
    () => (selected ? selected.locations : companies.flatMap((c) => c.locations)) || [],
    [selected, companies]
  );
  const [locationId, setLocationId] = useState(null);
  useEffect(() => {
    try {
      const saved = localStorage.getItem('merchant.location');
      if (saved && locations.some((l) => String(l.id) === saved)) {
        setLocationId(Number(saved));
        return;
      }
    } catch {
      /* ignore */
    }
    setLocationId(locations[0]?.id ?? null);
  }, [locations]);
  const location = locations.find((l) => l.id === locationId);

  const loadToday = () =>
    api.get('/merchant/cabinet/redeem/today', { params: scope }).then((r) => setToday(r.data)).catch(() => {});

  useEffect(() => {
    loadToday();
  }, [scope.company_id]);

  const check = async (value = code) => {
    if (value.replace(/[^0-9A-Z]/g, '').length !== 8) {
      setError('Код из чека — 4 цифры и 4 буквы, например 0512 · KX7Q.');
      return;
    }
    setBusy(true);
    setError('');
    setRedeemed(false);
    setRejecting(false);
    try {
      const r = await api.post('/merchant/cabinet/redeem/check', { code: value, location_id: locationId }, { params: scope });
      setResult(r.data);
    } catch (e) {
      setError(e.response?.data?.error || 'Не удалось проверить код');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (params.get('code') && formatCode(params.get('code')).length === 11) check(formatCode(params.get('code')));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const redeem = async () => {
    if (!result?.order) return;
    setBusy(true);
    setError('');
    try {
      const r = await api.post(`/merchant/cabinet/redeem/${result.order.id}`, { location_id: locationId }, { params: scope });
      setResult(r.data);
      setRedeemed(true);
      loadToday();
    } catch (e) {
      if (e.response?.status === 409 && e.response.data) setResult(e.response.data);
      else setError(e.response?.data?.error || 'Не удалось погасить заказ');
    } finally {
      setBusy(false);
    }
  };

  const reject = async () => {
    if (!result?.order || !reason.trim()) return;
    setBusy(true);
    setError('');
    try {
      await api.post(`/merchant/cabinet/redeem/${result.order.id}/reject`, { reason }, { params: scope });
      setResult({ ...result, error_code: 'cancelled', error_title: 'Заказ отменён', error_text: 'Деньги вернулись студенту.' });
      setRejecting(false);
      setReason('');
    } catch (e) {
      setError(e.response?.data?.error || 'Не удалось оформить отказ');
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setCode('');
    setResult(null);
    setRedeemed(false);
    setRejecting(false);
  };

  // --- QR: BarcodeDetector есть в Chrome/Edge; в остальных браузерах вводим код руками.
  const stopScan = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setScanning(false);
  };
  useEffect(() => stopScan, []);
  const startScan = async () => {
    setError('');
    if (!('BarcodeDetector' in window) || !navigator.mediaDevices?.getUserMedia) {
      setError('Этот браузер не умеет читать QR. Откройте кассу в Chrome или введите код вручную.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      setScanning(true);
      setTimeout(async () => {
        if (!videoRef.current) return;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
        const tick = async () => {
          if (!streamRef.current || !videoRef.current) return;
          try {
            const found = await detector.detect(videoRef.current);
            if (found.length > 0) {
              const value = formatCode(found[0].rawValue);
              stopScan();
              setCode(value);
              check(value);
              return;
            }
          } catch {
            /* кадр не готов */
          }
          requestAnimationFrame(tick);
        };
        tick();
      }, 50);
    } catch {
      setError('Нет доступа к камере. Разрешите камеру в браузере или введите код вручную.');
    }
  };

  const valid = result?.order && !result.error_code && !redeemed;

  return (
    <div className="flex flex-col gap-7">
      <PageHead
        title="Касса"
        subtitle="Проверьте код из чека студента и погасите заказ."
        right={
          locations.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setPointOpen((v) => !v)}
                className="font-mono font-medium text-[11px] tracking-[0.04em] uppercase text-ink whitespace-nowrap"
              >
                Точка: {location ? location.address : 'любая'} ↓
              </button>
              {pointOpen && (
                <div className="absolute right-0 top-full mt-3 z-20 bg-bg border border-dashed border-ink min-w-[240px] py-2">
                  {locations.map((l) => (
                    <button
                      key={l.id}
                      onClick={() => {
                        setLocationId(l.id);
                        setPointOpen(false);
                        try {
                          localStorage.setItem('merchant.location', String(l.id));
                        } catch {
                          /* ignore */
                        }
                      }}
                      className={`block w-full text-left px-4 py-2 font-mono text-[11px] tracking-[0.04em] uppercase hover:bg-surface-2 ${
                        l.id === locationId ? 'font-bold text-ink' : 'text-ink-soft'
                      }`}
                    >
                      {l.id === locationId ? '● ' : '○ '}
                      {l.address}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        }
      />

      <div className="flex flex-col xl:flex-row gap-10 items-start">
        <div className="w-full xl:w-[486px] shrink-0 flex flex-col gap-5">
          <form
            className="flex flex-col gap-5"
            onSubmit={(e) => {
              e.preventDefault();
              check();
            }}
          >
            <label className="flex flex-col gap-2">
              <FieldLabel>Код заказа</FieldLabel>
              <input
                value={code}
                onChange={(e) => setCode(formatCode(e.target.value))}
                placeholder="0000 · XXXX"
                autoFocus
                className="border-b-2 border-ink pb-[10px] bg-transparent outline-none font-display font-bold text-[36px] tracking-[0.04em] text-ink placeholder:text-ink-faint"
              />
              <div className="text-[12px] leading-[18px] text-ink-soft">
                4 цифры и 4 буквы из чека. Или отсканируйте QR камерой ноутбука.
              </div>
            </label>
            <div className="flex items-center gap-5">
              <PrimaryButton type="submit" disabled={busy}>
                Проверить
              </PrimaryButton>
              {scanning ? (
                <TextButton type="button" onClick={stopScan}>Остановить камеру</TextButton>
              ) : (
                <TextButton type="button" onClick={startScan}>Сканировать QR</TextButton>
              )}
            </div>
          </form>
          {scanning && <video ref={videoRef} className="w-full bg-ink aspect-video object-cover" muted playsInline />}
          <ErrorLine>{error}</ErrorLine>

          {result?.error_code && (
            <>
              <Rule2 />
              <SectionLabel>Если что-то не так</SectionLabel>
              <AlertBlock title={result.error_title}>{result.error_text}</AlertBlock>
            </>
          )}

          <Rule />
          <div className="flex items-center justify-between">
            <SectionLabel>Сегодня погашено · {today.count}</SectionLabel>
            <Meta>На {rub(today.sum)}</Meta>
          </div>
          <Table
            columns={[
              { key: 't', label: 'Время', width: 70, render: (r) => <CellMono>{hhmm(r.redeemed_at)}</CellMono> },
              {
                key: 's',
                label: 'Студент',
                render: (r) => <CellText className="whitespace-normal">{[r.student, r.university].filter(Boolean).join(' · ')}</CellText>,
              },
              { key: 'c', label: 'Код', width: 120, render: (r) => <CellMono>{r.code}</CellMono> },
              { key: 'a', label: 'Сумма', width: 80, align: 'right', render: (r) => <CellMono>{rub(r.amount)}</CellMono> },
            ]}
            rows={today.items}
            empty="Сегодня ещё никто не погашал заказы."
          />
        </div>

        <VRule className="hidden xl:block" />

        <div className="w-full xl:flex-1 xl:min-w-[360px] flex flex-col gap-5">
          <Receipt result={result} redeemed={redeemed} />
          {valid && !rejecting && (
            <>
              <PrimaryButton className="w-full" onClick={redeem} disabled={busy}>
                {busy ? 'Гасим…' : 'Погасить заказ'}
              </PrimaryButton>
              <div className="text-center">
                <TextButton onClick={() => setRejecting(true)}>Отказать с причиной</TextButton>
              </div>
            </>
          )}
          {valid && rejecting && (
            <div className="flex flex-col gap-4">
              <label className="flex flex-col gap-2">
                <FieldLabel>Причина отказа (увидит студент)</FieldLabel>
                <textarea
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Например: позиция закончилась"
                  className="border-b border-dashed border-line focus:border-ink pb-[10px] bg-transparent outline-none text-[16px] text-ink resize-none placeholder:text-ink-faint"
                />
              </label>
              <OutlineButton onClick={reject} disabled={busy || !reason.trim()}>
                Отказать и вернуть деньги
              </OutlineButton>
              <div className="text-center">
                <TextButton onClick={() => setRejecting(false)}>Отмена</TextButton>
              </div>
            </div>
          )}
          {(redeemed || result?.error_code) && (
            <div className="text-center">
              <TextButton onClick={reset}>Следующий код</TextButton>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MerchantCashier;
