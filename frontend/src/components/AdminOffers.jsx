import React, { useState, useEffect } from 'react';
import api from '../api/client';
import AdminOfferDetailModal from './AdminOfferDetailModal';
import { PageTitle, Eyebrow, Button, Input, Label, Badge } from '../design/UI';
import { RouteLoadingView } from '../design/DottedPath';

const STATUS_LABELS = {
  draft: 'Черновик',
  pending_review: 'На модерации',
  pending_partner_approval: 'У партнёра',
  published: 'Опубликовано',
  expired: 'Истёк',
  archived: 'Архив',
  rejected: 'Отклонён',
};

const AdminOffers = () => {
  const [offers, setOffers] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');
  const [pendingTagIDs, setPendingTagIDs] = useState(new Set());
  const [selectedOfferId, setSelectedOfferId] = useState(null);
  const [form, setForm] = useState({
    company_id: '',
    title: '',
    description: '',
    discount_type: 'percentage',
    discount_value: 10,
    start_at: '',
    end_at: '',
    status: 'pending_review', // <-- изменено с 'draft' на 'pending_review'
    bonus_allowed: false,
    max_bonus_percent: 20,
  });

  useEffect(() => {
    fetchData();
  }, [filterStatus]);

  const fetchData = async () => {
    try {
      const [offersRes, companiesRes, pendingRes] = await Promise.all([
        api.get('/admin/offers'),
        api.get('/admin/companies'),
        api.get('/admin/tags?status=pending').catch(() => ({ data: [] })),
      ]);
      let offersData = offersRes.data || [];
      if (filterStatus !== 'all') {
        offersData = offersData.filter(o => o.status === filterStatus);
      }
      setOffers(offersData);
      setCompanies(companiesRes.data || []);
      setPendingTagIDs(new Set((pendingRes.data || []).map(t => t.id)));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await api.post('/admin/offers', {
        ...form,
        company_id: form.company_id ? parseInt(form.company_id) : '',
        discount_value: parseFloat(form.discount_value),
        max_bonus_percent: parseInt(form.max_bonus_percent || 0),
      });
      setForm({ ...form, title: '', description: '' });
      fetchData();
    } catch (err) {
      alert('Ошибка создания предложения');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Удалить предложение?')) return;
    try {
      await api.delete(`/admin/offers?id=${id}`);
      fetchData();
    } catch (err) {
      alert('Ошибка удаления: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleModerate = async (id, action) => {
    let reason = '';
    if (action === 'reject') {
      reason = window.prompt('Укажите причину отклонения:');
      if (reason === null) return; // отмена
      if (!reason.trim()) {
        alert('Нужно указать причину');
        return;
      }
    }
    try {
      await api.put(`/admin/offers/${id}/moderate`, { action, reason });
      fetchData();
    } catch (err) {
      alert('Ошибка модерации');
    }
  };

  const handleArchive = async (id) => {
    if (!confirm('Архивировать предложение? Оно перестанет отображаться на главной.')) return;
    try {
      await api.put(`/admin/offers/${id}/archive`, {});
      fetchData();
    } catch (err) {
      alert('Ошибка архивации: ' + (err.response?.data?.error || err.message));
    }
  };

  if (loading) return <RouteLoadingView label="Загрузка предложений..." />;

  const inputClass = 'w-full bg-transparent border-b border-line focus:border-accent outline-none py-2 text-ink text-sm transition';

  return (
    <div>
      <PageTitle>Предложения (модерация)</PageTitle>
      <div className="mb-4 flex gap-2 items-center">
        <label className="text-sm text-ink-soft">Фильтр по статусу:</label>
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="bg-surface border border-line rounded-[var(--radius-xs)] p-1.5 text-sm text-ink"
        >
          <option value="all">Все</option>
          <option value="draft">Черновики</option>
          <option value="pending_review">На модерации</option>
          <option value="pending_partner_approval">У партнёра на согласовании</option>
          <option value="published">Опубликованные</option>
          <option value="expired">Истекшие</option>
          <option value="archived">Архив</option>
        </select>
      </div>

      <form onSubmit={handleCreate} className="mb-8 grid grid-cols-2 gap-4 border border-line rounded-[var(--radius-md)] p-4">
        <div>
          <Label className="mb-1">Компания</Label>
          <select
            value={form.company_id}
            onChange={e => setForm({...form, company_id: e.target.value})}
            className={inputClass}
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
            required
          />
        </div>
        <div>
          <Label className="mb-1">Описание</Label>
          <Input
            type="text"
            value={form.description}
            onChange={e => setForm({...form, description: e.target.value})}
          />
        </div>
        <div>
          <Label className="mb-1">Тип скидки</Label>
          <select
            value={form.discount_type}
            onChange={e => setForm({...form, discount_type: e.target.value})}
            className={inputClass}
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
        <div>
          <Label className="mb-1">Статус</Label>
          <select
            value={form.status}
            onChange={e => setForm({...form, status: e.target.value})}
            className={inputClass}
          >
            <option value="draft">Черновик</option>
            <option value="pending_review">На модерации</option>
            <option value="pending_partner_approval">У партнёра на согласовании</option>
            <option value="published">Опубликовано</option>
            <option value="archived">Архив</option>
          </select>
        </div>
        <div className="col-span-2 flex gap-2">
          <Button type="submit">Создать предложение</Button>
        </div>
      </form>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-line">
              <th className="p-2 text-left text-eyebrow text-ink-faint font-normal">Название</th>
              <th className="p-2 text-left text-eyebrow text-ink-faint font-normal">Скидка</th>
              <th className="p-2 text-left text-eyebrow text-ink-faint font-normal">Компания</th>
              <th className="p-2 text-left text-eyebrow text-ink-faint font-normal">Теги</th>
              <th className="p-2 text-left text-eyebrow text-ink-faint font-normal">Статус</th>
              <th className="p-2 text-left text-eyebrow text-ink-faint font-normal">Причина</th>
              <th className="p-2 text-left text-eyebrow text-ink-faint font-normal">Действия</th>
            </tr>
          </thead>
          <tbody>
            {offers.map(offer => (
              <tr key={offer.id} className="border-b border-line align-top">
                <td className="p-2">
                  <button
                    onClick={() => setSelectedOfferId(offer.id)}
                    className="text-left text-ink hover:text-accent transition font-medium"
                  >
                    {offer.title}
                  </button>
                </td>
                <td className="p-2 text-ink-soft">{offer.discount_value}{offer.discount_type === 'percentage' ? '%' : ' ₽'}</td>
                <td className="p-2 text-ink-faint">{offer.company_id}</td>
                <td className="p-2">
                  <div className="flex flex-wrap gap-1">
                    {(offer.tags || []).map(tag => {
                      const isPending = pendingTagIDs.has(tag.id);
                      return (
                        <Badge
                          key={tag.id}
                          filled={isPending}
                          className="normal-case"
                        >
                          #{tag.name}
                        </Badge>
                      );
                    })}
                    {(!offer.tags || offer.tags.length === 0) && (
                      <span className="text-xs text-ink-faint">—</span>
                    )}
                  </div>
                </td>
                <td className="p-2">
                  <Badge filled={offer.status === 'published'}>
                    {STATUS_LABELS[offer.status] || offer.status}
                  </Badge>
                </td>
                <td className="p-2 text-xs text-danger">
                  {offer.rejection_reason || '—'}
                </td>
                <td className="p-2">
                  <div className="flex gap-2 flex-wrap">
                    <Button variant="ghost" onClick={() => setSelectedOfferId(offer.id)} className="text-xs px-3 py-1">
                      Открыть
                    </Button>
                    {(offer.status === 'published' || offer.status === 'expired') && (
                      <Button variant="ghost" onClick={() => handleArchive(offer.id)} className="text-xs px-3 py-1">
                        Архивировать
                      </Button>
                    )}
                    <button
                      onClick={() => handleDelete(offer.id)}
                      className="text-danger hover:underline text-xs px-1"
                    >
                      Удалить
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedOfferId && (
        <AdminOfferDetailModal
          offerId={selectedOfferId}
          onClose={() => setSelectedOfferId(null)}
          onUpdate={fetchData}
        />
      )}
    </div>
  );
};

export default AdminOffers;
