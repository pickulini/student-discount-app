import React, { useEffect, useState } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import api from '../api/client';
import { RouteLoadingView } from '../design/DottedPath';
import { Field, Leader, PrimaryButton, Rule, Rule2, SectionLabel, TextButton, VRule, ddmmyy } from './merchant/kit';
import { CheckLine, Crumbs } from './admin/shared';
import { VerifStatus } from './AdminVerifications';

/** A05 · Верификация — проверка: студенческий, селфи, решение. */

const REJECT = [
  { key: 'blur', label: 'Фото размыто', text: 'Фото размыто — сфотографируйте при хорошем свете, чтобы текст читался.' },
  { key: 'date', label: 'Не видна дата', text: 'Не видна дата действия билета — сфотографируйте разворот целиком.' },
  { key: 'face', label: 'Лицо не совпадает', text: 'Лицо на селфи не совпадает с фото в билете.' },
  { key: 'uni', label: 'Билет другого вуза', text: 'Билет другого вуза — укажите вуз из студенческого.' },
  { key: 'invalid', label: 'Документ недействителен', text: 'Документ недействителен или просрочен.' },
];

const CHECKS = ['Вуз совпадает с почтой', 'Лицо на селфи = фото в билете', 'Номер читается', 'Видна дата действия'];

const ordinal = (n) => `${n}-я`;

// По умолчанию — как на сервере: 30 сентября следующего года.
const defaultUntil = () => {
  const y = String((new Date().getFullYear() + 1) % 100).padStart(2, '0');
  return `30.09.${y}`;
};

const parseUntil = (s) => {
  const m = String(s).trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})$/);
  if (!m) return null;
  const y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
  const d = new Date(y, Number(m[2]) - 1, Number(m[1]));
  if (d.getDate() !== Number(m[1]) || d <= new Date()) return null;
  return `${y}-${String(m[2]).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`;
};

const DocPhoto = ({ title, src, caption, onZoom }) => {
  const [turn, setTurn] = useState(0);
  return (
    <div className="flex-1 min-w-0 flex flex-col gap-3">
      <SectionLabel>{title}</SectionLabel>
      <div className="relative w-full h-[300px] bg-surface-2 overflow-hidden flex items-center justify-center">
        {src ? (
          <img
            src={src}
            alt={title}
            onClick={onZoom}
            className="w-full h-full object-cover cursor-zoom-in transition-transform"
            style={{ transform: `rotate(${turn}deg)` }}
          />
        ) : (
          <span className="font-mono text-[11px] uppercase text-ink-soft">Файл не загружен</span>
        )}
        {caption && (
          <span className="absolute left-[14px] bottom-[14px] font-mono text-[10px] tracking-[0.06em] uppercase text-white/85 drop-shadow">
            {caption}
          </span>
        )}
      </div>
      {src && (
        <div className="flex gap-4">
          <TextButton onClick={onZoom}>Увеличить</TextButton>
          <TextButton onClick={() => setTurn((t) => (t + 90) % 360)}>Повернуть</TextButton>
        </div>
      )}
    </div>
  );
};

