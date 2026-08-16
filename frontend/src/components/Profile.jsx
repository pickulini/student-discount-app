import React, { useState, useEffect } from 'react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

const Profile = () => {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyMessage, setVerifyMessage] = useState('');

  const fetchProfile = async () => {
    try {
      const res = await api.get('/users/me');
      setData(res.data);
    } catch (err) {
      console.error('Failed to load profile:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const handleRequestVerification = async () => {
    setVerifyLoading(true);
    setVerifyMessage('');
    try {
      const res = await api.post('/students/verify');
      setVerifyMessage(res.data.message || 'Заявка отправлена');
      fetchProfile();
    } catch (err) {
      setVerifyMessage(err.response?.data?.error || 'Ошибка отправки заявки');
    } finally {
      setVerifyLoading(false);
    }
  };

  if (loading) return <div className="text-center py-8">Загрузка...</div>;
  if (!data) return <div className="text-center py-8 text-red-500">Не удалось загрузить профиль</div>;

  const isVerified = data.student_status === 'verified';

  return (
    <div className="max-w-lg mx-auto bg-white p-6 rounded shadow">
      <h2 className="text-2xl font-bold mb-4">Профиль</h2>
      <div className="space-y-2">
        <p><strong>Имя:</strong> {data.full_name}</p>
        <p><strong>Email:</strong> {data.email}</p>
        <p><strong>Статус студента:</strong> 
          <span className={`ml-2 px-2 py-1 rounded text-white ${
            data.student_status === 'verified' ? 'bg-green-500' :
            data.student_status === 'pending' ? 'bg-yellow-500' : 'bg-red-500'
          }`}>
            {data.student_status}
          </span>
        </p>
        <p><strong>Реферальный код:</strong> <code className="bg-gray-100 px-2 py-1 rounded">{data.referral_code}</code></p>
        <p><strong>Баланс:</strong> {data.balance} ₽</p>
      </div>

      {!isVerified && (
        <div className="mt-4 border-t pt-4">
          <button
            onClick={handleRequestVerification}
            disabled={verifyLoading}
            className="w-full bg-blue-500 text-white py-2 rounded hover:bg-blue-600 disabled:opacity-50"
          >
            {verifyLoading ? 'Отправка...' : 'Запросить верификацию студента'}
          </button>
          {verifyMessage && (
            <p className={`mt-2 text-sm ${verifyMessage.includes('Ошибка') ? 'text-red-500' : 'text-green-600'}`}>
              {verifyMessage}
            </p>
          )}
          <p className="text-xs text-gray-500 mt-2">После отправки заявки администратор проверит её в админ-панели</p>
        </div>
      )}
    </div>
  );
};

export default Profile;
