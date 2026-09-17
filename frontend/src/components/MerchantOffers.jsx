import React, { useState, useEffect } from 'react';
import api from '../api/client';
import ImageUpload from './ImageUpload';

const EMPTY_FORM = {
  company_id: '',
  title: '',
  description: '',
  discount_type: 'percentage',
  discount_value: 10,
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

const MerchantOffers = () => {
  const [offers, setOffers] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [tags, setTags] = useState([]);
  const [selectedTagIDs, setSelectedTagIDs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);

  const fetchData = async () => {
    try {
      const [offersRes, companiesRes, tagsRes] = await Promise.all([
        api.get('/merchant/offers'),
        api.get('/merchant/companies'),
        api.get('/tags'),
      ]);
      setOffers(offersRes.data || []);
      setCompanies(companiesRes.data || []);
      setTags(tagsRes.data || []);
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
    setSelectedTagIDs([]);
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
      start_at: toLocalDatetime(offer.start_at),
      end_at: toLocalDatetime(offer.end_at),
      bonus_allowed: !!offer.bonus_allowed,
      max_bonus_percent: offer.max_bonus_percent || 0,
      image_url: offer.image_url || '',
      address: offer.address || '',
      phone: offer.phone || '',
      website: offer.website || '',
      working_hours: offer.working_hours || '',
    });
    setSelectedTagIDs((offer.tags || []).map(t => t.id));
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
      start_at: form.start_at ? new Date(form.start_at).toISOString() : '',
      end_at: form.end_at ? new Date(form.end_at).toISOString() : '',
      bonus_allowed: form.bonus_allowed,
      max_bonus_percent: parseInt(form.max_bonus_percent || 0),
      tag_ids: selectedTagIDs,
      image_url: form.image_url || undefined,
      address: form.address || undefined,
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

  const handleSubmitForReview = async (offerId) => {
    try {
      await api.post(`/merchant/offers/${offerId}/submit`);
      fetchData();
    } catch (err) {
      alert('Ошибка отправки на модерацию');
    }
  };

  if (loading) return <div>Загрузка...</div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">Мои предложения</h2>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Создать предложение
        </button>
      </div>

      {showForm && (
        <div className="bg-gray-50 p-4 rounded shadow mb-6">
          <h3 className="text-lg font-semibold mb-2">
            {editingId ? `Редактировать предложение #${editingId}` : 'Новое предложение'}
          </h3>
          {editingId && (
            <p className="text-sm text-orange-600 mb-2">
              При сохранении предложение уйдёт на повторную модерацию.
            </p>
          )}
          {editingId && offers.find(o => o.id === editingId)?.rejection_reason && (
            <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-800 mb-3">
              <strong>Причина отклонения:</strong> {offers.find(o => o.id === editingId).rejection_reason}
            </div>
          )}
          {error && <div className="text-red-500 mb-2 text-sm">{error}</div>}
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm">Компания</label>
              <select
                value={form.company_id}
                onChange={e => setForm({...form, company_id: e.target.value})}
                className="w-full border p-2 rounded"
                required
              >
                <option value="">Выберите компанию</option>
                {companies.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm">Название</label>
              <input
                type="text"
                value={form.title}
                onChange={e => setForm({...form, title: e.target.value})}
                className="w-full border p-2 rounded"
                placeholder="Скидка 20% на кофе"
                required
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm">Описание</label>
              <textarea
                value={form.description}
                onChange={e => setForm({...form, description: e.target.value})}
                className="w-full border p-2 rounded"
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

            <div>
              <label className="block text-sm">Адрес</label>
              <input
                type="text"
                value={form.address}
                onChange={e => setForm({...form, address: e.target.value})}
                className="w-full border p-2 rounded"
                placeholder="г. Москва, ул. Примерная, д. 1"
              />
            </div>
            <div>
              <label className="block text-sm">Телефон</label>
              <input
                type="text"
                value={form.phone}
                onChange={e => setForm({...form, phone: e.target.value})}
                className="w-full border p-2 rounded"
                placeholder="+7 (999) 123-45-67"
              />
            </div>
            <div>
              <label className="block text-sm">Сайт</label>
              <input
                type="text"
                value={form.website}
                onChange={e => setForm({...form, website: e.target.value})}
                className="w-full border p-2 rounded"
                placeholder="example.com"
              />
            </div>
            <div>
              <label className="block text-sm">Часы работы</label>
              <input
                type="text"
                value={form.working_hours}
                onChange={e => setForm({...form, working_hours: e.target.value})}
                className="w-full border p-2 rounded"
                placeholder="Пн–Пт 10:00–20:00"
              />
            </div>

            <div>
              <label className="block text-sm">Тип скидки</label>
              <select
                value={form.discount_type}
                onChange={e => setForm({...form, discount_type: e.target.value})}
                className="w-full border p-2 rounded"
              >
                <option value="percentage">Процент</option>
                <option value="fixed">Фиксированная</option>
              </select>
            </div>
            <div>
              <label className="block text-sm">Значение</label>
              <input
                type="number"
                value={form.discount_value}
                onChange={e => setForm({...form, discount_value: parseFloat(e.target.value)})}
                className="w-full border p-2 rounded"
                placeholder="20"
                required
              />
            </div>
            <div>
              <label className="block text-sm">Начало</label>
              <input
                type="datetime-local"
                value={form.start_at}
                onChange={e => setForm({...form, start_at: e.target.value})}
                className="w-full border p-2 rounded"
                required
              />
            </div>
            <div>
              <label className="block text-sm">Окончание</label>
              <input
                type="datetime-local"
                value={form.end_at}
                onChange={e => setForm({...form, end_at: e.target.value})}
                className="w-full border p-2 rounded"
                required
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="block text-sm">Бонусы разрешены</label>
              <input
                type="checkbox"
                checked={form.bonus_allowed}
                onChange={e => setForm({...form, bonus_allowed: e.target.checked})}
              />
            </div>
            <div>
              <label className="block text-sm">Макс. % бонусов</label>
              <input
                type="number"
                value={form.max_bonus_percent}
                onChange={e => setForm({...form, max_bonus_percent: parseInt(e.target.value)})}
                className="w-full border p-2 rounded"
                placeholder="20"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm mb-1">Теги</label>
              <div className="flex flex-wrap gap-2">
                {tags.map(tag => (
                  <button
                    type="button"
                    key={tag.id}
                    onClick={() => setSelectedTagIDs(prev =>
                      prev.includes(tag.id) ? prev.filter(id => id !== tag.id) : [...prev, tag.id]
                    )}
                    className={`px-3 py-1 rounded-full text-sm border ${
                      selectedTagIDs.includes(tag.id)
                        ? 'bg-blue-500 text-white border-blue-500'
                        : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'
                    }`}
                  >
                    #{tag.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="md:col-span-2 flex gap-2">
              <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">
                {editingId ? 'Сохранить' : 'Создать'}
              </button>
              <button
                type="button"
                onClick={() => { setShowForm(false); resetForm(); }}
                className="bg-gray-300 px-4 py-2 rounded hover:bg-gray-400"
              >
                Отмена
              </button>
            </div>
          </form>
        </div>
      )}

      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-gray-100">
            <th className="p-2 text-left">Название</th>
            <th className="p-2 text-left">Скидка</th>
            <th className="p-2 text-left">Статус</th>
            <th className="p-2 text-left">Причина</th>
            <th className="p-2 text-left">Действия</th>
          </tr>
        </thead>
        <tbody>
          {offers.map(o => (
            <tr key={o.id} className="border-b">
              <td className="p-2">{o.title}</td>
              <td className="p-2">{o.discount_value}{o.discount_type === 'percentage' ? '%' : ' ₽'}</td>
              <td className="p-2">
                <span className={`px-2 py-1 rounded text-white text-sm ${
                  o.status === 'published' ? 'bg-green-500' :
                  o.status === 'pending_review' ? 'bg-yellow-500' :
                  o.status === 'rejected' ? 'bg-red-500' :
                  o.status === 'archived' ? 'bg-gray-500' : 'bg-gray-400'
                }`}>
                  {o.status}
                </span>
              </td>
              <td className="p-2 text-xs text-red-600">
                {o.rejection_reason || '—'}
              </td>
              <td className="p-2 space-x-2">
                {(o.status === 'draft' || o.status === 'published' || o.status === 'rejected') && (
                  <button
                    onClick={() => handleEdit(o)}
                    className="bg-yellow-500 text-white px-2 py-1 rounded text-sm hover:bg-yellow-600"
                  >
                    Редактировать
                  </button>
                )}
                {o.status === 'draft' && (
                  <button
                    onClick={() => handleSubmitForReview(o.id)}
                    className="bg-blue-500 text-white px-2 py-1 rounded text-sm hover:bg-blue-600"
                  >
                    На модерацию
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default MerchantOffers;
