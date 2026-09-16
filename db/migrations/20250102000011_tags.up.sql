CREATE TABLE IF NOT EXISTS tags (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS offer_tags (
    offer_id BIGINT NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
    tag_id BIGINT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (offer_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_offer_tags_offer_id ON offer_tags(offer_id);
CREATE INDEX IF NOT EXISTS idx_offer_tags_tag_id ON offer_tags(tag_id);
