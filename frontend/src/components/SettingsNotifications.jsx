import React, { useEffect, useState } from 'react';
import api from '../api/client';
import { RouteLoadingView } from '../design/DottedPath';
import { PrimaryButton, Rule, Rule2 } from './merchant/kit';
import { PanelHead, SettingRow, OnOff, SavedMark, ErrorText } from './settings/shared';

/** D62 · Настройки → Уведомления. */

const ROWS = [
  { key: 'orders', title: 'Заказы', hint: 'Оплата, чек, срок действия кода' },
  { key: 'offers', title: 'Офферы', hint: 'Новые предложения компаний из подписок' },
  { key: 'events', title: 'Ивенты', hint: 'Новые ивенты подписок и друзей, напоминания' },
  { key: 'friends', title: 'Друзья', hint: 'Заявки в друзья и принятие' },
];

const SettingsNotifications = () => {
  const [s, setS] = useState(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get('/users/me/notification-settings')
      .then((r) =>
        setS({
          enabled: r.data.enabled !== false,
          orders: r.data.orders !== false,
          offers: r.data.offers !== false,
          events: r.data.events !== false,
          friends: r.data.friends !== false,
          quiet: r.data.quiet === true,
        })
      )
      .catch(() => setError('Не удалось загрузить настройки'));
  }, []);

  if (!s) return error ? <ErrorText>{error}</ErrorText> : <RouteLoadingView label="Загрузка..." />;

  const set = (k) => (v) => {
    setS((x) => ({ ...x, [k]: v }));
    setSavedAt(null);
  };

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      await api.patch('/users/me/notification-settings', s);
      setSavedAt(new Date());
    } catch (err) {
      setError(err.response?.data?.error || 'Не удалось сохранить');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PanelHead title="Уведомления" subtitle="Выберите, что вам присылать." />
      <SettingRow title="Все уведомления" hint="Главный выключатель">
        <OnOff value={s.enabled} onChange={set('enabled')} />
      </SettingRow>
      <Rule2 />
      {ROWS.map((row, i) => (
        <React.Fragment key={row.key}>
          {i > 0 && <Rule />}
          <SettingRow title={row.title} hint={row.hint} dim={!s.enabled}>
            <OnOff value={s[row.key]} onChange={set(row.key)} disabled={!s.enabled} />
          </SettingRow>
        </React.Fragment>
      ))}
      <Rule2 />
      <SettingRow title="Тихие часы" hint="23:00–09:00 — без звука" dim={!s.enabled}>
        <OnOff value={s.quiet} onChange={set('quiet')} disabled={!s.enabled} />
      </SettingRow>
      <div className="flex flex-wrap gap-6 items-center">
        <PrimaryButton onClick={save} disabled={saving}>{saving ? 'Сохраняем…' : 'Сохранить'}</PrimaryButton>
        <SavedMark at={savedAt}>Сохранено</SavedMark>
        <ErrorText>{error}</ErrorText>
      </div>
    </>
  );
};

export default SettingsNotifications;
