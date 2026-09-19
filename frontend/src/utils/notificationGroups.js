export const NOTIFICATION_GROUPS = {
  friends: {
    key: 'friends',
    label: 'Заявки в друзья',
    shortLabel: 'Друзья',
    icon: '👥',
    color: 'blue',
    types: ['friend_request'],
  },
  friend_responses: {
    key: 'friend_responses',
    label: 'Ответы на заявки',
    shortLabel: 'Заявки',
    icon: '✉️',
    color: 'green',
    types: ['friend_accepted', 'friend_rejected'],
  },
  events: {
    key: 'events',
    label: 'Ивенты',
    shortLabel: 'Ивенты',
    icon: '📅',
    color: 'purple',
    types: ['new_event', 'friend_going', 'event_pending_review'],
  },
  offers: {
    key: 'offers',
    label: 'Офферы',
    shortLabel: 'Офферы',
    icon: '🎁',
    color: 'yellow',
    types: [
      'new_offer',
      'offer_pending_review',
      'offer_admin_edited',
      'offer_partner_accepted',
      'offer_partner_rejected',
    ],
  },
  support: {
    key: 'support',
    label: 'Поддержка',
    shortLabel: 'Поддержка',
    icon: '💬',
    color: 'indigo',
    types: ['support_message', 'support_reply', 'new_support_ticket'],
  },
  system: {
    key: 'system',
    label: 'Система',
    shortLabel: 'Система',
    icon: '⚙️',
    color: 'gray',
    types: ['verification_done', 'verification_pending', 'order_paid', 'order_refunded'],
  },
};

export const GROUP_ORDER = ['friends', 'friend_responses', 'events', 'offers', 'support', 'system'];

export const getGroupKeyForType = (type) => {
  for (const [key, group] of Object.entries(NOTIFICATION_GROUPS)) {
    if (group.types.includes(type)) return key;
  }
  return 'system';
};

export const groupNotifications = (items) => {
  const result = {};
  GROUP_ORDER.forEach((key) => { result[key] = []; });
  items.forEach((n) => {
    const gk = getGroupKeyForType(n.type);
    if (!result[gk]) result[gk] = [];
    result[gk].push(n);
  });
  return result;
};

export const GROUPING_THRESHOLD = 5;

export const timeAgo = (iso) => {
  const d = new Date(iso);
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 60) return 'только что';
  if (diff < 3600) return `${Math.floor(diff / 60)} мин назад`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} ч назад`;
  if (diff < 604800) return `${Math.floor(diff / 86400)} дн назад`;
  return d.toLocaleDateString('ru-RU');
};
