import React, { useState, useEffect } from 'react';
import api from '../api/client';
import { Card, PageTitle, Eyebrow, Caption } from '../design/UI';
import { RouteLoadingView } from '../design/DottedPath';

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

  if (loading) return <RouteLoadingView label="Загрузка..." />;

  const referralLink = `${window.location.origin}/register?ref=${code}`;

  return (
    <Card className="max-w-md mx-auto p-6">
      <PageTitle className="mb-4">Реферальная система</PageTitle>
      <div className="space-y-4">
        <div>
          <Eyebrow className="mb-1">Ваш реферальный код</Eyebrow>
          <div className="flex items-center gap-2">
            <code className="bg-surface-2 px-3 py-1 rounded-[var(--radius-sm)] font-mono text-lg text-ink">{code}</code>
            <button
              onClick={() => { navigator.clipboard.writeText(code); alert('Код скопирован!'); }}
              className="text-accent hover:underline text-sm"
            >Копировать</button>
          </div>
        </div>
        <div>
          <Eyebrow className="mb-1">Реферальная ссылка</Eyebrow>
          <div className="flex items-center gap-2">
            <code className="bg-surface-2 px-3 py-1 rounded-[var(--radius-sm)] text-sm text-ink truncate max-w-xs">{referralLink}</code>
            <button
              onClick={() => { navigator.clipboard.writeText(referralLink); alert('Ссылка скопирована!'); }}
              className="text-accent hover:underline text-sm"
            >Копировать</button>
          </div>
        </div>
        <div className="border-t border-line pt-3 mt-2 space-y-1 text-sm">
          <p className="text-ink-soft">Приглашено <span className="text-ink font-medium">{stats.total_invites}</span></p>
          <p className="text-ink-soft">Активных <span className="text-ink font-medium">{stats.active}</span></p>
          <p className="text-ink-soft">Заработано бонусов <span className="text-accent font-medium">{stats.bonus_total}</span></p>
        </div>
        <Caption>* Бонус начисляется за каждого приглашённого пользователя после регистрации.</Caption>
      </div>
    </Card>
  );
};

export default Referral;
