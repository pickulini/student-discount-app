import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api/client';
import { Button, Input, Card, ErrorText } from '../design/UI';
import { RouteMark, DottedDivider } from '../design/DottedPath';

const Register = () => {
  const [form, setForm] = useState({ email: '', password: '', full_name: '', referral_code: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await api.post('/auth/register', form);
      navigate('/login');
    } catch (err) {
      setError(err.response?.data?.error || 'Ошибка регистрации');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center gap-4 mb-8">
          <RouteMark />
          <h2 className="text-xl font-semibold text-ink">Регистрация</h2>
        </div>

        <Card className="p-6">
          <ErrorText>{error}</ErrorText>
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <Input
              type="email"
              placeholder="Email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
            <Input
              type="password"
              placeholder="Пароль"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
            />
            <Input
              type="text"
              placeholder="Полное имя"
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              required
            />
            <Input
              type="text"
              placeholder="Реферальный код (опционально)"
              value={form.referral_code}
              onChange={(e) => setForm({ ...form, referral_code: e.target.value })}
            />
            <Button type="submit" disabled={loading} className="w-full mt-2">
              {loading ? 'Регистрация...' : 'Зарегистрироваться'}
            </Button>
          </form>
        </Card>

        <DottedDivider className="my-6" />

        <div className="text-center text-sm text-ink-soft">
          Уже есть аккаунт?{' '}
          <Link to="/login" className="text-accent hover:underline">
            Войти
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Register;
