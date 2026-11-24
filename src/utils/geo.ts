/**
 * Geolocation and Distance Utilities for Punta Alta
 */

export type LocationSource = 'gps' | 'network' | 'ip' | 'manual' | 'fallback';

export interface Coordinates {
  lat: number;
  lng: number;
  accuracy?: number;
  source?: LocationSource;
  timestamp?: number;
  label?: string;
}

// Punta Alta City Center (Plaza General Belgrano - Rivadavia, Murature, Irigoyen, Humberto I)
export const DEFAULT_PUNTA_ALTA_COORDS: Coordinates = {
  lat: -38.8807,
  lng: -62.0772,
  source: 'fallback',
  label: 'Plaza Belgrano (Centro)'
};

// Calibrated coordinates for Colón 414 / 415, Punta Alta (verified OSM)
export const COLON_415_COORDS: Coordinates = {
  lat: -38.882207,
  lng: -62.083263,
  source: 'manual',
  label: 'Colón 415'
};

const COORDS_KEY = 'vortex_last_coords';
const REAL_GPS_KEY = 'vortex_last_real_gps_v1';

function normalizeGeoText(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/,/g, ' ')
    .replace(/\./g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Retrieves the last known successful real coordinates from localStorage (only if within Punta Alta & < 30 min old)
 */
export function getStoredCoords(maxAgeMs = 30 * 60 * 1000): Coordinates | null {
  try {
    const raw = localStorage.getItem(COORDS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Coordinates;
    if (
      typeof parsed?.lat === 'number' &&
      typeof parsed?.lng === 'number' &&
      isVerifiedEmergencyCoords(parsed) &&
      isWithinPuntaAltaArea(parsed)
    ) {
      if (parsed.timestamp && Date.now() - parsed.timestamp > maxAgeMs) {
        return null;
      }
      return parsed;
    }
  } catch {
    // ignore
  }
  return null;
}

/**
 * Checks whether coordinates come from real device location (GPS/WiFi/network) or confirmed street selection.
 * Deliberately EXCLUDES coarse ISP IP lookups and city-center fallbacks so UI never falsely claims "GPS real listo".
 */
export function isVerifiedEmergencyCoords(coords?: Coordinates | null): coords is Coordinates {
  if (!coords) return false;
  if (typeof coords.lat !== 'number' || typeof coords.lng !== 'number') return false;
  if (!Number.isFinite(coords.lat) || !Number.isFinite(coords.lng)) return false;
  if (coords.lat === 0 && coords.lng === 0) return false;
  return (
    coords.source === 'gps' ||
    coords.source === 'network' ||
    coords.source === 'manual'
  );
}

/**
 * Checks whether coordinates are a coarse network IP estimation
 */
export function isCoarseIpCoords(coords?: Coordinates | null): coords is Coordinates {
  if (!coords) return false;
  if (typeof coords.lat !== 'number' || typeof coords.lng !== 'number') return false;
  if (!Number.isFinite(coords.lat) || !Number.isFinite(coords.lng)) return false;
  return coords.source === 'ip';
}

export interface CoordsFreshnessInfo {
  ageMs: number;
  ageSeconds: number;
  ageLabel: string;
  isFresh: boolean;
  isStale: boolean;
  accuracyMeters: number | null;
  isHighAccuracy: boolean;
}

export function getCoordsFreshnessInfo(coords?: Coordinates | null): CoordsFreshnessInfo {
  const now = Date.now();
  const ageMs = coords?.timestamp ? Math.max(0, now - coords.timestamp) : 0;
  const ageSeconds = Math.round(ageMs / 1000);
  const accuracyMeters = typeof coords?.accuracy === 'number' ? Math.round(coords.accuracy) : null;

  let ageLabel = 'recién';
  if (!coords?.timestamp) {
    ageLabel = coords?.source === 'manual' ? 'confirmada' : 'sin hora';
  } else if (ageSeconds < 15) {
    ageLabel = 'en vivo';
  } else if (ageSeconds < 60) {
    ageLabel = `hace ${ageSeconds}s`;
  } else {
    const mins = Math.floor(ageSeconds / 60);
    ageLabel = `hace ${mins} min`;
  }

  return {
    ageMs,
    ageSeconds,
    ageLabel,
    isFresh: coords?.source === 'manual' || (Boolean(coords?.timestamp) && ageMs <= 90_000),
    isStale: coords?.source !== 'manual' && (!coords?.timestamp || ageMs > 180_000),
    accuracyMeters,
    isHighAccuracy:
      coords?.source === 'manual' ||
      (coords?.source === 'gps' && (accuracyMeters === null || accuracyMeters <= 80))
  };
}

/**
 * Decides whether an incoming coordinate fix should replace the current emergency coordinate.
 * Prevents low-precision IP carrier coordinates or coarse cell tower fixes from overwriting fresh hardware GPS.
 */
export function shouldReplaceEmergencyCoords(
  current: Coordinates | null | undefined,
  incoming: Coordinates
): boolean {
  if (!isVerifiedEmergencyCoords(incoming) && !isCoarseIpCoords(incoming)) return false;
  if (!current || (!isVerifiedEmergencyCoords(current) && !isCoarseIpCoords(current))) return true;

  const currentAgeMs = current.timestamp ? Math.max(0, Date.now() - current.timestamp) : Infinity;

  // Never overwrite any reasonably recent (< 15 min) GPS, network, or manual fix with a rough IP lookup
  if (
    incoming.source === 'ip' &&
    (current.source === 'gps' || current.source === 'network' || current.source === 'manual') &&
    currentAgeMs < 15 * 60 * 1000
  ) {
    return false;
  }

  // Keep a fresh (< 2 min) high-accuracy hardware GPS fix over a much coarser network fix
  if (
    current.source === 'gps' &&
    currentAgeMs < 2 * 60 * 1000 &&
    incoming.source === 'network' &&
    (current.accuracy ?? 50) <= 100 &&
    (incoming.accuracy ?? 1000) > 250
  ) {
    return false;
  }

  return true;
}

/**
 * Saves real device GPS/network coordinates regardless of city limits (critical for travelers/highways)
 */
export function saveLastRealGpsCoords(coords: Coordinates): void {
  try {
    if (!isVerifiedEmergencyCoords(coords) && !isCoarseIpCoords(coords)) return;
    const existing = getLastRealGpsCoords(15 * 60 * 1000);
    if (!shouldReplaceEmergencyCoords(existing, coords)) return;

    const payload: Coordinates = {
      ...coords,
      timestamp: coords.timestamp || Date.now()
    };
    localStorage.setItem(REAL_GPS_KEY, JSON.stringify(payload));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('vortex_real_gps_updated', { detail: payload }));
    }
  } catch {
    // ignore
  }
}

