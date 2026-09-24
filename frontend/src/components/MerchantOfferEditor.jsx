import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useOutletContext, useParams, useSearchParams } from 'react-router-dom';
import api from '../api/client';
import LocationPicker from './LocationPicker';
import {
  PageHead, SectionLabel, FieldLabel, Field, Segmented, PrimaryButton, TextButton, Rule, Rule2, VRule,
  Leader, Photo, StatusMark, Loading, ErrorLine, rub, pad6,
} from './merchant/kit';

/** P04 · Предложение — редактор (новое / правка / повтор). */

const toDateInput = (d) => {
  if (!d) return '';
  const x = new Date(d);
  const p = (n) => String(n).padStart(2, '0');
  return `${x.getFullYear()}-${p(x.getMonth() + 1)}-${p(x.getDate())}`;
};

const STATUS_MARK = {
  draft: ['draft', 'Черновик'],
  pending_review: ['progress', 'На модерации'],
  pending_partner_approval: ['back', 'Ждёт вашего решения'],
  published: ['ok', 'Опубликовано'],
  rejected: ['reject', 'Отклонено'],
  expired: ['archive', 'Истёк'],
  archived: ['archive', 'Архив'],
};

const empty = {
  company_id: null,
  title: '',
  description: '',
  discount_type: 'percentage',
  discount_value: '',
  base_price: '',
  bonus_allowed: true,
  max_bonus_percent: 10,
  max_uses: '',
  start_at: toDateInput(new Date()),
  end_at: '',
  address: '',
  latitude: null,
  longitude: null,
  place_name: '',
  working_hours: '',
  phone: '',
  website: '',
  hashtags: '',
  image_url: '',
  gallery: [],
};

const fileName = (url) => (url ? decodeURIComponent(url.split('/').pop() || '') : '');

