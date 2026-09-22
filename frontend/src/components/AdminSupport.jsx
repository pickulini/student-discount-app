import React, { useState, useEffect } from 'react';
import api from '../api/client';
import UserStatsModal from './UserStatsModal';
import { useNotifications } from '../context/NotificationContext';
import { PageTitle, Eyebrow, Button, Input, Card } from '../design/UI';
import { TrailDivider } from '../design/DottedPath';

const AdminSupport = () => {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [status, setStatus] = useState('');
  const [statsUserId, setStatsUserId] = useState(null);
  const { events, reconnectCount } = useNotifications(true);

  const fetchTickets = async () => {
    try {
      const res = await api.get('/admin/support/tickets');
      setTickets(res.data || []);
    } catch (err) {
      console.error('Failed to load tickets:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (ticketId) => {
    try {
      const res = await api.get(`/support/tickets/${ticketId}/messages`);
      setMessages(res.data || []);
    } catch (err) {
      console.error('Failed to load messages:', err);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, []);

  // realtime: support_message -> обновить открытый тикет и список
  useEffect(() => {
    if (!events.support_message) return;
    const payload = events.support_message.payload;
    if (selectedTicket && payload.ticket_id === selectedTicket.id) {
      fetchMessages(selectedTicket.id);
    }
    fetchTickets();
  }, [events.support_message]);

  // realtime: new_support_ticket -> обновить список
  useEffect(() => {
    if (!events.new_support_ticket) return;
    fetchTickets();
  }, [events.new_support_ticket]);

  // При переподключении SSE — перечитываем всё
  useEffect(() => {
    if (reconnectCount === 0) return;
    fetchTickets();
    if (selectedTicket) {
      fetchMessages(selectedTicket.id);
    }
  }, [reconnectCount]);

  const openTicket = (ticket) => {
    setSelectedTicket(ticket);
    setStatus(ticket.status);
    fetchMessages(ticket.id);
  };

  const handleUpdateStatus = async () => {
    if (!selectedTicket) return;
    try {
      await api.put(`/admin/support/tickets/${selectedTicket.id}/status`, { status });
      fetchTickets();
      setSelectedTicket({ ...selectedTicket, status });
    } catch (err) {
      alert('Ошибка обновления статуса');
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedTicket) return;
    try {
      await api.post(`/admin/support/tickets/${selectedTicket.id}/messages`, { message: newMessage });
      setNewMessage('');
      fetchMessages(selectedTicket.id);
    } catch (err) {
      alert('Ошибка отправки сообщения');
    }
  };

  if (loading) return <div className="text-ink-soft">Загрузка...</div>;

  return (
    <div>
      <PageTitle>Обращения в поддержку</PageTitle>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="md:col-span-1 p-3">
          <Eyebrow className="mb-2">Все обращения</Eyebrow>
          {tickets.length === 0 ? (
            <p className="text-ink-faint text-sm">Нет обращений</p>
          ) : (
            <ul>
              {tickets.map((t, i) => (
                <React.Fragment key={t.id}>
                  <li
                    className={`py-2 px-2 rounded-[var(--radius-xs)] ${selectedTicket?.id === t.id ? 'bg-surface-2' : 'hover:bg-surface-2'}`}
                  >
                    <div
                      onClick={() => openTicket(t)}
                      className="cursor-pointer"
                    >
                      <div className="font-medium text-sm text-ink">{t.subject}</div>
                      <div className="text-xs text-ink-faint">
                        Пользователь #{t.user_id} • Статус: {t.status}
                      </div>
                    </div>
                  </li>
                  {i < tickets.length - 1 && <TrailDivider />}
                </React.Fragment>
              ))}
            </ul>
          )}
        </Card>

        <Card className="md:col-span-2 p-3">
          {selectedTicket ? (
            <>
              <div className="flex justify-between items-center flex-wrap gap-2">
                <div>
                  <h4 className="font-semibold text-ink">{selectedTicket.subject}</h4>
                  <p className="text-xs text-ink-faint">Пользователь #{selectedTicket.user_id}</p>
                </div>
                <div className="flex gap-2 items-center">
                  <Button variant="ghost" onClick={() => setStatsUserId(selectedTicket.user_id)} className="text-xs px-3 py-1.5">
                    Статистика пользователя
                  </Button>
                  <select
                    value={status}
                    onChange={e => setStatus(e.target.value)}
                    className="bg-surface border border-line rounded-[var(--radius-xs)] p-1.5 text-sm text-ink"
                  >
                    <option value="open">Открыт</option>
                    <option value="in_progress">В работе</option>
                    <option value="resolved">Решён</option>
                    <option value="closed">Закрыт</option>
                  </select>
                  <Button onClick={handleUpdateStatus} className="text-xs px-3 py-1.5">
                    Обновить статус
                  </Button>
                </div>
              </div>

              <div className="border border-line rounded-[var(--radius-sm)] p-3 h-64 overflow-y-auto bg-surface-2 mt-3">
                {messages.map(m => (
                  <div key={m.id} className={`mb-2 ${m.is_internal ? 'border-l-2 border-accent pl-2' : m.user_id === selectedTicket.user_id ? 'text-right' : ''}`}>
                    <div className={`inline-block p-2 rounded-[var(--radius-sm)] ${m.is_internal ? 'text-ink-soft' : m.user_id === selectedTicket.user_id ? 'bg-accent/10 text-ink' : 'bg-surface border border-line text-ink'}`}>
                      <div className="text-sm">{m.message}</div>
                      <div className="text-xs text-ink-faint">{new Date(m.created_at).toLocaleString()}</div>
                    </div>
                  </div>
                ))}
              </div>

              <form onSubmit={handleSendMessage} className="mt-3 flex gap-2">
                <Input
                  type="text"
                  value={newMessage}
                  onChange={e => setNewMessage(e.target.value)}
                  placeholder="Ответ..."
                  className="flex-1"
                />
                <Button type="submit">
                  Отправить
                </Button>
              </form>
            </>
          ) : (
            <p className="text-ink-faint text-center py-8">Выберите обращение</p>
          )}
        </Card>
      </div>

      {/* Модалка статистики пользователя */}
      {statsUserId && (
        <UserStatsModal userId={statsUserId} onClose={() => setStatsUserId(null)} />
      )}
    </div>
  );
};

export default AdminSupport;
