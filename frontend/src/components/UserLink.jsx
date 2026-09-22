import React from 'react';
import { Link } from 'react-router-dom';

/**
 * Рендерит @username как ссылку на публичный профиль.
 * Если username отсутствует — показывает fallback (nickname/full_name/id).
 *
 * <UserLink username="artem_x" />
 * <UserLink username="artem_x" showAt={false} label="Артём" />
 */
export default function UserLink({
  username,
  label,
  showAt = true,
  className = '',
  onClick,
}) {
  const text = label || (username ? `@${username}` : '—');

  if (!username) {
    return <span className={`text-ink-faint ${className}`}>{text}</span>;
  }

  const display = label ? label : (showAt ? `@${username}` : username);

  return (
    <Link
      to={`/@${username}`}
      onClick={(e) => {
        if (onClick) onClick(e);
      }}
      className={`text-accent hover:underline ${className}`}
    >
      {display}
    </Link>
  );
}