/**
 * Retrieves the last verified real device GPS/network coordinates (max age 5 minutes by default for incidents)
 */
export function getLastRealGpsCoords(maxAgeMs = 5 * 60 * 1000): Coordinates | null {
  try {
    const raw = localStorage.getItem(REAL_GPS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Coordinates;
    if (!isVerifiedEmergencyCoords(parsed)) return null;
    if (parsed.timestamp && Date.now() - parsed.timestamp > maxAgeMs) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Saves successful coordinates to localStorage (strictly inside Punta Alta area for local pharmacy radar)
 */
export function saveStoredCoords(coords: Coordinates): void {
  try {
    if (!isVerifiedEmergencyCoords(coords) || !isWithinPuntaAltaArea(coords)) return;
    localStorage.setItem(COORDS_KEY, JSON.stringify({ ...coords, timestamp: coords.timestamp || Date.now() }));
  } catch {
    // ignore
  }
}

/**
 * Actively requests fresh device GPS coordinates (high accuracy first, fast network fallback).
 * Returns null if permission denied or unavailable (never fabricates fallback coordinates).
 */
export function acquireFreshGpsCoordinates(timeoutMs = 5500): Promise<Coordinates | null> {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      resolve(null);
      return;
    }

    let settled = false;
    const done = (res: Coordinates | null) => {
      if (settled) return;
      settled = true;
      if (res) {
        saveLastRealGpsCoords(res);
        saveStoredCoords(res);
      }
      resolve(res);
    };

    const safetyTimer = setTimeout(() => {
      done(null);
    }, timeoutMs + 3000);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        clearTimeout(safetyTimer);
        done({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: Math.round(pos.coords.accuracy || 15),
          source: 'gps',
          timestamp: Date.now()
        });
      },
      (err) => {
        if (err.code === 1) {
          clearTimeout(safetyTimer);
          done(null);
          return;
        }
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            clearTimeout(safetyTimer);
            done({
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              accuracy: Math.round(pos.coords.accuracy || 120),
              source: 'network',
              timestamp: Date.now()
            });
          },
          () => {
            clearTimeout(safetyTimer);
            done(null);
          },
          {
            enableHighAccuracy: false,
            timeout: 3000,
            maximumAge: 30000
          }
        );
      },
      {
        enableHighAccuracy: true,
        timeout: timeoutMs,
        maximumAge: 5000
      }
    );
  });
}

/**
 * Tries to fetch approximate coordinates via network IP if hardware GPS is unavailable or blocked
 */
export async function fetchIpFallbackCoordinates(): Promise<Coordinates | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2500);
    const resp = await fetch('https://get.geojs.io/v1/ip/geo.json', { signal: controller.signal });
    clearTimeout(timer);
    if (!resp.ok) return null;
    const data = await resp.json();
    const lat = parseFloat(data.latitude);
    const lng = parseFloat(data.longitude);
    if (!isNaN(lat) && !isNaN(lng)) {
      const cityParts = [data.city, data.region].filter(Boolean);
      return {
        lat,
        lng,
        source: 'ip',
        timestamp: Date.now(),
        label: cityParts.length > 0 ? cityParts.join(', ') : undefined
      };
    }
  } catch {
    // ignore
  }
  return null;
}

/**
 * Exact address coordinates directory for critical spots and calibrated streets in Punta Alta.
 * Verified against OpenStreetMap / Nominatim real coordinates.
 */
export const PUNTA_ALTA_EXACT_ADDRESSES: Record<string, Coordinates> = {
  'colon 414': { lat: -38.882207, lng: -62.083263 },
  'colon 415': { lat: -38.882207, lng: -62.083263 },
  'colon al 400': { lat: -38.882207, lng: -62.083263 },
  'colon 400': { lat: -38.882207, lng: -62.083263 },
  '25 de mayo 345': { lat: -38.882494, lng: -62.078526 },
  'veinticinco de mayo 345': { lat: -38.882494, lng: -62.078526 },
  '25 de mayo 571': { lat: -38.879632, lng: -62.079306 },
  'colon y rivadavia': { lat: -38.880805, lng: -62.080533 },
  'rivadavia y colon': { lat: -38.880805, lng: -62.080533 },
  'rivadavia 199': { lat: -38.880805, lng: -62.080533 },
  'rivadavia 450': { lat: -38.880091, lng: -62.076838 },
  'espora 250': { lat: -38.882775, lng: -62.072109 },
  'espora 428': { lat: -38.880344, lng: -62.072798 },
  'brown 151': { lat: -38.884372, lng: -62.074566 },
  'brown 502': { lat: -38.879916, lng: -62.076030 },
  'brown y rivadavia': { lat: -38.879916, lng: -62.076030 },
  'rivadavia y brown': { lat: -38.879916, lng: -62.076030 },
  'brown 1535': { lat: -38.867813, lng: -62.079079 },
  'murature 1147': { lat: -38.871725, lng: -62.076424 },
  'murature 1500': { lat: -38.861951, lng: -62.079233 },
  'irigoyen 111': { lat: -38.882250, lng: -62.081471 },
  'bernardo de irigoyen 111': { lat: -38.882250, lng: -62.081471 },
  'irigoyen 438': { lat: -38.881307, lng: -62.076707 },
  'bernardo de irigoyen 438': { lat: -38.881307, lng: -62.076707 },
  'humberto 445': { lat: -38.881605, lng: -62.081723 },
  'humberto i 445': { lat: -38.881605, lng: -62.081723 },
  'humberto primo 445': { lat: -38.881605, lng: -62.081723 },
  'humberto 756': { lat: -38.877942, lng: -62.083025 },
  'humberto i 756': { lat: -38.877942, lng: -62.083025 },
  'humberto primo 756': { lat: -38.877942, lng: -62.083025 },
  'saavedra 36': { lat: -38.886291, lng: -62.070441 },
  'mitre 913': { lat: -38.877897, lng: -62.070284 },
  'mitre 1202': { lat: -38.876973, lng: -62.065982 },
  'paso 2132': { lat: -38.862621, lng: -62.082704 },
  'roca 2411': { lat: -38.860361, lng: -62.085944 },
  '9 de julio 1262': { lat: -38.871750, lng: -62.066589 },
  'hipolito yrigoyen 860': { lat: -38.889648, lng: -62.067093 },
  'tucuman 138': { lat: -38.881948, lng: -62.062903 },
  'uriburu 650': { lat: -38.876646, lng: -62.066955 }
};

