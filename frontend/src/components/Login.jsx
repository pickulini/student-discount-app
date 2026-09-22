import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Button, Input, Card, ErrorText } from '../design/UI';
import { RouteMark, DottedDivider } from '../design/DottedPath';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await api.post('/auth/login', { email, password });
      const { access_token } = res.data;
      await login(access_token);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Ошибка входа');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center gap-4 mb-8">
          <RouteMark />
          <h2 className="text-editorial text-xl text-ink uppercase">Вход</h2>
        </div>

        <Card className="p-6">
          <ErrorText>{error}</ErrorText>
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <Input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Input
              type="password"
              placeholder="Пароль"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <Button type="submit" disabled={loading} className="w-full mt-2">
              {loading ? 'Вход...' : 'Войти'}
            </Button>
          </form>
        </Card>

        <DottedDivider className="my-6" />

        <div className="text-center text-sm text-ink-soft">
          Нет аккаунта?{' '}
          <Link to="/register" className="text-accent hover:underline">
            Зарегистрироваться
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Login;
