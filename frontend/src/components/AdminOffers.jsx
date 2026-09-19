import React, { useState, useEffect } from 'react';
import api from '../api/client';
import AdminOfferDetailModal from './AdminOfferDetailModal';

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

  if (loading) return <div>Загрузка...</div>;

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Предложения (модерация)</h2>
      <div className="mb-4 flex gap-2">
        <label className="text-sm">Фильтр по статусу:</label>
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="border rounded p-1 text-sm"
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

      <form onSubmit={handleCreate} className="mb-6 grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm">Компания</label>
          <select
            value={form.company_id}
            onChange={e => setForm({...form, company_id: e.target.value})}
            className="border p-2 rounded w-full"
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
            className="border p-2 rounded w-full"
            required
          />
        </div>
        <div>
          <label className="block text-sm">Описание</label>
          <input
            type="text"
            value={form.description}
            onChange={e => setForm({...form, description: e.target.value})}
            className="border p-2 rounded w-full"
          />
        </div>
        <div>
          <label className="block text-sm">Тип скидки</label>
          <select
            value={form.discount_type}
            onChange={e => setForm({...form, discount_type: e.target.value})}
            className="border p-2 rounded w-full"
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
            className="border p-2 rounded w-full"
            required
          />
        </div>
        <div>
          <label className="block text-sm">Начало</label>
          <input
            type="datetime-local"
            value={form.start_at}
            onChange={e => setForm({...form, start_at: e.target.value})}
            className="border p-2 rounded w-full"
            required
          />
        </div>
        <div>
          <label className="block text-sm">Окончание</label>
          <input
            type="datetime-local"
            value={form.end_at}
            onChange={e => setForm({...form, end_at: e.target.value})}
            className="border p-2 rounded w-full"
            required
          />
        </div>
        <div>
          <label className="block text-sm">Статус</label>
          <select
            value={form.status}
            onChange={e => setForm({...form, status: e.target.value})}
            className="border p-2 rounded w-full"
          >
            <option value="draft">Черновик</option>
            <option value="pending_review">На модерации</option>
          <option value="pending_partner_approval">У партнёра на согласовании</option>
            <option value="published">Опубликовано</option>
            <option value="archived">Архив</option>
          </select>
        </div>
        <div className="col-span-2 flex gap-2">
          <button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded">Создать предложение</button>
        </div>
      </form>

      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-gray-100">
            <th className="p-2 text-left">Название</th>
            <th className="p-2 text-left">Скидка</th>
            <th className="p-2 text-left">Компания</th>
            <th className="p-2 text-left">Теги</th>
            <th className="p-2 text-left">Статус</th>
            <th className="p-2 text-left">Причина</th>
            <th className="p-2 text-left">Действия</th>
          </tr>
        </thead>
        <tbody>
          {offers.map(offer => (
            <tr key={offer.id} className="border-b">
              <td className="p-2">
                <button
                  onClick={() => setSelectedOfferId(offer.id)}
                  className="text-left text-blue-600 hover:underline font-medium"
                >
                  {offer.title}
                </button>
              </td>
              <td className="p-2">{offer.discount_value}{offer.discount_type === 'percentage' ? '%' : ' ₽'}</td>
              <td className="p-2">{offer.company_id}</td>
              <td className="p-2">
                <div className="flex flex-wrap gap-1">
                  {(offer.tags || []).map(tag => {
                    const isPending = pendingTagIDs.has(tag.id);
                    return (
                      <span
                        key={tag.id}
                        title={isPending ? 'Новый тег — станет доступен после одобрения' : ''}
                        className={`inline-block px-2 py-0.5 rounded text-xs border ${
                          isPending
                            ? 'bg-yellow-100 text-yellow-800 border-yellow-400 font-semibold'
                            : 'bg-gray-100 text-gray-700 border-gray-300'
                        }`}
                      >
                        #{tag.name}
                        {isPending && ' ⚡'}
                      </span>
                    );
                  })}
                  {(!offer.tags || offer.tags.length === 0) && (
                    <span className="text-xs text-gray-400">—</span>
                  )}
                </div>
              </td>
              <td className="p-2">
                <span className={`px-2 py-1 rounded text-white text-sm ${
                  offer.status === 'published' ? 'bg-green-500' :
                  offer.status === 'pending_review' ? 'bg-yellow-500' :
                  offer.status === 'pending_partner_approval' ? 'bg-purple-500' :
                  offer.status === 'archived' ? 'bg-gray-500' :
                  offer.status === 'expired' ? 'bg-red-300' : 'bg-gray-400'
                }`}>
                  {offer.status}
                </span>
              </td>
              <td className="p-2 text-xs text-red-600">
                {offer.rejection_reason || '—'}
              </td>
              <td className="p-2 space-x-2">
                <button
                  onClick={() => setSelectedOfferId(offer.id)}
                  className="bg-blue-500 text-white px-2 py-1 rounded text-sm hover:bg-blue-600"
                >
                  Открыть
                </button>
                {(offer.status === 'published' || offer.status === 'expired') && (
                  <button
                    onClick={() => handleArchive(offer.id)}
                    className="bg-yellow-500 text-white px-2 py-1 rounded text-sm hover:bg-yellow-600"
                  >
                    Архивировать
                  </button>
                )}
                <button
                  onClick={() => handleDelete(offer.id)}
                  className="bg-red-600 text-white px-2 py-1 rounded text-sm hover:bg-red-700"
                >
                  Удалить
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

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
