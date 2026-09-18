ALTER TABLE tags
    ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active',
    ADD COLUMN IF NOT EXISTS created_by BIGINT REFERENCES users(id) ON DELETE SET NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'tags_status_check'
    ) THEN
        ALTER TABLE tags ADD CONSTRAINT tags_status_check
            CHECK (status IN ('pending', 'active', 'rejected'));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE tablename = 'tags' AND indexdef LIKE '%UNIQUE%slug%'
    ) THEN
        ALTER TABLE tags ADD CONSTRAINT tags_slug_unique UNIQUE (slug);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_tags_status ON tags(status);
