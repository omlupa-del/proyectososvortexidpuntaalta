import { Coordinates, calculateHaversineDistanceMeters } from './geo';

export type TravelPlaceCategory = 'hospital' | 'pharmacy' | 'police';

export interface TravelNearbyPlace {
  id: string;
  category: TravelPlaceCategory;
  name: string;
  subtitle: string;
  address: string;
  phone?: string;
  openingHours?: string;
  is24h: boolean;
  lat: number;
  lng: number;
  distMeters: number;
}

export interface TravelLocationInfo {
  city: string;
  province: string;
  road?: string;
  displayName: string;
}

export interface TravelLocalWeather {
  temperature: number;
  windSpeed: number;
  windGusts: number;
  precipitation: number;
  conditionText: string;
  isDay: boolean;
  alertLevel: 'verde' | 'amarilla' | 'naranja' | 'roja';
}

const TRAVEL_PLACES_CACHE_KEY = 'vortex_travel_places_cache_v1';
const TRAVEL_LOC_CACHE_KEY = 'vortex_travel_loc_cache_v1';

function translateTravelWmoCode(code: number): string {
  switch (code) {
    case 0:
      return 'Cielo despejado';
    case 1:
      return 'Mayormente despejado';
    case 2:
      return 'Parcialmente nublado';
    case 3:
      return 'Nublado';
    case 45:
    case 48:
      return 'Niebla / Visibilidad reducida';
    case 51:
    case 53:
    case 55:
      return 'Lloviznas';
    case 61:
    case 63:
      return 'Lluvia moderada';
    case 65:
      return 'Lluvia intensa';
    case 80:
    case 81:
    case 82:
      return 'Chaparrones';
    case 95:
      return 'Tormenta eléctrica';
    case 96:
    case 99:
      return 'Tormenta severa / Granizo';
    default:
      return 'Condiciones variables';
  }
}

export async function reverseGeocodeTravelLocation(
  coords: Coordinates
): Promise<TravelLocationInfo | null> {
  if (typeof fetch === 'undefined') return null;
  const cacheKey = `${coords.lat.toFixed(2)},${coords.lng.toFixed(2)}`;

  try {
    const raw = localStorage.getItem(TRAVEL_LOC_CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, { ts: number; data: TravelLocationInfo }>;
      const hit = parsed[cacheKey];
      if (hit && Date.now() - hit.ts < 30 * 60 * 1000) {
        return hit.data;
      }
    }
  } catch {
    // ignore storage errors
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4500);
    const url =
      `https://nominatim.openstreetmap.org/reverse?format=json&addressdetails=1&zoom=14` +
      `&lat=${encodeURIComponent(String(coords.lat))}&lon=${encodeURIComponent(String(coords.lng))}`;
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' }
    });
    clearTimeout(timer);

    if (resp.ok) {
      const data = await resp.json();
      const addr = data?.address || {};
      const city =
        addr.city ||
        addr.town ||
        addr.village ||
        addr.municipality ||
        addr.county ||
        addr.state_district ||
        'Localidad actual';
      const province = addr.state || addr.region || addr.country || '';
      const road = addr.road || undefined;
      const displayName = province && province !== city ? `${city}, ${province}` : city;

      const info: TravelLocationInfo = { city, province, road, displayName };

      try {
        const raw = localStorage.getItem(TRAVEL_LOC_CACHE_KEY);
        const existing = raw ? JSON.parse(raw) : {};
        existing[cacheKey] = { ts: Date.now(), data: info };
        localStorage.setItem(TRAVEL_LOC_CACHE_KEY, JSON.stringify(existing));
      } catch {
        // ignore
      }

      return info;
    }
  } catch {
    // fallback below
  }

  return null;
}

