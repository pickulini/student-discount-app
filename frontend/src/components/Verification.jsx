import React, { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { RouteLoadingView } from '../design/DottedPath';
import { PrimaryButton, TextButton, Leader, Rule, Rule2, VRule, AlertBlock, SectionLabel, pad6, ddmm, ddmmyy, hhmm } from './merchant/kit';

/**
 * D12 · Верификация (форма) и D13 · Верификация — статус заявки.
 * Форма — если заявок не было, её отклонили или срок истёк;
 * иначе — статус: на проверке или подтверждено.
 */

const OTHER = 'other';

const Crumbs = ({ step }) => (
  <div className="font-mono font-medium text-[11px] tracking-[0.06em] uppercase text-ink-soft whitespace-pre">
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

  const pick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return setErr('Файл больше 5 МБ');
    setBusy(true);
    setErr('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const r = await api.post('/users/upload-avatar', fd);
      onChange(r.data.url);
    } catch (e2) {
      setErr(e2.response?.data?.error || 'Не удалось загрузить');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex-1 min-w-0 flex flex-col gap-3">
      <SectionLabel>{n}. {title}</SectionLabel>
      <button
        type="button"
        onClick={() => input.current?.click()}
        className={`w-full border border-dashed px-4 py-10 flex flex-col items-center gap-[6px] transition hover:bg-surface-2 ${
          value ? 'border-ink' : 'border-line'
        }`}
      >
        <span className="font-mono font-bold text-[12px] tracking-[0.04em] text-ink">
          {busy ? 'ЗАГРУЖАЕМ…' : value ? '✓ ЗАГРУЖЕНО' : '+ ЗАГРУЗИТЬ ФОТО'}
        </span>
        <span className="text-[13px] text-ink-soft">{value ? 'Нажмите, чтобы заменить' : sub}</span>
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
        <AlertBlock title="Заявка отклонена">{last.rejection_reason ? `${last.rejection_reason.replace(/\.$/, '')}. ` : ''}Загрузите снимки заново.</AlertBlock>
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
        <PrimaryButton onClick={submit} disabled={!ready || busy}>
          {busy ? 'Отправляем…' : 'Отправить на проверку'}
        </PrimaryButton>
        <p className="flex-1 text-[13px] text-ink-soft">Фото видят только модераторы.</p>
      </div>
      {step && (
        <div>
          <TextButton as={Link} to="/">Пропустить — сделаю позже</TextButton>
        </div>
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
          <div className="font-mono text-[11px] tracking-[0.04em] text-ink-soft">
            ЗАЯВКА № {pad6(last.id).slice(-5)} · {ddmmyy(created)} {hhmm(created)}
          </div>
        )}
        <h1 className="font-display font-bold text-[34px] sm:text-[44px] leading-none tracking-[-0.02em] text-ink">
          {verified ? 'ВЕРИФИЦИРОВАН' : 'НА ПРОВЕРКЕ'}
        </h1>
        <p className="text-[17px] leading-[26px] text-ink-soft max-w-[560px]">
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
