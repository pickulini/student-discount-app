import React, { useState, useEffect } from 'react';
import api from '../api/client';

const Referral = () => {
  const [code, setCode] = useState('');
  const [stats, setStats] = useState({ total_invites: 0, active: 0, bonus_total: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const codeRes = await api.get('/referral/code');
        setCode(codeRes.data.code);
        const statsRes = await api.get('/referral/stats');
        setStats(statsRes.data);
      } catch (err) {
        console.error('Failed to load referral data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) return <div className="text-center py-8">Загрузка...</div>;

  const referralLink = `${window.location.origin}/register?ref=${code}`;

  return (
    <div className="max-w-md mx-auto bg-white p-6 rounded shadow">
      <h2 className="text-2xl font-bold mb-4">Реферальная система</h2>
      <div className="space-y-3">
        <div>
          <p className="text-sm text-gray-600">Ваш реферальный код</p>
          <div className="flex items-center gap-2">
            <code className="bg-gray-100 px-3 py-1 rounded font-mono text-lg">{code}</code>
            <button
              onClick={() => {
                navigator.clipboard.writeText(code);
                alert('Код скопирован!');
              }}
              className="text-blue-500 hover:text-blue-700 text-sm"
            >
              Копировать
            </button>
          </div>
        </div>
        <div>
          <p className="text-sm text-gray-600">Реферальная ссылка</p>
          <div className="flex items-center gap-2">
            <code className="bg-gray-100 px-3 py-1 rounded text-sm truncate max-w-xs">{referralLink}</code>
            <button
              onClick={() => {
                navigator.clipboard.writeText(referralLink);
                alert('Ссылка скопирована!');
              }}
              className="text-blue-500 hover:text-blue-700 text-sm"
            >
              Копировать
            </button>
          </div>
        </div>
        <div className="border-t pt-3 mt-2">
          <p><strong>Приглашено:</strong> {stats.total_invites}</p>
          <p><strong>Активных:</strong> {stats.active}</p>
          <p><strong>Заработано бонусов:</strong> {stats.bonus_total} баллов</p>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          * Бонус начисляется за каждого приглашённого пользователя после регистрации.
        </p>
      </div>
    </div>
  );
};

export default Referral;
