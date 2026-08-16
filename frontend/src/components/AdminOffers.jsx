import React, { useState, useEffect } from 'react';
import api from '../api/client';

const AdminOffers = () => {
  const [offers, setOffers] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    company_id: '',
    title: '',
    description: '',
    discount_type: 'percentage',
    discount_value: 10,
    start_at: '',
    end_at: '',
    status: 'draft',
    bonus_allowed: false,
    max_bonus_percent: 20,
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [offersRes, companiesRes] = await Promise.all([
        api.get('/admin/offers'),
        api.get('/admin/companies'),
      ]);
      setOffers(offersRes.data || []);
      setCompanies(companiesRes.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...form,
        start_at: form.start_at ? new Date(form.start_at).toISOString() : '',
        end_at: form.end_at ? new Date(form.end_at).toISOString() : '',
        company_id: parseInt(form.company_id),
        discount_value: parseFloat(form.discount_value),
        max_bonus_percent: parseInt(form.max_bonus_percent || 0),
      };
      await api.post('/admin/offers', payload);
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
      alert('Ошибка удаления');
    }
  };

  const handleModerate = async (id, action) => {
    try {
      await api.put(`/admin/offers/${id}/moderate`, { action });
      fetchData();
    } catch (err) {
      alert('Ошибка модерации');
    }
  };

  if (loading) return <div>Загрузка...</div>;

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Предложения (модерация)</h2>
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
            <option value="published">Опубликовано</option>
            <option value="archived">Архив</option>
          </select>
        </div>
        <div className="col-span-2">
          <button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded">Создать предложение</button>
        </div>
      </form>
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-gray-100">
            <th className="p-2 text-left">Название</th>
            <th className="p-2 text-left">Скидка</th>
            <th className="p-2 text-left">Компания</th>
            <th className="p-2 text-left">Статус</th>
            <th className="p-2 text-left">Действия</th>
          </tr>
        </thead>
        <tbody>
          {offers.map(offer => (
            <tr key={offer.id} className="border-b">
              <td className="p-2">{offer.title}</td>
              <td className="p-2">{offer.discount_value}{offer.discount_type === 'percentage' ? '%' : ' ₽'}</td>
              <td className="p-2">{offer.company_id}</td>
              <td className="p-2">
                <span className={`px-2 py-1 rounded text-white text-sm ${
                  offer.status === 'published' ? 'bg-green-500' :
                  offer.status === 'pending_review' ? 'bg-yellow-500' : 'bg-gray-500'
                }`}>
                  {offer.status}
                </span>
              </td>
              <td className="p-2 space-x-2">
                {offer.status === 'pending_review' && (
                  <>
                    <button
                      onClick={() => handleModerate(offer.id, 'publish')}
                      className="bg-green-500 text-white px-2 py-1 rounded text-sm hover:bg-green-600"
                    >
                      Опубликовать
                    </button>
                    <button
                      onClick={() => handleModerate(offer.id, 'reject')}
                      className="bg-red-500 text-white px-2 py-1 rounded text-sm hover:bg-red-600"
                    >
                      Отклонить
                    </button>
                  </>
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
    </div>
  );
};

export default AdminOffers;
