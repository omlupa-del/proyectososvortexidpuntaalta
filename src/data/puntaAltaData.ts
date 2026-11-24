export interface Pharmacy {
  id: string;
  name: string;
  address: string;
  phones: string[];
  whatsapp?: string;
  lat: number;
  lng: number;
  notes?: string;
}

export interface EmergencyContact {
  id: string;
  title: string;
  subtitle: string;
  number: string;
  icon: string;
  category: 'police' | 'medical' | 'fire' | 'civil' | 'naval';
  color: string;
  directDial: string;
  mapQuery: string;
}

// 20 Verified Punta Alta Pharmacies with real approximate coordinates in Punta Alta (centered ~ -38.878, -62.076)
export const PUNTA_ALTA_PHARMACIES: Pharmacy[] = [
  {
    id: "f1",
    name: "Farmacia Zandonadi",
    address: "Brown 151",
    phones: ["(02932) 43-2443"],
    lat: -38.884372,
    lng: -62.074566
  },
  {
    id: "f2",
    name: "Farmacia Barresi",
    address: "Murature 1147",
    phones: ["(0291) 427-6565", "(02932) 43-3317"],
    lat: -38.871725,
    lng: -62.076424
  },
  {
    id: "f3",
    name: "Farmacia El Águila",
    address: "Bernardo de Irigoyen 111",
    phones: ["(02932) 42-2338"],
    lat: -38.882250,
    lng: -62.081471
  },
  {
    id: "f4",
    name: "Farmacia Fontanarrosa",
    address: "25 de Mayo 345",
    phones: ["(02932) 42-5099"],
    lat: -38.882494,
    lng: -62.078526
  },
  {
    id: "f5",
    name: "Farmacia De Dios",
    address: "Brown 1535",
    phones: ["(02932) 42-8134"],
    lat: -38.867813,
    lng: -62.079079
  },
  {
    id: "f6",
    name: "Farmacia Ausili",
    address: "Humberto I 756",
    phones: ["(02932) 43-3660"],
    lat: -38.877942,
    lng: -62.083025
  },
  {
    id: "f7",
    name: "Farmacia Bussinelli",
    address: "Saavedra 36",
    phones: ["(02932) 42-1555"],
    lat: -38.886291,
    lng: -62.070441
  },
  {
    id: "f8",
    name: "Maciel Farmacia y Perfumería",
    address: "Av. Tucumán 138 (Acceso Ruta 249)",
    phones: ["(02932) 51-1635"],
    notes: "Boulevard Papa Francisco · Acceso Ruta 249",
    lat: -38.881948,
    lng: -62.062903
  },
  {
    id: "f9",
    name: "Farmacia Veron",
    address: "Brown 502 (esq. Rivadavia)",
    phones: ["(02932) 42-7979"],
    whatsapp: "5492932427979",
    lat: -38.879916,
    lng: -62.076030,
    notes: "Farmacia destacada · Brown y Rivadavia"
  },
  {
    id: "f10",
    name: "Nueva Farmacia del Puerto",
    address: "Bernardo de Irigoyen 438",
    phones: ["(02932) 42-2151", "(02932) 43-3783"],
    lat: -38.881307,
    lng: -62.076707
  },
  {
    id: "f11",
    name: "Farmacia Galeno",
    address: "Mitre 913",
    phones: ["(02932) 42-7373"],
    lat: -38.877897,
    lng: -62.070284
  },
  {
    id: "f12",
    name: "Farmacia Curie",
    address: "25 de Mayo 571",
    phones: ["(02932) 43-4000"],
    lat: -38.879632,
    lng: -62.079306
  },
  {
    id: "f13",
    name: "Farmacia del Barrio",
    address: "Juan José Paso 2132",
    phones: ["(02932) 43-5333"],
    lat: -38.862621,
    lng: -62.082704
  },
  {
    id: "f14",
    name: "Farmacia Marqués",
    address: "Roca 2411",
    phones: ["(02932) 42-1110"],
    lat: -38.860361,
    lng: -62.085944
  },
  {
    id: "f15",
    name: "Farmacia Argentina",
    address: "Rivadavia 199 (esq. Colón)",
    phones: ["(02932) 42-1652", "(02932) 43-1900"],
    notes: "Esquina Av. Colón y Rivadavia (Centro)",
    lat: -38.880805,
    lng: -62.080533
  },
  {
    id: "f16",
    name: "Farmacia García",
    address: "Espora 428",
    phones: ["(02932) 42-2400"],
    notes: "Espora e/ Bernardo de Irigoyen y Mitre (Centro)",
    lat: -38.880344,
    lng: -62.072798
  },
  {
    id: "f17",
    name: "Farmacia Pereyra",
    address: "9 de Julio 1262",
    phones: ["(02932) 43-0012"],
    lat: -38.871750,
    lng: -62.066589
  },
  {
    id: "f18",
    name: "Farmacia Palavecino",
    address: "Mitre 1202",
    phones: ["(02932) 40-3535"],
    lat: -38.876973,
    lng: -62.065982
  },
  {
    id: "f19",
    name: "Farmacia Punta Alta",
    address: "Hipólito Yrigoyen 860",
    phones: ["(02932) 43-3054"],
    lat: -38.889648,
    lng: -62.067093
  },
  {
    id: "f20",
    name: "Farmacia del León",
    address: "Humberto I 445",
    phones: ["(02932) 42-1653"],
    lat: -38.881605,
    lng: -62.081723
  }
];

