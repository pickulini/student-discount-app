import React, { useState, useEffect } from 'react';
import api from '../api/client';
import ImageUpload from './ImageUpload';
import { Button, Input, Textarea, Label, Badge, ErrorText } from '../design/UI';
import { RouteLoadingView } from '../design/DottedPath';

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

const STATUS_LABELS = {
  draft: 'Черновик',
  pending_review: 'На модерации',
  pending_partner_approval: 'У партнёра',
  published: 'Опубликовано',
  expired: 'Истёк',
  archived: 'Архив',
  rejected: 'Отклонён',
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
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-surface border border-line rounded-[var(--radius-lg)] max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="p-6">
          <div className="flex justify-between items-start mb-4">
            <h2 className="text-editorial text-2xl text-ink uppercase">
              {editMode ? 'Редактирование оффера' : 'Просмотр оффера'}
            </h2>
            <button onClick={onClose} className="text-ink-faint hover:text-ink text-2xl leading-none">✕</button>
          </div>

          {loading ? (
            <RouteLoadingView />
          ) : !offer ? (
            <div className="py-8 text-center text-danger">{error || 'Оффер не найден'}</div>
          ) : (
            <>
              {/* Верхняя панель статусов */}
              <div className="flex flex-wrap gap-2 mb-4 items-center">
                <Badge filled={offer.status === 'published'}>
                  {STATUS_LABELS[offer.status] || offer.status}
                </Badge>
                {offer.is_event && <Badge>Ивент</Badge>}
                {offer.admin_edit_comment && (
                  <span className="text-xs text-ink-soft bg-surface-2 border border-line px-2 py-1 rounded-[var(--radius-xs)]">
                    Комментарий админа: {offer.admin_edit_comment}
                  </span>
                )}
                {offer.partner_reject_comment && (
                  <span className="text-xs text-danger bg-danger/10 border border-danger/30 px-2 py-1 rounded-[var(--radius-xs)]">
                    Партнёр отклонил: {offer.partner_reject_comment}
                  </span>
                )}
              </div>

              {!editMode ? (
                <>
                  {offer.image_url && (
                    <div
                      className="w-full h-48 bg-cover bg-center rounded-[var(--radius-md)] mb-4 bg-surface-2"
                      style={{ backgroundImage: `url('${offer.image_url}')` }}
                    />
                  )}
                  <h3 className="text-xl font-semibold text-ink">{offer.title}</h3>
                  <p className="text-ink-soft mt-1 whitespace-pre-line">{offer.description}</p>

                  <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-ink">
                    <div><span className="text-ink-soft">Компания:</span> #{offer.company_id || '—'}</div>
                    <div><span className="text-ink-soft">Базовая цена:</span> {offer.base_price} ₽</div>
                    <div><span className="text-ink-soft">Скидка:</span> {offer.discount_value}{offer.discount_type === 'percentage' ? '%' : ' ₽'}</div>
                    {offer.special_price && <div><span className="text-ink-soft">Спец. цена:</span> {offer.special_price} ₽</div>}
                    <div><span className="text-ink-soft">Начало:</span> {new Date(offer.start_at).toLocaleString('ru-RU')}</div>
                    <div><span className="text-ink-soft">Окончание:</span> {new Date(offer.end_at).toLocaleString('ru-RU')}</div>
                    {offer.max_uses && <div><span className="text-ink-soft">Лимит:</span> {offer.max_uses}</div>}
                    {offer.bonus_allowed && <div><span className="text-ink-soft">Бонусы:</span> до {offer.max_bonus_percent}%</div>}
                    {offer.address && <div className="md:col-span-2"><span className="text-ink-soft">Адрес:</span> {offer.address}</div>}
                    {offer.phone && <div><span className="text-ink-soft">Телефон:</span> {offer.phone}</div>}
                    {offer.website && <div><span className="text-ink-soft">Сайт:</span> {offer.website}</div>}
                    {offer.working_hours && <div className="md:col-span-2"><span className="text-ink-soft">Часы работы:</span> {offer.working_hours}</div>}
                  </div>

                  {offer.tags && offer.tags.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1">
                      {offer.tags.map(t => (
                        <Badge key={t.id} className="normal-case">#{t.name}</Badge>
                      ))}
                    </div>
                  )}

                  {offer.rejection_reason && (
                    <div className="mt-4 bg-danger/10 border border-danger/30 rounded-[var(--radius-sm)] p-2 text-sm text-danger">
                      <strong>Причина отклонения:</strong> {offer.rejection_reason}
                    </div>
                  )}

                  <div className="mt-6 flex gap-2 flex-wrap">
                    {offer.status === 'pending_review' && (
                      <>
                        <Button onClick={() => handleModerate('publish')}>
                          Опубликовать
                        </Button>
                        <Button variant="danger" onClick={() => handleModerate('reject')}>
                          Отклонить
                        </Button>
                      </>
                    )}
                    <Button variant="ghost" onClick={() => setEditMode(true)}>
                      Редактировать
                    </Button>
                    <Button variant="ghost" onClick={onClose}>
                      Закрыть
                    </Button>
                  </div>
                </>
              ) : (
                <form onSubmit={handleSave} className="space-y-3">
                  <ErrorText>{error}</ErrorText>

                  <div>
                    <Label className="mb-1">Название</Label>
                    <Input
                      type="text"
                      value={form.title}
                      onChange={e => setForm({ ...form, title: e.target.value })}
                      required
                    />
                  </div>

                  <div>
                    <Label className="mb-1">Описание</Label>
                    <Textarea
                      value={form.description}
                      onChange={e => setForm({ ...form, description: e.target.value })}
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
                      <Label className="mb-1">Базовая цена (₽)</Label>
                      <Input
                        type="number"
                        value={form.base_price}
                        onChange={e => setForm({ ...form, base_price: e.target.value })}
                        min="0"
                        step="1"
                      />
                    </div>
                    <div>
                      <Label className="mb-1">Тип скидки</Label>
                      <select
                        value={form.discount_type}
                        onChange={e => setForm({ ...form, discount_type: e.target.value })}
                        className="w-full bg-transparent border-b border-line focus:border-accent outline-none py-2.5 text-ink text-sm transition"
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
                        onChange={e => setForm({ ...form, discount_value: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label className="mb-1">Спец. цена</Label>
                      <Input
                        type="number"
                        value={form.special_price}
                        onChange={e => setForm({ ...form, special_price: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label className="mb-1">Макс. использований</Label>
                      <Input
                        type="number"
                        value={form.max_uses}
                        onChange={e => setForm({ ...form, max_uses: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label className="mb-1">Начало</Label>
                      <Input
                        type="datetime-local"
                        value={form.start_at}
                        onChange={e => setForm({ ...form, start_at: e.target.value })}
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

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="mb-1">Адрес</Label>
                      <Input
                        type="text"
                        value={form.address}
                        onChange={e => setForm({ ...form, address: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label className="mb-1">Телефон</Label>
                      <Input
                        type="text"
                        value={form.phone}
                        onChange={e => setForm({ ...form, phone: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label className="mb-1">Сайт</Label>
                      <Input
                        type="text"
                        value={form.website}
                        onChange={e => setForm({ ...form, website: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label className="mb-1">Часы работы</Label>
                      <Input
                        type="text"
                        value={form.working_hours}
                        onChange={e => setForm({ ...form, working_hours: e.target.value })}
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
                    <label htmlFor="bonus" className="text-sm text-ink-soft">Бонусы разрешены</label>
                    {form.bonus_allowed && (
                      <>
                        <span className="text-sm text-ink-soft ml-2">до</span>
                        <input
                          type="number"
                          value={form.max_bonus_percent}
                          onChange={e => setForm({ ...form, max_bonus_percent: e.target.value })}
                          className="bg-transparent border-b border-line focus:border-accent outline-none py-1 text-ink w-16 text-sm"
                        />
                        <span className="text-sm text-ink-soft">%</span>
                      </>
                    )}
                  </div>

                  <div>
                    <Label className="mb-1">Комментарий партнёру (обязательно)</Label>
                    <Textarea
                      value={comment}
                      onChange={e => setComment(e.target.value)}
                      rows="2"
                      placeholder="Опишите, что и почему вы изменили — партнёр увидит это"
                      required
                    />
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button type="submit" disabled={saving} className="flex-1">
                      {saving ? 'Сохранение...' : 'Сохранить и отправить партнёру'}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => { setEditMode(false); setError(''); }}
                    >
                      Отмена
                    </Button>
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
