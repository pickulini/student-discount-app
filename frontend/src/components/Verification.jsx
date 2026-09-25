import React, { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import api from '../api/client';
import { compressImage } from '../utils/image';
import { useMobileTop } from '../context/MobileChrome';
import { useAuth } from '../context/AuthContext';
import { RouteLoadingView } from '../design/DottedPath';
import { PrimaryButton, OutlineButton, TextButton, Leader, Rule, Rule2, VRule, AlertBlock, SectionLabel, pad6, ddmm, ddmmyy, hhmm } from './merchant/kit';

/**
 * D12 · Верификация (форма) и D13 · Верификация — статус заявки.
 * Форма — если заявок не было, её отклонили или срок истёк;
 * иначе — статус: на проверке или подтверждено.
 */

const OTHER = 'other';

const Crumbs = ({ step }) => (
  <div className="hidden md:block font-mono font-medium text-[11px] tracking-[0.06em] uppercase text-ink-soft whitespace-pre">
    <Link to="/settings" className="hover:text-ink">Настройки</Link>
    {'  /  '}Верификация{step ? '  ·  шаг 2 из 2' : ''}
  </div>
);

const Check = ({ done, title, sub }) => (
  <div className="flex gap-3 items-start">
    <span className={`font-mono font-bold text-[13px] whitespace-nowrap ${done ? 'text-ink' : 'text-ink-faint'}`}>{done ? '[×]' : '[ ]'}</span>
    <div className={`flex flex-col gap-[2px] ${done ? 'text-ink' : 'text-ink-soft'}`}>
      <span className="font-mono font-bold text-[12px] tracking-[0.04em] uppercase">{title}</span>
      {sub && <span className="font-mono text-[11px] tracking-[0.02em] text-ink-soft">{sub}</span>}
    </div>
  </div>
);

const UploadBox = ({ n, title, sub, value, onChange }) => {
  const input = useRef(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [preview, setPreview] = useState('');

  useEffect(() => () => preview && URL.revokeObjectURL(preview), [preview]);

  const pick = async (e) => {
    const original = e.target.files?.[0];
    e.target.value = '';
    if (!original) return;
    setErr('');
    // Превью — сразу, из самого файла: не ждём, пока он долетит до сервера.
    setPreview(URL.createObjectURL(original));
    setBusy(true);
    try {
      const file = await compressImage(original);
      if (file.size > 5 * 1024 * 1024) throw new Error('Файл больше 5 МБ');
      const fd = new FormData();
      fd.append('file', file);
      const r = await api.post('/users/upload-avatar', fd);
      onChange(r.data.url);
    } catch (e2) {
      setErr(e2.response?.data?.error || e2.message || 'Не удалось загрузить');
      setPreview('');
      onChange('');
    } finally {
      setBusy(false);
    }
  };

  const shown = preview || value;

  return (
    <div className="flex-1 min-w-0 flex flex-col gap-3">
      <SectionLabel>{n}. {title}</SectionLabel>
      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={busy}
        className={`relative w-full border border-dashed overflow-hidden transition hover:bg-surface-2 ${value ? 'border-ink' : 'border-line'}`}
      >
        {shown ? (
          <>
            <img src={shown} alt="" className={`w-full h-[200px] object-cover ${busy ? 'opacity-50' : ''}`} />
            <span className="absolute left-0 right-0 bottom-0 bg-ink/85 text-on-ink font-mono font-bold text-[11px] tracking-[0.04em] uppercase py-2">
              {busy ? 'Загружаем…' : value ? '✓ Загружено · нажмите, чтобы заменить' : 'Не загрузилось · выбрать снова'}
            </span>
          </>
        ) : (
          <span className="flex flex-col items-center gap-[6px] px-4 py-10">
            <span className="font-mono font-bold text-[12px] tracking-[0.04em] text-ink">+ ЗАГРУЗИТЬ ФОТО</span>
            <span className="text-[13px] text-ink-soft">{sub}</span>
          </span>
        )}
      </button>
      {err && <span className="font-mono text-[11px] text-accent uppercase">{err}</span>}
      <input ref={input} type="file" accept="image/*" className="hidden" onChange={pick} />
    </div>
  );
};

const VerificationForm = ({ user, last, onSent, step }) => {
  const [universities, setUniversities] = useState([]);
  const [uni, setUni] = useState(user?.university_id ? String(user.university_id) : '');
  const [uniName, setUniName] = useState('');
  const [number, setNumber] = useState(last?.student_identifier || '');
  const [doc, setDoc] = useState('');
  const [selfie, setSelfie] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get('/universities').then((r) => setUniversities(Array.isArray(r.data) ? r.data : [])).catch(() => {});
  }, []);

  const expired = user?.student_status === 'expired' || last?.status === 'expired';
  const rejected = last?.status === 'rejected';
  const ready = (uni && uni !== OTHER ? true : uniName.trim()) && number.trim() && doc && selfie;

  const submit = async () => {
    setError('');
    setBusy(true);
    try {
      await api.post('/students/verify', {
        university_id: uni && uni !== OTHER ? Number(uni) : null,
        university_name: uni === OTHER || !uni ? uniName.trim() : '',
        student_identifier: number.trim(),
        document_key: doc,
        selfie_key: selfie,
      });
      onSent();
    } catch (e) {
      setError(e.response?.data?.error || 'Не удалось отправить заявку');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="w-full max-w-[760px] mx-auto flex flex-col gap-6">
      <Crumbs step={step} />
      <div className="flex flex-col gap-[10px]">
        <h1 className="font-display font-bold text-[30px] sm:text-[36px] leading-none tracking-[-0.02em] uppercase text-ink">Верификация</h1>
        <p className="text-[16px] leading-[24px] text-ink-soft">Подтвердите, что вы студент, — откроются все скидки. Проверка занимает до 24 часов.</p>
      </div>
      <Leader label="Статус" value={<b>{expired ? 'ВЕРИФИКАЦИЯ ИСТЕКЛА' : rejected ? 'ЗАЯВКА ОТКЛОНЕНА' : 'НЕ ВЕРИФИЦИРОВАН'}</b>} />
      {rejected && (
        <>
          <AlertBlock title="Заявка отклонена">{last.rejection_reason ? `${last.rejection_reason.replace(/\.$/, '')}. ` : ''}Загрузите снимки заново.</AlertBlock>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6 -mt-2">
            <span className="text-[14px] text-ink-soft">Не согласны с решением или что-то непонятно?</span>
            <OutlineButton as={Link} to="/support?topic=verification" className="w-full sm:w-auto">Обратиться в поддержку</OutlineButton>
          </div>
        </>
      )}
      {expired && !rejected && (
        <div className="flex flex-col gap-[6px]">
          {user?.student_verification_expires_at && <Leader label="Верификация истекла" value={ddmmyy(user.student_verification_expires_at)} />}
          <p className="text-[14px] leading-[20px] text-ink-soft">Скидки для студентов приостановлены. Подтвердите статус на новый учебный год.</p>
        </div>
      )}
      <Rule2 />
      <div className="flex flex-col sm:flex-row gap-6 sm:gap-8">
        <label className="flex-1 min-w-0 flex flex-col gap-2">
          <span className="font-mono font-medium text-[11px] tracking-[0.06em] uppercase text-ink-soft">Университет</span>
          <span className="relative flex items-center border-b border-dashed border-line focus-within:border-solid focus-within:border-ink pb-[10px]">
            <select
              value={uni}
              onChange={(e) => setUni(e.target.value)}
              className="appearance-none bg-transparent w-full pr-6 text-[16px] text-ink outline-none cursor-pointer"
            >
              <option value="">Выберите вуз</option>
              {universities.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
              <option value={OTHER}>Другой вуз…</option>
            </select>
            <span className="absolute right-0 font-mono font-bold text-[11px] text-ink pointer-events-none">↓</span>
          </span>
          {(uni === OTHER || (!uni && universities.length === 0)) && (
            <input
              value={uniName}
              onChange={(e) => setUniName(e.target.value)}
              placeholder="Полное название вуза"
              className="mt-2 bg-transparent pb-[10px] border-b border-dashed border-line focus:border-solid focus:border-ink outline-none text-[16px] text-ink placeholder:text-ink-faint"
            />
          )}
        </label>
        <label className="flex-1 min-w-0 flex flex-col gap-2">
          <span className="font-mono font-medium text-[11px] tracking-[0.06em] uppercase text-ink-soft">Номер студенческого</span>
          <input
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            placeholder="12345/2024"
            className="bg-transparent pb-[10px] border-b border-dashed border-line focus:border-solid focus:border-ink outline-none font-mono text-[16px] tracking-[0.02em] text-ink placeholder:text-ink-faint"
          />
        </label>
      </div>
      <Rule />
      <div className="flex flex-col sm:flex-row gap-6 sm:gap-8">
        <UploadBox n={1} title="Фото студенческого" sub="Разворот с фото и датой" value={doc} onChange={setDoc} />
        <UploadBox n={2} title="Селфи со студенческим" sub="Лицо и билет в кадре" value={selfie} onChange={setSelfie} />
      </div>
      {error && <div className="font-mono text-[12px] text-accent uppercase">{error}</div>}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
        <PrimaryButton onClick={submit} disabled={!ready || busy} className="w-full sm:w-auto">
          {busy ? 'Отправляем…' : 'Отправить на проверку'}
        </PrimaryButton>
        <p className="flex-1 text-[13px] text-ink-soft text-center sm:text-left">Фото видят только модераторы.</p>
      </div>
      {step && (
        <>
          <span className="hidden sm:block">
            <TextButton as={Link} to="/">Пропустить — сделаю позже</TextButton>
          </span>
          <OutlineButton as={Link} to="/" className="sm:hidden w-full">Пропустить — на главную</OutlineButton>
        </>
      )}
    </div>
  );
};

const VerificationStatus = ({ user, last }) => {
  const verified = user?.student_status === 'verified' || last?.status === 'verified';
  const created = last?.created_at;
  const expires = user?.student_verification_expires_at || last?.expires_at;

  return (
    <div className="flex flex-col lg:flex-row gap-10 lg:gap-14 items-start">
      <div className="flex-1 min-w-0 w-full flex flex-col gap-6">
        <Crumbs />
        {last && (
          <div className="font-mono text-[11px] tracking-[0.04em] text-ink-soft text-center md:text-left">
            ЗАЯВКА № {pad6(last.id).slice(-5)}
            <span className="hidden md:inline"> · {ddmmyy(created)} {hhmm(created)}</span>
          </div>
        )}
        <h1 className="font-display font-bold text-[26px] sm:text-[44px] leading-none tracking-[-0.02em] text-ink text-center md:text-left -mt-2 md:mt-0">
          {verified ? 'ВЕРИФИЦИРОВАН' : 'НА ПРОВЕРКЕ'}
        </h1>
        {last && (
          <div className="md:hidden -mt-2 font-mono text-[11px] tracking-[0.04em] text-ink-soft text-center uppercase">
            Отправлено {ddmmyy(created)} · {hhmm(created)}
          </div>
        )}
        <p className="hidden md:block text-[17px] leading-[26px] text-ink-soft max-w-[560px]">
          {verified
            ? 'Все скидки доступны. За месяц до конца срока напомним обновить статус.'
            : 'Обычно проверяем за несколько часов. Пришлём уведомление, как только всё будет готово.'}
        </p>
        <Rule2 />
        <div className="flex flex-col gap-4">
          <Check done title="Документы загружены" sub={created ? `${ddmm(created)} · ${hhmm(created)}` : null} />
          <Check done title="Заявка отправлена" sub={created ? `${ddmm(created)} · ${hhmm(created)}` : null} />
          <Check
            done={verified}
            title="Проверка модератором"
            sub={verified && last?.verified_at ? `${ddmm(last.verified_at)} · ${hhmm(last.verified_at)}` : 'обычно до 24 ч'}
          />
          <Check done={verified} title="Все скидки открыты" />
        </div>
        <PrimaryButton as={Link} to="/" className="w-full sm:w-auto sm:self-start">
          {verified ? 'К скидкам' : 'На главную'}
        </PrimaryButton>
      </div>

      <VRule className="hidden lg:block" />

      <div className="flex-1 min-w-0 w-full flex flex-col gap-6">
        <SectionLabel>Заявка</SectionLabel>
        <div className="flex flex-col gap-[10px]">
          {verified && expires && <Leader label="Верифицирован" value={<b>✓ ДО {ddmmyy(expires)}</b>} />}
          <Leader label="Университет" value={user?.university_short || last?.university_name || '—'} />
          {last?.student_identifier && <Leader label="Номер студенческого" value={last.student_identifier} />}
          <Leader label="Фото студенческого" value={last?.has_document ? '✓' : '—'} />
          <Leader label="Селфи" value={last?.has_selfie ? '✓' : '—'} />
        </div>
        <Rule />
        <p className="text-[14px] leading-[20px] text-ink-soft">
          {verified
            ? 'Сменили вуз или данные изменились — напишите в поддержку, обновим заявку.'
            : 'Ошиблись в данных или загрузили не то фото — напишите в поддержку, модератор увидит сообщение.'}
        </p>
        <div>
          <TextButton as={Link} to="/support">Написать в поддержку</TextButton>
        </div>
      </div>
    </div>
  );
};

const Verification = () => {
  const location = useLocation();
  const { user, loading, fetchUser } = useAuth();
  const [last, setLast] = useState(undefined);
  const formStep = last !== undefined && (!last || ['rejected', 'expired'].includes(last?.status)) && user?.student_status !== 'verified';
  useMobileTop(
    {
      back: '/settings',
      label: 'Настройки',
      right: formStep ? <span className="font-mono font-medium text-[11px] tracking-[0.06em] uppercase text-ink">Шаг 2 из 2</span> : null,
    },
    [formStep]
  );

  const load = () =>
    api
      .get('/students/verify')
      .then((r) => setLast(r.data.verification || null))
      .catch(() => setLast(null));
  useEffect(() => {
    load();
  }, []);

  if (!loading && !user) return <Navigate to="/login" replace state={{ from: location }} />;
  if (last === undefined || !user) return <RouteLoadingView label="Проверяем статус..." />;

  const status = last?.status;
  const showForm = !last || status === 'rejected' || status === 'expired' || user.student_status === 'expired';

  if (showForm && user.student_status !== 'verified') {
    return (
      <VerificationForm
        user={user}
        last={last}
        step={Boolean(location.state?.afterRegister) || !last}
        onSent={() => {
          load();
          fetchUser?.();
        }}
      />
    );
  }
  return <VerificationStatus user={user} last={last} />;
};

export default Verification;