/**
 * Punta Alta street coordinate grid calibrated against real OpenStreetMap anchors.
 * Convention: coord = base + stepPer1000 * (height / 1000)
 * - SE -> NW arteries (Brown, Murature, Espora, 25 de Mayo, Humberto I, Paso, Roca): +lat, -lng as height grows
 * - SW -> NE arteries (Rivadavia, Bernardo de Irigoyen, Mitre, Colón): +lat, +lng as height grows
 */
const PUNTA_ALTA_STREET_GRID: Array<{
  names: string[];
  baseLat: number;
  baseLng: number;
  latStepPer1000: number;
  lngStepPer1000: number;
}> = [
  // Brown (151 -> -38.88437,-62.07457 ; 1535 -> -38.86781,-62.07908)
  { names: ['almirante brown', 'brown'], baseLat: -38.88618, baseLng: -62.07407, latStepPer1000: 0.01196, lngStepPer1000: -0.00326 },
  // Murature (parallel ~1 block W of Brown; 1147 -> -38.87172,-62.07642)
  { names: ['murature'], baseLat: -38.88540, baseLng: -62.07270, latStepPer1000: 0.01195, lngStepPer1000: -0.00325 },
  // Espora (250 -> -38.88278,-62.07211 ; 428 -> -38.88034,-62.07280)
  { names: ['tomas espora', 'capitan espora', 'espora'], baseLat: -38.88619, baseLng: -62.07114, latStepPer1000: 0.01366, lngStepPer1000: -0.00387 },
  // 25 de Mayo (345 -> -38.88249,-62.07853 ; 571 -> -38.87963,-62.07931)
  { names: ['veinticinco de mayo', '25 de mayo'], baseLat: -38.88686, baseLng: -62.07734, latStepPer1000: 0.01266, lngStepPer1000: -0.00345 },
  // Humberto Primo (445 -> -38.88161,-62.08172 ; 756 -> -38.87794,-62.08303)
  { names: ['humberto primo', 'humberto 1', 'humberto i'], baseLat: -38.88685, baseLng: -62.07986, latStepPer1000: 0.01178, lngStepPer1000: -0.00419 },
  // Luiggi (parallel W of Humberto I)
  { names: ['luiggi'], baseLat: -38.88750, baseLng: -62.08120, latStepPer1000: 0.01180, lngStepPer1000: -0.00400 },
  // Juan José Paso (2132 -> -38.86262,-62.08270)
  { names: ['juan jose paso', 'juan j paso', 'paso'], baseLat: -38.88780, baseLng: -62.07570, latStepPer1000: 0.01181, lngStepPer1000: -0.00329 },
  // Roca (2411 -> -38.86036,-62.08594)
  { names: ['roca'], baseLat: -38.88880, baseLng: -62.07800, latStepPer1000: 0.01180, lngStepPer1000: -0.00329 },
  // Bernardo de Irigoyen (111 -> -38.88225,-62.08147 ; 438 -> -38.88131,-62.07671)
  { names: ['bernardo de irigoyen', 'b de irigoyen', 'irigoyen'], baseLat: -38.88257, baseLng: -62.08308, latStepPer1000: 0.00288, lngStepPer1000: 0.01455 },
  // Rivadavia (199 -> -38.88081,-62.08053 ; 450 -> -38.88009,-62.07684)
  { names: ['rivadavia'], baseLat: -38.88137, baseLng: -62.08346, latStepPer1000: 0.00285, lngStepPer1000: 0.01471 },
  // Mitre (913 -> -38.87790,-62.07028 ; 1202 -> -38.87697,-62.06598)
  { names: ['bartolome mitre', 'mitre'], baseLat: -38.88082, baseLng: -62.08387, latStepPer1000: 0.00320, lngStepPer1000: 0.01488 },
  // Saavedra (36 -> -38.88629,-62.07044)
  { names: ['saavedra'], baseLat: -38.88640, baseLng: -62.07097, latStepPer1000: 0.00290, lngStepPer1000: 0.01470 },
  // Colón (SE -> NW verified OSM: 61 -> -38.88679,-62.08204 ; 415 -> -38.88221,-62.08326)
  { names: ['colon', 'avenida colon', 'av colon'], baseLat: -38.88758, baseLng: -62.08182, latStepPer1000: 0.01294, lngStepPer1000: -0.00347 },
  // 9 de Julio (1262 -> -38.87175,-62.06659)
  { names: ['9 de julio', 'nueve de julio'], baseLat: -38.87580, baseLng: -62.08500, latStepPer1000: 0.00320, lngStepPer1000: 0.01460 },
  // Hipólito Yrigoyen (860 -> -38.88965,-62.06709)
  { names: ['hipolito yrigoyen', 'h yrigoyen', 'yrigoyen'], baseLat: -38.89210, baseLng: -62.07960, latStepPer1000: 0.00285, lngStepPer1000: 0.01455 },
  // Av. Tucumán (138 -> -38.88195,-62.06290)
  { names: ['tucuman', 'avenida tucuman'], baseLat: -38.88360, baseLng: -62.06245, latStepPer1000: 0.01195, lngStepPer1000: -0.00325 },
  // Uriburu (650 -> -38.87665,-62.06696 Hospital Eva Perón)
  { names: ['pte uriburu', 'uriburu'], baseLat: -38.87850, baseLng: -62.07640, latStepPer1000: 0.00285, lngStepPer1000: 0.01455 },
  // Urquiza
  { names: ['urquiza'], baseLat: -38.88390, baseLng: -62.08360, latStepPer1000: 0.00288, lngStepPer1000: 0.01455 },
  // Pellegrini
  { names: ['carlos pellegrini', 'pellegrini'], baseLat: -38.87720, baseLng: -62.08420, latStepPer1000: 0.00288, lngStepPer1000: 0.01455 },
  // Alem
  { names: ['leandro n alem', 'leandro alem', 'alem'], baseLat: -38.87320, baseLng: -62.07950, latStepPer1000: 0.01180, lngStepPer1000: -0.00330 }
];

