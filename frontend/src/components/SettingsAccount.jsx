import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { RouteLoadingView } from '../design/DottedPath';
import { AlertBlock, Field, Leader, OutlineButton, Rule2, SectionLabel, ddmmyy, num, plural } from './merchant/kit';
import { PanelHead, ErrorText } from './settings/shared';

/** D64 · Настройки → Аккаунт: сведения, кошелёк, удаление. */

const ROLE = { student: 'Студент', merchant: 'Партнёр', admin: 'Администратор' };

const SettingsAccount = () => {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [me, setMe] = useState(null);
  const [password, setPassword] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get('/users/me')
      .then((r) => setMe(r.data))
      .catch(() => setError('Не удалось загрузить данные'));
  }, []);

  if (!me) return error ? <ErrorText>{error}</ErrorText> : <RouteLoadingView label="Загрузка..." />;

  const balance = Number(me.balance || 0);
  const bonus = Number(me.bonus_balance || 0);

  const lose = [];
  if (balance > 0) lose.push(`баланс ${num(balance)} ₽`);
  if (bonus > 0) lose.push(`${num(bonus)} ${plural(bonus, 'бонус', 'бонуса', 'бонусов')}`);
  const warning = lose.length
    ? `Сгорят ${lose.join(' и ')}, удалятся заказы и журнал экономии.${balance > 0 ? ' Сначала выведите деньги через поддержку.' : ''}`
    : 'Удалятся заказы, друзья, подписки и журнал экономии.';

  const remove = async (e) => {
    e.preventDefault();
    if (!password) return setError('Введите пароль');
    setDeleting(true);
    setError('');
    try {
      await api.delete('/users/me', { data: { password } });
      logout();
      navigate('/');
    } catch (err) {
      const msg = err.response?.data?.error || '';
      setError(/неверн/i.test(msg) ? 'Неверный пароль' : msg || 'Не удалось удалить аккаунт');
      setDeleting(false);
    }
  };

  return (
    <>
      <PanelHead title="Аккаунт" />

      <div className="flex flex-col sm:flex-row gap-6 sm:gap-8 items-start">
        <div className="flex-1 w-full min-w-0 flex flex-col gap-[10px]">
          <SectionLabel>Информация</SectionLabel>
          <Leader label="Email" value={me.email} />
          <Leader label="Роль" value={ROLE[me.role] || me.role} />
          <Leader label="Аккаунт создан" value={ddmmyy(me.created_at)} />
        </div>
        <div className="flex-1 w-full min-w-0 flex flex-col gap-[10px]">
          <SectionLabel>Кошелёк</SectionLabel>
          <Leader label="Баланс" value={`${num(balance)} ₽`} />
          <Leader label="Бонусы" value={`${num(bonus)} Б`} />
          <Leader label="Реферальный код" value={<span className="font-bold">{String(me.referral_code || '—').toUpperCase()}</span>} />
        </div>
      </div>

      <Rule2 />

      <SectionLabel>Удаление аккаунта</SectionLabel>
      <AlertBlock title="Это необратимо">{warning}</AlertBlock>

      <form onSubmit={remove} className="flex flex-col sm:flex-row gap-6 items-stretch sm:items-end">
        <Field
          className="flex-1"
          label="Пароль для подтверждения"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setError('');
          }}
          error={error}
          placeholder="••••••••"
        />
        <OutlineButton type="submit" disabled={deleting} className="px-[22px] w-full md:w-auto">
          {deleting ? 'Удаляем…' : 'Удалить навсегда'}
        </OutlineButton>
      </form>
    </>
  );
};

export default SettingsAccount;