// Rotating duty schedule and verified Calendar of Colegio de Farmacéuticos for Punta Alta
export const TURNOS_PUNTA_ALTA: Record<string, string[]> = {
  "2026-10-01": ["f1", "f2"],
  "2026-10-02": ["f3", "f4"],
  "2026-10-03": ["f5", "f6", "f7"],
  "2026-10-04": ["f5", "f8", "f9"],
  "2026-10-05": ["f10", "f11"],
  "2026-10-06": ["f12", "f13"],
  "2026-10-07": ["f4", "f14"],
  "2026-10-08": ["f7", "f8"],
  "2026-10-09": ["f15", "f9"],
  "2026-10-10": ["f12", "f13", "f16"],
  "2026-10-11": ["f12", "f13", "f16"],
  "2026-10-12": ["f8", "f13"],
  "2026-10-13": ["f3", "f17"],
  "2026-10-14": ["f10", "f11"],
  "2026-10-15": ["f13", "f8"],
  "2026-10-16": ["f18", "f2"],
  "2026-10-17": ["f3", "f19", "f17"],
  "2026-10-18": ["f3", "f14", "f10"],
  "2026-10-19": ["f7", "f20"],
  "2026-10-20": ["f13", "f8"],
  "2026-10-21": ["f6", "f2"],
  "2026-10-22": ["f19", "f17"],
  "2026-10-23": ["f10", "f11"],
  "2026-10-24": ["f15", "f9", "f8"],
  "2026-10-25": ["f15", "f9", "f13"],
  "2026-10-26": ["f8", "f16"], // Maciel (Av. Tucumán 138) + García (Espora 428)
  "2026-10-27": ["f14", "f18"], // Marqués (Roca 2411) + Palavecino (Mitre 1202)
  "2026-10-28": ["f5", "f20"],  // De Dios (Brown 1535) + del León (Humberto I 445)
  "2026-10-29": ["f8", "f9"],   // Maciel + Veron
  "2026-10-30": ["f1", "f2"],   // Zandonadi + Barresi
  "2026-10-31": ["f4", "f18", "f14"],

  // NOVIEMBRE 2026 (Oficial Colegio de Farmacéuticos de Coronel Rosales - 08:30 a 08:30 hs)
  "2026-11-01": ["f4", "f18", "f7"],   // Fontanarrosa - Palavecino - Bussinelli
  "2026-11-02": ["f9", "f19"],         // Veron - Punta Alta
  "2026-11-03": ["f10", "f11"],        // Del Puerto - Galeno
  "2026-11-04": ["f12", "f13"],        // Curie - Del Barrio
  "2026-11-05": ["f4", "f14"],         // Fontanarrosa - Marqués
  "2026-11-06": ["f7", "f5"],          // Bussinelli - De Dios
  "2026-11-07": ["f11", "f10"],        // Galeno - Del Puerto
  "2026-11-08": ["f11", "f2", "f19"],  // Galeno - Barresi - Punta Alta
  "2026-11-09": ["f15", "f9"],         // Argentina - Veron
  "2026-11-10": ["f6", "f1"],          // Ausili - Zandonadi
  "2026-11-11": ["f3", "f17"],         // El Águila - Pereyra
  "2026-11-12": ["f10", "f11"],        // Del Puerto - Galeno
  "2026-11-13": ["f13", "f16"],        // Del Barrio - García
  "2026-11-14": ["f1", "f2", "f6"],    // Zandonadi - Barresi - Ausili
  "2026-11-15": ["f1", "f17", "f20"],  // Zandonadi - Pereyra - Del León
  "2026-11-16": ["f4", "f18"],         // Fontanarrosa - Palavecino
  "2026-11-17": ["f7", "f20"],         // Bussinelli - Del León
  "2026-11-18": ["f15", "f8"],         // Argentina - Maciel
  "2026-11-19": ["f6", "f2"],          // Ausili - Barresi
  "2026-11-20": ["f19", "f17"],        // Punta Alta - Pereyra
  "2026-11-21": ["f13", "f20", "f7"],  // Del Barrio - Del León - Bussinelli
  "2026-11-22": ["f5", "f6", "f8"],    // De Dios - Ausili - Maciel
  "2026-11-23": ["f10", "f11"],        // Del Puerto - Galeno
  "2026-11-24": ["f12", "f16"],        // Curie - García
  "2026-11-25": ["f14", "f18"],        // Marqués - Palavecino
  "2026-11-26": ["f5", "f2"],          // De Dios - Barresi
  "2026-11-27": ["f8", "f9"],          // Maciel - Veron
  "2026-11-28": ["f12", "f5", "f16"],  // Curie - De Dios - García
  "2026-11-29": ["f12", "f2", "f16"],  // Curie - Barresi - García
  "2026-11-30": ["f1", "f2"],          // Zandonadi - Barresi

  // DICIEMBRE 2026 (Oficial Colegio de Farmacéuticos de Coronel Rosales - 08:30 a 08:30 hs)
  "2026-12-01": ["f3", "f19"],         // El Águila - Punta Alta
  "2026-12-02": ["f10", "f11"],        // Del Puerto - Galeno
  "2026-12-03": ["f12", "f13"],        // Curie - Del Barrio
  "2026-12-04": ["f4", "f14"]          // Fontanarrosa - Marqués
};