export async function searchCityForTravelPreview(
  query: string
): Promise<{ coords: Coordinates; label: string } | null> {
  const clean = (query || '').trim();
  if (!clean || typeof fetch === 'undefined') return null;

  const trySearch = async (countryCodes?: string) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const ccParam = countryCodes ? `&countrycodes=${countryCodes}` : '';
    const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=1${ccParam}&q=${encodeURIComponent(clean)}`;
    try {
      const resp = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: 'application/json' }
      });
      clearTimeout(timer);
      if (!resp.ok) return null;
      const results = await resp.json();
      if (Array.isArray(results) && results.length > 0) {
        const first = results[0];
        const lat = parseFloat(first.lat);
        const lng = parseFloat(first.lon);
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          const addr = first.address || {};
          const city =
            addr.city || addr.town || addr.village || addr.municipality || first.name || clean;
          const province = addr.state || addr.country || '';
          const label = province && province !== city ? `${city}, ${province}` : city;
          return {
            coords: {
              lat,
              lng,
              source: 'manual' as const,
              timestamp: Date.now(),
              label
            },
            label
          };
        }
      }
    } catch {
      clearTimeout(timer);
    }
    return null;
  };

  return (await trySearch('ar')) || (await trySearch());
}

export async function fetchTravelLocalWeather(
  coords: Coordinates
): Promise<TravelLocalWeather | null> {
  if (typeof fetch === 'undefined') return null;

  try {
    const endpoint =
      `https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(String(coords.lat))}` +
      `&longitude=${encodeURIComponent(String(coords.lng))}` +
      `&current=temperature_2m,is_day,precipitation,weather_code,wind_speed_10m,wind_gusts_10m&timezone=auto`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4500);
    const resp = await fetch(endpoint, { signal: controller.signal });
    clearTimeout(timer);

    if (!resp.ok) return null;
    const data = await resp.json();
    const cur = data?.current;
    if (!cur) return null;

    const windSpeed = Math.round(cur.wind_speed_10m || 0);
    const windGusts = Math.round(cur.wind_gusts_10m || 0);
    const precipitation = Number(cur.precipitation || 0);
    const weatherCode = Number(cur.weather_code || 0);

    let alertLevel: TravelLocalWeather['alertLevel'] = 'verde';
    if (windGusts >= 105 || windSpeed >= 75 || weatherCode === 96 || weatherCode === 99 || precipitation >= 50) {
      alertLevel = 'roja';
    } else if (windGusts >= 90 || windSpeed >= 60 || precipitation >= 30) {
      alertLevel = 'naranja';
    } else if ((windSpeed >= 40 && windGusts >= 70) || windGusts >= 75 || weatherCode === 95 || precipitation >= 15) {
      alertLevel = 'amarilla';
    }

    return {
      temperature: Math.round(cur.temperature_2m || 0),
      windSpeed,
      windGusts,
      precipitation,
      conditionText: translateTravelWmoCode(weatherCode),
      isDay: cur.is_day === 1,
      alertLevel
    };
  } catch {
    return null;
  }
}

function classifyOsmElement(tags: Record<string, string>): {
  category: TravelPlaceCategory;
  subtitle: string;
} | null {
  const amenity = (tags.amenity || '').toLowerCase();
  const healthcare = (tags.healthcare || '').toLowerCase();

  if (amenity === 'pharmacy' || healthcare === 'pharmacy') {
    return {
      category: 'pharmacy',
      subtitle: tags.dispensing === 'yes' ? 'Farmacia habilitada' : 'Farmacia cercana'
    };
  }

  if (amenity === 'hospital' || healthcare === 'hospital') {
    return {
      category: 'hospital',
      subtitle: tags.emergency === 'yes' ? 'Hospital · Guardia 24hs' : 'Hospital / Centro médico'
    };
  }

  if (amenity === 'clinic' || healthcare === 'clinic' || healthcare === 'centre') {
    return {
      category: 'hospital',
      subtitle: 'Clínica / Salita / Guardia'
    };
  }

  if (amenity === 'doctors' || healthcare === 'doctor') {
    return {
      category: 'hospital',
      subtitle: 'Consultorios / Atención médica'
    };
  }

  if (amenity === 'police') {
    return {
      category: 'police',
      subtitle: 'Comisaría / Dependencia policial'
    };
  }

  return null;
}

function formatOsmAddress(tags: Record<string, string>): string {
  const street = tags['addr:street'] || '';
  const num = tags['addr:housenumber'] || '';
  const city = tags['addr:city'] || tags['addr:town'] || '';
  const streetPart = [street, num].filter(Boolean).join(' ').trim();
  if (streetPart && city) return `${streetPart} · ${city}`;
  if (streetPart) return streetPart;
  if (tags['addr:full']) return tags['addr:full'];
  return city || 'Ver ubicación exacta en mapa';
}

export async function fetchTravelNearbyPlaces(
  coords: Coordinates,
  radiusMeters = 15000,
  forceRefresh = false
): Promise<{
  places: TravelNearbyPlace[];
  source: 'live' | 'cache' | 'unavailable';
}> {
  if (typeof fetch === 'undefined') {
    return { places: [], source: 'unavailable' };
  }

  const cacheKey = `${coords.lat.toFixed(2)}_${coords.lng.toFixed(2)}`;
  if (!forceRefresh) {
    try {
      const raw = localStorage.getItem(TRAVEL_PLACES_CACHE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { key: string; ts: number; places: TravelNearbyPlace[] };
        if (parsed.key === cacheKey && Date.now() - parsed.ts < 12 * 60 * 1000 && Array.isArray(parsed.places)) {
          // Recompute exact Haversine distance from current exact coords
          const recalced = parsed.places
            .map((p) => ({
              ...p,
              distMeters: calculateHaversineDistanceMeters(coords.lat, coords.lng, p.lat, p.lng)
            }))
            .sort((a, b) => a.distMeters - b.distMeters);
          return { places: recalced, source: 'cache' };
        }
      }
    } catch {
      // ignore
    }
  }

  const query = `
