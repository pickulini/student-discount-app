import React, { useState, useEffect } from 'react';
import api from '../api/client';
import { Card, Button, Input, Label } from '../design/UI';

const SettingsSecurity = () => {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changing, setChanging] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [sessions, setSessions] = useState([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);

  const fetchSessions = () => {
    api.get('/users/me/sessions')
      .then((res) => setSessions(res.data || []))
      .catch(() => setSessions([]))
      .finally(() => setSessionsLoading(false));
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (newPassword.length < 8) {
      setError('Пароль должен быть не менее 8 символов');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Пароли не совпадают');
      return;
    }

    setChanging(true);
    try {
      await api.patch('/users/me/password', {
        old_password: oldPassword,
        new_password: newPassword,
      });
      setSuccess('Пароль изменён. Все сессии отозваны, войдите заново.');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(err.response?.data?.error || 'Ошибка смены пароля');
    } finally {
      setChanging(false);
    }
  };

  const revokeSession = async (id) => {
    if (!confirm('Отозвать эту сессию?')) return;
    try {
      await api.delete(`/users/me/sessions/${id}`);
      fetchSessions();
    } catch (err) {
      alert(err.response?.data?.error || 'Ошибка');
    }
  };

  const revokeAll = async () => {
    if (!confirm('Отозвать все сессии? Вам нужно будет войти заново.')) return;
    try {
      await api.delete('/users/me/sessions');
      fetchSessions();
    } catch (err) {
      alert(err.response?.data?.error || 'Ошибка');
    }
  };

  const formatDate = (iso) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('ru-RU');
  };

  return (
    <div className="space-y-4">
      {/* Смена пароля */}
      <Card className="p-6">
        <h2 className="text-editorial text-xl text-ink uppercase mb-1">Смена пароля</h2>
        <p className="text-sm text-ink-soft mb-4">
          После смены пароля все активные сессии будут отозваны
        </p>

        {error && <div className="bg-danger/10 text-danger p-3 rounded-[var(--radius-sm)] mb-3 text-sm">{error}</div>}
        {success && <div className="bg-accent/10 text-accent p-3 rounded-[var(--radius-sm)] mb-3 text-sm">{success}</div>}

        <form onSubmit={handleChangePassword} className="space-y-3">
          <div>
            <Label className="mb-1">Текущий пароль</Label>
            <Input
              type="password"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              required
            />
          </div>
          <div>
            <Label className="mb-1">Новый пароль</Label>
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              minLength={8}
              required
            />
          </div>
          <div>
            <Label className="mb-1">Повторите новый пароль</Label>
            <Input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>
          <Button type="submit" disabled={changing} className="px-6">
            {changing ? 'Сохранение...' : 'Изменить пароль'}
          </Button>
        </form>
      </Card>

      {/* Сессии */}
      <Card className="p-6">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-editorial text-xl text-ink uppercase">Активные сессии</h2>
            <p className="text-sm text-ink-soft">Устройства, где вы вошли</p>
          </div>
          {sessions.length > 1 && (
            <button onClick={revokeAll} className="text-sm text-danger hover:underline">
              Отозвать все
            </button>
          )}
        </div>

        {sessionsLoading ? (
          <div className="text-center py-4 text-ink-soft">Загрузка...</div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-4 text-ink-soft text-sm">Нет активных сессий</div>
        ) : (
          <div className="space-y-2">
            {sessions.map((s) => (
              <div key={s.id} className="flex items-center gap-3 p-3 bg-surface-2 rounded-[var(--radius-sm)]">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-ink truncate">
                    {s.device_name || 'Неизвестное устройство'}
                  </div>
                  <div className="text-eyebrow text-ink-faint mt-0.5">
                    {/mobile|android|iphone/i.test(s.user_agent || '') ? 'Мобильное' : 'Десктоп'}
                  </div>
                  <div className="text-xs text-ink-faint truncate mt-1">{s.ip || '—'}</div>
                  <div className="text-caption text-xs text-ink-faint">
                    Последняя активность: {formatDate(s.last_used_at)}
                  </div>
                </div>
                <button onClick={() => revokeSession(s.id)} className="text-danger hover:underline text-sm">
                  Отозвать
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};

export default SettingsSecurity;
