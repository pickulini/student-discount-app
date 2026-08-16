import React, { useState, useEffect } from 'react';
import api from '../api/client';

const AdminCompanies = () => {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: '', description: '', is_active: true });

  useEffect(() => {
    fetchCompanies();
  }, []);

  const fetchCompanies = async () => {
    try {
      const res = await api.get('/admin/companies');
      setCompanies(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Failed to load companies:', err);
      setCompanies([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await api.post('/admin/companies', form);
      setForm({ name: '', description: '', is_active: true });
      fetchCompanies();
    } catch (err) {
      alert('Ошибка создания компании');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Удалить компанию?')) return;
    try {
      await api.delete(`/admin/companies?id=${id}`);
      fetchCompanies();
    } catch (err) {
      alert('Ошибка удаления');
    }
  };

  if (loading) return <div>Загрузка...</div>;

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Компании</h2>
      <form onSubmit={handleCreate} className="mb-6 flex gap-2 flex-wrap items-end">
        <div>
          <label className="block text-sm">Название</label>
          <input
            type="text"
            value={form.name}
            onChange={e => setForm({...form, name: e.target.value})}
            className="border p-2 rounded"
            required
          />
        </div>
        <div>
          <label className="block text-sm">Описание</label>
          <input
            type="text"
            value={form.description}
            onChange={e => setForm({...form, description: e.target.value})}
            className="border p-2 rounded"
          />
        </div>
        <div>
          <label className="block text-sm">Активна</label>
          <input
            type="checkbox"
            checked={form.is_active}
            onChange={e => setForm({...form, is_active: e.target.checked})}
          />
        </div>
        <button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded">Создать</button>
      </form>
      {companies.length === 0 ? (
        <p className="text-gray-500">Нет компаний</p>
      ) : (
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-100">
              <th className="p-2 text-left">ID</th>
              <th className="p-2 text-left">Название</th>
              <th className="p-2 text-left">Описание</th>
              <th className="p-2 text-left">Активна</th>
              <th className="p-2 text-left">Действия</th>
            </tr>
          </thead>
          <tbody>
            {companies.map(comp => (
              <tr key={comp.id} className="border-b">
                <td className="p-2">{comp.id}</td>
                <td className="p-2">{comp.name}</td>
                <td className="p-2">{comp.description}</td>
                <td className="p-2">{comp.is_active ? '✅' : '❌'}</td>
                <td className="p-2">
                  <button onClick={() => handleDelete(comp.id)} className="text-red-500">Удалить</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default AdminCompanies;
