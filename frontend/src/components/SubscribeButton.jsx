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
          subscribed ? 'text-accent' : 'text-ink-faint hover:text-accent'
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
      className={`px-3 py-1 rounded-[var(--radius-sm)] text-sm font-medium transition ${
        subscribed
          ? 'bg-surface-2 text-ink-soft border border-line hover:border-ink-faint'
          : 'bg-accent text-accent-ink hover:bg-accent/90'
      } ${loading ? 'opacity-50 cursor-wait' : ''}`}
    >
      {loading ? '...' : subscribed ? '★ Вы подписаны' : '☆ Подписаться'}
    </button>
  );
}
