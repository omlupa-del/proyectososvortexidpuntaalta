/**
 * Live Meteorological & Severe Weather Alert Service for Punta Alta,
 * Puerto Belgrano & Coronel Rosales (Pehuen Co).
 *
 * Connects to Open-Meteo real-time atmospheric station (Lat -38.8759, Lon -62.0736)
 * and evaluates local coastal storm, sudestada, and wind gusts against SMN / Defensa Civil criteria.
 */

export interface LiveWeatherReport {
  temperature: number;
  apparentTemperature: number;
  humidity: number;
  windSpeed: number;
  windGusts: number;
  windDirection: number;
  windDirectionText: string;
  precipitation: number;
  weatherCode: number;
  conditionText: string;
  isDay: boolean;
  alertLevel: 'verde' | 'amarilla' | 'naranja' | 'roja';
  alertTitle: string;
  alertDetail: string;
  recommendations: string[];
  lastUpdated: string;
  isLive: boolean;
  source: string;
  smnUrl: string;
  defensaCivilPhone: string;
  bomberosPhone: string;
}

const STORAGE_KEY_WEATHER = 'vortex_weather_cache_v2';
const STORAGE_KEY_ADMIN_ALERT = 'vortex_admin_weather_alert_v1';

/**
 * WMO Weather Code Translator into Argentine Spanish
 */
function translateWmoCode(code: number): string {
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
      return 'Niebla costera';
    case 51:
    case 53:
    case 55:
      return 'Lloviznas intermitentes';
    case 61:
      return 'Lluvia leve';
    case 63:
      return 'Lluvia moderada';
    case 65:
      return 'Lluvia fuerte constante';
    case 80:
      return 'Chaparrones aislados';
    case 81:
      return 'Chaparrones moderados';
    case 82:
      return 'Chaparrones intensos';
    case 95:
      return 'Tormenta eléctrica';
    case 96:
    case 99:
      return 'Tormenta severa con granizo';
    default:
      return 'Condiciones variables';
  }
}

/**
 * Convert wind degrees to cardinal direction abbreviation
 */
function getWindCardinal(deg: number): string {
  const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE (Sudestada)', 'SSE', 'S', 'SSO', 'SO', 'OSO', 'O', 'ONO', 'NO', 'NNO'];
  const idx = Math.round((deg % 360) / 22.5) % 16;
  return directions[idx] || 'N';
}

/**
 * Evaluate local weather alert level calibrated to SMN Argentina thresholds
 * for Sudoeste Bonaerense / Coronel Rosales (coastal wind zone).
 * Note: Official SMN decrees come from smn.gob.ar/alertas or Admin Defensa Civil override.
 */
