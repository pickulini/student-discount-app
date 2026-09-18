DROP INDEX IF EXISTS idx_tags_slug_lower;
DROP INDEX IF EXISTS idx_tags_status;
ALTER TABLE tags DROP CONSTRAINT IF EXISTS tags_status_check;
ALTER TABLE tags
    DROP COLUMN IF EXISTS created_by,
    DROP COLUMN IF EXISTS status;
