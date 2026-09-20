/**
 * Преобразует RRULE-строку в человекочитаемый текст на русском.
 */
export const formatRecurrence = (rule, until) => {
  if (!rule) return null;

  let text = '';
  if (rule.includes('FREQ=DAILY')) text = 'Ежедневно';
  else if (rule.includes('FREQ=WEEKLY')) text = 'Еженедельно';
  else if (rule.includes('FREQ=MONTHLY')) text = 'Ежемесячно';
  else if (rule.includes('FREQ=YEARLY')) text = 'Ежегодно';
  else return 'Повторяется';

  if (until) {
    const d = new Date(until);
    text += ' до ' + d.toLocaleDateString('ru-RU', {
      day: 'numeric', month: 'long', year: 'numeric',
    });
  }

  return text;
};

export const isRecurring = (offer) => !!(offer && offer.recurrence_rule);
