import React, { useEffect, useState } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import api from '../api/client';
import {
  PageHead, SectionLabel, FieldLabel, PrimaryButton, OutlineButton, Rule, Rule2, VRule, Leader, Photo,
  StatusMark, Avatar, Loading, ErrorLine, rub, pad6, ddmmyy, ddmmHHMM,
} from './merchant/kit';

/** P05 · Правки от администратора */

const LABELS = {
  title: 'Название',
  description: 'Описание',
  discount_type: 'Тип скидки',
  discount_value: 'Скидка',
  base_price: 'Базовая цена',
  special_price: 'Спец. цена',
  start_at: 'Начало',
  end_at: 'Окончание',
  bonus_allowed: 'Бонусы',
  max_bonus_percent: 'Макс. % бонусами',
  max_uses: 'Лимит',
  address: 'Адрес',
  phone: 'Телефон',
  website: 'Сайт',
  working_hours: 'Часы работы',
  image_url: 'Обложка',
  latitude: 'Точка на карте',
};

const show = (key, v, o) => {
  if (v === null || v === undefined || v === '') return '—';
  switch (key) {
    case 'discount_value':
      return (o.discount_type || 'percentage') === 'percentage' ? `−${Number(v)}%` : `−${Math.round(v)} ₽`;
    case 'base_price':
      return `${Math.round(v).toLocaleString('ru-RU')} ₽`;
    case 'discount_type':
      return v === 'percentage' ? 'Процент' : 'Фиксированная';
    case 'start_at':
    case 'end_at':
      return ddmmyy(v);
    case 'bonus_allowed':
      return v ? 'Разрешены' : 'Запрещены';
    case 'max_bonus_percent':
      return `${v}%`;
    case 'image_url':
      return decodeURIComponent(String(v).split('/').pop());
    case 'latitude':
      return 'изменена';
    default:
      return String(v);
  }
};

const same = (key, a, b) => {
  if (key === 'start_at' || key === 'end_at') return ddmmyy(a) === ddmmyy(b);
  if (typeof a === 'number' || typeof b === 'number') return Number(a || 0) === Number(b || 0);
  return String(a ?? '') === String(b ?? '');
};

const shortName = (full) => {
  const p = (full || '').trim().split(/\s+/);
  return p.length > 1 ? `${p[0][0]}. ${p.slice(1).join(' ')}` : full || 'Модератор';
};

