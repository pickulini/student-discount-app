import React, { useState, useEffect } from 'react';
import api from '../api/client';
import ImageUpload from './ImageUpload';

const EMPTY_FORM = {
  title: '',
  description: '',
  discount_type: 'percentage',
  discount_value: 0,
  base_price: 1000,
  special_price: '',
  start_at: '',
  end_at: '',
  bonus_allowed: false,
  max_bonus_percent: 0,
  max_uses: '',
  address: '',
  phone: '',
  website: '',
  working_hours: '',
  image_url: '',
};

const toLocalDatetime = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const AdminOfferDetailModal = ({ offerId, onClose, onUpdate }) => {
  const [offer, setOffer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [comment, setComment] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);

  const fetchOffer = () => {
    setLoading(true);
    api.get(`/admin/offers/${offerId}`)
      .then((res) => {
        setOffer(res.data);
        setForm({
          title: res.data.title || '',
          description: res.data.description || '',
          discount_type: res.data.discount_type || 'percentage',
          discount_value: res.data.discount_value || 0,
          base_price: res.data.base_price || 1000,
          special_price: res.data.special_price || '',
          start_at: toLocalDatetime(res.data.start_at),
          end_at: toLocalDatetime(res.data.end_at),
          bonus_allowed: !!res.data.bonus_allowed,
          max_bonus_percent: res.data.max_bonus_percent || 0,
          max_uses: res.data.max_uses || '',
          address: res.data.address || '',
          phone: res.data.phone || '',
          website: res.data.website || '',
          working_hours: res.data.working_hours || '',
          image_url: res.data.image_url || '',
        });
      })
      .catch(() => setError('Не удалось загрузить оффер'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (offerId) fetchOffer();
  }, [offerId]);

  const handleSave = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await api.put(`/admin/offers/${offerId}`, {
        title: form.title,
        description: form.description,
        discount_type: form.discount_type,
        discount_value: parseFloat(form.discount_value) || 0,
        base_price: parseFloat(form.base_price) || 0,
        special_price: form.special_price ? parseFloat(form.special_price) : undefined,
        start_at: form.start_at ? new Date(form.start_at).toISOString() : '',
        end_at: form.end_at ? new Date(form.end_at).toISOString() : '',
        bonus_allowed: form.bonus_allowed,
        max_bonus_percent: parseInt(form.max_bonus_percent) || 0,
        max_uses: form.max_uses ? parseInt(form.max_uses) : undefined,
        address: form.address || undefined,
        phone: form.phone || undefined,
        website: form.website || undefined,
        working_hours: form.working_hours || undefined,
        image_url: form.image_url || undefined,
        comment: comment,
      });
      setEditMode(false);
      setComment('');
      fetchOffer();
      if (onUpdate) onUpdate();
    } catch (err) {
      setError(err.response?.data?.error || 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  const handleModerate = async (action) => {
    let reason = '';
    if (action === 'reject') {
      reason = window.prompt('Причина отклонения:');
      if (reason === null) return;
      if (!reason.trim()) return;
    }
    try {
      await api.put(`/admin/offers/${offerId}/moderate`, { action, reason });
      if (onUpdate) onUpdate();
      onClose();
    } catch (err) {
      alert('Ошибка: ' + (err.response?.data?.error || err.message));
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="p-6">
          <div className="flex justify-between items-start mb-4">
            <h2 className="text-2xl font-bold">
              {editMode ? 'Редактирование оффера' : 'Просмотр оффера'}
            </h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">✕</button>
          </div>

          {loading ? (
            <div className="py-8 text-center">Загрузка...</div>
          ) : !offer ? (
            <div className="py-8 text-center text-red-500">{error || 'Оффер не найден'}</div>
          ) : (
            <>
              {/* Верхняя панель статусов */}
              <div className="flex flex-wrap gap-2 mb-4">
                <span className={`px-3 py-1 rounded text-white text-sm ${
                  offer.status === 'published' ? 'bg-green-500' :
                  offer.status === 'pending_review' ? 'bg-yellow-500' :
                  offer.status === 'pending_partner_approval' ? 'bg-purple-500' :
                  offer.status === 'rejected' ? 'bg-red-500' :
                  offer.status === 'archived' ? 'bg-gray-500' : 'bg-gray-400'
                }`}>
                  {offer.status}
                </span>
                {offer.is_event && <span className="px-3 py-1 bg-purple-100 text-purple-800 rounded text-sm">📅 Ивент</span>}
                {offer.admin_edit_comment && (
                  <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                    Комментарий админа: {offer.admin_edit_comment}
                  </span>
                )}
                {offer.partner_reject_comment && (
                  <span className="text-xs text-red-700 bg-red-50 border border-red-200 px-2 py-1 rounded">
                    Партнёр отклонил: {offer.partner_reject_comment}
                  </span>
                )}
              </div>

              {!editMode ? (
                <>
                  {offer.image_url && (
                    <div
                      className="w-full h-48 bg-cover bg-center rounded-lg mb-4"
                      style={{ backgroundImage: `url('${offer.image_url}')` }}
                    />
                  )}
                  <h3 className="text-xl font-semibold">{offer.title}</h3>
                  <p className="text-gray-600 mt-1 whitespace-pre-line">{offer.description}</p>

                  <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    <div><strong>Компания:</strong> #{offer.company_id || '—'}</div>
                    <div><strong>Базовая цена:</strong> {offer.base_price} ₽</div>
                    <div><strong>Скидка:</strong> {offer.discount_value}{offer.discount_type === 'percentage' ? '%' : ' ₽'}</div>
                    {offer.special_price && <div><strong>Спец. цена:</strong> {offer.special_price} ₽</div>}
                    <div><strong>Начало:</strong> {new Date(offer.start_at).toLocaleString('ru-RU')}</div>
                    <div><strong>Окончание:</strong> {new Date(offer.end_at).toLocaleString('ru-RU')}</div>
                    {offer.max_uses && <div><strong>Лимит:</strong> {offer.max_uses}</div>}
                    {offer.bonus_allowed && <div><strong>Бонусы:</strong> до {offer.max_bonus_percent}%</div>}
                    {offer.address && <div className="md:col-span-2"><strong>Адрес:</strong> {offer.address}</div>}
                    {offer.phone && <div><strong>Телефон:</strong> {offer.phone}</div>}
                    {offer.website && <div><strong>Сайт:</strong> {offer.website}</div>}
                    {offer.working_hours && <div className="md:col-span-2"><strong>Часы работы:</strong> {offer.working_hours}</div>}
                  </div>

                  {offer.tags && offer.tags.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1">
                      {offer.tags.map(t => (
                        <span key={t.id} className="bg-gray-100 text-gray-700 text-xs px-2 py-0.5 rounded-full">
                          #{t.name}
                        </span>
                      ))}
                    </div>
                  )}

                  {offer.rejection_reason && (
                    <div className="mt-4 bg-red-50 border border-red-200 rounded p-2 text-sm text-red-700">
                      <strong>Причина отклонения:</strong> {offer.rejection_reason}
                    </div>
                  )}

                  <div className="mt-6 flex gap-2 flex-wrap">
                    {offer.status === 'pending_review' && (
                      <>
                        <button
                          onClick={() => handleModerate('publish')}
                          className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
                        >
                          Опубликовать
                        </button>
                        <button
                          onClick={() => handleModerate('reject')}
                          className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
                        >
                          Отклонить
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => setEditMode(true)}
                      className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                    >
                      Редактировать
                    </button>
                    <button
                      onClick={onClose}
                      className="bg-gray-200 text-gray-800 px-4 py-2 rounded hover:bg-gray-300"
                    >
                      Закрыть
                    </button>
                  </div>
                </>
              ) : (
                <form onSubmit={handleSave} className="space-y-3">
                  {error && <div className="bg-red-50 text-red-700 p-2 rounded text-sm">{error}</div>}

                  <div>
                    <label className="block text-sm mb-1">Название</label>
                    <input
                      type="text"
                      value={form.title}
                      onChange={e => setForm({ ...form, title: e.target.value })}
                      className="w-full border p-2 rounded"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm mb-1">Описание</label>
                    <textarea
                      value={form.description}
                      onChange={e => setForm({ ...form, description: e.target.value })}
                      className="w-full border p-2 rounded"
                      rows="3"
                    />
                  </div>

                  <ImageUpload
                    value={form.image_url}
                    onChange={(url) => setForm({ ...form, image_url: url })}
                    uploadEndpoint="/admin/upload"
                  />

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm mb-1">Базовая цена (₽)</label>
                      <input
                        type="number"
                        value={form.base_price}
                        onChange={e => setForm({ ...form, base_price: e.target.value })}
                        className="w-full border p-2 rounded"
                        min="0"
                        step="1"
                      />
                    </div>
                    <div>
                      <label className="block text-sm mb-1">Тип скидки</label>
                      <select
                        value={form.discount_type}
                        onChange={e => setForm({ ...form, discount_type: e.target.value })}
                        className="w-full border p-2 rounded"
                      >
                        <option value="percentage">Процент</option>
                        <option value="fixed">Фиксированная</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm mb-1">Значение</label>
                      <input
                        type="number"
                        value={form.discount_value}
                        onChange={e => setForm({ ...form, discount_value: e.target.value })}
                        className="w-full border p-2 rounded"
                      />
                    </div>
                    <div>
                      <label className="block text-sm mb-1">Спец. цена</label>
                      <input
                        type="number"
                        value={form.special_price}
                        onChange={e => setForm({ ...form, special_price: e.target.value })}
                        className="w-full border p-2 rounded"
                      />
                    </div>
                    <div>
                      <label className="block text-sm mb-1">Макс. использований</label>
                      <input
                        type="number"
                        value={form.max_uses}
                        onChange={e => setForm({ ...form, max_uses: e.target.value })}
                        className="w-full border p-2 rounded"
                      />
                    </div>
                    <div>
                      <label className="block text-sm mb-1">Начало</label>
                      <input
                        type="datetime-local"
                        value={form.start_at}
                        onChange={e => setForm({ ...form, start_at: e.target.value })}
                        className="w-full border p-2 rounded"
                      />
                    </div>
                    <div>
                      <label className="block text-sm mb-1">Окончание</label>
                      <input
                        type="datetime-local"
                        value={form.end_at}
                        onChange={e => setForm({ ...form, end_at: e.target.value })}
                        className="w-full border p-2 rounded"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm mb-1">Адрес</label>
                      <input
                        type="text"
                        value={form.address}
                        onChange={e => setForm({ ...form, address: e.target.value })}
                        className="w-full border p-2 rounded"
                      />
                    </div>
                    <div>
                      <label className="block text-sm mb-1">Телефон</label>
                      <input
                        type="text"
                        value={form.phone}
                        onChange={e => setForm({ ...form, phone: e.target.value })}
                        className="w-full border p-2 rounded"
                      />
                    </div>
                    <div>
                      <label className="block text-sm mb-1">Сайт</label>
                      <input
                        type="text"
                        value={form.website}
                        onChange={e => setForm({ ...form, website: e.target.value })}
                        className="w-full border p-2 rounded"
                      />
                    </div>
                    <div>
                      <label className="block text-sm mb-1">Часы работы</label>
                      <input
                        type="text"
                        value={form.working_hours}
                        onChange={e => setForm({ ...form, working_hours: e.target.value })}
                        className="w-full border p-2 rounded"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="bonus"
                      checked={form.bonus_allowed}
                      onChange={e => setForm({ ...form, bonus_allowed: e.target.checked })}
                    />
                    <label htmlFor="bonus" className="text-sm">Бонусы разрешены</label>
                    {form.bonus_allowed && (
                      <>
                        <span className="text-sm ml-2">до</span>
                        <input
                          type="number"
                          value={form.max_bonus_percent}
                          onChange={e => setForm({ ...form, max_bonus_percent: e.target.value })}
                          className="border p-1 rounded w-16"
                        />
                        <span className="text-sm">%</span>
                      </>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm mb-1">Комментарий партнёру (обязательно)</label>
                    <textarea
                      value={comment}
                      onChange={e => setComment(e.target.value)}
                      className="w-full border p-2 rounded"
                      rows="2"
                      placeholder="Опишите, что и почему вы изменили — партнёр увидит это"
                      required
                    />
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      type="submit"
                      disabled={saving}
                      className="flex-1 bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-50"
                    >
                      {saving ? 'Сохранение...' : 'Сохранить и отправить партнёру'}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setEditMode(false); setError(''); }}
                      className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400"
                    >
                      Отмена
                    </button>
                  </div>
                </form>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminOfferDetailModal;