const PUNTA_ALTA_NEIGHBORHOODS: Record<string, Coordinates> = {
  'ciudad atlantida': { lat: -38.889132, lng: -62.067938 },
  'nueva bahia blanca': { lat: -38.867293, lng: -62.058625 },
  'albatros': { lat: -38.859500, lng: -62.080500 },
  'albatros xiv': { lat: -38.859500, lng: -62.080500 },
  'albatros v': { lat: -38.862000, lng: -62.078500 },
  'albatros xx': { lat: -38.856500, lng: -62.082500 },
  'villa maio': { lat: -38.860361, lng: -62.085944 },
  'villa laura': { lat: -38.881948, lng: -62.062903 },
  'barrio centenario': { lat: -38.862621, lng: -62.082704 },
  'villa del mar': { lat: -38.852577, lng: -62.117149 },
  'hospital eva peron': { lat: -38.876646, lng: -62.066955 },
  'hospital municipal': { lat: -38.876646, lng: -62.066955 },
  'hospital naval': { lat: -38.891954, lng: -62.093992 },
  'puerto belgrano': { lat: -38.891954, lng: -62.093992 },
  'base naval': { lat: -38.891954, lng: -62.093992 },
  'plaza belgrano': DEFAULT_PUNTA_ALTA_COORDS,
  'centro': DEFAULT_PUNTA_ALTA_COORDS
};

export interface LandmarkSpot {
  id: string;
  label: string;
  subtitle: string;
  coords: Coordinates;
}

export const POPULAR_PUNTA_ALTA_SPOTS: LandmarkSpot[] = [
  { id: 'centro', label: 'Plaza Belgrano (Centro)', subtitle: 'Rivadavia, Murature, Irigoyen y Humberto I', coords: DEFAULT_PUNTA_ALTA_COORDS },
  { id: 'colon_100', label: 'Av. Colón al 100 (Puesto 1)', subtitle: 'Acceso Base Naval / Av. Colón Sur', coords: { lat: -38.886286, lng: -62.082167, source: 'manual', label: 'Av. Colón al 100' } },
  { id: 'colon_urquiza', label: 'Av. Colón y Urquiza', subtitle: 'Av. Colón al 400 / Centro Sur', coords: { lat: -38.882207, lng: -62.083263, source: 'manual', label: 'Av. Colón y Urquiza' } },
  { id: 'brown_rivadavia', label: 'Brown y Rivadavia', subtitle: 'Esquina céntrica comercial', coords: { lat: -38.879916, lng: -62.076030 } },
  { id: 'espora_centro', label: 'Espora al 400', subtitle: 'Espora e/ Irigoyen y Mitre', coords: { lat: -38.880344, lng: -62.072798 } },
  { id: 'hosp_eva_peron', label: 'Hospital Eva Perón (Uriburu 650)', subtitle: 'Zona Norte / Atepam', coords: { lat: -38.876646, lng: -62.066955 } },
  { id: 'ciudad_atlantida', label: 'Ciudad Atlántida (Yrigoyen 860)', subtitle: 'Zona Sudeste / ATE V', coords: { lat: -38.889132, lng: -62.067938 } },
  { id: 'nueva_bahia', label: 'Nueva Bahía Blanca', subtitle: 'Zona Nordeste / Acceso', coords: { lat: -38.867293, lng: -62.058625 } },
  { id: 'barrio_centenario', label: 'Paso al 2100 (Centenario / Gottling)', subtitle: 'Zona Noroeste / Brown 1500', coords: { lat: -38.862621, lng: -62.082704 } },
  { id: 'acceso_tucuman', label: 'Av. Tucumán y Ruta 249', subtitle: 'Acceso a Punta Alta / Villa Laura', coords: { lat: -38.881948, lng: -62.062903 } },
  { id: 'villa_del_mar', label: 'Villa del Mar / Base Naval', subtitle: 'Sector Costero / HNPB', coords: { lat: -38.852577, lng: -62.117149 } }
];

export interface EstimateAddressOptions {
  allowCenterFallback?: boolean;
}

/**
 * Estimates approximate coordinates from a Punta Alta street address, neighborhood or intersection.
 * By default (`allowCenterFallback: false`), returns null if the street/place is unrecognized
 * so callers can query OpenStreetMap Nominatim instead of falsely pinning to Plaza Belgrano.
 */
