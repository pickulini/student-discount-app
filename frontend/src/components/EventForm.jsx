import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Rule, Rule2, VRule, SectionLabel, PrimaryButton, TextButton, Photo } from './merchant/kit';
import { yandexSearchUrl } from '../utils/mapLinks';

/** D32 · Предложить ивент: форма слева, справа — «так будет в ленте» и правила. */

const RECURRENCE = [
  { value: '', label: 'Не повторять' },
  { value: 'FREQ=DAILY', label: 'Каждый день' },
  { value: 'FREQ=WEEKLY', label: 'Каждую неделю' },
  { value: 'FREQ=MONTHLY', label: 'Каждый месяц' },
];

const inputCls =
  'w-full bg-transparent pb-[10px] border-b border-dashed border-line focus:border-solid focus:border-ink outline-none text-[16px] text-ink placeholder:text-ink-faint';

const Field = ({ label, right, hint, children }) => (
  <label className="flex-1 min-w-0 flex flex-col gap-2">
    <span className="flex items-start justify-between gap-3">
      <span className="font-mono font-medium text-[11px] tracking-[0.06em] uppercase text-ink-soft">{label}</span>
      {right && <span className="font-mono text-[11px] tracking-[0.04em] text-ink-soft">{right}</span>}
    </span>
    {children}
    {hint && <span className="text-[12px] leading-[18px] text-ink-soft">{hint}</span>}
  </label>
);

