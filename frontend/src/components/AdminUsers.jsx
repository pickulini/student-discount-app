import React, { useState, useEffect } from 'react';
import api from '../api/client';
import UserStatsModal from './UserStatsModal';
import UniversityPickerModal from './UniversityPickerModal';
import { PageTitle, Button, Caption } from '../design/UI';
import { RouteLoadingView } from '../design/DottedPath';

const AdminUsers = () => {
  const [users, setUsers] = useState([]);
  const [universities, setUniversities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [editingUniversityUserId, setEditingUniversityUserId] = useState(null);

  const fetchUsers = () => {
    setLoading(true);
    api.get('/admin/users')
      .then(res => setUsers(res.data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchUsers();
    api.get('/universities')
      .then(res => setUniversities(res.data || []))
      .catch(console.error);
  }, []);

  if (loading) return <RouteLoadingView label="Загрузка пользователей..." />;

  return (
    <div>
      <PageTitle>Пользователи</PageTitle>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-line">
              <th className="p-2 text-left text-eyebrow text-ink-faint font-normal">ID</th>
              <th className="p-2 text-left text-eyebrow text-ink-faint font-normal">Email</th>
              <th className="p-2 text-left text-eyebrow text-ink-faint font-normal">Имя</th>
              <th className="p-2 text-left text-eyebrow text-ink-faint font-normal">Статус</th>
              <th className="p-2 text-left text-eyebrow text-ink-faint font-normal">Вуз</th>
              <th className="p-2 text-right text-eyebrow text-ink-faint font-normal">Баланс</th>
              <th className="p-2 text-left text-eyebrow text-ink-faint font-normal">Действия</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user.id} className="border-b border-line">
                <td className="p-2 text-ink-faint">{user.id}</td>
                <td className="p-2 text-ink">{user.email}</td>
                <td className="p-2 text-ink">{user.full_name}</td>
                <td className="p-2 text-ink-soft">{user.student_status}</td>
                <td className="p-2">
                  <button
                    onClick={() => setEditingUniversityUserId(user.id)}
                    className="text-left text-ink-soft hover:text-accent transition"
                    title="Изменить вуз"
                  >
                    {user.university_name || <span className="text-ink-faint">—</span>}
                  </button>
                </td>
                <td className="p-2 text-right"><Caption>{user.balance} ₽</Caption></td>
                <td className="p-2">
                  <Button variant="ghost" onClick={() => setSelectedUserId(user.id)} className="text-xs px-3 py-1">
                    Детали
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedUserId && (
        <UserStatsModal userId={selectedUserId} onClose={() => setSelectedUserId(null)} />
      )}

      {editingUniversityUserId && (
        <UniversityPickerModal
          userId={editingUniversityUserId}
          currentUniversityId={
            users.find(u => u.id === editingUniversityUserId)?.university_id
          }
          universities={universities}
          onClose={() => setEditingUniversityUserId(null)}
          onSaved={fetchUsers}
        />
      )}
    </div>
  );
};

export default AdminUsers;
