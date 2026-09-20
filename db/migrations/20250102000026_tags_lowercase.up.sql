-- 1. Мержим дубли по LOWER(name): оставляем минимальный id, переносим offer_tags
WITH dups AS (
    SELECT LOWER(name) AS lname, MIN(id) AS keep_id, ARRAY_AGG(id) AS all_ids
    FROM tags
    GROUP BY LOWER(name)
    HAVING COUNT(*) > 1
)
UPDATE offer_tags ot
SET tag_id = d.keep_id
FROM dups d
WHERE ot.tag_id = ANY(d.all_ids) AND ot.tag_id <> d.keep_id;

-- 2. Удаляем задублированные теги (оставляем keep_id)
WITH dups AS (
    SELECT LOWER(name) AS lname, MIN(id) AS keep_id
    FROM tags
    GROUP BY LOWER(name)
    HAVING COUNT(*) > 1
)
DELETE FROM tags
WHERE id IN (
    SELECT t.id
    FROM tags t
    JOIN dups d ON LOWER(t.name) = d.lname
    WHERE t.id <> d.keep_id
);

-- 3. Все name → lowercase
UPDATE tags SET name = LOWER(name);

-- 4. Гарантия: индекс на lower(name) уникальный? Нет, разные имена могут совпадать.
-- Но добавим индекс для быстрого поиска по lower(name)
CREATE INDEX IF NOT EXISTS idx_tags_name_lower ON tags(LOWER(name));
