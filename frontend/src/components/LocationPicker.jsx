import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { formatNominatimAddress } from '../utils/mapLinks';

// Фикс для иконок Leaflet в бандлерах
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const DEFAULT_CENTER = [55.7558, 37.6173]; // Москва

// Компонент для обработки кликов по карте
const ClickHandler = ({ onPick }) => {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
};

// Центрирование карты при изменении position
const RecenterMap = ({ position }) => {
  const map = useMapEvents({});
  useEffect(() => {
    if (position) {
      map.setView(position, Math.max(map.getZoom(), 14));
    }
  }, [position, map]);
  return null;
};

/**
 * LocationPicker — выбор координат на карте или через адрес.
 * value = { latitude, longitude, place_name, address }
 * onChange = (newValue) => void
 */
const LocationPicker = ({ value = {}, onChange }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');

  const position = value.latitude && value.longitude
    ? [value.latitude, value.longitude]
    : null;

  const handleMapClick = async (lat, lng) => {
    const roundLat = parseFloat(lat.toFixed(6));
    const roundLng = parseFloat(lng.toFixed(6));

    // Сразу ставим маркер
    onChange({
      ...value,
      latitude: roundLat,
      longitude: roundLng,
    });

    // Reverse geocoding: получаем адрес по координатам
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&addressdetails=1&accept-language=ru&lat=${roundLat}&lon=${roundLng}`;
      const res = await fetch(url, {
        headers: { 'Accept-Language': 'ru' },
      });
      const data = await res.json();
      if (data && data.address) {
        const shortAddress = formatNominatimAddress(data.address) || data.display_name || '';
        onChange({
          ...value,
          latitude: roundLat,
          longitude: roundLng,
          address: shortAddress,
          place_name: shortAddress,
        });
      }
    } catch (err) {
      console.warn('Reverse geocoding failed:', err);
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearching(true);
    setSearchError('');
    try {
      // Nominatim OpenStreetMap — бесплатный, без ключа
      // addressdetails=1 → разобранная структура адреса (city, road, house_number)
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&addressdetails=1&accept-language=ru&q=${encodeURIComponent(searchQuery)}`;
      const res = await fetch(url, {
        headers: { 'Accept-Language': 'ru' },
      });
      const data = await res.json();
      if (!data || data.length === 0) {
        setSearchError('Адрес не найден');
        return;
      }
      const hit = data[0];
      const shortAddress = formatNominatimAddress(hit.address) || hit.display_name || searchQuery;
      onChange({
        ...value,
        latitude: parseFloat(parseFloat(hit.lat).toFixed(6)),
        longitude: parseFloat(parseFloat(hit.lon).toFixed(6)),
        address: shortAddress,
        place_name: shortAddress,
      });
    } catch (err) {
      setSearchError('Ошибка поиска адреса');
    } finally {
      setSearching(false);
    }
  };

  const clearPoint = () => {
    onChange({
      ...value,
      latitude: null,
      longitude: null,
      place_name: '',
    });
  };

  return (
    <div>
      <label className="block text-sm mb-1">Место на карте</label>

      {/* Поиск адреса */}
      <div className="flex gap-2 mb-2">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleSearch(e);
            }
          }}
          placeholder="Найти адрес: Красная площадь, Москва"
          className="flex-1 border p-2 rounded text-sm"
        />
        <button
          type="button"
          onClick={(e) => { e.preventDefault(); handleSearch(e); }}
          disabled={searching}
          className="bg-blue-500 text-white px-3 py-2 rounded text-sm hover:bg-blue-600 disabled:opacity-50 whitespace-nowrap"
        >
          {searching ? '...' : '🔍 Найти'}
        </button>
      </div>

      {searchError && (
        <p className="text-xs text-red-500 mb-2">{searchError}</p>
      )}

      {/* Карта */}
      <div className="border rounded overflow-hidden" style={{ height: '300px' }}>
        <MapContainer
          center={position || DEFAULT_CENTER}
          zoom={position ? 14 : 10}
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <ClickHandler onPick={handleMapClick} />
          {position && (
            <>
              <Marker position={position} />
              <RecenterMap position={position} />
            </>
          )}
        </MapContainer>
      </div>

      <p className="text-xs text-gray-500 mt-2">
        {position
          ? '📍 Точка установлена'
          : 'Кликните на карте или найдите адрес, чтобы установить точку'}
      </p>

      {position && (
        <button
          type="button"
          onClick={clearPoint}
          className="text-xs text-red-500 hover:underline mt-1"
        >
          Убрать точку
        </button>
      )}
    </div>
  );
};

export default LocationPicker;
