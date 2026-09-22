import React, { useState, useEffect } from 'react';
import api from '../api/client';
import ImageUpload from './ImageUpload';
import { useAuth } from '../context/AuthContext';
import { Card, Button, Input, Label } from '../design/UI';
import { RouteLoadingView } from '../design/DottedPath';

const SettingsProfile = () => {
  const { fetchUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [form, setForm] = useState({
    nickname: '',
    username: '',
    avatar_url: '',
  });

  useEffect(() => {
    api.get('/users/me')
      .then((res) => {
        setForm({
          nickname: res.data.nickname || '',
          username: res.data.username || '',
          avatar_url: res.data.avatar_url || '',
        });
      })
      .catch(() => setError('Не удалось загрузить'))
      .finally(() => setLoading(false));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await api.patch('/users/me', {
        nickname: form.nickname || null,
        username: form.username || null,
        avatar_url: form.avatar_url || null,
      });
      setSuccess('Профиль обновлён');
      if (fetchUser) fetchUser();
    } catch (err) {
      setError(err.response?.data?.error || 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <RouteLoadingView label="Загрузка..." />;

  return (
    <Card className="p-6">
      <h2 className="text-editorial text-xl text-ink uppercase mb-4">Профиль</h2>

      {error && <div className="bg-danger/10 text-danger p-3 rounded-[var(--radius-sm)] mb-3 text-sm">{error}</div>}
      {success && <div className="bg-accent/10 text-accent p-3 rounded-[var(--radius-sm)] mb-3 text-sm">{success}</div>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <ImageUpload
          value={form.avatar_url}
          onChange={(url) => setForm({ ...form, avatar_url: url })}
          uploadEndpoint="/users/upload-avatar"
        />

        <div>
          <Label className="mb-1">Никнейм</Label>
          <Input
            type="text"
            value={form.nickname}
            onChange={(e) => setForm({ ...form, nickname: e.target.value })}
            placeholder="Артём"
            maxLength={50}
          />
        </div>

        <div>
          <Label className="mb-1">Username (@тег)</Label>
          <div className="flex items-center gap-1">
            <span className="text-ink-faint">@</span>
            <Input
              type="text"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase() })}
              placeholder="artem_2005"
              pattern="[a-z0-9_]{3,30}"
              title="3-30 символов: латиница, цифры, _"
            />
          </div>
          <p className="text-xs text-ink-faint mt-1">3-30 символов: латиница, цифры, _</p>
        </div>

        <div className="flex gap-2 pt-2">
          <Button type="submit" disabled={saving} className="px-6">
            {saving ? 'Сохранение...' : 'Сохранить'}
          </Button>
        </div>
      </form>
    </Card>
  );
};

export default SettingsProfile;
