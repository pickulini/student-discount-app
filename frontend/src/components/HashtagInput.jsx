import React, { useState, useEffect, useRef } from 'react';
import api from '../api/client';

const MAX_TAGS = 5;

export default function HashtagInput({ value = [], onChange, placeholder = 'Введите хештег и нажмите Enter' }) {
  const [input, setInput] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [popular, setPopular] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const wrapperRef = useRef(null);

  // Загружаем популярные теги один раз
  useEffect(() => {
    api.get('/tags/popular?limit=12')
      .then(res => setPopular(res.data || []))
      .catch(console.error);
  }, []);

  // Автодополнение с debounce
  useEffect(() => {
    const q = input.trim().replace(/^#/, '');
    if (q.length < 1) {
      setSuggestions([]);
      return;
    }
    const t = setTimeout(() => {
      api.get(`/tags/search?q=${encodeURIComponent(q)}&limit=8`)
        .then(res => setSuggestions(res.data || []))
        .catch(() => setSuggestions([]));
    }, 200);
    return () => clearTimeout(t);
  }, [input]);

  // Закрытие по клику вне
  useEffect(() => {
    const onClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const normalize = (s) => s.trim().replace(/^#+/, '').trim().toLowerCase();

  const addTag = (raw) => {
    const t = normalize(raw);
    if (!t) return;
    if (value.length >= MAX_TAGS) {
      alert(`Максимум ${MAX_TAGS} хештегов`);
      return;
    }
    if (value.some(v => v.toLowerCase() === t.toLowerCase())) {
      setInput('');
      setShowSuggestions(false);
      return;
    }
    onChange([...value, t]);
    setInput('');
    setShowSuggestions(false);
  };

  const removeTag = (t) => {
    onChange(value.filter(v => v !== t));
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',' || e.key === ' ') {
      e.preventDefault();
      addTag(input);
    } else if (e.key === 'Backspace' && !input && value.length > 0) {
      removeTag(value[value.length - 1]);
    }
  };

  const isSelected = (name) => value.some(v => v.toLowerCase() === name.toLowerCase());

  return (
    <div ref={wrapperRef} className="relative">
      {/* Чипы + input */}
      <div className="border border-line rounded-[var(--radius-sm)] p-2 flex flex-wrap gap-1 items-center bg-surface focus-within:border-accent transition">
        {value.map(t => (
          <span
            key={t}
            className="inline-flex items-center gap-1 bg-accent/10 text-accent px-2 py-0.5 rounded-[var(--radius-xs)] text-sm"
          >
            #{t}
            <button
              type="button"
              onClick={() => removeTag(t)}
              className="hover:text-accent-ink font-bold"
            >
              ×
            </button>
          </span>
        ))}
        <input
          type="text"
          value={input}
          onChange={(e) => { setInput(e.target.value); setShowSuggestions(true); }}
          onKeyDown={handleKeyDown}
          onFocus={() => setShowSuggestions(true)}
          placeholder={value.length === 0 ? placeholder : ''}
          className="flex-1 min-w-[100px] outline-none text-sm bg-transparent text-ink placeholder:text-ink-faint"
          maxLength={50}
        />
      </div>

      <p className="text-xs text-ink-faint mt-1">
        {value.length}/{MAX_TAGS} · разделяйте пробелом, запятой или Enter
      </p>

      {/* Дропдаун с предложениями */}
      {showSuggestions && (suggestions.length > 0 || (input.length === 0 && popular.length > 0)) && (
        <div className="absolute z-10 mt-1 w-full bg-surface border border-line rounded-[var(--radius-sm)] shadow-2xl max-h-64 overflow-y-auto">
          {suggestions.length > 0 ? (
            <>
              <div className="px-3 py-1 text-xs text-ink-faint border-b border-line bg-surface-2">Совпадения</div>
              {suggestions.map(s => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => addTag(s.name)}
                  disabled={isSelected(s.name)}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-surface-2 transition ${
                    isSelected(s.name) ? 'text-ink-faint cursor-not-allowed' : 'text-ink'
                  }`}
                >
                  #{s.name}
                  <span className="text-xs text-ink-faint ml-2">({s.slug})</span>
                </button>
              ))}
            </>
          ) : (
            <>
              <div className="px-3 py-1 text-xs text-ink-faint border-b border-line bg-surface-2">
                Популярные теги
              </div>
              <div className="p-2 flex flex-wrap gap-1">
                {popular.map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => addTag(p.name)}
                    disabled={isSelected(p.name)}
                    className={`px-2 py-1 rounded-[var(--radius-xs)] text-xs border transition ${
                      isSelected(p.name)
                        ? 'bg-surface-2 text-ink-faint cursor-not-allowed border-line'
                        : 'bg-surface hover:bg-surface-2 text-ink-soft border-line'
                    }`}
                  >
                    #{p.name}
                    {p.offer_count > 0 && (
                      <span className="text-ink-faint ml-1">{p.offer_count}</span>
                    )}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
