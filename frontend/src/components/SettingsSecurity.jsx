import React, { useEffect, useState } from 'react';
import api from '../api/client';
import { Field, PrimaryButton, Rule, Rule2, SectionLabel, TextButton, ddmm, hhmm } from './merchant/kit';
import { PanelHead, SavedMark, ErrorText } from './settings/shared';

/** D63 · Настройки → Безопасность: смена пароля и активные сессии. */

const deviceOf = (ua = '') => {
  let dev = 'Устройство';
  if (/iPhone/i.test(ua)) dev = 'iPhone';
  else if (/iPad/i.test(ua)) dev = 'iPad';
  else if (/Android/i.test(ua)) dev = /Mobile/i.test(ua) ? 'Android' : 'Android-планшет';
  else if (/Macintosh|Mac OS X/i.test(ua)) dev = 'Mac';
  else if (/Windows/i.test(ua)) dev = 'Windows';
  else if (/Linux/i.test(ua)) dev = 'Linux';

  let br = '';
  if (/YaBrowser/i.test(ua)) br = 'Яндекс Браузер';
  else if (/Edg\//i.test(ua)) br = 'Edge';
  else if (/OPR\//i.test(ua)) br = 'Opera';
  else if (/Firefox\//i.test(ua)) br = 'Firefox';
  else if (/Chrome\//i.test(ua)) br = 'Chrome';
  else if (/Safari\//i.test(ua)) br = 'Safari';
  else if (/curl|python|Go-http/i.test(ua)) br = 'API';
  return br ? `${dev} · ${br}` : dev;
};

const whenLabel = (s) => {
  const t = new Date(s.last_used_at || s.created_at);
  if (s.current || Date.now() - t.getTime() < 3 * 60 * 1000) return 'сейчас';
  const today = new Date().toDateString() === t.toDateString();
  if (today) return `сегодня, ${hhmm(t)}`;
  if (Date.now() - t.getTime() < 7 * 24 * 3600 * 1000) return `${ddmm(t)}, ${hhmm(t)}`;
  return ddmm(t);
};

const SettingsSecurity = () => {
  const [pw, setPw] = useState({ old: '', next: '', again: '' });
  const [changing, setChanging] = useState(false);
  const [changedAt, setChangedAt] = useState(null);
  const [pwError, setPwError] = useState('');

  const [sessions, setSessions] = useState(null);
  const [busy, setBusy] = useState(null);
  const [sessError, setSessError] = useState('');

  const loadSessions = () =>
    api
      .get('/users/me/sessions')
      .then((r) => setSessions(r.data || []))
      .catch(() => setSessions([]));

  useEffect(() => {
    loadSessions();
  }, []);

  const tooShort = pw.next.length > 0 && [...pw.next].length < 8;
  const mismatch = pw.again.length > 0 && pw.again !== pw.next;

  const change = async (e) => {
    e.preventDefault();
    if (!pw.old) return setPwError('Введите текущий пароль');
    if (!pw.next || tooShort) return setPwError('Новый пароль — минимум 8 символов');
    if (pw.again !== pw.next) return setPwError('Пароли не совпадают');
    setChanging(true);
    setPwError('');
    try {
      await api.patch('/users/me/password', { old_password: pw.old, new_password: pw.next });
      setPw({ old: '', next: '', again: '' });
      setChangedAt(new Date());
      loadSessions();
    } catch (err) {
      const msg = err.response?.data?.error || '';
      setPwError(/invalid|неверн/i.test(msg) ? 'Текущий пароль указан неверно' : msg || 'Не удалось сменить пароль');
    } finally {
      setChanging(false);
    }
  };

  const revoke = async (id) => {
    setBusy(id);
    setSessError('');
    try {
      await api.delete(`/users/me/sessions/${id}`);
      await loadSessions();
    } catch (err) {
      setSessError(err.response?.data?.error || 'Не удалось отозвать');
    } finally {
      setBusy(null);
    }
  };

  const revokeOthers = async () => {
    setBusy('all');
    setSessError('');
    try {
      await api.delete('/users/me/sessions', { params: { keep_current: 1 } });
      await loadSessions();
    } catch (err) {
      setSessError(err.response?.data?.error || 'Не удалось отозвать');
    } finally {
      setBusy(null);
    }
  };

  const setField = (k) => (e) => {
    setPw((p) => ({ ...p, [k]: e.target.value }));
    setPwError('');
    setChangedAt(null);
  };

  const list = sessions || [];
  const hasOthers = list.some((s) => !s.current);

  return (
    <>
      <PanelHead title="Безопасность" />

      <form onSubmit={change} className="flex flex-col gap-6">
        <SectionLabel>Смена пароля</SectionLabel>
        <Field label="Текущий пароль" type="password" autoComplete="current-password" value={pw.old} onChange={setField('old')} placeholder="—" />
        <div className="flex flex-col sm:flex-row gap-6 sm:gap-8 items-start">
          <Field
            className="flex-1 w-full"
            label="Новый пароль"
            type="password"
            autoComplete="new-password"
            value={pw.next}
            onChange={setField('next')}
            error={tooShort ? 'Минимум 8 символов' : ''}
            placeholder="—"
          />
          <Field
            className="flex-1 w-full"
            label="Повторите новый пароль"
            type="password"
            autoComplete="new-password"
            value={pw.again}
            onChange={setField('again')}
            error={mismatch ? 'Пароли не совпадают' : ''}
            placeholder="—"
          />
        </div>
        <div className="flex flex-wrap gap-6 items-center">
          <PrimaryButton type="submit" disabled={changing}>
            {changing ? 'Меняем…' : 'Изменить пароль'}
          </PrimaryButton>
          {changedAt ? (
            <SavedMark at={changedAt}>Пароль изменён, другие сессии завершены</SavedMark>
          ) : pwError ? (
            <ErrorText>{pwError}</ErrorText>
          ) : (
            <span className="text-[13px] text-ink-soft">После смены все сессии будут завершены.</span>
          )}
        </div>
      </form>

      <Rule2 />

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <SectionLabel>Активные сессии · {list.length}</SectionLabel>
        {hasOthers && (
          <TextButton onClick={revokeOthers} disabled={busy !== null}>
            Отозвать все, кроме этой
          </TextButton>
        )}
      </div>
      <ErrorText>{sessError}</ErrorText>

      {sessions === null ? (
        <span className="text-[14px] text-ink-soft">Загружаем сессии…</span>
      ) : list.length === 0 ? (
        <span className="text-[14px] text-ink-soft">Активных сессий нет.</span>
      ) : (
        list.map((s, i) => (
          <React.Fragment key={s.id}>
            {i > 0 && <Rule />}
            <div className="flex gap-4 items-center">
              <div className="flex-1 min-w-0 flex flex-col gap-[3px]">
                <span className="font-mono font-bold text-[12px] tracking-[0.03em] uppercase text-ink truncate">{deviceOf(s.user_agent)}</span>
                <span className="text-[14px] text-ink-soft truncate">
                  {[s.ip ? `IP ${s.ip}` : null, whenLabel(s)].filter(Boolean).join(' · ')}
                </span>
              </div>
              {s.current ? (
                <span className="font-mono text-[11px] tracking-[0.04em] text-ink-soft whitespace-nowrap">ЭТО УСТРОЙСТВО</span>
              ) : (
                <button
                  onClick={() => revoke(s.id)}
                  disabled={busy !== null}
                  className="font-mono font-bold text-[11px] tracking-[0.04em] uppercase text-ink hover:text-accent whitespace-nowrap disabled:opacity-40"
                >
                  {busy === s.id ? 'Отзываем…' : 'Отозвать'}
                </button>
              )}
            </div>
          </React.Fragment>
        ))
      )}
    </>
  );
};

export default SettingsSecurity;