export function estimateCoordsFromPuntaAltaAddress(
  address?: string | null,
  options: EstimateAddressOptions = {}
): Coordinates | null {
  if (!address || typeof address !== 'string') return null;
  const raw = normalizeGeoText(address);
  if (!raw) return null;

  // 1. Check exact calibrated addresses first
  for (const [key, coords] of Object.entries(PUNTA_ALTA_EXACT_ADDRESSES)) {
    if (raw.includes(key)) {
      return { ...coords, source: 'manual' };
    }
  }

  // 2. Check neighborhoods / hospitals / plazas
  for (const [key, coords] of Object.entries(PUNTA_ALTA_NEIGHBORHOODS)) {
    if (raw.includes(key)) {
      return { ...coords, source: 'manual' };
    }
  }

  // 3. Check for intersections like "Paso y Brown", "Colón esq Rivadavia"
  const isIntersection = raw.includes(' y ') || raw.includes(' esq ') || raw.includes(' esquina ');
  if (isIntersection) {
    const parts = raw.split(/\s+(?:y|esq|esquina)\s+/);
    if (parts.length >= 2) {
      const match1 = PUNTA_ALTA_STREET_GRID.find((s) => s.names.some((n) => parts[0].includes(n)));
      const match2 = PUNTA_ALTA_STREET_GRID.find((s) => s.names.some((n) => parts[1].includes(n)));
      if (match1 && match2) {
        // Approximate intersection around typical center block height (~400) for each artery
        const p1Lat = match1.baseLat + match1.latStepPer1000 * 0.4;
        const p1Lng = match1.baseLng + match1.lngStepPer1000 * 0.4;
        const p2Lat = match2.baseLat + match2.latStepPer1000 * 0.4;
        const p2Lng = match2.baseLng + match2.lngStepPer1000 * 0.4;
        return {
          lat: (p1Lat + p2Lat) / 2,
          lng: (p1Lng + p2Lng) / 2,
          source: 'manual'
        };
      }
    }
  }

  // 4. Extract street + height number
  const numMatch = raw.match(/\b(\d{1,5})\b/);
  const height = numMatch ? parseInt(numMatch[1], 10) : 400;

  for (const item of PUNTA_ALTA_STREET_GRID) {
    const matched = item.names.some((name) => raw.includes(name));
    if (matched) {
      const heightFactor = height / 1000;
      return {
        lat: item.baseLat + item.latStepPer1000 * heightFactor,
        lng: item.baseLng + item.lngStepPer1000 * heightFactor,
        source: 'manual'
      };
    }
  }

  if (options.allowCenterFallback && raw.length > 3) {
    return DEFAULT_PUNTA_ALTA_COORDS;
  }

  return null;
}

/**
 * Checks whether the given coordinates are within the Punta Alta urban/coastal area (15km radius)
 */
export function isWithinPuntaAltaArea(coords: Coordinates | null): boolean {
  if (!coords || typeof coords.lat !== 'number' || typeof coords.lng !== 'number') return false;
  const d = calculateDistanceKm(coords.lat, coords.lng, DEFAULT_PUNTA_ALTA_COORDS.lat, DEFAULT_PUNTA_ALTA_COORDS.lng);
  return d <= 15;
}

/**
 * Describes in clear human Spanish where the coordinates correspond to in Punta Alta or distance outside it.
 */
export function describePuntaAltaLocation(coords: Coordinates | null): string {
  if (!coords) return 'Ubicación no disponible';

  const distFromCenter = calculateDistanceKm(
    coords.lat,
    coords.lng,
    DEFAULT_PUNTA_ALTA_COORDS.lat,
    DEFAULT_PUNTA_ALTA_COORDS.lng
  );

  if (distFromCenter > 15) {
    return `A ${Math.round(distFromCenter)} km de Punta Alta`;
  }

  // Never guess a specific corner or neighborhood when GPS is coarse WiFi/network/IP triangulation
  if (
    coords.source === 'ip' ||
    (typeof coords.accuracy === 'number' && coords.accuracy > 150)
  ) {
    return 'Punta Alta (señal aprox. por red)';
  }

  const BROAD_ZONE_IDS = new Set([
    'centro',
    'hosp_eva_peron',
    'ciudad_atlantida',
    'nueva_bahia',
    'barrio_centenario',
    'acceso_tucuman',
    'villa_del_mar'
  ]);

  let closestSpot: LandmarkSpot = POPULAR_PUNTA_ALTA_SPOTS[0];
  let minDistance = 99999;

  for (const spot of POPULAR_PUNTA_ALTA_SPOTS) {
    if (!BROAD_ZONE_IDS.has(spot.id)) continue;
    const d = calculateDistanceKm(coords.lat, coords.lng, spot.coords.lat, spot.coords.lng);
    if (d < minDistance) {
      minDistance = d;
      closestSpot = spot;
    }
  }

  if (minDistance <= 0.15) {
    return `Cerca de ${closestSpot.label}`;
  }
  if (minDistance <= 0.5) {
    return `Zona ${closestSpot.label}`;
  }

  return 'Punta Alta';
}

/**
 * Calculates exact distance between two coordinates in meters using the spherical Haversine formula
 * Radius of Earth R = 6,371,000 meters
 */
export function calculateHaversineDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Radius of Earth in meters
  const toRad = Math.PI / 180;
  const dLat = (lat2 - lat1) * toRad;
  const dLon = (lon2 - lon1) * toRad;
  const lat1Rad = lat1 * toRad;
  const lat2Rad = lat2 * toRad;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1Rad) * Math.cos(lat2Rad) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

/**
 * Calculates distance between two coordinates in kilometers using Haversine formula
 */
export function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  return calculateHaversineDistanceMeters(lat1, lon1, lat2, lon2) / 1000;
}

export interface HaversineDebugStep {
  pharmacyName: string;
  pharmacyAddress: string;
  originCoords: Coordinates;
  targetCoords: Coordinates;
  dLatRad: number;
  dLonRad: number;
  lat1Rad: number;
  lat2Rad: number;
  a: number;
  c: number;
  rawMeters: number;
  uiMeters: number;
  uiCuadras: number;
  uiKm: number;
  manhattanMeters: number;
  evaPeronDiscrepancyMeters: number;
}

/**
 * Computes all internal mathematical steps of the Haversine formula
 */
