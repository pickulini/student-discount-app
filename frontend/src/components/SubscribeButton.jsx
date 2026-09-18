import React, { useState, useEffect } from 'react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

/**
 * Кнопка подписки на компанию.
 * variant: 'default' | 'icon' (только звёздочка)
 */
export default function SubscribeButton({ companyId, initialSubscribed = false, onChange, variant = 'default' }) {
  const { user } = useAuth();
  const [subscribed, setSubscribed] = useState(initialSubscribed);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setSubscribed(initialSubscribed);
  }, [initialSubscribed, companyId]);

  const toggle = async (e) => {
    e.stopPropagation();
    e.preventDefault();
    if (!user) {
      alert('Войдите, чтобы подписаться');
      return;
    }
    setLoading(true);
    try {
      if (subscribed) {
        await api.delete(`/companies/${companyId}/subscribe`);
        setSubscribed(false);
        if (onChange) onChange(false);
      } else {
        await api.post(`/companies/${companyId}/subscribe`);
        setSubscribed(true);
        if (onChange) onChange(true);
      }
    } catch (err) {
      alert(err.response?.data?.error || 'Ошибка');
    } finally {
      setLoading(false);
    }
  };

  if (variant === 'icon') {
    return (
      <button
        onClick={toggle}
        disabled={loading}
        title={subscribed ? 'Отписаться' : 'Подписаться на компанию'}
        className={`text-lg leading-none transition ${
          subscribed ? 'text-yellow-500' : 'text-gray-300 hover:text-yellow-400'
        } ${loading ? 'opacity-50' : ''}`}
      >
        {subscribed ? '★' : '☆'}
      </button>
    );
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className={`px-3 py-1 rounded text-sm font-medium transition ${
        subscribed
          ? 'bg-gray-100 text-gray-700 border border-gray-300 hover:bg-gray-200'
          : 'bg-blue-600 text-white hover:bg-blue-700'
      } ${loading ? 'opacity-50 cursor-wait' : ''}`}
    >
      {loading ? '...' : subscribed ? '★ Вы подписаны' : '☆ Подписаться'}
    </button>
  );
}