[out:json][timeout:10];
(
  nwr(around:${radiusMeters},${coords.lat},${coords.lng})["amenity"~"^(hospital|clinic|doctors|pharmacy|police)$"];
  nwr(around:${radiusMeters},${coords.lat},${coords.lng})["healthcare"~"^(hospital|clinic|pharmacy)$"];
);
out center tags 120;
`.trim();

  const endpoints = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter'
  ];

  for (const endpoint of endpoints) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8500);
      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          Accept: 'application/json'
        },
        body: `data=${encodeURIComponent(query)}`,
        signal: controller.signal
      });
      clearTimeout(timer);

      if (!resp.ok) continue;
      const json = await resp.json();
      const elements = Array.isArray(json?.elements) ? json.elements : [];

      const seenKeys = new Set<string>();
      const collected: TravelNearbyPlace[] = [];

      for (const el of elements) {
        const tags = (el?.tags || {}) as Record<string, string>;
        const classified = classifyOsmElement(tags);
        if (!classified) continue;

        const elLat = typeof el.lat === 'number' ? el.lat : el.center?.lat;
        const elLng = typeof el.lon === 'number' ? el.lon : el.center?.lon;
        if (typeof elLat !== 'number' || typeof elLng !== 'number') continue;

        const fallbackName =
          classified.category === 'hospital'
            ? 'Centro de Salud / Hospital'
            : classified.category === 'pharmacy'
              ? 'Farmacia'
              : 'Comisaría / Policía';
        const name = (tags.name || tags.official_name || tags.brand || fallbackName).trim();

        // Deduplicate nodes/ways representing the same building
        const dedupeKey = `${classified.category}:${name.toLowerCase()}:${elLat.toFixed(3)}:${elLng.toFixed(3)}`;
        if (seenKeys.has(dedupeKey)) continue;
        seenKeys.add(dedupeKey);

        const openingHours = tags.opening_hours || undefined;
        const is24h =
          openingHours === '24/7' ||
          tags.emergency === 'yes' ||
          /24\s*h/i.test(openingHours || '') ||
          (classified.category === 'hospital' && /hospital/i.test(name));

        const phone = tags.phone || tags['contact:phone'] || tags['contact:mobile'] || undefined;
        const distMeters = calculateHaversineDistanceMeters(coords.lat, coords.lng, elLat, elLng);

        collected.push({
          id: `${el.type || 'n'}-${el.id}`,
          category: classified.category,
          name,
          subtitle: classified.subtitle,
          address: formatOsmAddress(tags),
          phone,
          openingHours,
          is24h,
          lat: elLat,
          lng: elLng,
          distMeters
        });
      }

      collected.sort((a, b) => a.distMeters - b.distMeters);

      // Keep top 15 per category for clean rendering
      const counts: Record<TravelPlaceCategory, number> = {
        hospital: 0,
        pharmacy: 0,
        police: 0
      };
      const trimmed = collected.filter((item) => {
        if (counts[item.category] >= 15) return false;
        counts[item.category] += 1;
        return true;
      });

      try {
        localStorage.setItem(
          TRAVEL_PLACES_CACHE_KEY,
          JSON.stringify({ key: cacheKey, ts: Date.now(), places: trimmed })
        );
      } catch {
        // ignore
      }

      return { places: trimmed, source: 'live' };
    } catch {
      // Try next Overpass mirror
    }
  }

  return { places: [], source: 'unavailable' };
}