function evaluateAlertLevel(
  windSpeed: number,
  windGusts: number,
  weatherCode: number,
  precipitation: number
): {
  level: 'verde' | 'amarilla' | 'naranja' | 'roja';
  title: string;
  detail: string;
  recommendations: string[];
} {
  // 1. Extreme Hazard (Nivel Rojo: ráfagas >= 105 km/h, viento sostenido >= 75 km/h, granizo severo o diluvio >= 50 mm/h)
  if (windGusts >= 105 || windSpeed >= 75 || weatherCode === 96 || weatherCode === 99 || precipitation >= 50) {
    return {
      level: 'roja',
      title: '🚨 RIESGO EXTREMO · TEMPORAL SEVERO EN CORONEL ROSALES',
      detail: `Viento sostenido de ${Math.round(windSpeed)} km/h y ráfagas de ${Math.round(windGusts)} km/h con fenómeno severo. Riesgo de caída de postes, árboles y voladura de techos en Punta Alta y Pehuen Co.`,
      recommendations: [
        'Permanecé a resguardo en construcciones sólidas. No salgas a la vía pública.',
        'Desconectá artefactos eléctricos y cerrá persianas y ventanas.',
        'Evitá circular en auto o moto; no cruces calles anegadas.',
        'Ante caídas de cables o riesgo de vida, comunicate de inmediato al 103 (Defensa Civil) o 100 (Bomberos).'
      ]
    };
  }

  // 2. High Hazard (Nivel Naranja: ráfagas >= 90 km/h, viento sostenido >= 60 km/h o lluvia torrencial >= 30 mm/h)
  if (windGusts >= 90 || windSpeed >= 60 || precipitation >= 30) {
    return {
      level: 'naranja',
      title: '⚠️ ALERTA NARANJA · VIENTOS MUY FUERTES O LLUVIA INTENSA',
      detail: `Viento sostenido de ${Math.round(windSpeed)} km/h con ráfagas de ${Math.round(windGusts)} km/h en Punta Alta y zona costera.`,
      recommendations: [
        'Asegurá chapas, macetas, carteles y objetos sueltos en patios o balcones.',
        'Mantenete alejado de árboles frondosos y cables caídos.',
        'Tené a mano linterna, cargador de celular y documentación personal.',
        'Línea 103 (Defensa Civil) y 100 (Bomberos) en guardia activa.'
      ]
    };
  }

  // 3. Moderate Hazard (Nivel Amarillo SMN: viento sostenido >= 40 km/h con ráfagas >= 70 km/h, tormenta eléctrica o lluvia fuerte)
  if (
    (windSpeed >= 40 && windGusts >= 70) ||
    windGusts >= 75 ||
    weatherCode === 95 ||
    weatherCode === 65 ||
    weatherCode === 82 ||
    precipitation >= 15
  ) {
    const hasRainOrStorm = weatherCode >= 65 || precipitation > 0;
    return {
      level: 'amarilla',
      title: hasRainOrStorm
        ? '🟡 PRECAUCIÓN AMARILLA · VIENTO Y TORMENTA EN LA REGIÓN'
        : '🟡 PRECAUCIÓN AMARILLA · RÁFAGAS FUERTES EN PUNTA ALTA',
      detail: `Viento de ${Math.round(windSpeed)} km/h con ráfagas de hasta ${Math.round(windGusts)} km/h${precipitation > 0 ? ` y precipitación de ${precipitation} mm` : ''}. Verificá también el mapa oficial del SMN.`,
      recommendations: [
        'Circulá con precaución, especialmente en rutas costeras y accesos abiertos.',
        'Evitá estacionar vehículos bajo ramas grandes o postes añejos.',
        'Confirmá alertas vigentes en el mapa oficial del SMN (smn.gob.ar/alertas).'
      ]
    };
  }

  // 4. Stable Conditions (Nivel Verde — incluye brisa costera normal en Punta Alta)
  const hasBreezyGusts = windGusts >= 45;
  return {
    level: 'verde',
    title: '🟢 NIVEL VERDE · CONDICIONES METEOROLÓGICAS ESTABLES',
    detail: hasBreezyGusts
      ? `Sin alerta meteorológica activa en Punta Alta y Pehuen Co. Viento de ${Math.round(windSpeed)} km/h con ráfagas costeras moderadas de ${Math.round(windGusts)} km/h dentro de valores habituales.`
      : `Sin alertas meteorológicas activas en Punta Alta, Puerto Belgrano y Pehuen Co. Viento de ${Math.round(windSpeed)} km/h (ráfagas ${Math.round(windGusts)} km/h).`,
    recommendations: [
      'Condiciones normales según umbral del SMN para el Sudoeste Bonaerense.',
      'Línea 103 (Defensa Civil Punta Alta) disponible las 24 horas ante cualquier contingencia.',
      'SAME 107 y Hospital Municipal Eva Perón con guardia médica abierta.'
    ]
  };
}

/**
 * Fetch real-time live meteorological observations for Punta Alta
 */
