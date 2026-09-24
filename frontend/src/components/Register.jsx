import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { PrimaryButton, Leader } from './merchant/kit';
import { AuthLayout, AuthField } from './auth/AuthShared';
import { useMobileTop } from '../context/MobileChrome';

/**
 * D11 · Регистрация (шаг 1 из 2). Вуз определяем по домену почты;
 * после регистрации сразу входим и ведём на верификацию (шаг 2).
 */

const ERRORS = {
  'email already exists': { field: 'email', text: 'Этот email уже зарегистрирован' },
  'invalid email': { field: 'email', text: 'Проверьте email' },
  'password must be at least 8 characters': { field: 'password', text: 'Минимум 8 символов' },
  'full name is required': { field: 'full_name', text: 'Укажите имя' },
};

const Register = () => {
  useMobileTop({
    back: '/login',
    label: 'Вход',
    right: <span className="font-mono font-medium text-[11px] tracking-[0.06em] uppercase text-ink">Шаг 1 из 2</span>,
  });
  const [params] = useSearchParams();
  const [form, setForm] = useState({ full_name: '', email: '', password: '', referral_code: params.get('ref') || '' });
  const [touched, setTouched] = useState({});
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [universities, setUniversities] = useState([]);
  const navigate = useNavigate();
  const { login } = useAuth();

  useEffect(() => {
    api.get('/universities').then((r) => setUniversities(Array.isArray(r.data) ? r.data : [])).catch(() => {});
  }, []);

  const domain = form.email.includes('@') ? form.email.split('@').pop().trim().toLowerCase() : '';
  const university = useMemo(() => {
    if (!domain) return null;
    return universities.find((u) => (u.domains || []).some((d) => domain === d.toLowerCase() || domain.endsWith(`.${d.toLowerCase()}`))) || null;
  }, [domain, universities]);

  const set = (k) => (e) => {
    setForm({ ...form, [k]: e.target.value });
    if (error?.field === k) setError(null);
  };
  const blur = (k) => () => setTouched({ ...touched, [k]: true });

  const passwordError =
    error?.field === 'password' ? error.text : touched.password && form.password && form.password.length < 8 ? 'Минимум 8 символов' : null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!form.full_name.trim()) return setError(ERRORS['full name is required']);
    if (form.password.length < 8) {
      setTouched({ ...touched, password: true });
      return setError(ERRORS['password must be at least 8 characters']);
    }
    setLoading(true);
    try {
      const res = await api.post('/auth/register', {
        full_name: form.full_name.trim(),
        email: form.email.trim(),
        password: form.password,
        referral_code: form.referral_code.trim(),
      });
      await login(res.data.token);
      navigate('/verification', { replace: true, state: { afterRegister: true } });
    } catch (err) {
      const msg = err.response?.data?.error || '';
      setError(ERRORS[msg] || { field: null, text: msg || 'Не удалось зарегистрироваться' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <div className="hidden md:block font-mono text-[11px] tracking-[0.04em] text-ink-soft">ШАГ 1 ИЗ 2</div>
      <div className="flex flex-col gap-[10px]">
        <h1 className="font-display font-bold text-[30px] sm:text-[36px] leading-none tracking-[-0.02em] uppercase text-ink">Регистрация</h1>
        <p className="text-[16px] leading-[24px] text-ink-soft">Через почту вуза — мы сразу определим, где вы учитесь.</p>
      </div>
      <div className="md:hidden h-[5px] border-y border-dashed border-ink" />
      <form onSubmit={handleSubmit} className="flex flex-col gap-6" noValidate>
        <AuthField
          label="Полное имя"
          autoComplete="name"
          placeholder="Имя Фамилия"
          value={form.full_name}
          onChange={set('full_name')}
          error={error?.field === 'full_name' ? error.text : null}
        />
        <AuthField
          label="Email"
          type="email"
          autoComplete="email"
          placeholder="you@university.ru"
          value={form.email}
          onChange={set('email')}
          onBlur={blur('email')}
          error={error?.field === 'email' ? error.text : null}
        >
          {domain && domain.includes('.') && (
            university ? (
              <Leader label="Вуз определён" value={<b>{university.short_name || university.name} ✓</b>} />
            ) : (
              <span className="text-[12px] leading-[18px] text-ink-soft">Вуз по этой почте не определили — выберете его при верификации.</span>
            )
          )}
        </AuthField>
        <AuthField
          label="Пароль"
          type="password"
          autoComplete="new-password"
          value={form.password}
          onChange={set('password')}
          onBlur={blur('password')}
          error={passwordError}
        />
        <AuthField
          label="Реферальный код"
          right="НЕОБЯЗ."
          mono
          placeholder="например, 9a6c9829"
          value={form.referral_code}
          onChange={set('referral_code')}
          hint="Если вас пригласил друг — он получит 100 бонусов, когда вы подтвердите статус студента."
        />
        {error && !error.field && <div className="font-mono text-[12px] text-accent uppercase">{error.text}</div>}
        <PrimaryButton type="submit" disabled={loading || !form.email || !form.password || !form.full_name} className="w-full">
          {loading ? 'Регистрируем…' : 'Зарегистрироваться'}
        </PrimaryButton>
      </form>
      <p className="text-[12px] leading-[18px] text-ink-soft">Нажимая кнопку, вы соглашаетесь с условиями и политикой конфиденциальности.</p>
    </AuthLayout>
  );
};

export default Register;