const MerchantOfferEditor = () => {
  const { id } = useParams();
  const [params] = useSearchParams();
  const copyId = params.get('copy');
  const navigate = useNavigate();
  const { companies, selected, reload } = useOutletContext();
  const [form, setForm] = useState(empty);
  const [status, setStatus] = useState('draft');
  const [loaded, setLoaded] = useState(!id && !copyId);
  const [config, setConfig] = useState({ commission_rate: 0.02 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [mapOpen, setMapOpen] = useState(false);
  const [uploading, setUploading] = useState('');
  const coverInput = useRef(null);
  const galleryInput = useRef(null);
  const tagsInput = useRef(null);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  useEffect(() => {
    api.get('/merchant/cabinet/config').then((r) => setConfig(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    const src = id || copyId;
    if (!src) return;
    api
      .get(`/merchant/cabinet/offers/${src}`)
      .then(({ data: o }) => {
        setForm({
          company_id: o.company_id,
          title: o.title || '',
          description: o.description || '',
          discount_type: o.discount_type || 'percentage',
          discount_value: o.discount_value ?? '',
          base_price: o.base_price || '',
          bonus_allowed: !!o.bonus_allowed,
          max_bonus_percent: o.max_bonus_percent || 10,
          max_uses: o.max_uses ?? '',
          start_at: copyId ? toDateInput(new Date()) : toDateInput(o.start_at),
          end_at: copyId ? '' : toDateInput(o.end_at),
          address: o.address || '',
          latitude: o.latitude ?? null,
          longitude: o.longitude ?? null,
          place_name: o.place_name || '',
          working_hours: o.working_hours || '',
          phone: o.phone || '',
          website: o.website || '',
          hashtags: (o.tags || []).map((t) => `#${t.name}`).join(' '),
          image_url: o.image_url || '',
          gallery: o.gallery || [],
        });
        setStatus(copyId ? 'draft' : o.status);
        setLoaded(true);
      })
      .catch((e) => {
        setError(e.response?.data?.error || 'Не удалось загрузить предложение');
        setLoaded(true);
      });
  }, [id, copyId]);

  // Компания по умолчанию — выбранная сверху или первая.
  useEffect(() => {
    if (!form.company_id && companies.length > 0) set({ company_id: selected?.id || companies[0].id });
  }, [companies, selected]);

  const company = companies.find((c) => c.id === form.company_id);
  const price = Number(form.base_price) || 0;
  const dv = Number(form.discount_value) || 0;
  const studentPays = Math.max(0, form.discount_type === 'percentage' ? price * (1 - dv / 100) : price - dv);
  const maxBonus = form.bonus_allowed ? Math.round((studentPays * (Number(form.max_bonus_percent) || 0)) / 100) : 0;
  const commission = studentPays * config.commission_rate;
  const credit = studentPays - commission;
  const creditMin = (studentPays - maxBonus) * (1 - config.commission_rate);
  const discountText = form.discount_type === 'percentage' ? `−${dv}%` : `−${Math.round(dv)} ₽`;

  const checklist = useMemo(() => {
    const text = `${form.title} ${form.description}`.toLowerCase();
    const start = form.start_at ? new Date(form.start_at) : null;
    const end = form.end_at ? new Date(form.end_at) : null;
    return [
      { ok: price > 0 && dv > 0 && studentPays < price, label: 'Реальная скидка к обычной цене' },
      { ok: !!form.image_url && !!form.address.trim(), label: 'Есть обложка и адрес' },
      { ok: !(studentPays > 0 && text.includes('бесплатн')), label: 'Без слов «бесплатно» при оплате' },
      { ok: !!(start && end && end > start && (end - start) / 86400000 <= 184), label: 'Срок не больше 6 месяцев' },
    ];
  }, [form, price, dv, studentPays]);

  const upload = async (file, kind) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError('Файл больше 5 МБ');
      return;
    }
    setUploading(kind);
    setError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const r = await api.post('/merchant/upload', fd);
      if (kind === 'cover') set({ image_url: r.data.url });
      else set({ gallery: [...form.gallery, r.data.url].slice(0, 4) });
    } catch (e) {
      setError(e.response?.data?.error || 'Ошибка загрузки');
    } finally {
      setUploading('');
    }
  };

  const payload = () => {
    const iso = (d, endOfDay) => (d ? new Date(`${d}T${endOfDay ? '23:59:00' : '00:00:00'}`).toISOString() : undefined);
    return {
      company_id: form.company_id,
      title: form.title.trim(),
      description: form.description.trim(),
      discount_type: form.discount_type,
      discount_value: dv,
      base_price: price,
      bonus_allowed: form.bonus_allowed,
      max_bonus_percent: form.bonus_allowed ? Number(form.max_bonus_percent) || 0 : 0,
      max_uses: form.max_uses === '' ? undefined : Number(form.max_uses),
      start_at: iso(form.start_at, false),
      end_at: iso(form.end_at, true),
      address: form.address || undefined,
      latitude: form.latitude ?? undefined,
      longitude: form.longitude ?? undefined,
      place_name: form.place_name || undefined,
      working_hours: form.working_hours || undefined,
      phone: form.phone || undefined,
      website: form.website || undefined,
      image_url: form.image_url || undefined,
      gallery: form.gallery,
      hashtags: form.hashtags.split(/[\s,]+/).map((t) => t.replace(/^#+/, '')).filter(Boolean),
    };
  };

  const save = async (submit) => {
    setError('');
    if (!form.company_id) return setError('Выберите компанию');
    if (!form.title.trim()) return setError('Укажите название');
    if (submit && (!price || !dv)) return setError('Укажите базовую цену и размер скидки');
    if (submit && !form.end_at) return setError('Укажите дату окончания');
    setBusy(true);
    try {
      let offerId = id;
      if (id) {
        await api.put(`/merchant/offers/${id}`, payload());
      } else {
        const r = await api.post('/merchant/offers', payload());
        offerId = r.data.id;
      }
      if (submit && (!id || status === 'draft')) {
        await api.post(`/merchant/offers/${offerId}/submit`);
      }
      reload();
      navigate('/merchant/offers');
    } catch (e) {
      setError(e.response?.data?.error || 'Не удалось сохранить');
    } finally {
      setBusy(false);
    }
  };

  if (!loaded) return <Loading />;

  const [markKind, markLabel] = STATUS_MARK[status] || STATUS_MARK.draft;
  const isNew = !id;
  const canDraft = isNew || status === 'draft';

  return (
    <div className="flex flex-col gap-7">
      <PageHead
        crumbs={[{ label: 'Предложения', to: '/merchant/offers' }, { label: isNew ? 'Новое' : `№ ${pad6(id)}` }]}
        title={isNew ? 'Новое предложение' : 'Редактирование'}
        subtitle={
          isNew || status === 'draft'
            ? 'Заполните поля — модерация обычно занимает до 2 часов.'
            : 'После сохранения предложение снова уйдёт на модерацию.'
        }
        right={<StatusMark kind={markKind}>{markLabel}</StatusMark>}
      />

      <div className="flex flex-col xl:flex-row gap-10 items-start">
        {/* Форма */}
        <div className="w-full xl:w-[622px] shrink-0 flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <FieldLabel>Компания</FieldLabel>
            <Segmented
              items={companies.map((c) => ({ key: c.id, label: c.name }))}
              value={form.company_id}
              onChange={(v) => set({ company_id: v })}
            />
          </div>
          <Field
            label="Название *"
            value={form.title}
            maxLength={40}
            onChange={(e) => set({ title: e.target.value })}
            placeholder="Кофе + десерт"
            hint="Коротко, что получает студент. До 40 символов."
          />
          <Field
            label="Описание"
            multiline
            value={form.description}
            onChange={(e) => set({ description: e.target.value })}
            placeholder="Что входит, когда действует, как получить"
          />

          <Rule />
          <SectionLabel>Цена и скидка</SectionLabel>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="flex flex-col gap-2">
              <FieldLabel>Тип скидки</FieldLabel>
              <Segmented
                items={[{ key: 'percentage', label: 'Процент' }, { key: 'fixed', label: 'Фиксированная' }]}
                value={form.discount_type}
                onChange={(v) => set({ discount_type: v })}
              />
            </div>
            <Field
              label="Значение *"
              mono
              type="number"
              min="0"
              value={form.discount_value}
              onChange={(e) => set({ discount_value: e.target.value })}
              suffix={<span className="font-mono text-[16px] text-ink">{form.discount_type === 'percentage' ? '%' : '₽'}</span>}
              inputClassName="w-16"
            />
            <Field
              label="Базовая цена *"
              mono
              type="number"
              min="0"
              value={form.base_price}
              onChange={(e) => set({ base_price: e.target.value })}
              suffix={<span className="font-mono text-[16px] text-ink">₽</span>}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="font-mono font-bold text-[12px] tracking-[0.04em] uppercase text-ink">Бонусы разрешены</div>
                <div className="text-[13px] text-ink-soft mt-1">Студент может оплатить часть бонусами</div>
              </div>
              <Segmented
                className="mt-1"
                items={[{ key: true, label: 'Вкл' }, { key: false, label: 'Выкл' }]}
                value={form.bonus_allowed}
                onChange={(v) => set({ bonus_allowed: v })}
              />
            </div>
            <Field
              label="Макс. % бонусами"
              mono
              type="number"
              min="0"
              max="100"
              disabled={!form.bonus_allowed}
              value={form.max_bonus_percent}
              onChange={(e) => set({ max_bonus_percent: e.target.value })}
              suffix={<span className="font-mono text-[16px] text-ink">%</span>}
            />
          </div>
          <Field
            label="Лимит использований"
            right="Необяз."
            type="number"
            min="1"
            value={form.max_uses}
            onChange={(e) => set({ max_uses: e.target.value })}
            placeholder="без ограничений"
          />

          <Rule />
          <SectionLabel>Где и когда</SectionLabel>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <Field label="Начало *" mono type="date" value={form.start_at} onChange={(e) => set({ start_at: e.target.value })} />
            <Field label="Окончание *" mono type="date" value={form.end_at} onChange={(e) => set({ end_at: e.target.value })} />
            <Field
              label="Адрес"
              value={form.address}
              onChange={(e) => set({ address: e.target.value })}
              placeholder={company?.locations?.[0]?.address || 'Улица, дом'}
              suffix={
                <button type="button" onClick={() => setMapOpen((v) => !v)} className="font-mono font-bold text-[11px] tracking-[0.04em] uppercase text-ink shrink-0">
                  Карта
                </button>
              }
            />
            <Field label="Часы работы" value={form.working_hours} onChange={(e) => set({ working_hours: e.target.value })} placeholder="Пн–Пт 08:00–16:00" />
          </div>
          {mapOpen && (
            <LocationPicker
              value={{ latitude: form.latitude, longitude: form.longitude, place_name: form.place_name, address: form.address }}
              onChange={(v) => set({ latitude: v.latitude, longitude: v.longitude, place_name: v.place_name || '', address: v.address || form.address })}
            />
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <Field label="Телефон" mono value={form.phone} onChange={(e) => set({ phone: e.target.value })} placeholder="+7 495 000-00-00" />
            <Field label="Сайт" mono value={form.website} onChange={(e) => set({ website: e.target.value })} placeholder="example.ru" />
          </div>
          <label className="flex flex-col gap-2">
            <FieldLabel>Хештеги</FieldLabel>
            <div className="flex items-center gap-3 border-b border-dashed border-line pb-[10px] focus-within:border-ink">
              <input
                ref={tagsInput}
                value={form.hashtags}
                onChange={(e) => set({ hashtags: e.target.value })}
                placeholder="#кофе #десерты"
                className="flex-1 bg-transparent outline-none font-mono text-[16px] tracking-[0.02em] text-ink placeholder:text-ink-faint"
              />
              <button
                type="button"
                onClick={() => {
                  set({ hashtags: `${form.hashtags.trim()} #`.trimStart() });
                  setTimeout(() => tagsInput.current?.focus(), 0);
                }}
                className="font-mono font-bold text-[11px] tracking-[0.04em] uppercase text-ink shrink-0"
              >
                + Тег
              </button>
            </div>
          </label>

          <input ref={coverInput} type="file" accept="image/*" className="hidden" onChange={(e) => upload(e.target.files?.[0], 'cover')} />
          <button
            type="button"
            onClick={() => coverInput.current?.click()}
            className="border border-dashed border-ink py-[30px] flex flex-col items-center gap-[6px] hover:bg-surface-2 transition"
          >
            <span className="font-mono font-bold text-[12px] tracking-[0.04em] uppercase text-ink">
              {uploading === 'cover'
                ? 'Загружаем…'
                : form.image_url
                  ? `✓ Обложка загружена · ${fileName(form.image_url)}`
                  : '+ Загрузить обложку'}
            </span>
            <span className="text-[13px] text-ink-soft">{form.image_url ? 'Заменить · ' : ''}1600×900, до 5 МБ</span>
          </button>
          <div className="flex items-center gap-3 flex-wrap">
            <FieldLabel>Доп. фото · {form.gallery.length}/4</FieldLabel>
            {form.gallery.map((g, i) => (
              <button
                type="button"
                key={g}
                title="Убрать"
                onClick={() => set({ gallery: form.gallery.filter((_, j) => j !== i) })}
                className="relative"
              >
                <Photo src={g} className="w-16 h-10" />
                <span className="absolute -top-2 -right-2 bg-ink text-on-ink font-mono text-[10px] w-4 h-4 leading-4">×</span>
              </button>
            ))}
            {form.gallery.length < 4 && (
              <>
                <input ref={galleryInput} type="file" accept="image/*" className="hidden" onChange={(e) => upload(e.target.files?.[0], 'gallery')} />
                <TextButton type="button" onClick={() => galleryInput.current?.click()}>
                  {uploading === 'gallery' ? 'Загружаем…' : '+ Фото'}
                </TextButton>
              </>
            )}
          </div>

          <ErrorLine>{error}</ErrorLine>
          <div className="flex items-center gap-6 flex-wrap">
            <PrimaryButton onClick={() => save(true)} disabled={busy}>
              {isNew || status === 'draft' ? 'Отправить на модерацию' : 'Сохранить и отправить'}
            </PrimaryButton>
            {canDraft && (
              <TextButton onClick={() => save(false)} disabled={busy}>
                Сохранить черновик
              </TextButton>
            )}
          </div>
        </div>

        <VRule className="hidden xl:block" />

        {/* Превью и расчёт */}
        <div className="w-full xl:w-[340px] shrink-0 flex flex-col gap-5">
          <SectionLabel>Так увидят студенты</SectionLabel>
          <div className="flex flex-col">
            <Photo src={form.image_url} className="w-full h-[170px]" />
            <div className="mt-[10px] flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-display font-bold text-[15px] uppercase text-ink truncate">{company?.name || 'Компания'}</div>
                <div className="text-[12px] text-ink-soft mt-[3px] truncate">
                  {[company?.category_label, form.address].filter(Boolean).join(' · ') || form.title || 'описание'}
                </div>
              </div>
              {dv > 0 && <span className="text-ink-red text-[22px] shrink-0 leading-none">{discountText}</span>}
            </div>
            <div className="mt-[10px] flex flex-col gap-[10px]">
              <Leader label="Цена" value={price ? rub(price) : '—'} />
              <Leader label="Ваша цена" value={price ? rub(studentPays) : '—'} strong />
            </div>
          </div>
          <Rule2 />
          <SectionLabel>Расчёт с одного заказа</SectionLabel>
          <div className="flex flex-col gap-[9px]">
            <Leader label="Студент платит" value={rub(studentPays)} />
            {form.bonus_allowed && maxBonus > 0 && (
              <Leader label={`Бонусы (до ${Number(form.max_bonus_percent) || 0}%)`} value={`до −${maxBonus} ₽`} />
            )}
            <Leader
              label={`Комиссия сервиса ${Math.round(config.commission_rate * 1000) / 10}%`}
              value={`−${Math.round(commission)} ₽`}
            />
            <Rule className="my-[2px]" />
            <Leader label="Вам зачислим" value={rub(credit)} strong />
          </div>
          <div className="text-[13px] leading-[19px] text-ink-soft">
            {form.bonus_allowed && maxBonus > 0
              ? `Если студент оплатит часть бонусами, зачисление будет от ${rub(creditMin)}.`
              : 'Деньги поступают на баланс компании сразу после оплаты студентом.'}
          </div>
          <Rule />
          <SectionLabel>Чек-лист модерации</SectionLabel>
          <div className="flex flex-col gap-5">
            {checklist.map((c) => (
              <div key={c.label} className="flex items-start gap-[10px]">
                <span className={`font-mono font-bold text-[12px] w-[22px] shrink-0 ${c.ok ? 'text-ink' : 'text-ink-faint'}`}>{c.ok ? '[×]' : '[ ]'}</span>
                <span className="text-[14px] text-ink">{c.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MerchantOfferEditor;
