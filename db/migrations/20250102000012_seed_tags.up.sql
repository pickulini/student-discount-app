INSERT INTO tags (name, slug) VALUES
  ('Еда', 'food'),
  ('Кофе', 'coffee'),
  ('Спорт', 'sport'),
  ('Развлечения', 'entertainment'),
  ('Кино', 'cinema'),
  ('Образование', 'education'),
  ('Книги', 'books'),
  ('Одежда', 'clothing'),
  ('Красота', 'beauty'),
  ('Путешествия', 'travel')
ON CONFLICT (slug) DO NOTHING;
