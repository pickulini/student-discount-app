DROP INDEX IF EXISTS idx_users_username;
ALTER TABLE users
  DROP COLUMN IF EXISTS nickname,
  DROP COLUMN IF EXISTS username,
  DROP COLUMN IF EXISTS avatar_url;