export function computeHaversineDetails(
  origin: Coordinates,
  target: Coordinates,
  pharmacyName = 'Destino',
  pharmacyAddress = ''
): HaversineDebugStep {
  const R = 6371000;
  const toRad = Math.PI / 180;
  const dLatRad = (target.lat - origin.lat) * toRad;
  const dLonRad = (target.lng - origin.lng) * toRad;
  const lat1Rad = origin.lat * toRad;
  const lat2Rad = target.lat * toRad;

  const a =
    Math.sin(dLatRad / 2) * Math.sin(dLatRad / 2) +
    Math.cos(lat1Rad) * Math.cos(lat2Rad) *
    Math.sin(dLonRad / 2) * Math.sin(dLonRad / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const rawMeters = R * c;
  const uiMeters = Math.round(rawMeters);
  const uiCuadras = Math.max(1, Math.round(uiMeters / 100));
  const uiKm = parseFloat((uiMeters / 1000).toFixed(2));

  const latMeters = Math.abs(target.lat - origin.lat) * 111139;
  const lonMeters = Math.abs(target.lng - origin.lng) * 111139 * Math.cos(lat1Rad);
  const manhattanMeters = Math.round(latMeters + lonMeters);

  const evaPeronMeters = calculateHaversineDistanceMeters(-38.876646, -62.066955, target.lat, target.lng);

  return {
    pharmacyName,
    pharmacyAddress,
    originCoords: origin,
    targetCoords: target,
    dLatRad,
    dLonRad,
    lat1Rad,
    lat2Rad,
    a,
    c,
    rawMeters,
    uiMeters,
    uiCuadras,
    uiKm,
    manhattanMeters,
    evaPeronDiscrepancyMeters: evaPeronMeters
  };
}

/**
 * Console diagnostic helper for Haversine verification
 */
export function logHaversineDebugComparison(
  origin: Coordinates,
  pharmacies: Array<{ name: string; address?: string; lat: number; lng: number }>,
  originLabel = 'Ubicación actual'
): HaversineDebugStep[] {
  const steps = pharmacies.map((p) =>
    computeHaversineDetails(origin, { lat: p.lat, lng: p.lng }, p.name, p.address || '')
  );
  console.group(`🔬 [HAVERSINE] Distancias desde ${originLabel}`);
  console.table(
    steps.map((s, idx) => ({
      '#': idx + 1,
      Farmacia: s.pharmacyName,
      Dirección: s.pharmacyAddress,
      Metros: s.uiMeters,
      Cuadras: s.uiCuadras
    }))
  );
  console.groupEnd();
  return steps;
}

/**
 * Optimized sorting function using the Haversine formula.
 * Strictly sorts ascending (closest first).
 */
export function sortByHaversineDistance<T extends { lat: number; lng: number; name?: string }>(
  items: T[],
  origin: Coordinates
): (T & { distMeters: number; distKm: number })[] {
  if (!items || items.length === 0) return [];

  const withDistances = items.map((item) => {
    const distMeters = calculateHaversineDistanceMeters(
      origin.lat,
      origin.lng,
      item.lat,
      item.lng
    );
    const distKm = distMeters / 1000;
    return {
      ...item,
      distMeters,
      distKm
    };
  });

  return withDistances.sort((a, b) => {
    if (a.distMeters !== b.distMeters) {
      return a.distMeters - b.distMeters;
    }
    return (a.name || '').localeCompare(b.name || '');
  });
}

export function formatMetersDistance(meters: number | null | undefined): string {
  if (meters == null || isNaN(meters)) return '';
  if (meters < 1000) {
    return `${meters} metros`;
  }
  const km = (meters / 1000).toFixed(2).replace('.', ',');
  return `${km} km (${meters.toLocaleString('es-AR')} m)`;
}

export function formatDistance(km: number | null | undefined): string {
  if (km == null || isNaN(km)) return '';
  if (km < 1) {
    const meters = Math.round(km * 1000);
    return `${meters} m`;
  }
  return `${km.toFixed(1).replace('.', ',')} km`;
}

export function formatPharmacyDistanceBadge(
  meters: number | null | undefined,
  options: { compact?: boolean; includeApprox?: boolean } = {}
): string {
  if (meters == null || isNaN(meters)) return '';
  if (meters >= 1000) {
    const kmStr = (meters / 1000).toFixed(1).replace('.', ',');
    return `a ${kmStr} km`;
  }
  const cuadras = Math.max(1, Math.round(meters / 100));
  const unit = cuadras === 1 ? 'cuadra' : 'cuadras';
  const tilde = options.includeApprox ? '~' : '';
  return `a ${meters} m (${tilde}${cuadras} ${unit})`;
}

export interface DirectionTarget {
  name?: string;
  address: string;
  lat?: number;
  lng?: number;
}

/**
 * Generates Google Maps directions URL.
 * Prioritizes exact destination coordinates when available so Google Maps never routes
 * to the wrong house block on long avenues like Paso, Roca, or Brown.
 */
export function getDirectionsUrl(
  dest: DirectionTarget | number,
  destLngOrOrigin?: number | Coordinates | null,
  originOrAddress?: Coordinates | null | string,
  maybeAddress?: string,
  maybeName?: string
): string {
  let address = '';
  let name = '';
  let origin: Coordinates | null | undefined = null;
  let lat: number | undefined;
  let lng: number | undefined;

  if (typeof dest === 'object' && dest !== null) {
    address = dest.address || '';
    name = dest.name || '';
    lat = dest.lat;
    lng = dest.lng;
    origin = destLngOrOrigin as (Coordinates | null | undefined);
  } else if (typeof dest === 'number') {
    lat = dest;
    lng = typeof destLngOrOrigin === 'number' ? destLngOrOrigin : undefined;
    origin = originOrAddress as (Coordinates | null | undefined);
    address = typeof maybeAddress === 'string' ? maybeAddress : '';
    name = typeof maybeName === 'string' ? maybeName : '';
  }

  const cleanAddr = address.replace(/°/g, '').trim();

  let destinationQuery = '';
  if (typeof lat === 'number' && typeof lng === 'number' && Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && lng !== 0) {
    destinationQuery = `${lat},${lng}`;
  } else if (cleanAddr) {
    const hasCity = cleanAddr.toLowerCase().includes('punta alta');
    const suffix = hasCity ? ', Buenos Aires, Argentina' : ', Punta Alta, Buenos Aires, Argentina';
    destinationQuery = name ? `${name}, ${cleanAddr}${suffix}` : `${cleanAddr}${suffix}`;
  } else if (name) {
    destinationQuery = `${name}, Punta Alta, Buenos Aires, Argentina`;
  } else {
    destinationQuery = 'Punta Alta, Buenos Aires, Argentina';
  }

  const params = new URLSearchParams();
  params.set('api', '1');
  params.set('travelmode', 'walking');
  params.set('destination', destinationQuery);

  if (
    origin &&
    typeof origin.lat === 'number' &&
    typeof origin.lng === 'number' &&
    isVerifiedEmergencyCoords(origin)
  ) {
    params.set('origin', `${origin.lat},${origin.lng}`);
  }

  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

export function getMapSearchUrl(query: string, name?: string): string {
  const clean = query.replace(/°/g, '').trim();
  const text = name ? `${name}, ${clean}` : clean;
  const hasCity = text.toLowerCase().includes('punta alta');
  const full = hasCity ? `${text}, Buenos Aires, Argentina` : `${text}, Punta Alta, Buenos Aires, Argentina`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(full)}`;
}

/**
 * Generates a Google Maps nearby search URL centered directly on the user's real GPS coordinates.
 * Essential when traveling outside Punta Alta (vacations/highways) to locate the closest ER or open pharmacy.
 */
export function getNearbyMapSearchUrl(searchTerms: string, coords: Coordinates): string {
  const cleanQuery = (searchTerms || 'hospital').trim().replace(/\s+/g, '+');
  return `https://www.google.com/maps/search/${encodeURIComponent(cleanQuery).replace(/%2B/g, '+')}/@${coords.lat},${coords.lng},14z`;
}

export function calculateBearingAngle(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = Math.PI / 180;
  const toDeg = 180 / Math.PI;
  const y = Math.sin((lon2 - lon1) * toRad) * Math.cos(lat2 * toRad);
  const x =
    Math.cos(lat1 * toRad) * Math.sin(lat2 * toRad) -
    Math.sin(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.cos((lon2 - lon1) * toRad);
  const brng = Math.atan2(y, x) * toDeg;
  return Math.round((brng + 360) % 360);
}

export interface CardinalBearing {
  angle: number;
  code: string;
  label: string;
  arrow: string;
}

export function getCardinalBearing(angle: number): CardinalBearing {
  const directions: Array<{ code: string; label: string; arrow: string }> = [
    { code: 'N', label: 'Norte', arrow: '↑' },
    { code: 'NE', label: 'Noreste', arrow: '↗' },
    { code: 'E', label: 'Este', arrow: '→' },
    { code: 'SE', label: 'Sureste', arrow: '↘' },
    { code: 'S', label: 'Sur', arrow: '↓' },
    { code: 'SO', label: 'Suroeste', arrow: '↙' },
    { code: 'O', label: 'Oeste', arrow: '←' },
    { code: 'NO', label: 'Noroeste', arrow: '↖' }
  ];
  const idx = Math.round(angle / 45) % 8;
  return {
    angle,
    ...directions[idx]
  };
}

export function getClosestPuntaAltaSpot(coords: Coordinates): { spot: LandmarkSpot; distMeters: number } {
  let closest = POPULAR_PUNTA_ALTA_SPOTS[0];
  let minMeters = 999999;
  for (const spot of POPULAR_PUNTA_ALTA_SPOTS) {
    const d = calculateHaversineDistanceMeters(coords.lat, coords.lng, spot.coords.lat, spot.coords.lng);
    if (d < minMeters) {
      minMeters = d;
      closest = spot;
    }
  }
  return { spot: closest, distMeters: minMeters };
}

async function queryNominatimPuntaAlta(
  query: string
): Promise<{ coords: Coordinates; label: string; isHouseMatch: boolean } | null> {
  if (typeof fetch === 'undefined') return null;

  const clean = query.trim();
  const hasCity = clean.toLowerCase().includes('punta alta') || clean.toLowerCase().includes('rosales');
  const fullQuery = hasCity ? clean : `${clean}, Punta Alta, Buenos Aires, Argentina`;

  // Punta Alta + Coronel Rosales bounding box (west,north,east,south)
  const boundedUrl =
    `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=3&countrycodes=ar` +
    `&viewbox=-62.16,-38.82,-62.00,-38.93&bounded=1&q=${encodeURIComponent(fullQuery)}`;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);
    const resp = await fetch(boundedUrl, {
      signal: controller.signal,
      headers: { Accept: 'application/json' }
    });
    clearTimeout(timer);
    if (resp.ok) {
      const results = await resp.json();
      if (Array.isArray(results) && results.length > 0) {
        const first = results[0];
        const lat = parseFloat(first.lat);
        const lng = parseFloat(first.lon);
        const isHouseMatch =
          Boolean(first.address?.house_number) ||
          first.type === 'house' ||
          first.addresstype === 'place';
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          return {
            coords: { lat, lng, source: 'manual', timestamp: Date.now(), label: clean },
            label: clean,
            isHouseMatch
          };
        }
      }
    }
  } catch {
    // ignore network timeout and fall back below
  }

  return null;
}