// 10 Balanced rotation pairs for Punta Alta (covers central and outer zones)
export const PUNTA_ALTA_ROTATION_PAIRS: string[][] = [
  ["f8", "f16"],  // Maciel + García
  ["f14", "f18"], // Marqués + Palavecino
  ["f5", "f20"],  // De Dios + del León
  ["f8", "f9"],   // Maciel + Veron
  ["f15", "f3"],  // Argentina + El Águila
  ["f1", "f2"],   // Zandonadi + Barresi
  ["f4", "f6"],   // Fontanarrosa + Ausili
  ["f7", "f13"],  // Bussinelli + del Barrio
  ["f10", "f11"], // Nueva Farmacia del Puerto + Galeno
  ["f12", "f17"]  // Curie + Pereyra
];

export const VORTEX_CUSTOM_DUTY_STORAGE_KEY = 'vortex_custom_duty_pharmacies_v2';

/**
 * Extracts accurate local date/time parts for Punta Alta (America/Argentina/Buenos_Aires, UTC-3)
 */
export function getPuntaAltaTimeParts(inputDate: Date = new Date()): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  isBefore830AM: boolean;
  formattedTime: string;
} {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Argentina/Buenos_Aires',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    const parts = formatter.formatToParts(inputDate);
    const getVal = (type: string) => parts.find((p) => p.type === type)?.value || '0';
    const year = parseInt(getVal('year'), 10);
    const month = parseInt(getVal('month'), 10);
    const day = parseInt(getVal('day'), 10);
    const rawHour = parseInt(getVal('hour'), 10);
    const hour = rawHour === 24 ? 0 : rawHour;
    const minute = parseInt(getVal('minute'), 10);
    const isBefore830AM = hour < 8 || (hour === 8 && minute < 30);
    const formattedTime = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')} hs`;
    return { year, month, day, hour, minute, isBefore830AM, formattedTime };
  } catch {
    const year = inputDate.getFullYear();
    const month = inputDate.getMonth() + 1;
    const day = inputDate.getDate();
    const hour = inputDate.getHours();
    const minute = inputDate.getMinutes();
    const isBefore830AM = hour < 8 || (hour === 8 && minute < 30);
    const formattedTime = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')} hs`;
    return { year, month, day, hour, minute, isBefore830AM, formattedTime };
  }
}

