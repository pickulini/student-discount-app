import React from 'react';
import { Button, Eyebrow } from '../design/UI';

const FIELD_LABELS = {
  title: 'Название',
  description: 'Описание',
  discount_type: 'Тип скидки',
  discount_value: 'Значение скидки',
  special_price: 'Спец. цена',
  start_at: 'Начало',
  end_at: 'Окончание',
  bonus_allowed: 'Бонусы разрешены',
  max_bonus_percent: 'Макс. % бонусов',
  max_uses: 'Лимит использований',
  address: 'Адрес',
  phone: 'Телефон',
  website: 'Сайт',
  working_hours: 'Часы работы',
  image_url: 'Обложка',
};

const formatValue = (field, val, offer) => {
  if (val === null || val === undefined || val === '') return '—';
  switch (field) {
    case 'start_at':
    case 'end_at':
      try { return new Date(val).toLocaleString('ru-RU'); } catch { return String(val); }
    case 'bonus_allowed':
      return val === true || val === 'true' ? 'Да' : 'Нет';
    case 'discount_type':
      return val === 'percentage' ? 'Процент' : 'Фиксированная';
    case 'discount_value':
      return offer?.discount_type === 'percentage' ? `${val}%` : `${val} ₽`;
    case 'special_price':
      return `${val} ₽`;
    case 'max_bonus_percent':
      return `${val}%`;
    default:
      return String(val);
  }
};

const AdminEditDiffModal = ({ offer, onClose, onAccept, onReject }) => {
  if (!offer) return null;

  const adminData = offer.admin_edited_data || {};
  const diffs = [];

  Object.keys(FIELD_LABELS).forEach((field) => {
    const newVal = adminData[field];
    const oldVal = offer[field];

    // Нормализуем для сравнения
    const normalize = (v) => {
      if (v === null || v === undefined || v === '') return '';
      if (typeof v === 'boolean') return v ? 'true' : 'false';
      return String(v);
    };

    if (normalize(newVal) === normalize(oldVal)) return;
    if (newVal === undefined) return;

    diffs.push({
      field,
      label: FIELD_LABELS[field],
      oldValue: oldVal,
      newValue: newVal,
    });
  });

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-surface border border-line rounded-[var(--radius-lg)] max-w-3xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="p-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="text-editorial text-2xl text-ink uppercase">Правки от администратора</h2>
              <p className="text-sm text-ink-soft mt-1">{offer.title}</p>
            </div>
            <button onClick={onClose} className="text-ink-faint hover:text-ink text-2xl leading-none">✕</button>
          </div>

          {offer.admin_edit_comment && (
            <div className="bg-surface-2 border border-line rounded-[var(--radius-sm)] p-3 mb-4 text-sm text-ink">
              <strong>Комментарий администратора:</strong>
              <div className="mt-1 whitespace-pre-line text-ink-soft">{offer.admin_edit_comment}</div>
            </div>
          )}

          {diffs.length === 0 ? (
            <div className="border border-line rounded-[var(--radius-sm)] p-6 text-center text-ink-faint">
              Администратор не изменил ни одного поля (только комментарий).
            </div>
          ) : (
            <div className="space-y-3">
              <Eyebrow>Изменённые поля ({diffs.length})</Eyebrow>
              {diffs.map((d) => (
                <div key={d.field} className="border border-line rounded-[var(--radius-sm)] overflow-hidden">
                  <div className="bg-surface-2 border-b border-line px-3 py-1 text-xs font-semibold text-ink-soft">
                    {d.label}
                  </div>
                  <div className="grid grid-cols-2 divide-x divide-line">
                    <div className="p-3">
                      <div className="text-xs text-ink-faint mb-1">Было</div>
                      {d.field === 'image_url' && d.oldValue ? (
                        <img src={d.oldValue} alt="" className="max-h-32 rounded-[var(--radius-xs)] object-cover" />
                      ) : (
                        <div className="text-sm text-danger line-through break-words">
                          {formatValue(d.field, d.oldValue, offer)}
                        </div>
                      )}
                    </div>
                    <div className="p-3">
                      <div className="text-xs text-ink-faint mb-1">Стало</div>
                      {d.field === 'image_url' && d.newValue ? (
                        <img src={d.newValue} alt="" className="max-h-32 rounded-[var(--radius-xs)] object-cover" />
                      ) : (
                        <div className="text-sm text-accent font-medium break-words">
                          {formatValue(d.field, d.newValue, offer)}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-6 flex gap-3">
            <Button onClick={() => onAccept(offer.id)} className="flex-1">
              Согласовать и опубликовать
            </Button>
            <Button variant="danger" onClick={() => onReject(offer.id)} className="flex-1">
              Отклонить правки
            </Button>
            <Button variant="ghost" onClick={onClose}>
              Закрыть
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminEditDiffModal;
