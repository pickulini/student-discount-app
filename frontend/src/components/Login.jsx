import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { PrimaryButton, TextButton, Rule, plural } from './merchant/kit';
import { AuthLayout, AuthField, AuthBrandMobile } from './auth/AuthShared';
import { useMobileTop } from '../context/MobileChrome';

/** D10 · Вход. */
const Login = () => {
  useMobileTop({ hidden: true });
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null); // { field: 'email'|'password'|null, text }
  const [loading, setLoading] = useState(false);
  const [forgot, setForgot] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await api.post('/auth/login', { email: email.trim(), password });
      await login(res.data.access_token);
      const from = location.state?.from?.pathname;
      navigate(from && from !== '/login' ? from : '/', { replace: true });
    } catch (err) {
      const status = err.response?.status;
      const left = Number(err.response?.headers?.['x-ratelimit-remaining']);
      if (status === 429) {
        setError({ field: 'password', text: 'Слишком много попыток. Подождите минуту' });
      } else if (status === 401) {
        const tail = Number.isFinite(left) && left <= 3 ? `. Осталось ${left} ${plural(left, 'попытка', 'попытки', 'попыток')}` : '';
        setError({ field: 'password', text: `Неверный email или пароль${tail}` });
      } else {
        setError({ field: null, text: err.response?.data?.error || 'Не удалось войти. Попробуйте ещё раз' });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <AuthBrandMobile />
      <h1 className="font-display font-bold text-[30px] md:text-[36px] leading-none tracking-[-0.02em] uppercase text-ink">Вход</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-6" noValidate>
        <AuthField
          label="Email"
          type="email"
          autoComplete="email"
          placeholder="you@university.ru"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <AuthField
          label="Пароль"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            if (error?.field === 'password') setError(null);
          }}
          error={error?.field === 'password' ? error.text : null}
          required
        />
        {error && !error.field && <div className="font-mono text-[12px] text-accent uppercase">{error.text}</div>}
        <PrimaryButton type="submit" disabled={loading || !email || !password} className="w-full">
          {loading ? 'Входим…' : 'Войти'}
        </PrimaryButton>
      </form>
      <div className="flex flex-col items-center gap-2 -mt-2">
        <TextButton type="button" onClick={() => setForgot((v) => !v)}>Забыли пароль?</TextButton>
        {forgot && (
          <p className="text-[13px] leading-[20px] text-ink-soft text-center">
            Сброс пароля по почте пока не подключён. Если вы вошли на другом устройстве — смените пароль в настройках безопасности.
          </p>
        )}
      </div>
      <Rule />
      <div className="flex flex-col md:flex-row items-center md:justify-between gap-3 md:gap-4">
        <span className="text-[15px] text-ink-soft">Ещё нет аккаунта?</span>
        <TextButton as={Link} to="/register">Регистрация</TextButton>
      </div>
    </AuthLayout>
  );
};

export default Login;