// Alias mapping for detecting pharmacy names in circulars/emails from the Colegio de Farmacéuticos
export const COLEGIO_PHARMACY_ALIASES: { id: string; name: string; aliases: string[] }[] = [
  { id: 'f1', name: 'Farmacia Zandonadi', aliases: ['zandonadi', 'zandonad'] },
  { id: 'f2', name: 'Farmacia Barresi', aliases: ['barresi', 'baresi', 'murature 1147'] },
  { id: 'f3', name: 'Farmacia El Águila', aliases: ['aguila', 'el aguila', 'águila', 'el águila'] },
  { id: 'f4', name: 'Farmacia Fontanarrosa', aliases: ['fontanarrosa', 'fontanarosa', '25 de mayo 345'] },
  { id: 'f5', name: 'Farmacia De Dios', aliases: ['de dios', 'dedios', 'brown 1535'] },
  { id: 'f6', name: 'Farmacia Ausili', aliases: ['ausili', 'humberto 756'] },
  { id: 'f7', name: 'Farmacia Bussinelli', aliases: ['bussinelli', 'businelli', 'saavedra 36'] },
  { id: 'f8', name: 'Maciel Farmacia y Perfumería', aliases: ['maciel', 'tucuman', 'tucumán', 'ruta 249', 'papa francisco'] },
  { id: 'f9', name: 'Farmacia Veron', aliases: ['veron', 'verón', 'brown y rivadavia', 'brown 502'] },
  { id: 'f10', name: 'Nueva Farmacia del Puerto', aliases: ['puerto', 'farmacia del puerto', 'irigoyen 438', 'nueva farmacia del puerto'] },
  { id: 'f11', name: 'Farmacia Galeno', aliases: ['galeno', 'mitre 913'] },
  { id: 'f12', name: 'Farmacia Curie', aliases: ['curie', '25 de mayo 571'] },
  { id: 'f13', name: 'Farmacia del Barrio', aliases: ['del barrio', 'barrio', 'paso 2132', 'juan jose paso 2132'] },
  { id: 'f14', name: 'Farmacia Marqués', aliases: ['marques', 'marqués', 'roca 2411'] },
  { id: 'f15', name: 'Farmacia Argentina', aliases: ['argentina', 'colon y rivadavia', 'colón y rivadavia', 'rivadavia 199'] },
  { id: 'f16', name: 'Farmacia García', aliases: ['garcia', 'garcía', 'espora 428'] },
  { id: 'f17', name: 'Farmacia Pereyra', aliases: ['pereyra', 'pereira', '9 de julio 1262'] },
  { id: 'f18', name: 'Farmacia Palavecino', aliases: ['palavecino', 'mitre 1202'] },
  { id: 'f19', name: 'Farmacia Punta Alta', aliases: ['punta alta', 'yrigoyen 860', 'hipolito yrigoyen 860'] },
  { id: 'f20', name: 'Farmacia del León', aliases: ['del leon', 'leon', 'león', 'del león', 'humberto 445', 'humberto i 445'] }
];