const reverseGeocodeCache = new Map<string, string | null>();

/**
 * Reverse-geocodes live GPS coordinates in Punta Alta to show the user's real street
 * (e.g. "Avenida Colón · Centro") instead of only a coarse zone landmark.
 */
export async function reverseGeocodePuntaAlta(coords: Coordinates | null): Promise<string | null> {
  if (!coords || typeof fetch === 'undefined' || !isWithinPuntaAltaArea(coords)) return null;
  const cacheKey = `${coords.lat.toFixed(4)},${coords.lng.toFixed(4)}`;
  if (reverseGeocodeCache.has(cacheKey)) {
    return reverseGeocodeCache.get(cacheKey) ?? null;
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    const url =
      `https://nominatim.openstreetmap.org/reverse?format=json&addressdetails=1&zoom=18` +
      `&lat=${encodeURIComponent(String(coords.lat))}&lon=${encodeURIComponent(String(coords.lng))}`;
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' }
    });
    clearTimeout(timer);
    if (resp.ok) {
      const data = await resp.json();
      const addr = data?.address;
      if (addr?.road) {
        const roadPart = addr.house_number ? `${addr.road} ${addr.house_number}` : addr.road;
        const areaPart = addr.suburb || addr.neighbourhood || addr.quarter || '';
        const formatted = areaPart ? `${roadPart} · ${areaPart}` : roadPart;
        reverseGeocodeCache.set(cacheKey, formatted);
        return formatted;
      }
    }
  } catch {
    // ignore network timeout
  }

  reverseGeocodeCache.set(cacheKey, null);
  return null;
}

