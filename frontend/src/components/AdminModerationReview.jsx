import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useOutletContext, useParams } from 'react-router-dom';
import api from '../api/client';
import { RouteLoadingView } from '../design/DottedPath';
import {
  Avatar,
  Field,
  FieldLabel,
  Leader,
  OutlineButton,
  Photo,
  PrimaryButton,
  Rule,
  Rule2,
  SectionLabel,
  Segmented,
  TextButton,
  VRule,
  ddmm,
  ddmmyy,
  discountLabel,
  hhmm,
  num,
  plural,
} from './merchant/kit';
import { CheckLine, Crumbs, no6 } from './admin/shared';
import { ModStatus, statusOf } from './AdminModeration';

/** A03 · Модерация — проверка предложения: опубликовать, поправить и вернуть партнёру или отклонить. */

const REASONS = [
  'Нет базовой цены',
  '«Бесплатно» при оплате',
  'Срок больше 6 месяцев',
  'Нет обложки или адреса',
  'Скидка не настоящая',
];

const priceAfter = (o) => {
  const base = Number(o.base_price || 0);
  if (!base) return null;
  const v = Number(o.discount_value || 0);
  const after = o.discount_type === 'percentage' ? base * (1 - v / 100) : base - v;
  return Math.max(0, Math.round(after));
};

const toDateInput = (d) => {
  if (!d) return '';
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};

const EditForm = ({ offer, onCancel, onDone }) => {
  const [f, setF] = useState({
    title: offer.title || '',
    description: offer.description || '',
    discount_type: offer.discount_type || 'percentage',
    discount_value: offer.discount_value ?? 0,
    base_price: offer.base_price ?? 0,
    start_at: toDateInput(offer.start_at),
    end_at: toDateInput(offer.end_at),
    address: offer.address || '',
    working_hours: offer.working_hours || '',
    phone: offer.phone || '',
    website: offer.website || '',
  });
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));

  const send = async () => {
    if (!comment.trim()) return setError('Напишите партнёру, что и зачем поменяли');
    setBusy(true);
    setError('');
    try {
      await api.put(`/admin/offers/${offer.id}`, {
        ...offer,
        ...f,
        company_id: offer.company_id,
        discount_value: Number(f.discount_value),
        base_price: Number(f.base_price),
        start_at: f.start_at ? new Date(`${f.start_at}T00:00:00`).toISOString() : offer.start_at,
        end_at: f.end_at ? new Date(`${f.end_at}T23:59:00`).toISOString() : offer.end_at,
        tags: undefined,
        comment: comment.trim(),
      });
      onDone();
    } catch (e) {
      setError(e.response?.data?.error || 'Не удалось отправить правки');
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-10 items-start">
      <div className="flex-1 min-w-0 w-full flex flex-col gap-6">
        <SectionLabel>Правки для партнёра</SectionLabel>
        <Field label="Название" value={f.title} onChange={set('title')} />
        <Field label="Описание" multiline value={f.description} onChange={set('description')} />
        <div className="flex flex-col gap-2">
          <FieldLabel>Тип скидки</FieldLabel>
          <Segmented
            value={f.discount_type}
            onChange={(v) => setF((x) => ({ ...x, discount_type: v }))}
            items={[
              { key: 'percentage', label: 'Процент' },
              { key: 'fixed', label: 'Рубли' },
            ]}
          />
        </div>
        <div className="grid sm:grid-cols-2 gap-6">
          <Field label="Базовая цена, ₽" mono inputMode="decimal" value={f.base_price} onChange={set('base_price')} />
          <Field label={f.discount_type === 'percentage' ? 'Скидка, %' : 'Скидка, ₽'} mono inputMode="decimal" value={f.discount_value} onChange={set('discount_value')} />
          <Field label="Начало" mono type="date" value={f.start_at} onChange={set('start_at')} />
          <Field label="Конец" mono type="date" value={f.end_at} onChange={set('end_at')} />
          <Field label="Адрес" value={f.address} onChange={set('address')} />
          <Field label="Часы" value={f.working_hours} onChange={set('working_hours')} />
          <Field label="Телефон" value={f.phone} onChange={set('phone')} />
          <Field label="Сайт" value={f.website} onChange={set('website')} />
        </div>
      </div>
      <VRule className="hidden lg:block" />
      <div className="w-full lg:w-[380px] shrink-0 flex flex-col gap-5">
        <SectionLabel>Комментарий партнёру</SectionLabel>
        <Field multiline placeholder="Что поправили и почему" value={comment} onChange={(e) => setComment(e.target.value)} error={error} />
        <PrimaryButton className="w-full" onClick={send} disabled={busy}>
          {busy ? 'Отправляем…' : 'Отправить партнёру'}
        </PrimaryButton>
        <TextButton onClick={onCancel} className="self-start">Отмена</TextButton>
        <span className="text-[13px] leading-[19px] text-ink-soft">
          Партнёр увидит «было / стало» и сможет согласовать одной кнопкой — тогда предложение опубликуется.
        </span>
      </div>
    </div>
  );
};