const Radio = ({ checked, disabled, onClick, children, note }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={`flex gap-3 items-start text-left ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
  >
    <span className={`font-mono font-bold text-[13px] whitespace-nowrap ${checked ? 'text-ink' : 'text-ink-faint'}`}>{checked ? '[×]' : '[ ]'}</span>
    <span className="flex flex-col gap-[2px]">
      <span className={`font-mono text-[12px] tracking-[0.04em] uppercase ${checked ? 'font-bold text-ink' : 'text-ink-soft'}`}>{children}</span>
      {note && <span className="text-[12px] text-ink-soft">{note}</span>}
    </span>
  </button>
);

const toISO = (v) => (v ? new Date(v).toISOString() : undefined);
const timeOf = (v) => (v ? new Date(v).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : '19:00');

const EventForm = ({ backTo }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [form, setForm] = useState({
    title: '',
    description: '',
    start_at: '',
    end_at: '',
    address: '',
    image_url: '',
    company_id: '',
    event_privacy: 'public',
    special_price: '',
    max_uses: '',
    recurrence_rule: '',
    recurrence_until: '',
  });
  const [companies, setCompanies] = useState([]);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  const isMerchant = user?.role === 'merchant';
  const target = backTo || (isMerchant ? '/merchant/events' : '/events?tab=mine');

  useEffect(() => {
    if (isMerchant) api.get('/merchant/companies').then((r) => setCompanies(r.data || [])).catch(() => {});
  }, [isMerchant]);

  if (!user) {
    return (
      <div className="flex flex-col items-start gap-3">
        <div className="text-[15px] text-ink-soft">Войдите, чтобы предложить ивент.</div>
        <TextButton as={Link} to="/login">Войти</TextButton>
      </div>
    );
  }

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const upload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return setError('Обложка больше 5 МБ');
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const r = await api.post(isMerchant ? '/merchant/upload' : '/users/upload-avatar', fd);
      setForm((f) => ({ ...f, image_url: r.data.url }));
    } catch (err) {
      setError(err.response?.data?.error || 'Не удалось загрузить обложку');
    } finally {
      setUploading(false);
    }
  };

  const submit = async (send) => {
    setError('');
    if (!form.title.trim()) return setError('Укажите название');
    if (!form.start_at) return setError('Укажите начало');
    if (form.end_at && new Date(form.end_at) <= new Date(form.start_at)) return setError('Окончание должно быть позже начала');
    if (form.event_privacy === 'university' && !user.university_id) return setError('Сначала укажите вуз в верификации');
    if (form.event_privacy === 'subscribers' && !form.company_id) return setError('«Подписчики компании» — только для ивентов компании');
    setBusy(send ? 'send' : 'draft');
    try {
      const price = parseFloat(String(form.special_price).replace(',', '.'));
      const r = await api.post('/events', {
        title: form.title.trim(),
        description: form.description.trim(),
        start_at: toISO(form.start_at),
        end_at: toISO(form.end_at) || '',
        address: form.address.trim() || undefined,
        image_url: form.image_url || undefined,
        company_id: form.company_id ? Number(form.company_id) : undefined,
        event_privacy: form.event_privacy,
        event_university_id: form.event_privacy === 'university' ? user.university_id : undefined,
        special_price: price > 0 ? price : undefined,
        max_uses: form.max_uses ? parseInt(form.max_uses, 10) : undefined,
        recurrence_rule: form.recurrence_rule || undefined,
        recurrence_until: form.recurrence_rule && form.recurrence_until ? toISO(`${form.recurrence_until}T23:59`) : undefined,
      });
      if (send) await api.post(`/events/${r.data.id}/submit`);
      navigate(target);
    } catch (err) {
      setError(err.response?.data?.error || 'Не удалось сохранить ивент');
    } finally {
      setBusy('');
    }
  };

  const price = parseFloat(String(form.special_price).replace(',', '.')) || 0;
  const companyName = companies.find((c) => String(c.id) === String(form.company_id))?.name;

  return (
    <div className="flex flex-col gap-8">
      <div className="font-mono font-medium text-[11px] tracking-[0.06em] uppercase text-ink-soft whitespace-pre">
        <Link to={isMerchant ? '/merchant/events' : '/events'} className="hover:text-ink">Ивенты</Link>
        {'  /  '}Предложить
      </div>
      <div className="flex flex-col lg:flex-row gap-10 lg:gap-14 items-start">
        <div className="flex-1 min-w-0 w-full flex flex-col gap-6">
          <div className="flex flex-col gap-[10px]">
            <h1 className="font-display font-bold text-[28px] sm:text-[36px] leading-none tracking-[-0.02em] uppercase text-ink">Предложить ивент</h1>
            <p className="text-[16px] leading-[24px] text-ink-soft">После модерации ивент появится в ленте. Обычно проверяем за пару часов.</p>
          </div>
          <Rule2 />
          <Field label="Название *">
            <input className={inputCls} value={form.title} onChange={set('title')} maxLength={200} placeholder="Встреча студентов" />
          </Field>
          <Field label="Описание">
            <textarea className={`${inputCls} min-h-[80px] resize-y`} value={form.description} onChange={set('description')} placeholder="Что будет, для кого, программа…" />
          </Field>
          <div className="flex flex-col sm:flex-row gap-6 sm:gap-8">
            <Field label="Начало *">
              <input type="datetime-local" className={`${inputCls} font-mono`} value={form.start_at} onChange={set('start_at')} />
            </Field>
            <Field label="Окончание" hint={!form.end_at ? 'Не указано — через 2 часа после начала' : null}>
              <input type="datetime-local" className={`${inputCls} font-mono`} value={form.end_at} onChange={set('end_at')} />
            </Field>
          </div>
          <div className="flex flex-col sm:flex-row gap-6 sm:gap-8">
            <Field label="Место">
              <span className="flex gap-2 items-start">
                <input className={inputCls} value={form.address} onChange={set('address')} placeholder="г. Москва, Ленинские горы, 1" />
                {form.address.trim() && (
                  <a href={yandexSearchUrl(form.address)} target="_blank" rel="noopener noreferrer" className="font-mono font-bold text-[11px] tracking-[0.04em] text-ink pt-[4px] hover:text-accent">
                    КАРТА
                  </a>
                )}
              </span>
            </Field>
            <Field label="Компания" right="НЕОБЯЗ.">
              <span className="relative flex items-center border-b border-dashed border-line focus-within:border-solid focus-within:border-ink pb-[10px]">
                <select
                  value={form.company_id}
                  onChange={(e) => setForm({ ...form, company_id: e.target.value, event_privacy: !e.target.value && form.event_privacy === 'subscribers' ? 'public' : form.event_privacy })}
                  disabled={!companies.length}
                  className="appearance-none bg-transparent w-full pr-6 text-[16px] text-ink outline-none cursor-pointer disabled:cursor-default"
                >
                  <option value="">— Личный ивент —</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                {companies.length > 0 && <span className="absolute right-0 font-mono font-bold text-[11px] text-ink pointer-events-none">↓</span>}
              </span>
            </Field>
          </div>
          <div className="flex flex-col sm:flex-row gap-6 sm:gap-8">
            <Field label="Цена билета" hint="0 = бесплатно">
              <input className={`${inputCls} font-mono`} inputMode="decimal" value={form.special_price} onChange={set('special_price')} placeholder="0 ₽" />
            </Field>
            <Field label="Макс. участников">
              <input className={inputCls} inputMode="numeric" value={form.max_uses} onChange={(e) => setForm({ ...form, max_uses: e.target.value.replace(/\D/g, '') })} placeholder="без ограничений" />
            </Field>
          </div>
          <Rule />
          <div className="flex flex-col sm:flex-row gap-8">
            <div className="flex-1 min-w-0 flex flex-col gap-3">
              <SectionLabel>Повторение</SectionLabel>
              {RECURRENCE.map((r) => (
                <Radio key={r.value} checked={form.recurrence_rule === r.value} onClick={() => setForm({ ...form, recurrence_rule: r.value })}>
                  {r.label}
                </Radio>
              ))}
              {form.recurrence_rule && (
                <Field label="Повторять до">
                  <input type="date" className={`${inputCls} font-mono`} value={form.recurrence_until} onChange={set('recurrence_until')} />
                </Field>
              )}
            </div>
            <div className="flex-1 min-w-0 flex flex-col gap-3">
              <SectionLabel>Кто может видеть</SectionLabel>
              <Radio checked={form.event_privacy === 'public'} onClick={() => setForm({ ...form, event_privacy: 'public' })}>Все пользователи</Radio>
              <Radio
                checked={form.event_privacy === 'university'}
                disabled={!user.university_id}
                onClick={() => setForm({ ...form, event_privacy: 'university' })}
                note={!user.university_id ? 'Вуз не указан' : null}
              >
                Студенты моего вуза
              </Radio>
              <Radio
                checked={form.event_privacy === 'subscribers'}
                disabled={!form.company_id}
                onClick={() => setForm({ ...form, event_privacy: 'subscribers' })}
                note={!form.company_id ? 'Только для ивентов компании' : null}
              >
                Подписчики компании
              </Radio>
              <Radio checked={form.event_privacy === 'friends'} onClick={() => setForm({ ...form, event_privacy: 'friends' })}>Только мои друзья</Radio>
              <Radio checked={form.event_privacy === 'invite_only'} onClick={() => setForm({ ...form, event_privacy: 'invite_only' })}>Только по приглашению</Radio>
            </div>
          </div>
          {error && <div className="font-mono text-[12px] text-accent uppercase">{error}</div>}
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
            <PrimaryButton onClick={() => submit(true)} disabled={busy !== '' || uploading}>
              {busy === 'send' ? 'Отправляем…' : 'Отправить на модерацию'}
            </PrimaryButton>
            <TextButton onClick={() => submit(false)} disabled={busy !== '' || uploading}>
              {busy === 'draft' ? 'Сохраняем…' : 'Сохранить черновик'}
            </TextButton>
          </div>
        </div>

        <VRule className="hidden lg:block" />

        <div className="w-full lg:w-[380px] shrink-0 flex flex-col gap-6">
          <SectionLabel>Так будет в ленте</SectionLabel>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className={`w-full border border-dashed ${form.image_url ? 'border-ink' : 'border-line'} hover:bg-surface-2 transition`}
          >
            {form.image_url ? (
              <Photo src={form.image_url} className="w-full h-[200px] overflow-hidden">
                <span className="absolute left-[14px] bottom-[13px] font-mono text-[10px] tracking-[0.06em] uppercase text-white/85">Нажмите, чтобы заменить</span>
              </Photo>
            ) : (
              <span className="flex flex-col items-center gap-[6px] py-[70px]">
                <span className="font-mono font-bold text-[12px] tracking-[0.04em] text-ink">{uploading ? 'ЗАГРУЖАЕМ…' : '+ ОБЛОЖКА'}</span>
                <span className="text-[13px] text-ink-soft">JPG, 1600×900</span>
              </span>
            )}
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={upload} />
          <div className="flex gap-[14px] items-stretch">
            <div className="w-[52px] shrink-0 font-mono font-bold text-[13px] text-ink">{timeOf(form.start_at)}</div>
            <VRule />
            <div className="flex-1 min-w-0 flex flex-col gap-[6px]">
              <span className={`font-display font-bold text-[15px] tracking-[-0.01em] uppercase truncate ${form.title ? 'text-ink' : 'text-ink-faint'}`}>
                {form.title || 'Название ивента'}
              </span>
              <span className={`text-[13px] truncate ${companyName || form.address ? 'text-ink-soft' : 'text-ink-faint'}`}>
                {companyName || form.address || 'Место проведения'}
              </span>
              <span className={`font-mono font-bold text-[11px] tracking-[0.01em] ${price > 0 ? 'text-ink' : 'text-accent'}`}>
                {price > 0 ? `${Math.round(price).toLocaleString('ru-RU')} ₽` : 'БЕСПЛАТНО'}
              </span>
            </div>
          </div>
          <Rule />
          <SectionLabel>Правила</SectionLabel>
          {['Ивент для студентов, без рекламы алкоголя', 'Реальное место и время', 'Цена — не выше, чем для остальных'].map((t) => (
            <div key={t} className="flex gap-[10px] items-start text-ink-soft">
              <span className="font-mono text-[12px]">—</span>
              <span className="flex-1 text-[14px] leading-[20px]">{t}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default EventForm;
