import React, { useState, useEffect } from 'react';
import api from '../api/client';
import ImageUpload from './ImageUpload';
import HashtagInput from './HashtagInput';
import LocationPicker from './LocationPicker';
import AdminEditDiffModal from './AdminEditDiffModal';
import { Card, Button, Input, Textarea, Label, PageTitle, Eyebrow, Badge, ErrorText } from '../design/UI';
import { RouteLoadingView } from '../design/DottedPath';

const EMPTY_FORM = {
  company_id: '',
  title: '',
  latitude: null,
  longitude: null,
  place_name: '',
  description: '',
  discount_type: 'percentage',
  discount_value: 10,
  base_price: 1000,
  start_at: '',
  end_at: '',
  bonus_allowed: false,
  max_bonus_percent: 20,
  image_url: '',
  address: '',
  phone: '',
  website: '',
  working_hours: '',
};

const selectClass = 'w-full bg-transparent border-b border-line focus:border-accent outline-none py-2.5 text-ink transition';

const MerchantOffers = () => {
  const [offers, setOffers] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [hashtags, setHashtags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [selectedDiffOffer, setSelectedDiffOffer] = useState(null);

  const fetchData = async () => {
    try {
      const [offersRes, companiesRes] = await Promise.all([
        api.get('/merchant/offers'),
        api.get('/merchant/companies'),
      ]);
      setOffers(offersRes.data || []);
      setCompanies(companiesRes.data || []);
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setHashtags([]);
    setEditingId(null);
    setError('');
  };

  const toLocalDatetime = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const handleEdit = (offer) => {
    setForm({
      company_id: String(offer.company_id || ''),
      title: offer.title || '',
      description: offer.description || '',
      discount_type: offer.discount_type || 'percentage',
      discount_value: offer.discount_value || 0,
      base_price: offer.base_price || 1000,
      start_at: toLocalDatetime(offer.start_at),
      end_at: toLocalDatetime(offer.end_at),
      bonus_allowed: !!offer.bonus_allowed,
      max_bonus_percent: offer.max_bonus_percent || 0,
      image_url: offer.image_url || '',
      address: offer.address || '',
      latitude: offer.latitude || null,
      longitude: offer.longitude || null,
      place_name: offer.place_name || '',
      phone: offer.phone || '',
      website: offer.website || '',
      working_hours: offer.working_hours || '',
    });
    setHashtags((offer.tags || []).map(t => t.name));
    setEditingId(offer.id);
    setShowForm(true);
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const payload = {
      company_id: parseInt(form.company_id),
      title: form.title,
      description: form.description,
      discount_type: form.discount_type,
      discount_value: parseFloat(form.discount_value),
      base_price: parseFloat(form.base_price) || 0,
      start_at: form.start_at ? new Date(form.start_at).toISOString() : '',
      end_at: form.end_at ? new Date(form.end_at).toISOString() : '',
      bonus_allowed: form.bonus_allowed,
      max_bonus_percent: parseInt(form.max_bonus_percent || 0),
      hashtags: hashtags,
      image_url: form.image_url || undefined,
      address: form.address || undefined,
      latitude: form.latitude || undefined,
      longitude: form.longitude || undefined,
      place_name: form.place_name || undefined,
      phone: form.phone || undefined,
      website: form.website || undefined,
      working_hours: form.working_hours || undefined,
    };

    try {
      if (editingId) {
        await api.put(`/merchant/offers/${editingId}`, payload);
      } else {
        await api.post('/merchant/offers', payload);
      }
      setShowForm(false);
      resetForm();
      fetchData();
    } catch (err) {
      setError('Ошибка: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleAcceptEdits = async (offerId) => {
    if (!confirm('Согласовать правки администратора и опубликовать?')) return;
    try {
      await api.post(`/merchant/offers/${offerId}/accept-edits`);
      setSelectedDiffOffer(null);
      fetchData();
    } catch (err) {
      alert('Ошибка: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleRejectEdits = async (offerId) => {
    const comment = window.prompt('Что именно вас не устроило? (комментарий увидит администратор):');
    if (comment === null) return;
    if (!comment.trim()) {
      alert('Укажите причину');
      return;
    }
    try {
      await api.post(`/merchant/offers/${offerId}/reject-edits`, { comment });
      setSelectedDiffOffer(null);
      fetchData();
    } catch (err) {
      alert('Ошибка: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleSubmitForReview = async (offerId) => {
    try {
      await api.post(`/merchant/offers/${offerId}/submit`);
      fetchData();
    } catch (err) {
      alert('Ошибка отправки на модерацию');
    }
  };

  if (loading) return <RouteLoadingView label="Загрузка..." />;

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <PageTitle className="mb-0">Мои предложения</PageTitle>
        <Button onClick={() => { resetForm(); setShowForm(true); }}>
          Создать предложение
        </Button>
      </div>

      {showForm && (
        <Card className="p-4 mb-6">
          <Eyebrow className="mb-2">
            {editingId ? `Редактировать предложение #${editingId}` : 'Новое предложение'}
          </Eyebrow>
          {editingId && (
            <p className="text-sm text-accent mb-2">
              При сохранении предложение уйдёт на повторную модерацию.
            </p>
          )}
          {editingId && offers.find(o => o.id === editingId)?.rejection_reason && (
            <div className="border border-danger/30 bg-danger/10 rounded-[var(--radius-sm)] p-3 text-sm text-danger mb-3">
              <strong>Причина отклонения:</strong> {offers.find(o => o.id === editingId).rejection_reason}
            </div>
          )}
          <ErrorText>{error}</ErrorText>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="mb-1">Компания</Label>
              <select
                value={form.company_id}
                onChange={e => setForm({...form, company_id: e.target.value})}
                className={selectClass}
                required
              >
                <option value="">Выберите компанию</option>
                {companies.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <Label className="mb-1">Название</Label>
              <Input
                type="text"
                value={form.title}
                onChange={e => setForm({...form, title: e.target.value})}
                placeholder="Скидка 20% на кофе"
                required
              />
            </div>
            <div className="md:col-span-2">
              <Label className="mb-1">Описание</Label>
              <Textarea
                value={form.description}
                onChange={e => setForm({...form, description: e.target.value})}
                placeholder="На все напитки в меню"
                rows="2"
              />
            </div>

            <div className="md:col-span-2">
              <ImageUpload
                value={form.image_url}
                onChange={(url) => setForm({ ...form, image_url: url })}
                uploadEndpoint="/merchant/upload"
              />
            </div>

            <div className="md:col-span-2">
              <LocationPicker
                value={{
                  latitude: form.latitude,
                  longitude: form.longitude,
                  place_name: form.place_name,
                  address: form.address,
                }}
                onChange={(v) => setForm({
                  ...form,
                  latitude: v.latitude,
                  longitude: v.longitude,
                  place_name: v.place_name,
                  address: v.address || form.address,
                })}
              />
            </div>

            <div>
              <Label className="mb-1">Адрес</Label>
              <Input
                type="text"
                value={form.address}
                onChange={e => setForm({...form, address: e.target.value})}
                placeholder="г. Москва, ул. Примерная, д. 1"
              />
              <p className="text-xs text-ink-faint mt-1">
                Можно править вручную или установить точку на карте — адрес подтянется автоматически
              </p>
            </div>
            <div>
              <Label className="mb-1">Телефон</Label>
              <Input
                type="text"
                value={form.phone}
                onChange={e => setForm({...form, phone: e.target.value})}
                placeholder="+7 (999) 123-45-67"
              />
            </div>
            <div>
              <Label className="mb-1">Сайт</Label>
              <Input
                type="text"
                value={form.website}
                onChange={e => setForm({...form, website: e.target.value})}
                placeholder="example.com"
              />
            </div>
            <div>
              <Label className="mb-1">Часы работы</Label>
              <Input
                type="text"
                value={form.working_hours}
                onChange={e => setForm({...form, working_hours: e.target.value})}
                placeholder="Пн–Пт 10:00–20:00"
              />
            </div>

            <div>
              <Label className="mb-1">Базовая цена (₽)</Label>
              <Input
                type="number"
                value={form.base_price}
                onChange={e => setForm({...form, base_price: parseFloat(e.target.value) || 0})}
                placeholder="1000"
                min="0"
                step="1"
                required
              />
              <p className="text-xs text-ink-faint mt-1">
                Стоимость без скидки. Скидка применяется к этой цене.
              </p>
            </div>
            <div>
              <Label className="mb-1">Тип скидки</Label>
              <select
                value={form.discount_type}
                onChange={e => setForm({...form, discount_type: e.target.value})}
                className={selectClass}
              >
                <option value="percentage">Процент</option>
                <option value="fixed">Фиксированная</option>
              </select>
            </div>
            <div>
              <Label className="mb-1">Значение</Label>
              <Input
                type="number"
                value={form.discount_value}
                onChange={e => setForm({...form, discount_value: parseFloat(e.target.value)})}
                placeholder="20"
                required
              />
            </div>
            <div>
              <Label className="mb-1">Начало</Label>
              <Input
                type="datetime-local"
                value={form.start_at}
                onChange={e => setForm({...form, start_at: e.target.value})}
                required
              />
            </div>
            <div>
              <Label className="mb-1">Окончание</Label>
              <Input
                type="datetime-local"
                value={form.end_at}
                onChange={e => setForm({...form, end_at: e.target.value})}
                required
              />
            </div>
            <div className="flex items-center gap-2">
              <Label className="mb-0">Бонусы разрешены</Label>
              <input
                type="checkbox"
                checked={form.bonus_allowed}
                onChange={e => setForm({...form, bonus_allowed: e.target.checked})}
                className="accent-[var(--color-accent)]"
              />
            </div>
            <div>
              <Label className="mb-1">Макс. % бонусов</Label>
              <Input
                type="number"
                value={form.max_bonus_percent}
                onChange={e => setForm({...form, max_bonus_percent: parseInt(e.target.value)})}
                placeholder="20"
              />
            </div>

            <div className="md:col-span-2">
              <Label className="mb-1">Хештеги</Label>
              <HashtagInput value={hashtags} onChange={setHashtags} />
              <p className="text-xs text-ink-faint mt-1">
                Новые теги появятся в общем пуле после одобрения предложения модератором.
              </p>
            </div>

            <div className="md:col-span-2 flex gap-2">
              <Button type="submit">
                {editingId ? 'Сохранить' : 'Создать'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => { setShowForm(false); resetForm(); }}
              >
                Отмена
              </Button>
            </div>
          </form>
        </Card>
      )}

      <Card className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-line">
              <th className="p-2 text-left text-eyebrow">Название</th>
              <th className="p-2 text-left text-eyebrow">Скидка</th>
              <th className="p-2 text-left text-eyebrow">Статус</th>
              <th className="p-2 text-left text-eyebrow">Причина</th>
              <th className="p-2 text-left text-eyebrow">Действия</th>
            </tr>
          </thead>
          <tbody>
            {offers.map(o => (
              <tr key={o.id} className="border-b border-line last:border-0">
                <td className="p-2 text-ink">{o.title}</td>
                <td className="p-2">
                  <div className="text-xs text-ink-faint">{o.base_price} ₽</div>
                  <div className="font-semibold text-danger">
                    −{o.discount_value}{o.discount_type === 'percentage' ? '%' : ' ₽'}
                  </div>
                </td>
                <td className="p-2">
                  <Badge filled={o.status === 'published'}>{o.status}</Badge>
                </td>
                <td className="p-2 text-xs text-danger">
                  {o.status === 'pending_partner_approval' ? (
                    <span className="text-accent">
                      Админ изменил оффер
                      {o.admin_edit_comment && (
                        <span className="block text-ink-soft mt-0.5">
                          «{o.admin_edit_comment}»
                        </span>
                      )}
                    </span>
                  ) : (
                    o.rejection_reason || '—'
                  )}
                </td>
                <td className="p-2 space-x-2">
                  {o.status === 'pending_partner_approval' && (
                    <Button variant="ghost" onClick={() => setSelectedDiffOffer(o)} className="px-2 py-1 text-xs">
                      Посмотреть правки
                    </Button>
                  )}
                  {(o.status === 'draft' || o.status === 'published' || o.status === 'rejected') && (
                    <Button variant="ghost" onClick={() => handleEdit(o)} className="px-2 py-1 text-xs">
                      Редактировать
                    </Button>
                  )}
                  {o.status === 'draft' && (
                    <Button onClick={() => handleSubmitForReview(o.id)} className="px-2 py-1 text-xs">
                      На модерацию
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      {selectedDiffOffer && (
        <AdminEditDiffModal
          offer={selectedDiffOffer}
          onClose={() => setSelectedDiffOffer(null)}
          onAccept={handleAcceptEdits}
          onReject={handleRejectEdits}
        />
      )}
    </div>
  );
};

export default MerchantOffers;