const MerchantOfferEdits = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { reload } = useOutletContext();
  const [offer, setOffer] = useState(null);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get(`/merchant/cabinet/offers/${id}`)
      .then((r) => setOffer(r.data))
      .catch((e) => setError(e.response?.data?.error || 'Не удалось загрузить предложение'));
  }, [id]);

  if (error && !offer) return <ErrorLine>{error}</ErrorLine>;
  if (!offer) return <Loading />;

  const edits = offer.admin_edited_data || {};
  const merged = { ...offer, ...Object.fromEntries(Object.entries(edits).filter(([, v]) => v !== null && v !== undefined)) };
  const changes = Object.keys(LABELS)
    .filter((k) => k in edits && edits[k] !== null && edits[k] !== undefined && !same(k, offer[k], edits[k]))
    .map((k) => ({ key: k, label: LABELS[k], before: show(k, offer[k], offer), after: show(k, edits[k], merged) }));
  const waiting = offer.status === 'pending_partner_approval';

  const price = Number(merged.base_price) || 0;
  const dv = Number(merged.discount_value) || 0;
  const yourPrice = merged.discount_type === 'percentage' ? price * (1 - dv / 100) : Math.max(0, price - dv);

  const act = async (accept) => {
    setError('');
    if (!accept && !comment.trim()) return setError('Напишите, что не так — модератор увидит комментарий.');
    setBusy(true);
    try {
      if (accept) await api.post(`/merchant/offers/${id}/accept-edits`);
      else await api.post(`/merchant/offers/${id}/reject-edits`, { comment });
      reload();
      navigate('/merchant/offers');
    } catch (e) {
      setError(e.response?.data?.error || 'Не удалось сохранить решение');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-7">
      <PageHead
        crumbs={[{ label: 'Предложения', to: '/merchant/offers' }, { label: `№ ${pad6(offer.id)}` }, { label: 'Правки' }]}
        title="Правки от администратора"
        subtitle={`«${offer.title}» · ${offer.company_name || ''}`}
        right={waiting ? <StatusMark kind="back">Ждёт вашего решения</StatusMark> : <StatusMark kind="draft">Решение принято</StatusMark>}
      />

      <div className="flex flex-col xl:flex-row gap-10 items-start">
        <div className="w-full xl:w-[622px] shrink-0 flex flex-col gap-5">
          <div className="border-l-[3px] border-ink pl-4 flex flex-col gap-[10px]">
            <div className="flex items-center gap-[10px]">
              <Avatar name={offer.admin_edited_by_name || 'М'} size={28} />
              <span className="font-mono font-bold text-[11px] tracking-[0.04em] uppercase text-ink">
                {shortName(offer.admin_edited_by_name)} · модератор{offer.admin_edited_at ? ` · ${ddmmHHMM(offer.admin_edited_at)}` : ''}
              </span>
            </div>
            <div className="text-[15px] leading-[25px] text-ink">
              {(() => {
                const c = (offer.admin_edit_comment || 'Модератор внёс правки без комментария').trim();
                return /[.!?…]$/.test(c) ? c : `${c}.`;
              })()}{' '}
              Если согласны — нажмите «Согласовать», предложение сразу выйдет в ленту.
            </div>
          </div>
          <Rule2 />
          <div>
            <div className="flex gap-4 py-2 border-b border-ink font-mono font-medium text-[10px] tracking-[0.06em] uppercase text-ink-soft">
              <span className="w-[150px] shrink-0">Поле</span>
              <span className="flex-1">Было</span>
              <span className="flex-1">Стало</span>
            </div>
            {changes.length === 0 ? (
              <div className="py-4 text-[14px] text-ink-soft border-b border-dashed border-line">Изменений в полях нет — модератор оставил только комментарий.</div>
            ) : (
              changes.map((c) => (
                <div key={c.key} className="flex gap-4 py-3 items-center border-b border-dashed border-line">
                  <span className="w-[150px] shrink-0 font-mono text-[12px] tracking-[0.03em] uppercase text-ink">{c.label}</span>
                  <span className="flex-1 text-[14px] leading-[19px] text-ink-soft line-through">{c.before}</span>
                  <span className="flex-1 text-[14px] leading-[19px] font-medium text-ink">{c.after}</span>
                </div>
              ))
            )}
          </div>
          <div className="text-[13px] text-ink-soft">Остальные поля не изменились.</div>
        </div>

        <VRule className="hidden xl:block" />

        <div className="w-full xl:w-[340px] shrink-0 flex flex-col gap-5">
          <SectionLabel>После правок</SectionLabel>
          <div>
            <Photo src={merged.image_url} className="w-full h-[170px]" />
            <div className="mt-[10px] flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-display font-bold text-[15px] uppercase text-ink truncate">{offer.company_name}</div>
                <div className="text-[12px] text-ink-soft mt-[3px] truncate">{[merged.title, merged.address].filter(Boolean).join(' · ')}</div>
              </div>
              {dv > 0 && (
                <span className="text-ink-red text-[22px] leading-none shrink-0">
                  {merged.discount_type === 'percentage' ? `−${dv}%` : `−${Math.round(dv)} ₽`}
                </span>
              )}
            </div>
            <div className="mt-[10px] flex flex-col gap-[10px]">
              <Leader label="Цена" value={price ? rub(price) : '—'} />
              <Leader label="Ваша цена" value={price ? rub(yourPrice) : '—'} strong />
            </div>
          </div>
          <Rule2 />
          {waiting ? (
            <>
              <PrimaryButton className="w-full" onClick={() => act(true)} disabled={busy}>
                Согласовать и опубликовать
              </PrimaryButton>
              <OutlineButton className="w-full" onClick={() => act(false)} disabled={busy}>
                Не согласен
              </OutlineButton>
              <label className="flex flex-col gap-2">
                <FieldLabel>Что не так? (увидит модератор)</FieldLabel>
                <textarea
                  rows={3}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Например: скидка 50% согласована с управляющим"
                  className="border-b border-dashed border-line focus:border-ink pb-[10px] bg-transparent outline-none text-[16px] leading-[22px] text-ink resize-none placeholder:text-ink-faint"
                />
              </label>
              <ErrorLine>{error}</ErrorLine>
            </>
          ) : (
            <div className="text-[14px] text-ink-soft">По этим правкам решение уже принято.</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MerchantOfferEdits;
