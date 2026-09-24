import React, { useEffect, useState } from 'react';
import api from '../api/client';
import { RouteLoadingView } from '../design/DottedPath';
import { PrimaryButton, Rule, Rule2, Segmented } from './merchant/kit';
import { PanelHead, SettingRow, OnOff, SavedMark, ErrorText } from './settings/shared';

/** D61 · Настройки → Приватность: кто что видит в публичном профиле. */

const LEVELS = [
  { key: 'public', label: 'Все' },
  { key: 'friends', label: 'Друзья' },
  { key: 'private', label: 'Никто' },
];

// «Профиль» управляет сразу аватаром и вузом.
const ROWS = [
  { key: 'profile', fields: ['avatar_visibility', 'university_visibility'], title: 'Профиль', hint: 'Имя, вуз, аватар' },
  { key: 'friends', fields: ['friends_list_visibility'], title: 'Друзья', hint: 'Список ваших друзей' },
  { key: 'subs', fields: ['subscriptions_visibility'], title: 'Подписки', hint: 'Места, на которые вы подписаны' },
  { key: 'going', fields: ['attending_events_visibility'], title: 'Планирую посетить', hint: 'Ивенты, на которые вы идёте' },
  { key: 'saved', fields: ['statistics_visibility'], title: 'Сэкономлено', hint: 'Сумма в журнале экономии' },
];

const RANK = { public: 0, friends: 1, private: 2 };

const SettingsPrivacy = () => {
  const [vals, setVals] = useState(null);
  const [searchable, setSearchable] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get('/users/me')
      .then((r) => {
        const next = {};
        ROWS.forEach((row) => {
          // Если поля разошлись — показываем самое строгое.
          next[row.key] = row.fields
            .map((f) => r.data[f] || 'public')
            .reduce((a, b) => (RANK[b] > RANK[a] ? b : a), 'public');
        });
        setVals(next);
        setSearchable(r.data.searchable !== false);
      })
      .catch(() => setError('Не удалось загрузить настройки'));
  }, []);

  if (!vals) return error ? <ErrorText>{error}</ErrorText> : <RouteLoadingView label="Загрузка..." />;

  const change = (k, v) => {
    setVals((s) => ({ ...s, [k]: v }));
    setSavedAt(null);
  };

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const body = {};
      ROWS.forEach((row) => row.fields.forEach((f) => (body[f] = vals[row.key])));
      await api.patch('/users/me/privacy', body);
      await api.patch('/users/me/search-visibility', { searchable });
      setSavedAt(new Date());
    } catch (err) {
      setError(err.response?.data?.error || 'Не удалось сохранить');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PanelHead title="Приватность" subtitle="Кто что видит в вашем публичном профиле." />
      {ROWS.map((row, i) => (
        <React.Fragment key={row.key}>
          {i > 0 && <Rule />}
          <SettingRow title={row.title} hint={row.hint}>
            <Segmented dense items={LEVELS} value={vals[row.key]} onChange={(v) => change(row.key, v)} />
          </SettingRow>
        </React.Fragment>
      ))}
      <Rule2 />
      <SettingRow title="Показывать в поиске" hint="Вас можно найти по @username">
        <OnOff
          value={searchable}
          onChange={(v) => {
            setSearchable(v);
            setSavedAt(null);
          }}
        />
      </SettingRow>
      <div className="flex flex-col md:flex-row md:flex-wrap gap-4 md:gap-6 items-center">
        <PrimaryButton className="w-full md:w-auto" onClick={save} disabled={saving}>{saving ? 'Сохраняем…' : 'Сохранить'}</PrimaryButton>
        <SavedMark at={savedAt}>Сохранено</SavedMark>
        <ErrorText>{error}</ErrorText>
      </div>
    </>
  );
};

export default SettingsPrivacy;