/**
 * Resolves any address query in Punta Alta using:
 * 1. Exact calibrated Punta Alta addresses & neighborhoods (instant, offline-safe)
 * 2. Calibrated street+height interpolation when a numeric height is given and Nominatim lacks house numbers
 * 3. Live OpenStreetMap Nominatim bounded to Punta Alta (works on static Netlify & PWA)
 * 4. Backend /api/geocode (when Express server is running, rejecting fake fallback)
 * 5. Calibrated local street grid & intersection estimator
 */
export async function fetchGeocodedLocation(query: string): Promise<{ coords: Coordinates; label: string } | null> {
  const trimmed = (query || '').trim();
  if (!trimmed) return null;

  const norm = normalizeGeoText(trimmed);

  // 1. Exact calibrated addresses & neighborhoods first
  for (const [key, coords] of Object.entries(PUNTA_ALTA_EXACT_ADDRESSES)) {
    if (norm.includes(key)) {
      return {
        coords: { ...coords, source: 'manual', timestamp: Date.now(), label: trimmed },
        label: trimmed
      };
    }
  }
  for (const [key, coords] of Object.entries(PUNTA_ALTA_NEIGHBORHOODS)) {
    if (norm.includes(key)) {
      return {
        coords: { ...coords, source: 'manual', timestamp: Date.now(), label: trimmed },
        label: trimmed
      };
    }
  }

  // Compute local calibrated street+height estimate in advance (without center fallback)
  const hasExplicitHeight = /\b\d{1,5}\b/.test(norm);
  const gridEstimate = estimateCoordsFromPuntaAltaAddress(trimmed, { allowCenterFallback: false });

  // 2. Live OpenStreetMap Nominatim directly from client
  const nominatimHit = await queryNominatimPuntaAlta(trimmed);
  if (nominatimHit) {
    // If the user asked for a specific street height (e.g. "Colón 100") and Nominatim only returned
    // the generic highway centroid without a house number, prefer our calibrated street+height interpolation!
    if (hasExplicitHeight && !nominatimHit.isHouseMatch && gridEstimate) {
      return {
        coords: { ...gridEstimate, source: 'manual', timestamp: Date.now(), label: trimmed },
        label: trimmed
      };
    }
    return { coords: nominatimHit.coords, label: nominatimHit.label };
  }

  // 3. Backend /api/geocode (if Express server is active)
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2500);
    const resp = await fetch(`/api/geocode?q=${encodeURIComponent(trimmed)}`, {
      signal: controller.signal
    });
    clearTimeout(timer);
    if (resp.ok) {
      const data = await resp.json();
      if (
        data.success &&
        data.source !== 'fallback' &&
        typeof data.lat === 'number' &&
        typeof data.lng === 'number'
      ) {
        return {
          coords: { lat: data.lat, lng: data.lng, source: 'manual', timestamp: Date.now(), label: trimmed },
          label: data.label || trimmed
        };
      }
    }
  } catch {
    // Static hosting (Netlify) or offline - continue to calibrated street estimator
  }

  // 4. Calibrated local street grid & intersection fallback (returns null if truly unrecognized)
  if (gridEstimate) {
    return {
      coords: { ...gridEstimate, source: 'manual', timestamp: Date.now(), label: trimmed },
      label: trimmed
    };
  }

  return null;
}

/**
 * Calculates initial geodesic bearing in degrees [0, 360) from origin to target (0 = North, 90 = East).
 */
export function calculateBearingDegrees(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number }
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const toDeg = (rad: number) => (rad * 180) / Math.PI;
  const lat1 = toRad(from.lat);
  const lat2 = toRad(to.lat);
  const dLng = toRad(to.lng - from.lng);

  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  const brng = (toDeg(Math.atan2(y, x)) + 360) % 360;
  return Math.round(brng);
}

/**
 * Converts a compass bearing [0..360) into natural Argentine Spanish cardinal directions.
 */
export function bearingToSpanishCardinal(deg: number): string {
  const norm = ((deg % 360) + 360) % 360;
  const dirs = [
    'el Norte',
    'el Noreste',
    'el Este',
    'el Sudeste',
    'el Sur',
    'el Sudoeste',
    'el Oeste',
    'el Noroeste'
  ];
  const idx = Math.round(norm / 45) % 8;
  return dirs[idx];
}

/**
 * Converts target compass bearing and device heading into a blind mobility clock-face instruction.
 */
export function relativeBearingToClockFace(
  targetBearingDeg: number,
  deviceHeadingDeg: number
): { clockLabel: string; relativeDeg: number } {
  const rawDiff = ((targetBearingDeg - deviceHeadingDeg + 540) % 360) - 180;
  const hourFloat = ((rawDiff + 360) % 360) / 30;
  let hour = Math.round(hourFloat);
  if (hour === 0) hour = 12;

  let sideHint = '';
  if (hour === 12 || Math.abs(rawDiff) <= 20) {
    sideHint = 'justo de frente a vos, a las 12 en punto';
  } else if (hour === 6 || Math.abs(rawDiff) >= 160) {
    sideHint = 'detrás tuyo, a las 6 en punto';
  } else if (rawDiff > 0 && rawDiff < 160) {
    sideHint = `a tu derecha, aproximadamente a las ${hour} en punto`;
  } else {
    sideHint = `a tu izquierda, aproximadamente a las ${hour} en punto`;
  }

  return { clockLabel: sideHint, relativeDeg: rawDiff };
}