/**
 * Normalizes a text string by removing accents and lowercasing for accurate matching
 */
export function normalizeText(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Parses raw text, tabular data, or circular sent by the Colegio de Farmacéuticos
 * and converts it into a dateKey -> pharmacyIds dictionary.
 */
export function parseColegioDutyRoster(
  rawText: string,
  defaultYear: number = 2026,
  defaultMonth: number = 11
): {
  schedule: Record<string, string[]>;
  matchedCount: number;
  unrecognizedLines: string[];
} {
  const schedule: Record<string, string[]> = {};
  const unrecognizedLines: string[] = [];
  const lines = rawText.split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.length < 3) continue;

    const norm = normalizeText(line);

    // Skip headers or irrelevant lines
    if (
      norm.includes('colegio de farmaceutico') ||
      norm.includes('coronel rosales') ||
      norm.includes('horario de atencion') ||
      norm.includes('guardia de 08:30') ||
      norm.includes('dias de turno')
    ) {
      continue;
    }

    // Try to extract day number and optional month: e.g. "01/11", "1 de noviembre", "Dia 1", "01:", "1 -"
    let detectedDay: number | null = null;
    let detectedMonth: number = defaultMonth;

    const SPANISH_MONTHS: Record<string, number> = {
      enero: 1, ene: 1,
      febrero: 2, feb: 2,
      marzo: 3, mar: 3,
      abril: 4, abr: 4,
      mayo: 5, may: 5,
      junio: 6, jun: 6,
      julio: 7, jul: 7,
      agosto: 8, ago: 8,
      septiembre: 9, setiembre: 9, sep: 9, set: 9,
      octubre: 10, oct: 10,
      noviembre: 11, nov: 11,
      diciembre: 12, dic: 12
    };

    const dateRegex1 = /\b(\d{1,2})\s*[\/-]\s*(\d{1,2})(?:\s*[\/-]\s*(\d{2,4}))?\b/;
    const dateRegex2 = /\b(?:dia|día|fecha)?\s*(\d{1,2})\b/i;
    const dateRegex3 = /\b(\d{1,2})\s*(?:de\s+)?(enero|ene|febrero|feb|marzo|mar|abril|abr|mayo|may|junio|jun|julio|jul|agosto|ago|septiembre|setiembre|sep|set|octubre|oct|noviembre|nov|diciembre|dic)\b/i;

    const match3 = norm.match(dateRegex3);
    const match1 = line.match(dateRegex1);
    const match2 = line.match(dateRegex2);

    if (match3) {
      detectedDay = parseInt(match3[1], 10);
      if (SPANISH_MONTHS[match3[2].toLowerCase()]) {
        detectedMonth = SPANISH_MONTHS[match3[2].toLowerCase()];
      }
    } else if (match1) {
      detectedDay = parseInt(match1[1], 10);
      const parsedM = parseInt(match1[2], 10);
      if (parsedM >= 1 && parsedM <= 12) {
        detectedMonth = parsedM;
      }
    } else if (match2) {
      detectedDay = parseInt(match2[1], 10);
    }

    if (!detectedDay || detectedDay < 1 || detectedDay > 31) {
      // If no explicit day, check if line starts with a number like "1. Garcia, Maciel"
      const prefixMatch = line.match(/^(\d{1,2})[\s.:\-)\t]/);
      if (prefixMatch) {
        detectedDay = parseInt(prefixMatch[1], 10);
      }
    }

    if (!detectedDay || detectedDay < 1 || detectedDay > 31) {
      unrecognizedLines.push(line);
      continue;
    }

    const targetMonthStr = String(detectedMonth).padStart(2, '0');
    const dayStr = String(detectedDay).padStart(2, '0');
    const dateKey = `${defaultYear}-${targetMonthStr}-${dayStr}`;

    // Find which pharmacies are mentioned in this line
    const foundIds: string[] = [];

    for (const ph of COLEGIO_PHARMACY_ALIASES) {
      for (const alias of ph.aliases) {
        const normAlias = normalizeText(alias);
        // Word boundary or containment
        const regex = new RegExp(`\\b${normAlias}\\b`, 'i');
        if (regex.test(norm) || norm.includes(normAlias)) {
          if (!foundIds.includes(ph.id)) {
            foundIds.push(ph.id);
          }
          break;
        }
      }
    }

    if (foundIds.length > 0) {
      schedule[dateKey] = foundIds;
    } else {
      unrecognizedLines.push(line);
    }
  }

  return {
    schedule,
    matchedCount: Object.keys(schedule).length,
    unrecognizedLines
  };
}

