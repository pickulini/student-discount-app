import React, { useState, useEffect, useRef } from 'react';
import api from '../api/client';

const MAX_TAGS = 10;

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

  const normalize = (s) => s.trim().replace(/^#+/, '').trim();

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
      <div className="border rounded p-2 flex flex-wrap gap-1 items-center bg-white focus-within:ring-2 focus-within:ring-blue-400">
        {value.map(t => (
          <span
            key={t}
            className="inline-flex items-center gap-1 bg-blue-100 text-blue-800 px-2 py-0.5 rounded text-sm"
          >
            #{t}
            <button
              type="button"
              onClick={() => removeTag(t)}
              className="text-blue-600 hover:text-blue-900 font-bold"
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
          className="flex-1 min-w-[100px] outline-none text-sm"
          maxLength={50}
        />
      </div>

      <p className="text-xs text-gray-500 mt-1">
        {value.length}/{MAX_TAGS} · разделяйте пробелом, запятой или Enter
      </p>

      {/* Дропдаун с предложениями */}
      {showSuggestions && (suggestions.length > 0 || (input.length === 0 && popular.length > 0)) && (
        <div className="absolute z-10 mt-1 w-full bg-white border rounded shadow-lg max-h-64 overflow-y-auto">
          {suggestions.length > 0 ? (
            <>
              <div className="px-3 py-1 text-xs text-gray-500 border-b bg-gray-50">Совпадения</div>
              {suggestions.map(s => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => addTag(s.name)}
                  disabled={isSelected(s.name)}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 ${
                    isSelected(s.name) ? 'text-gray-400 cursor-not-allowed' : 'text-gray-800'
                  }`}
                >
                  #{s.name}
                  <span className="text-xs text-gray-400 ml-2">({s.slug})</span>
                </button>
              ))}
            </>
          ) : (
            <>
              <div className="px-3 py-1 text-xs text-gray-500 border-b bg-gray-50">
                Популярные теги
              </div>
              <div className="p-2 flex flex-wrap gap-1">
                {popular.map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => addTag(p.name)}
                    disabled={isSelected(p.name)}
                    className={`px-2 py-1 rounded text-xs border ${
                      isSelected(p.name)
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed border-gray-200'
                        : 'bg-white hover:bg-blue-50 text-gray-700 border-gray-300'
                    }`}
                  >
                    #{p.name}
                    {p.offer_count > 0 && (
                      <span className="text-gray-400 ml-1">{p.offer_count}</span>
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