const AdminVerificationReview = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { refreshCounters } = useOutletContext() || {};
  const [v, setV] = useState(null);
  const [error, setError] = useState('');
  const [until, setUntil] = useState(defaultUntil);
  const [checks, setChecks] = useState({});
  const [reasons, setReasons] = useState([]);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(null);
  const [zoom, setZoom] = useState(null);

  useEffect(() => {
    api
      .get(`/admin/verifications/${id}`)
      .then((r) => {
        setV(r.data);
        setChecks({ 0: r.data.domain_match });
      })
      .catch(() => setError('Заявка не найдена'));
  }, [id]);

  useEffect(() => {
    if (!zoom) return undefined;
    const onKey = (e) => e.key === 'Escape' && setZoom(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [zoom]);

  if (!v) return error ? <div className="font-mono text-[12px] text-accent uppercase">{error}</div> : <RouteLoadingView label="Открываем заявку..." />;

  const pending = v.status === 'pending';
  const domain = (v.email.split('@')[1] || '').toLowerCase();

  const toggleReason = (r) => {
    const next = reasons.includes(r.key) ? reasons.filter((x) => x !== r.key) : [...reasons, r.key];
    setReasons(next);
    setComment(REJECT.filter((x) => next.includes(x.key)).map((x) => x.text).join(' '));
  };

  const decide = async (status) => {
    setError('');
    const body = { status };
    if (status === 'verified') {
      const iso = parseUntil(until);
      if (!iso) return setError('Дата в формате ДД.ММ.ГГ и позже сегодняшней');
      body.expires_at = iso;
    } else {
      if (!comment.trim()) return setError('Отметьте причину или напишите комментарий студенту');
      body.rejection_reason = comment.trim();
    }
    setBusy(status);
    try {
      await api.put(`/admin/verifications/${id}`, body);
      refreshCounters?.();
      navigate('/admin/verifications');
    } catch (e) {
      setError(e.response?.data?.error || 'Не получилось');
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-col gap-7">
      <Crumbs items={[{ to: '/admin/verifications', label: 'Верификации' }, `Заявка № ${String(v.id).padStart(5, '0')}`]} />
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div className="flex flex-col gap-3 min-w-0">
          <h1 className="font-display font-bold text-[32px] sm:text-[40px] leading-none tracking-[-0.02em] text-ink uppercase">{v.full_name}</h1>
          <p className="text-[16px] text-ink-soft">
            {[v.username ? `@${v.username}` : null, v.email, `на сайте с ${ddmmyy(v.user_created_at)}`].filter(Boolean).join(' · ')}
          </p>
        </div>
        <VerifStatus status={v.status} />
      </div>

      <div className="flex flex-col xl:flex-row gap-10 items-start">
        <div className="flex-1 min-w-0 w-full flex flex-col gap-6">
          <div className="flex flex-col md:flex-row gap-5">
            <DocPhoto
              title="1. Студенческий билет"
              src={v.document_key}
              caption={v.student_identifier}
              onZoom={() => setZoom(v.document_key)}
            />
            <DocPhoto title="2. Селфи со студенческим" src={v.selfie_key} onZoom={() => setZoom(v.selfie_key)} />
          </div>
          <Rule2 />
          <div className="grid md:grid-cols-2 gap-10">
            <div className="flex flex-col gap-[10px]">
              <SectionLabel>Данные заявки</SectionLabel>
              <Leader label="Вуз" value={(v.university_full.length > 28 ? v.university : v.university_full) || '—'} />
              <Leader label="Домен почты" value={`${domain}${v.domain_match ? ' ✓' : ' ?'}`} />
              <Leader label="Номер билета" value={v.student_identifier || '—'} />
              <Leader label="Попытка" value={ordinal(v.attempt)} />
            </div>
            <div className="flex flex-col gap-[10px]">
              <SectionLabel>Проверьте</SectionLabel>
              {CHECKS.map((c, i) => (
                <CheckLine key={c} checked={!!checks[i]} onChange={(on) => setChecks((x) => ({ ...x, [i]: on }))}>
                  {c}
                </CheckLine>
              ))}
            </div>
          </div>
        </div>

        <VRule className="hidden xl:block" />

        <div className="w-full xl:w-[360px] shrink-0 flex flex-col gap-5">
          <SectionLabel>Решение</SectionLabel>
          {pending ? (
            <>
              <Field label="Действует до" mono active value={until} onChange={(e) => setUntil(e.target.value)} placeholder="ДД.ММ.ГГ" />
              <PrimaryButton className="w-full py-[16px]" onClick={() => decide('verified')} disabled={busy !== null}>
                {busy === 'verified' ? 'Подтверждаем…' : '✓ Подтвердить'}
              </PrimaryButton>
              <Rule2 />
              <SectionLabel>Или отказать</SectionLabel>
              <div className="flex flex-col gap-3">
                {REJECT.map((r) => (
                  <CheckLine key={r.key} checked={reasons.includes(r.key)} onChange={() => toggleReason(r)}>
                    {r.label}
                  </CheckLine>
                ))}
              </div>
              <Field
                label="Комментарий студенту"
                multiline
                placeholder="Что переснять, чтобы пройти проверку"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
              <Rule />
              {error && <span className="font-mono text-[12px] uppercase text-accent">{error}</span>}
              <TextButton onClick={() => decide('rejected')} disabled={busy !== null} className="self-start">
                {busy === 'rejected' ? 'Отправляем…' : 'Отправить отказ'}
              </TextButton>
            </>
          ) : (
            <span className="text-[14px] leading-[21px] text-ink-soft">
              {v.status === 'verified'
                ? `Статус подтверждён${v.expires_at ? ` до ${ddmmyy(v.expires_at)}` : ''}.`
                : `Отказано${v.rejection_reason ? `: «${v.rejection_reason}»` : '.'}`}
            </span>
          )}
        </div>
      </div>

      {zoom && (
        <button
          type="button"
          onClick={() => setZoom(null)}
          className="fixed inset-0 z-50 bg-ink/90 flex items-center justify-center p-6 cursor-zoom-out"
          aria-label="Закрыть"
        >
          <img src={zoom} alt="" className="max-w-full max-h-full object-contain" />
        </button>
      )}
    </div>
  );
};

export default AdminVerificationReview;