const AdminModerationReview = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { refreshCounters } = useOutletContext() || {};
  const [offer, setOffer] = useState(null);
  const [meta, setMeta] = useState(null);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [reasons, setReasons] = useState([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(null);

  const load = () =>
    Promise.all([api.get(`/admin/offers/${id}`), api.get(`/admin/moderation/${id}`)])
      .then(([o, m]) => {
        setOffer(o.data);
        setMeta(m.data);
      })
      .catch(() => setError('Предложение не найдено'));

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!offer || !meta) return error ? <div className="font-mono text-[12px] text-accent uppercase">{error}</div> : <RouteLoadingView label="Открываем предложение..." />;

  const st = statusOf(offer);
  const back = `/admin/moderation${offer.is_event ? '?kind=events' : ''}`;
  const after = priceAfter(offer);
  const sent = new Date(offer.updated_at);
  const canDecide = offer.status === 'pending_review';

  const done = () => {
    refreshCounters?.();
    window.dispatchEvent(new Event('admin-badges-refresh'));
    navigate(back);
  };

  const act = async (action) => {
    const reason = [...reasons, text.trim()].filter(Boolean).join('; ');
    if (action === 'reject' && !reason) return setError('Отметьте причину или напишите её — партнёр увидит, что исправить');
    setBusy(action);
    setError('');
    try {
      if (action === 'archive') await api.put(`/admin/offers/${id}/archive`);
      else await api.put(`/admin/offers/${id}/moderate`, { action, reason: action === 'reject' ? reason : undefined });
      done();
    } catch (e) {
      setError(e.response?.data?.error || 'Не получилось');
      setBusy(null);
    }
  };

  const toggleReason = (r) => setReasons((xs) => (xs.includes(r) ? xs.filter((x) => x !== r) : [...xs, r]));

  const discount =
    offer.discount_value > 0 ? (
      <span>
        <span className="text-accent font-bold">{discountLabel(offer)}</span>
        {after != null && <span className="text-accent font-bold"> · {num(after)} ₽</span>}
      </span>
    ) : (
      '—'
    );
  const period = `${ddmmyy(offer.start_at)} — ${offer.end_at ? ddmmyy(offer.end_at) : 'без срока'}`;
  const p = meta.partner;

  return (
    <div className="flex flex-col gap-7">
      <Crumbs items={[{ to: back, label: 'Модерация' }, no6(offer.id)]} />
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div className="flex flex-col gap-3 min-w-0">
          <h1 className="font-display font-bold text-[32px] sm:text-[40px] leading-none tracking-[-0.02em] text-ink uppercase">{offer.title}</h1>
          <p className="text-[16px] text-ink-soft">
            {meta.company_name || 'Без компании'} · отправлено {ddmm(sent)} в {hhmm(sent)}
          </p>
        </div>
        <ModStatus status={st} />
      </div>

      {editing ? (
        <EditForm
          offer={offer}
          onCancel={() => setEditing(false)}
          onDone={done}
        />
      ) : (
        <div className="flex flex-col xl:flex-row gap-10 items-start">
          <div className="flex-1 min-w-0 w-full flex flex-col gap-6">
            <div className="flex flex-col md:flex-row gap-6 items-start">
              <Photo src={offer.image_url} className="w-full md:w-[320px] h-[200px] shrink-0" />
              <div className="flex-1 min-w-0 flex flex-col gap-3">
                <div className="flex gap-3 items-start justify-between">
                  <span className="font-display font-bold text-[20px] leading-[1.1] tracking-[-0.01em] uppercase text-ink">{offer.title}</span>
                  {offer.discount_value > 0 && (
                    <span className="font-display font-bold text-[20px] leading-[1.1] text-accent whitespace-nowrap">{discountLabel(offer)}</span>
                  )}
                </div>
                <p className="text-[15px] leading-[23px] text-ink-soft whitespace-pre-line">{offer.description || 'Описания нет.'}</p>
                {meta.tags.length > 0 && (
                  <div className="flex gap-3 flex-wrap font-mono text-[11px] tracking-[0.04em] uppercase text-ink-soft">
                    {meta.tags.map((t) => (
                      <span key={t}>#{t}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <Rule2 />
            <div className="grid md:grid-cols-2 gap-x-10 gap-y-[10px]">
              <div className="flex flex-col gap-[10px]">
                <Leader label="Базовая цена" value={offer.base_price > 0 ? `${num(offer.base_price)} ₽` : '— нет'} />
                <Leader label="Скидка" value={discount} />
                <Leader label="Бонусы" value={offer.bonus_allowed ? `до ${offer.max_bonus_percent || 0}%` : 'нельзя'} />
                <Leader label="Лимит" value={offer.max_uses ? `${num(offer.max_uses)} ${plural(offer.max_uses, 'заказ', 'заказа', 'заказов')}` : 'без лимита'} />
                <Leader label="Период" value={period} />
              </div>
              <div className="flex flex-col gap-[10px]">
                <Leader label="Адрес" value={offer.address || '—'} />
                <Leader label="Часы" value={offer.working_hours || '—'} />
                <Leader label="Телефон" value={offer.phone || '—'} />
                <Leader label="Сайт" value={offer.website ? offer.website.replace(/^https?:\/\//, '') : '—'} />
                <Leader label="Обложка" value={offer.image_url ? 'есть ✓' : 'нет'} />
              </div>
            </div>
            <Rule />
            <SectionLabel>{offer.is_event ? 'Организатор' : 'Партнёр'}</SectionLabel>
            {p ? (
              <Link to={`/admin/users/${p.id}`} className="flex gap-3 items-center group">
                <Avatar src={p.avatar_url} name={p.name} size={36} />
                <span className="flex flex-col gap-[2px]">
                  <span className="text-[16px] font-medium text-ink group-hover:text-accent">{p.name}</span>
                  <span className="font-mono text-[11px] tracking-[0.04em] uppercase text-ink-soft">
                    {num(p.companies)} {plural(p.companies, 'компания', 'компании', 'компаний')} · {num(p.offers)}{' '}
                    {plural(p.offers, 'предложение', 'предложения', 'предложений')} · {num(p.rejected_30d)}{' '}
                    {plural(p.rejected_30d, 'отклонение', 'отклонения', 'отклонений')} за 30 дней
                  </span>
                </span>
              </Link>
            ) : (
              <span className="text-[14px] text-ink-soft">Не указан.</span>
            )}
            <Rule />
            <SectionLabel>История</SectionLabel>
            <div className="flex flex-col gap-[10px]">
              {meta.history.map((h, i) => (
                <Leader key={i} label={`${ddmm(h.at)} ${hhmm(h.at)}`} value={h.text} />
              ))}
            </div>
          </div>

          <VRule className="hidden xl:block" />

          <div className="w-full xl:w-[380px] shrink-0 flex flex-col gap-5">
            <SectionLabel>Решение</SectionLabel>
            {canDecide ? (
              <>
                <PrimaryButton className="w-full py-[16px]" onClick={() => act('publish')} disabled={busy !== null}>
                  {busy === 'publish' ? 'Публикуем…' : '✓ Опубликовать'}
                </PrimaryButton>
                <OutlineButton className="w-full py-[15px]" onClick={() => setEditing(true)} disabled={busy !== null}>
                  Править и вернуть партнёру
                </OutlineButton>
                <Rule2 />
                <SectionLabel>Или отклонить</SectionLabel>
                <div className="flex flex-col gap-3">
                  {REASONS.map((r) => (
                    <CheckLine key={r} checked={reasons.includes(r)} onChange={() => toggleReason(r)}>
                      {r}
                    </CheckLine>
                  ))}
                </div>
                <Field
                  label="Причина (увидит партнёр)"
                  multiline
                  placeholder="Что исправить, чтобы пройти модерацию"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                />
                {error && <span className="font-mono text-[12px] uppercase text-accent">{error}</span>}
                <TextButton onClick={() => act('reject')} disabled={busy !== null} className="self-start">
                  {busy === 'reject' ? 'Отклоняем…' : 'Отклонить с причиной'}
                </TextButton>
              </>
            ) : (
              <>
                <span className="text-[14px] leading-[21px] text-ink-soft">
                  {offer.status === 'pending_partner_approval'
                    ? 'Правки отправлены партнёру. Ждём, пока он их согласует или отклонит.'
                    : offer.status === 'rejected'
                    ? `Отклонено${offer.rejection_reason ? `: «${offer.rejection_reason}»` : '.'} Партнёр может исправить и отправить заново.`
                    : offer.status === 'draft'
                    ? 'Черновик — партнёр ещё не отправил на модерацию.'
                    : offer.status === 'archived'
                    ? 'Предложение в архиве.'
                    : 'Предложение опубликовано.'}
                </span>
                {offer.status === 'published' && (
                  <>
                    <OutlineButton className="w-full" onClick={() => setEditing(true)}>Править и вернуть партнёру</OutlineButton>
                    <TextButton onClick={() => act('archive')} disabled={busy !== null} className="self-start">
                      {busy === 'archive' ? 'Убираем…' : 'Убрать в архив'}
                    </TextButton>
                  </>
                )}
                {error && <span className="font-mono text-[12px] uppercase text-accent">{error}</span>}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminModerationReview;
