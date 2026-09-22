import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Card, Button, Input, Label, Eyebrow } from '../design/UI';

const SettingsAccount = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [deletePassword, setDeletePassword] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  if (!user) return null;

  const handleDelete = async (e) => {
    e.preventDefault();
    if (!confirm('Вы уверены? Это необратимо.')) return;
    setDeleting(true);
    setError('');
    try {
      await api.delete('/users/me', { data: { password: deletePassword } });
      logout();
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Ошибка удаления');
      setDeleting(false);
    }
  };

  const formatDate = (iso) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('ru-RU', {
      day: 'numeric', month: 'long', year: 'numeric',
    });
  };

  return (
    <div className="space-y-4">
      {/* Баланс и бонусы */}
      <Card className="p-6">
        <h2 className="text-editorial text-xl text-ink uppercase mb-4">Кошелёк</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-surface-2 border border-line p-4 rounded-[var(--radius-sm)]">
            <Eyebrow className="mb-1">Баланс</Eyebrow>
            <div className="text-editorial text-2xl text-ink">{user.balance || 0} ₽</div>
          </div>
          <div className="bg-surface-2 border border-line p-4 rounded-[var(--radius-sm)]">
            <Eyebrow className="mb-1">Бонусы</Eyebrow>
            <div className="text-editorial text-2xl text-accent">{user.bonus_balance || 0}</div>
          </div>
        </div>
      </Card>

      {/* Реферальная программа */}
      <Card className="p-6">
        <h2 className="text-editorial text-xl text-ink uppercase mb-4">Реферальная программа</h2>
        <div className="flex items-center justify-between gap-3 p-3 bg-surface-2 rounded-[var(--radius-sm)]">
          <div className="min-w-0">
            <div className="text-xs text-ink-faint mb-1">Ваш код</div>
            <div className="font-mono text-lg font-semibold text-ink truncate">{user.referral_code}</div>
          </div>
          <button
            onClick={() => {
              navigator.clipboard.writeText(user.referral_code);
            }}
            className="bg-surface border border-line px-3 py-1 rounded-[var(--radius-sm)] text-sm text-ink-soft hover:border-ink-faint transition"
          >
            Копировать
          </button>
        </div>
      </Card>

      {/* Информация об аккаунте */}
      <Card className="p-6">
        <h2 className="text-editorial text-xl text-ink uppercase mb-4">Информация</h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-ink-soft">Email</span>
            <span className="font-medium text-ink">{user.email}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-ink-soft">Аккаунт создан</span>
            <span className="font-medium text-ink">{formatDate(user.created_at)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-ink-soft">Роль</span>
            <span className="font-medium text-ink capitalize">{user.role}</span>
          </div>
          {user.is_vip && (
            <div className="flex justify-between">
              <span className="text-ink-soft">VIP</span>
              <span className="font-medium text-accent">
                Активен
                {user.vip_until && ` до ${formatDate(user.vip_until)}`}
              </span>
            </div>
          )}
        </div>
      </Card>

      {/* Опасная зона */}
      <Card className="p-6 border-2 border-danger/30">
        <h2 className="text-editorial text-xl uppercase mb-1 text-danger">Удаление аккаунта</h2>
        <p className="text-sm text-ink-soft mb-4">
          Все данные будут удалены безвозвратно: заказы, друзья, подписки, баланс.
        </p>

        {error && <div className="bg-danger/10 text-danger p-3 rounded-[var(--radius-sm)] mb-3 text-sm">{error}</div>}

        {!showDeleteConfirm ? (
          <Button variant="danger" onClick={() => setShowDeleteConfirm(true)} className="border border-danger/30">
            Удалить аккаунт
          </Button>
        ) : (
          <form onSubmit={handleDelete} className="space-y-3">
            <div>
              <Label className="mb-1">Введите пароль для подтверждения</Label>
              <Input
                type="password"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                required
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" variant="danger" disabled={deleting} className="border border-danger/30">
                {deleting ? 'Удаление...' : 'Удалить навсегда'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => { setShowDeleteConfirm(false); setDeletePassword(''); setError(''); }}
              >
                Отмена
              </Button>
            </div>
          </form>
        )}
      </Card>
    </div>
  );
};

export default SettingsAccount;
