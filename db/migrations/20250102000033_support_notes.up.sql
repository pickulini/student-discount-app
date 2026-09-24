-- Служебные заметки в обращениях (A09): видит только поддержка.
ALTER TABLE support_messages ADD COLUMN IF NOT EXISTS is_note BOOLEAN NOT NULL DEFAULT FALSE;