/**
 * Saves a user-confirmed override for duty pharmacies on a specific dateKey (YYYY-MM-DD)
 */
export function saveCustomDutyOverride(dateKey: string, pharmacyIds: string[], adminPin?: string): void {
  try {
    if (typeof localStorage === 'undefined') return;
    const raw = localStorage.getItem(VORTEX_CUSTOM_DUTY_STORAGE_KEY) || '{}';
    const store = JSON.parse(raw);
    store[dateKey] = pharmacyIds;
    localStorage.setItem(VORTEX_CUSTOM_DUTY_STORAGE_KEY, JSON.stringify(store));
    window.dispatchEvent(new CustomEvent('vortex_duty_updated', { detail: { dateKey, pharmacyIds } }));

    // Sync in background to server
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (adminPin) {
      headers['x-admin-pin'] = adminPin;
    }
    fetch('/api/pharmacies/duty-schedule', {
      method: 'POST',
      headers,
      body: JSON.stringify({ dateKey, pharmacyIds })
    }).catch(() => {});
  } catch {}
}

/**
 * Saves a complete multi-day schedule to localStorage and the server
 */
export async function saveFullDutySchedule(
  newSchedule: Record<string, string[]>,
  adminPin?: string
): Promise<boolean> {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(VORTEX_CUSTOM_DUTY_STORAGE_KEY) || '{}';
      const store = { ...JSON.parse(raw), ...newSchedule };
      localStorage.setItem(VORTEX_CUSTOM_DUTY_STORAGE_KEY, JSON.stringify(store));
      window.dispatchEvent(new CustomEvent('vortex_duty_updated', { detail: { schedule: newSchedule } }));
    }

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (adminPin) {
      headers['x-admin-pin'] = adminPin;
    }
    const res = await fetch('/api/pharmacies/duty-schedule', {
      method: 'POST',
      headers,
      body: JSON.stringify({ schedule: newSchedule })
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Synchronizes duty schedule from server into local memory / localStorage
 */
export async function syncDutyScheduleFromServer(): Promise<Record<string, string[]>> {
  try {
    const res = await fetch('/api/pharmacies/duty-schedule');
    if (res.ok) {
      const data = await res.json();
      if (data && data.schedule && typeof data.schedule === 'object') {
        if (typeof localStorage !== 'undefined') {
          const raw = localStorage.getItem(VORTEX_CUSTOM_DUTY_STORAGE_KEY) || '{}';
          const localStore = JSON.parse(raw);
          const merged = { ...data.schedule, ...localStore };
          localStorage.setItem(VORTEX_CUSTOM_DUTY_STORAGE_KEY, JSON.stringify(merged));
          return merged;
        }
        return data.schedule;
      }
    }
  } catch {}
  return getCustomDutyOverrides();
}

/**
 * Resets user-confirmed override for a specific dateKey or clears all
 */
export function clearCustomDutyOverride(dateKey?: string): void {
  try {
    if (typeof localStorage === 'undefined') return;
    if (!dateKey) {
      localStorage.removeItem(VORTEX_CUSTOM_DUTY_STORAGE_KEY);
    } else {
      const raw = localStorage.getItem(VORTEX_CUSTOM_DUTY_STORAGE_KEY) || '{}';
      const store = JSON.parse(raw);
      delete store[dateKey];
      localStorage.setItem(VORTEX_CUSTOM_DUTY_STORAGE_KEY, JSON.stringify(store));
    }
    window.dispatchEvent(new CustomEvent('vortex_duty_updated', { detail: { dateKey } }));
  } catch {}
}

export function getCustomDutyOverrides(): Record<string, string[]> {
  try {
    if (typeof localStorage === 'undefined') return {};
    const raw = localStorage.getItem(VORTEX_CUSTOM_DUTY_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export interface DutyShiftInfo {
  pharmacyIds: string[];
  isOfficial: boolean;
  isCustomOverride: boolean;
  dateKey: string;
  shiftLabel: string;
  isNightShift: boolean;
  activeWindow: string;
  currentTimeInPuntaAlta: string;
}

/**
 * Returns duty pharmacy IDs for any given date and time.
 * In Punta Alta, shifts run from 08:30 hs to 08:30 hs the next day.
 */
export function getDutyPharmaciesForDate(
  date: Date = new Date(),
  shiftPreference?: 'active_now' | 'next_shift'
): DutyShiftInfo {
  const paTime = getPuntaAltaTimeParts(date);

  // Construct Punta Alta calendar date safely at local noon so TZ offsets never shift the day
  const base = new Date(paTime.year, paTime.month - 1, paTime.day, 12, 0, 0, 0);

  // Determine whether this is considered the active night shift (before 08:30 hs in Punta Alta)
  let isNightShift = paTime.isBefore830AM;

  if (shiftPreference === 'active_now') {
    isNightShift = paTime.isBefore830AM;
  } else if (shiftPreference === 'next_shift') {
    isNightShift = false;
  }

  // If viewing active shift before 08:30 hs, the shift started yesterday at 08:30 hs
  if (isNightShift) {
    base.setDate(base.getDate() - 1);
  }

  const y = base.getFullYear();
  const m = String(base.getMonth() + 1).padStart(2, '0');
  const d = String(base.getDate()).padStart(2, '0');
  const dateKey = `${y}-${m}-${d}`;
  const monthDayKey = `2026-${m}-${d}`;

  const dayName = base.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });

  let shiftLabel = "";
  let activeWindow = "";

  if (isNightShift) {
    shiftLabel = `Guardia nocturna activa (hasta 08:30 hs de hoy) · Turno del ${dayName}`;
    activeWindow = `De ayer 08:30 hs hasta hoy 08:30 hs`;
  } else {
    shiftLabel = `Guardia 24hs activa · Turno del ${dayName}`;
    activeWindow = `De hoy 08:30 hs hasta mañana 08:30 hs`;
  }

  // 1. Check custom overrides from localStorage
  try {
    const overrides = getCustomDutyOverrides();
    if (overrides[dateKey] && overrides[dateKey].length > 0) {
      return {
        pharmacyIds: overrides[dateKey],
        isOfficial: true,
        isCustomOverride: true,
        dateKey,
        shiftLabel: `${shiftLabel} (Confirmado por usuario)`,
        isNightShift,
        activeWindow,
        currentTimeInPuntaAlta: paTime.formattedTime
      };
    }
  } catch {}

  // 2. Check official table by exact date key (e.g. 2026-10-26)
  if (TURNOS_PUNTA_ALTA[dateKey]) {
    return {
      pharmacyIds: TURNOS_PUNTA_ALTA[dateKey],
      isOfficial: true,
      isCustomOverride: false,
      dateKey,
      shiftLabel,
      isNightShift,
      activeWindow,
      currentTimeInPuntaAlta: paTime.formattedTime
    };
  }

  // 3. Check official table by month-day
  if (TURNOS_PUNTA_ALTA[monthDayKey]) {
    return {
      pharmacyIds: TURNOS_PUNTA_ALTA[monthDayKey],
      isOfficial: true,
      isCustomOverride: false,
      dateKey,
      shiftLabel,
      isNightShift,
      activeWindow,
      currentTimeInPuntaAlta: paTime.formattedTime
    };
  }

  // 4. Deterministic 10-pair cyclical rotation for any date
  const dayNumber = Math.floor(base.getTime() / (1000 * 60 * 60 * 24));
  const pairIndex = Math.abs(dayNumber) % PUNTA_ALTA_ROTATION_PAIRS.length;
  const pair = PUNTA_ALTA_ROTATION_PAIRS[pairIndex];

  return {
    pharmacyIds: pair,
    isOfficial: false,
    isCustomOverride: false,
    dateKey,
    shiftLabel,
    isNightShift,
    activeWindow,
    currentTimeInPuntaAlta: paTime.formattedTime
  };
}

// Emergency Services in Punta Alta
export const EMERGENCY_SERVICES: EmergencyContact[] = [
  {
    id: "911",
    title: "911 · Emergencias",
    subtitle: "Policía Comunal / Comando de Patrullas",
    number: "911",
    directDial: "911",
    icon: "🚨",
    category: "police",
    color: "from-red-600 to-rose-700",
    mapQuery: "Comisaría Punta Alta"
  },
  {
    id: "107",
    title: "107 · Ambulancia y Salud",
    subtitle: "Hospital Municipal Eva Perón (Urgencias)",
    number: "107",
    directDial: "107",
    icon: "🚑",
    category: "medical",
    color: "from-emerald-600 to-green-700",
    mapQuery: "Hospital Municipal Eva Peron Punta Alta"
  },
  {
    id: "100",
    title: "100 · Bomberos Voluntarios",
    subtitle: "Cuartel Central Mitre 537",
    number: "100",
    directDial: "100",
    icon: "🔥",
    category: "fire",
    color: "from-amber-600 to-orange-700",
    mapQuery: "Bomberos Voluntarios Punta Alta"
  },
  {
    id: "103",
    title: "103 · Defensa Civil",
    subtitle: "Municipio Coronel Rosales · Temporal / Inundación",
    number: "103",
    directDial: "103",
    icon: "⛑️",
    category: "civil",
    color: "from-blue-600 to-indigo-700",
    mapQuery: "Defensa Civil Punta Alta"
  },
  {
    id: "hnpb",
    title: "Hospital Naval Puerto Belgrano",
    subtitle: "Guardia Médica 24hs · Base Naval",
    number: "(02932) 48-9600",
    directDial: "02932489600",
    icon: "🏥",
    category: "naval",
    color: "from-cyan-700 to-blue-800",
    mapQuery: "Hospital Naval Puerto Belgrano"
  },
  {
    id: "hosp_muni",
    title: "Hospital Municipal Eva Perón",
    subtitle: "Guardia Adultos y Pediátrica · Uriburu 650",
    number: "(02932) 42-1222",
    directDial: "02932421222",
    icon: "🩺",
    category: "medical",
    color: "from-teal-600 to-emerald-800",
    mapQuery: "Hospital Eva Peron Uriburu 650 Punta Alta"
  }
];

// Transport Services (Remis 24hs)
export const TRANSPORT_SERVICES = [
  {
    id: "remis_centro",
    name: "Remis Centro 24 Horas",
    address: "Espora e/ Rivadavia y Murature, Punta Alta",
    phone: "(02932) 43-9000",
    directDial: "02932439000",
    whatsapp: "5492932439000",
    description: "Servicio de remis las 24 horas en Punta Alta, Puerto Belgrano y zona."
  },
  {
    id: "remis_belgrano",
    name: "Remis Belgrano",
    address: "Paso 860, Punta Alta",
    phone: "(02932) 42-1111",
    directDial: "02932421111",
    whatsapp: "5492932421111",
    description: "Flota de remises disponible día y noche para traslados locales y a Bahía Blanca."
  }
];
