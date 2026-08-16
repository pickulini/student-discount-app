import React, { useState, useEffect } from 'react';
import api from '../api/client';

const AdminUsers = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await api.get('/admin/users');
        setUsers(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        console.error('Failed to load users:', err);
        setUsers([]);
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
  }, []);

  if (loading) return <div className="text-center py-8">Загрузка...</div>;

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Пользователи</h2>
      {users.length === 0 ? (
        <p className="text-gray-500">Нет пользователей</p>
      ) : (
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-100">
              <th className="p-2 text-left">ID</th>
              <th className="p-2 text-left">Email</th>
              <th className="p-2 text-left">Имя</th>
              <th className="p-2 text-left">Статус студента</th>
              <th className="p-2 text-left">Баланс</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user.id} className="border-b">
                <td className="p-2">{user.id}</td>
                <td className="p-2">{user.email}</td>
                <td className="p-2">{user.full_name}</td>
                <td className="p-2">{user.student_status}</td>
                <td className="p-2">{user.balance} ₽</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default AdminUsers;
