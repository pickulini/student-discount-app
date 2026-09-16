import React, { useState, useEffect } from 'react';
import api from '../api/client';

const MerchantOffers = () => {
  const [offers, setOffers] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [tags, setTags] = useState([]);
  const [selectedTagIDs, setSelectedTagIDs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    company_id: '',
    title: '',
    description: '',
    discount_type: 'percentage',
    discount_value: 10,
    start_at: '',
    end_at: '',
    bonus_allowed: false,
    max_bonus_percent: 20,
  });

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

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await api.post('/merchant/offers', form);
      setShowCreate(false);
      setSelectedTagIDs([]);
      setForm({
        company_id: '',
        title: '',
        description: '',
        discount_type: 'percentage',
        discount_value: 10,
        start_at: '',
        end_at: '',
        bonus_allowed: false,
        max_bonus_percent: 20,
      });
      fetchData();
    } catch (err) {
      alert('Ошибка создания предложения');
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
          onClick={() => setShowCreate(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Создать предложение
        </button>
      </div>

      {showCreate && (
        <div className="bg-gray-50 p-4 rounded shadow mb-6">
          <h3 className="text-lg font-semibold mb-2">Новое предложение</h3>
          <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                required
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm">Описание</label>
              <textarea
                value={form.description}
                onChange={e => setForm({...form, description: e.target.value})}
                className="w-full border p-2 rounded"
                rows="2"
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
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm mb-1">Теги (хештеги)</label>
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
              <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">Создать</button>
              <button type="button" onClick={() => setShowCreate(false)} className="bg-gray-300 px-4 py-2 rounded hover:bg-gray-400">Отмена</button>
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
                  o.status === 'pending_review' ? 'bg-yellow-500' : 'bg-gray-500'
                }`}>
                  {o.status}
                </span>
              </td>
              <td className="p-2">
                {o.status === 'draft' && (
                  <button
                    onClick={() => handleSubmitForReview(o.id)}
                    className="bg-blue-500 text-white px-2 py-1 rounded text-sm hover:bg-blue-600"
                  >
                    Отправить на модерацию
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
