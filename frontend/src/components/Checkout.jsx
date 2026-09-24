import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import api from '../api/client';
import { useMobileTop } from '../context/MobileChrome';
import { RouteLoadingView, RouteEmptyState } from '../design/DottedPath';
import { SectionLabel, Leader, PrimaryButton, TextButton, Rule, Rule2, AlertBlock, Meta, rub } from './merchant/kit';

/**
 * D20 · Оплата и D21 · Оплата — ошибка (недостаточно средств).
 * Заказ создаётся в момент нажатия «Оплатить»: деньги списываются
 * с кошелька, затем показываем чек (D03).
 */

const bonusSteps = (max) => {
  if (max <= 0) return [0];
  const steps = new Set([0]);
  [1 / 3, 2 / 3].forEach((f) => {
    const v = Math.round(max * f);
    if (v > 0 && v < max) steps.add(v);
  });
  steps.add(max);
  return [...steps].sort((a, b) => a - b);
};

const Checkout = () => {
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [offer, setOffer] = useState(null);
  const [wallet, setWallet] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [bonus, setBonus] = useState(null);
  const [method, setMethod] = useState(params.get('method') === 'sbp' ? 'sbp' : 'wallet');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useMobileTop({
    back: -1,
    label: 'Назад',
    right: <span className="font-mono font-medium text-[11px] tracking-[0.06em] uppercase text-ink">Новый заказ</span>,
  });

  const load = () => {
    api.get(`/offers/${id}`).then((r) => setOffer(r.data.offer)).catch(() => setNotFound(true));
    api.get('/wallet').then((r) => setWallet(r.data)).catch(() => setWallet({ balance: 0, bonus: 0 }));
  };
  useEffect(load, [id]);

  const calc = useMemo(() => {
    if (!offer) return null;
    const base = offer.base_price || 0;
    const discount = offer.discount_type === 'percentage' ? base * (offer.discount_value / 100) : Math.min(base, offer.discount_value);
    const afterDiscount = Math.max(0, base - discount);
    const cap = offer.bonus_allowed ? Math.floor((afterDiscount * (offer.max_bonus_percent || 0)) / 100) : 0;
    const available = Math.floor(wallet?.bonus || 0);
    const maxBonus = Math.min(cap, available);
    return { base, discount, afterDiscount, maxBonus, available };
  }, [offer, wallet]);

  useEffect(() => {
    if (calc && bonus === null) setBonus(calc.maxBonus);
  }, [calc, bonus]);

  if (notFound) return <RouteEmptyState title="Предложение не найдено" action={<Link to="/" className="btn-bracket">На главную</Link>} />;
  if (!offer || !wallet || !calc || bonus === null) return <RouteLoadingView label="Готовим оплату..." />;

  const name = offer.company_name || offer.title;
  const total = Math.max(0, calc.afterDiscount - bonus);
  const balance = Number(wallet.balance || 0);
  const shortage = Math.max(0, Math.ceil(total - balance));
  const noMoney = method === 'wallet' && shortage > 0;
  const pct = offer.discount_type === 'percentage' ? ` ${Number(offer.discount_value)}%` : '';

  const topUp = async (amount) => {
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

  const pay = async () => {
    if (method === 'sbp') return topUp(Math.max(1, shortage || Math.ceil(total)));
    setBusy(true);
    setError('');
    try {
      const r = await api.post('/orders', { offer_id: offer.id, bonus_points: bonus });
      await api.post(`/orders/${r.data.id}/confirm`);
      navigate(`/orders/${r.data.id}`, { replace: true });
    } catch (e) {
      const msg = e.response?.data?.error || e.message;
      setError(msg.includes('insufficient') ? 'Недостаточно средств на кошельке.' : `Ошибка: ${msg}`);
      load();
    } finally {
      setBusy(false);
    }
  };

  const steps = bonusSteps(calc.maxBonus);

  return (
    <div className="w-full max-w-[560px] mx-auto flex flex-col">
      <div className="hidden md:block font-mono text-[11px] tracking-[0.06em] uppercase text-ink-soft">
        <Link to="/" className="hover:text-ink">Предложения</Link>
        <span className="mx-3">/</span>
        <Link to={`/offers/${offer.id}`} className="hover:text-ink">{name}</Link>
        <span className="mx-3">/</span>
        <span>Оплата</span>
      </div>
      <div className="md:mt-6 flex items-end justify-between gap-4">
        <h1 className="font-display font-bold text-[30px] md:text-[36px] leading-[1.25] tracking-[-0.02em] uppercase text-ink">Оплата</h1>
        <Meta className="hidden md:block pb-[6px]">Новый заказ</Meta>
      </div>
      <div className="mt-6">
        <div className="font-display font-bold text-[18px] uppercase text-ink">{name}</div>
        <div className="mt-1 text-[14px] text-ink-soft">{[offer.title, offer.address].filter(Boolean).join(' · ')}</div>
      </div>

      <Rule2 className="mt-6" />

      {!noMoney && (
        <>
          <div className="mt-6 flex flex-col gap-[10px]">
            <Leader label="Цена" value={rub(calc.base)} />
            <Leader label={`Скидка студента${pct}`} value={<span className="text-accent">−{Math.round(calc.discount)} ₽</span>} />
          </div>
          {offer.bonus_allowed && calc.maxBonus > 0 && (
            <>
              <Rule className="mt-6" />
              <div className="mt-6 flex items-center justify-between">
                <SectionLabel>Списать бонусы</SectionLabel>
                <Meta>Доступно {calc.available}</Meta>
              </div>
              <div className="mt-3 flex items-center gap-4 flex-wrap">
                {steps.map((v) =>
                  v === bonus ? (
                    <span key={v} className="bg-ink text-on-ink font-mono font-bold text-[12px] tracking-[0.04em] uppercase px-[6px] py-[2px]">
                      {v === calc.maxBonus && v > 0 ? `${v} · макс` : v}
                    </span>
                  ) : (
                    <button key={v} onClick={() => setBonus(v)} className="font-mono text-[12px] tracking-[0.04em] uppercase text-ink-soft hover:text-ink">
                      {v === calc.maxBonus && v > 0 ? `${v} · макс` : v}
                    </button>
                  )
                )}
              </div>
              <Leader className="mt-3" label="Бонусы" value={bonus > 0 ? `−${bonus} ₽` : '0 ₽'} />
            </>
          )}
          <Rule2 className="mt-6" />
        </>
      )}

      <div className="mt-6 flex items-end gap-2">
        <span className="font-mono font-bold text-[12px] tracking-[0.03em] uppercase text-ink whitespace-nowrap">Итого к оплате</span>
        <span className="flex-1 border-t border-dashed border-ink-faint h-[11px]" />
        <span className="font-display font-bold text-[30px] md:text-[36px] leading-none text-ink whitespace-nowrap">{rub(total)}</span>
      </div>
      <Rule2 className="mt-6" />

      {noMoney && (
        <AlertBlock className="mt-6" title="Недостаточно средств">
          На кошельке {rub(balance)}, а нужно {rub(total)}. Пополните кошелёк или оплатите через СБП.
        </AlertBlock>
      )}

      <SectionLabel className="mt-6">Способ оплаты</SectionLabel>
      <div className="mt-[14px] flex flex-col gap-[14px]">
        {[
          {
            key: 'wallet',
            label: 'Кошелёк',
            hint: shortage > 0 ? `Не хватает ${rub(shortage)}` : 'Списание с баланса, мгновенно',
            right: rub(balance),
          },
          { key: 'sbp', label: 'СБП', hint: 'Через приложение вашего банка' },
        ].map((m) => (
          <button key={m.key} onClick={() => setMethod(m.key)} className="flex items-start gap-3 text-left">
            <span className={`font-mono font-bold text-[13px] w-6 shrink-0 ${method === m.key ? 'text-ink' : 'text-ink-faint'}`}>
              {method === m.key ? '[×]' : '[ ]'}
            </span>
            <span className="flex-1 min-w-0">
              <span className={`block font-mono ${method === m.key ? 'font-bold text-ink' : 'text-ink-soft'} text-[12px] tracking-[0.04em] uppercase`}>{m.label}</span>
              <span className="block text-[14px] text-ink-soft mt-[3px]">{m.hint}</span>
            </span>
            {m.right && <span className="font-mono text-[12px] text-ink whitespace-nowrap">{m.right}</span>}
          </button>
        ))}
      </div>

      {error && <div className="mt-4 font-mono text-[12px] text-accent">{error}</div>}

      {noMoney ? (
        <>
          <PrimaryButton className="mt-6 w-full" onClick={() => topUp(shortage)} disabled={busy}>
            Пополнить на {rub(shortage)}
          </PrimaryButton>
          <div className="mt-6 text-center">
            <TextButton onClick={() => topUp(shortage)} disabled={busy}>Оплатить через СБП</TextButton>
          </div>
        </>
      ) : (
        <>
          <PrimaryButton className="mt-6 w-full" onClick={pay} disabled={busy}>
            {busy ? 'Оплачиваем…' : `Оплатить ${rub(total)}`}
          </PrimaryButton>
          <div className="mt-6 text-center text-[13px] text-ink-soft">После оплаты вы получите чек с кодом — покажите его на кассе. Код действует до конца дня.</div>
        </>
      )}
    </div>
  );
};

export default Checkout;