export async function getLiveWeatherReport(forceRefresh = false): Promise<LiveWeatherReport> {
  const DEFAULT_REPORT: LiveWeatherReport = {
    temperature: 20,
    apparentTemperature: 19,
    humidity: 55,
    windSpeed: 12,
    windGusts: 25,
    windDirection: 75,
    windDirectionText: 'E',
    precipitation: 0,
    weatherCode: 2,
    conditionText: 'Parcialmente nublado',
    isDay: true,
    alertLevel: 'verde',
    alertTitle: '🟢 NIVEL VERDE · SIN ALERTAS EN PUNTA ALTA',
    alertDetail: 'Condiciones meteorológicas estables en Coronel Rosales, Puerto Belgrano y Pehuen Co.',
    recommendations: [
      'Seguí los partes periódicos ante cambios bruscos de viento costero.',
      'Línea 103 (Defensa Civil) y 911 (Policía) activos las 24 horas.'
    ],
    lastUpdated: new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
    isLive: false,
    source: 'Cálculo de referencia local',
    smnUrl: 'https://www.smn.gob.ar/alertas',
    defensaCivilPhone: '103',
    bomberosPhone: '100'
  };

  // Check admin manual override first (if Defensa Civil officially issued a local decree)
  try {
    const adminRaw = localStorage.getItem(STORAGE_KEY_ADMIN_ALERT);
    if (adminRaw) {
      const adminData = JSON.parse(adminRaw);
      if (adminData && adminData.active) {
        return {
          ...DEFAULT_REPORT,
          ...adminData,
          isLive: true,
          source: 'Comunicado Oficial Defensa Civil Coronel Rosales'
        };
      }
    }
  } catch {}

  // Check cached report if recent (< 8 minutes)
  if (!forceRefresh) {
    try {
      const cached = localStorage.getItem(STORAGE_KEY_WEATHER);
      if (cached) {
        const parsed = JSON.parse(cached);
        const ageMs = Date.now() - (parsed._timestamp || 0);
        if (ageMs < 8 * 60 * 1000) {
          return parsed;
        }
      }
    } catch {}
  }

  // Fetch from Open-Meteo API
  try {
    const endpoint =
      'https://api.open-meteo.com/v1/forecast?latitude=-38.8759&longitude=-62.0736&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m,wind_gusts_10m,wind_direction_10m&timezone=America%2FArgentina%2FBuenos_Aires';

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const resp = await fetch(endpoint, { signal: controller.signal });
    clearTimeout(timeout);

    if (resp.ok) {
      const data = await resp.json();
      const cur = data.current;

      const temp = Math.round(cur.temperature_2m);
      const appTemp = Math.round(cur.apparent_temperature);
      const hum = Math.round(cur.relative_humidity_2m);
      const windSpd = Math.round(cur.wind_speed_10m);
      const windGst = Math.round(cur.wind_gusts_10m);
      const windDir = cur.wind_direction_10m;
      const precip = cur.precipitation || 0;
      const wCode = cur.weather_code || 0;
      const isDay = cur.is_day === 1;

      const evalAlert = evaluateAlertLevel(windSpd, windGst, wCode, precip);

      const report: LiveWeatherReport = {
        temperature: temp,
        apparentTemperature: appTemp,
        humidity: hum,
        windSpeed: windSpd,
        windGusts: windGst,
        windDirection: windDir,
        windDirectionText: getWindCardinal(windDir),
        precipitation: precip,
        weatherCode: wCode,
        conditionText: translateWmoCode(wCode),
        isDay,
        alertLevel: evalAlert.level,
        alertTitle: evalAlert.title,
        alertDetail: evalAlert.detail,
        recommendations: evalAlert.recommendations,
        lastUpdated: new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
        isLive: true,
        source: 'Estación en vivo Open-Meteo (Punta Alta · estimación según umbrales SMN)',
        smnUrl: 'https://www.smn.gob.ar/alertas',
        defensaCivilPhone: '103',
        bomberosPhone: '100'
      };

      try {
        localStorage.setItem(
          STORAGE_KEY_WEATHER,
          JSON.stringify({ ...report, _timestamp: Date.now() })
        );
      } catch {}

      return report;
    }
  } catch (err) {
    console.warn('Could not fetch live weather from Open-Meteo:', err);
  }

  return DEFAULT_REPORT;
}

/**
 * Set or clear an administrative manual weather alert override
 */
export function setAdminWeatherOverride(alert: Partial<LiveWeatherReport> | null): void {
  try {
    if (!alert) {
      localStorage.removeItem(STORAGE_KEY_ADMIN_ALERT);
    } else {
      localStorage.setItem(
        STORAGE_KEY_ADMIN_ALERT,
        JSON.stringify({ ...alert, active: true, _timestamp: Date.now() })
      );
    }
    window.dispatchEvent(new CustomEvent('vortex_weather_updated'));
  } catch {}
}
