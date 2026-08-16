import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';

const Register = () => {
  const [form, setForm] = useState({ email: '', password: '', full_name: '', referral_code: '' });
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/auth/register', form);
      navigate('/login');
    } catch (err) {
      setError(err.response?.data?.error || 'Ошибка регистрации');
    }
  };

  return (
    <div className="max-w-md mx-auto bg-white p-6 rounded shadow">
      <h2 className="text-2xl font-bold mb-4">Регистрация</h2>
      {error && <div className="text-red-500 mb-2">{error}</div>}
      <form onSubmit={handleSubmit}>
        <input
          type="email"
          placeholder="Email"
          className="w-full p-2 border rounded mb-2"
          value={form.email}
          onChange={e => setForm({...form, email: e.target.value})}
          required
        />
        <input
          type="password"
          placeholder="Пароль"
          className="w-full p-2 border rounded mb-2"
          value={form.password}
          onChange={e => setForm({...form, password: e.target.value})}
          required
        />
        <input
          type="text"
          placeholder="Полное имя"
          className="w-full p-2 border rounded mb-2"
          value={form.full_name}
          onChange={e => setForm({...form, full_name: e.target.value})}
          required
        />
        <input
          type="text"
          placeholder="Реферальный код (опционально)"
          className="w-full p-2 border rounded mb-2"
          value={form.referral_code}
          onChange={e => setForm({...form, referral_code: e.target.value})}
        />
        <button type="submit" className="w-full bg-green-500 text-white py-2 rounded hover:bg-green-600">
          Зарегистрироваться
        </button>
      </form>
    </div>
  );
};

export default Register;
