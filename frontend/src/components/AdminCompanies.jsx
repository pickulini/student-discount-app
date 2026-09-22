import React, { useState, useEffect } from 'react';
import api from '../api/client';
import { PageTitle, Eyebrow, Button, Input, Label, Badge } from '../design/UI';
import { RouteLoadingView } from '../design/DottedPath';

const AdminCompanies = () => {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: '', description: '', is_active: true });

  const fetchCompanies = async () => {
    try { const res = await api.get('/admin/companies'); setCompanies(res.data || []); } catch(e) {}
    finally { setLoading(false); }
  };
  useEffect(() => { fetchCompanies(); }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    try { await api.post('/admin/companies', form); setForm({ name: '', description: '', is_active: true }); fetchCompanies(); } catch(e) { alert('Ошибка создания'); }
  };
  const handleDelete = async (id) => {
    if (!confirm('Удалить компанию?')) return;
    try { await api.delete(`/admin/companies?id=${id}`); fetchCompanies(); } catch(e) { alert('Ошибка удаления'); }
  };

  if (loading) return <RouteLoadingView label="Загрузка компаний..." />;
  return (
    <div>
      <PageTitle>Компании</PageTitle>
      <form onSubmit={handleCreate} className="mb-6 flex gap-4 flex-wrap items-end">
        <div>
          <Label className="mb-1">Название</Label>
          <Input type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-56" required />
        </div>
        <div>
          <Label className="mb-1">Описание</Label>
          <Input type="text" value={form.description} onChange={e => setForm({...form, description: e.target.value})} className="w-56" />
        </div>
        <div className="flex items-center gap-2 pb-2.5">
          <input type="checkbox" checked={form.is_active} onChange={e => setForm({...form, is_active: e.target.checked})} id="company-active" />
          <label htmlFor="company-active" className="text-sm text-ink-soft">Активна</label>
        </div>
        <Button type="submit">Создать</Button>
      </form>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-line">
            <th className="p-2 text-left text-eyebrow text-ink-faint font-normal">ID</th>
            <th className="p-2 text-left text-eyebrow text-ink-faint font-normal">Название</th>
            <th className="p-2 text-left text-eyebrow text-ink-faint font-normal">Описание</th>
            <th className="p-2 text-left text-eyebrow text-ink-faint font-normal">Активна</th>
            <th className="p-2 text-left text-eyebrow text-ink-faint font-normal">Действия</th>
          </tr>
        </thead>
        <tbody>
          {companies.map(c => (
            <tr key={c.id} className="border-b border-line">
              <td className="p-2 text-ink-faint">{c.id}</td>
              <td className="p-2 text-ink">{c.name}</td>
              <td className="p-2 text-ink-soft">{c.description}</td>
              <td className="p-2">
                <Badge filled={c.is_active}>{c.is_active ? 'Активна' : 'Неактивна'}</Badge>
              </td>
              <td className="p-2">
                <button onClick={() => handleDelete(c.id)} className="text-danger hover:underline text-sm">Удалить</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default AdminCompanies;
