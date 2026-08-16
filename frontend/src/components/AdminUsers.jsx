import React, { useState, useEffect } from 'react';
import api from '../api/client';
import UserStatsModal from './UserStatsModal';

const AdminUsers = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedUserId, setSelectedUserId] = useState(null);

  useEffect(() => {
    api.get('/admin/users')
      .then(res => setUsers(res.data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div>Загрузка...</div>;

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Пользователи</h2>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-100">
              <th className="p-2 text-left">ID</th>
              <th className="p-2 text-left">Email</th>
              <th className="p-2 text-left">Имя</th>
              <th className="p-2 text-left">Статус</th>
              <th className="p-2 text-right">Баланс</th>
              <th className="p-2 text-left">Действия</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user.id} className="border-b">
                <td className="p-2">{user.id}</td>
                <td className="p-2">{user.email}</td>
                <td className="p-2">{user.full_name}</td>
                <td className="p-2">{user.student_status}</td>
                <td className="p-2 text-right">{user.balance} ₽</td>
                <td className="p-2">
                  <button
                    onClick={() => setSelectedUserId(user.id)}
                    className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600 text-sm"
                  >
                    Детали
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {selectedUserId && (
        <UserStatsModal userId={selectedUserId} onClose={() => setSelectedUserId(null)} />
      )}
    </div>
  );
};

export default AdminUsers;
