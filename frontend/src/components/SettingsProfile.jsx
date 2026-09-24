import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { RouteLoadingView } from '../design/DottedPath';
import { Avatar, Field, FieldLabel, PrimaryButton, TextButton } from './merchant/kit';
import { PanelHead, SavedMark, ErrorText } from './settings/shared';

/** D60 · Настройки → Профиль: фото, никнейм, @username, вуз (только через верификацию). */

const USERNAME_RE = /^[a-z0-9_]{3,30}$/;
const MAX_PHOTO = 5 * 1024 * 1024;

const SettingsProfile = () => {
  const { fetchUser } = useAuth();
  const [me, setMe] = useState(null);
  const [form, setForm] = useState({ nickname: '', username: '', avatar_url: '' });
  const [check, setCheck] = useState(null); // null | 'checking' | 'free' | 'taken' | 'invalid'
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(null);
  const [error, setError] = useState('');
  const fileRef = useRef(null);

  useEffect(() => {
    api
      .get('/users/me')
      .then((r) => {
        setMe(r.data);
        setForm({ nickname: r.data.nickname || '', username: r.data.username || '', avatar_url: r.data.avatar_url || '' });
      })
      .catch(() => setError('Не удалось загрузить профиль'));
  }, []);

  // Проверяем, свободен ли @username, пока человек печатает.
  useEffect(() => {
    if (!me) return undefined;
    const u = form.username.trim();
    if (!u || u === (me.username || '')) {
      setCheck(null);
      return undefined;
    }
    if (!USERNAME_RE.test(u)) {
      setCheck('invalid');
      return undefined;
    }
    setCheck('checking');
    const t = setTimeout(() => {
      api
        .get('/users/username-available', { params: { u } })
        .then((r) => setCheck(r.data.available ? 'free' : 'taken'))
        .catch(() => setCheck(null));
    }, 350);
    return () => clearTimeout(t);
  }, [form.username, me]);

  if (!me) return error ? <ErrorText>{error}</ErrorText> : <RouteLoadingView label="Загрузка..." />;

  const pickPhoto = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError('');
    if (!/^image\/(jpeg|png)$/.test(file.type)) return setError('Нужен JPG или PNG');
    if (file.size > MAX_PHOTO) return setError('Файл больше 5 МБ');
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const r = await api.post('/users/upload-avatar', fd);
      setForm((f) => ({ ...f, avatar_url: r.data.url }));
      setSavedAt(null);
    } catch (err) {
      setError(err.response?.data?.error || 'Не удалось загрузить фото');
    } finally {
      setUploading(false);
    }
  };

  const save = async (e) => {
    e.preventDefault();
    if (check === 'taken' || check === 'invalid') return;
    setSaving(true);
    setError('');
    try {
      const r = await api.patch('/users/me', {
        nickname: form.nickname.trim(),
        username: form.username.trim(),
        avatar_url: form.avatar_url || '',
      });
      setMe((m) => ({ ...m, ...r.data }));
      setCheck(null);
      setSavedAt(new Date());
      fetchUser?.();
    } catch (err) {
      setError(err.response?.data?.error || 'Не удалось сохранить');
    } finally {
      setSaving(false);
    }
  };

  const set = (k) => (e) => {
    const v = k === 'username' ? e.target.value.toLowerCase().replace(/^@/, '') : e.target.value;
    setForm((f) => ({ ...f, [k]: v }));
    setSavedAt(null);
  };

  const usernameRight =
    check === 'free' ? '✓ Свободен' : check === 'checking' ? 'Проверяем…' : null;
  const usernameError =
    check === 'taken' ? 'Этот username уже занят' : check === 'invalid' ? '3–30 символов: латиница, цифры, _' : '';
  const displayName = form.nickname || me.full_name;

  return (
    <form onSubmit={save} className="flex flex-col gap-6">
      <PanelHead title="Профиль" />

      <div className="flex gap-6 items-center">
        <Avatar src={form.avatar_url} name={displayName} size={88} />
        <div className="flex flex-col items-start gap-2">
          <TextButton type="button" onClick={() => fileRef.current?.click()} disabled={uploading}>
            {uploading ? 'Загружаем…' : 'Сменить фото'}
          </TextButton>
          <span className="text-[13px] text-ink-soft">JPG или PNG, до 5 МБ</span>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png" className="hidden" onChange={pickPhoto} />
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-6 sm:gap-8 items-start">
        <Field
          className="flex-1 w-full"
          label="Никнейм"
          value={form.nickname}
          onChange={set('nickname')}
          placeholder={me.full_name}
          maxLength={50}
        />
        <Field
          className="flex-1 w-full"
          label="Username (@тег)"
          right={usernameRight}
          active={check === 'free'}
          error={usernameError}
          hint="3–30 символов: латиница, цифры, _"
          value={form.username}
          onChange={set('username')}
          placeholder="anna_p"
          maxLength={30}
          autoComplete="off"
          spellCheck={false}
        />
      </div>

      <div className="flex flex-col gap-2">
        <FieldLabel>Вуз</FieldLabel>
        <div className="flex items-center gap-3 border-b border-dashed border-line pb-[10px]">
          <span className="flex-1 min-w-0 text-[16px] text-ink-soft truncate">{me.university_name || 'Не указан'}</span>
          <Link to="/verification" className="font-mono font-bold text-[11px] tracking-[0.04em] uppercase text-ink hover:text-accent whitespace-nowrap">
            Через верификацию
          </Link>
        </div>
        <span className="text-[12px] leading-[18px] text-ink-soft">Меняется только через повторную верификацию.</span>
      </div>

      <div className="flex flex-col md:flex-row md:flex-wrap gap-4 md:gap-6 items-center">
        <PrimaryButton className="w-full md:w-auto" type="submit" disabled={saving || uploading || check === 'checking' || !!usernameError}>
          {saving ? 'Сохраняем…' : 'Сохранить'}
        </PrimaryButton>
        <SavedMark at={savedAt}>Профиль обновлён</SavedMark>
        <ErrorText>{error}</ErrorText>
      </div>
    </form>
  );
};

export default SettingsProfile;
