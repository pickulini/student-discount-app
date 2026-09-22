import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import ImageUpload from './ImageUpload';
import { useAuth } from '../context/AuthContext';
import { Button, Input, Textarea, Label, Card } from '../design/UI';

const EMPTY = {
  title: '',
  recurrence_rule: '',
  recurrence_until: '',
  description: '',
  start_at: '',
  end_at: '',
  address: '',
  image_url: '',
  company_id: '',
  event_privacy: 'public',
  event_university_id: '',
  special_price: 0,
  max_uses: '',
};

const selectClass =
  'w-full bg-surface border border-line focus:border-accent outline-none rounded-[var(--radius-sm)] px-3 py-2.5 text-ink transition';

const EventForm = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [form, setForm] = useState(EMPTY);
  const [companies, setCompanies] = useState([]);
  const [universities, setUniversities] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isMerchant = user?.role === 'merchant';

  useEffect(() => {
    if (isMerchant) {
      api.get('/merchant/companies')
        .then(res => setCompanies(res.data || []))
        .catch(() => {});
    }
    // университеты (публичный список)
    api.get('/universities')
      .then(res => setUniversities(res.data || []))
      .catch(() => {});
  }, [isMerchant]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const payload = {
        title: form.title,
        description: form.description,
        start_at: form.start_at ? new Date(form.start_at).toISOString() : '',
        end_at: form.end_at ? new Date(form.end_at).toISOString() : '',
        address: form.address || undefined,
        image_url: form.image_url || undefined,
        company_id: form.company_id ? parseInt(form.company_id) : undefined,
        event_privacy: form.event_privacy,
        event_university_id: form.event_university_id ? parseInt(form.event_university_id) : undefined,
        special_price: form.special_price > 0 ? parseFloat(form.special_price) : undefined,
        max_uses: form.max_uses ? parseInt(form.max_uses) : undefined,
        recurrence_rule: form.recurrence_rule || undefined,
        recurrence_until: form.recurrence_rule && form.recurrence_until
          ? new Date(form.recurrence_until).toISOString()
          : undefined,
      };

      const res = await api.post('/events', payload);
      const eventId = res.data.id;

      // сразу отправляем на модерацию
      await api.post(`/events/${eventId}/submit`).catch(() => {});

      navigate('/events');
    } catch (err) {
      setError(err.response?.data?.error || 'Ошибка создания');
    } finally {
      setLoading(false);
    }
  };

  if (!user) return <div className="text-center py-8 text-ink-soft">Требуется авторизация</div>;

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-semibold text-ink mb-4">Предложить ивент</h1>

      <div className="bg-surface-2 border border-line text-ink-soft rounded-[var(--radius-sm)] p-3 mb-4 text-sm">
        Ивент уйдёт на модерацию. После одобрения станет доступен другим пользователям.
      </div>

      {error && <div className="bg-danger/10 border border-danger/30 text-danger rounded-[var(--radius-sm)] p-3 mb-4 text-sm">{error}</div>}

      <Card className="p-4">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label className="mb-1">Название *</Label>
            <Input
              type="text"
              value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })}
              placeholder="Встреча студентов МГУ"
              required
              maxLength={200}
            />
          </div>

          <div>
            <Label className="mb-1">Описание</Label>
            <Textarea
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              rows="4"
              placeholder="Что будет, для кого, программа..."
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="mb-1">Начало *</Label>
              <Input
                type="datetime-local"
                value={form.start_at}
                onChange={e => setForm({ ...form, start_at: e.target.value })}
                required
              />
            </div>
            <div>
              <Label className="mb-1">Окончание</Label>
              <Input
                type="datetime-local"
                value={form.end_at}
                onChange={e => setForm({ ...form, end_at: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="mb-1">Повторение</Label>
              <select
                value={form.recurrence_rule}
                onChange={e => setForm({ ...form, recurrence_rule: e.target.value })}
                className={selectClass}
              >
                <option value="">Не повторять</option>
                <option value="FREQ=DAILY">Ежедневно</option>
                <option value="FREQ=WEEKLY">Еженедельно</option>
                <option value="FREQ=MONTHLY">Ежемесячно</option>
              </select>
            </div>
            {form.recurrence_rule && (
              <div>
                <Label className="mb-1">Повторять до</Label>
                <Input
                  type="date"
                  value={form.recurrence_until}
                  onChange={e => setForm({ ...form, recurrence_until: e.target.value })}
                />
                <p className="text-xs text-ink-faint mt-1">
                  Оставьте пустым для бессрочного повторения
                </p>
              </div>
            )}
          </div>

          <div>
            <Label className="mb-1">Место (адрес)</Label>
            <Input
              type="text"
              value={form.address}
              onChange={e => setForm({ ...form, address: e.target.value })}
              placeholder="г. Москва, Ленинские горы, 1"
            />
          </div>

          <div>
            <ImageUpload
              value={form.image_url}
              onChange={(url) => setForm({ ...form, image_url: url })}
              uploadEndpoint={isMerchant ? '/merchant/upload' : '/users/upload-avatar'}
            />
          </div>

          {isMerchant && companies.length > 0 && (
            <div>
              <Label className="mb-1">Компания (опционально)</Label>
              <select
                value={form.company_id}
                onChange={e => setForm({ ...form, company_id: e.target.value })}
                className={selectClass}
              >
                <option value="">— Личный ивент (без компании) —</option>
                {companies.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <Label className="mb-1">Кто может видеть</Label>
            <select
              value={form.event_privacy}
              onChange={e => setForm({ ...form, event_privacy: e.target.value })}
              className={selectClass}
            >
              <option value="public">Все пользователи</option>
              <option value="friends">Только мои друзья</option>
              <option value="subscribers">Подписчики компании</option>
              <option value="university">Студенты конкретного вуза</option>
              <option value="invite_only">Только по приглашению</option>
            </select>
          </div>

          {form.event_privacy === 'university' && (
            <div>
              <Label className="mb-1">Вуз *</Label>
              <select
                value={form.event_university_id}
                onChange={e => setForm({ ...form, event_university_id: e.target.value })}
                className={selectClass}
                required
              >
                <option value="">Выберите вуз</option>
                {universities.map(u => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="mb-1">Цена билета (0 = бесплатно)</Label>
              <Input
                type="number"
                value={form.special_price}
                onChange={e => setForm({ ...form, special_price: parseFloat(e.target.value) || 0 })}
                min="0"
              />
            </div>
            <div>
              <Label className="mb-1">Макс. участников</Label>
              <Input
                type="number"
                value={form.max_uses}
                onChange={e => setForm({ ...form, max_uses: e.target.value })}
                placeholder="Без ограничений"
                min="1"
              />
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? 'Создание...' : 'Создать ивент'}
            </Button>
            <Button type="button" variant="ghost" onClick={() => navigate('/events')} className="flex-1">
              Отмена
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
};

export default EventForm;
