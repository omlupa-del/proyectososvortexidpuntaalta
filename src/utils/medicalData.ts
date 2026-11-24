import {
  Coordinates,
  isVerifiedEmergencyCoords,
  isCoarseIpCoords,
  getCoordsFreshnessInfo,
  describePuntaAltaLocation,
  isWithinPuntaAltaArea
} from './geo';
import { formatWhatsAppNumber } from './callHandler';
import { generateVerifiedFacePhoto } from './samplePhoto';
import { getEffectiveOrigin } from './systemConfig';

export interface ClinicalEvent {
  id: string;
  type: 'internacion' | 'cirugia' | 'antecedente' | 'otro';
  title: string;
  date?: string;
  institution?: string;
  details?: string;
}

export interface MedicalRecord {
  keychainId?: string; // Correlative physical keychain ID (e.g., "0042", "VTX-0042")
  nombre?: string;
  dni?: string;
  domicilio?: string;
  sangre?: string;
  enf?: string;
  med?: string;
  obraSocial?: string;
  doc?: string;
  tel?: string;
  cfam?: string;
  cami?: string;
  cmed?: string;
  foto?: string; // High-resolution (400x400) base64 portrait for Ficha de Asistencia, Badges, and Cloud
  fotoQr?: string; // Crisp compact <=1550B face thumbnail embedded in offline QR URL hashes (#d=...)
  // Datos biológicos y obstétricos (Embarazo con cálculo automático por fecha FUM)
  sexo?: 'Femenino' | 'Masculino' | 'Otro' | '';
  embarazada?: boolean;
  embarazoFum?: string; // Fecha ISO YYYY-MM-DD de última menstruación / ancla para actualizar meses y semanas automáticamente
  embarazoObstetra?: string; // Obstetra, maternidad, factor/riesgo o notas obstétricas
  // Historial Clínico confidencial (Protegido por PIN)
  historialClinico?: ClinicalEvent[];
  cirugiasPrevias?: string;
  internacionesPrevias?: string;
  antecedentesFamiliares?: string;
  historialClinicoProtected?: boolean; // Defaults to true (requires PIN)
}

export const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

export const RECORD_LABELS: Record<string, string> = {
  keychainId: 'Número de Llavero Físico (#ID Correlativo)',
  nombre: 'Nombre y apellido',
  dni: 'DNI / Documento',
  domicilio: 'Domicilio en Punta Alta',
  sangre: 'Grupo y Factor sanguíneo',
  enf: 'Enfermedades y Alergias',
  med: 'Medicamentos habituales',
  obraSocial: 'Obra Social / Prepaga (DIBA, IOMA, PAMI, etc.)',
  doc: 'Médico de cabecera',
  tel: 'Teléfono de contacto de emergencia',
  cfam: 'WhatsApp Familiar',
  cami: 'WhatsApp Amigo',
  cmed: 'WhatsApp Médico',
  foto: 'Fotografía del titular (identificación visual de seguridad)',
  sexo: 'Sexo biológico',
  embarazada: 'Estado de embarazo actual',
  embarazoFum: 'Fecha ancla de embarazo (FUM)',
  embarazoObstetra: 'Obstetra / Maternidad / Observaciones obstétricas',
  historialClinico: 'Historial Clínico (Internaciones, Cirugías, Antecedentes Familiares)',
  cirugiasPrevias: 'Cirugías importantes previas',
  internacionesPrevias: 'Fechas y motivos de internaciones previas',
  antecedentesFamiliares: 'Antecedentes clínicos familiares (hereditarios)',
  historialClinicoProtected: 'Protección con clave PIN'
};

export interface PregnancyProgress {
  isPregnant: boolean;
  hasValidAnchorDate: boolean;
  elapsedDays: number;
  weeks: number;
  days: number;
  monthsFloat: number;
  monthsDisplay: number; // e.g., 1..9 or half steps
  monthLabel: string; // e.g., "6 meses"
  detailedLabel: string; // e.g., "6 meses (26 semanas y 2 días)"
  trimester: 1 | 2 | 3;
  trimesterLabel: string;
  dueDateFormatted: string; // FPP (FUM + 280 días)
  daysRemaining: number;
  isFullTerm: boolean;
}

/**
 * Parses an ISO YYYY-MM-DD date string at local noon to avoid timezone drift.
 */
function parseLocalIsoDate(isoDate: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec((isoDate || '').trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const d = new Date(year, month, day, 12, 0, 0, 0);
  if (isNaN(d.getTime())) return null;
  return d;
}

/**
 * Formats a Date object into ISO YYYY-MM-DD using local calendar fields.
 */
export function toLocalIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Calculates an anchor FUM date (YYYY-MM-DD) from user input of weeks or months,
 * so gestational age advances automatically every day/week/month from today onward.
 */
export function computeFumFromGestationalInput(
  mode: 'semanas' | 'meses',
  amount: number,
  extraDays = 0,
  referenceDate: Date = new Date()
): string {
  const cleanAmount = Math.max(0, isNaN(amount) ? 0 : amount);
  const totalDays =
    mode === 'semanas'
      ? Math.round(cleanAmount * 7 + (extraDays || 0))
      : Math.round(cleanAmount * 30.4375 + (extraDays || 0));

  const clampedDays = Math.min(308, Math.max(0, totalDays));
  const anchor = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate(),
    12,
    0,
    0,
    0
  );
  anchor.setDate(anchor.getDate() - clampedDays);
  return toLocalIsoDate(anchor);
}

/**
 * Dynamically computes current pregnancy months, weeks, trimester, and estimated due date (FPP)
 * relative to the current date so emergency views always reflect real-time gestational age.
 */
export function calculatePregnancyProgress(
  record: MedicalRecord | null | undefined,
  referenceDate: Date = new Date()
): PregnancyProgress | null {
  if (!record || record.sexo !== 'Femenino' || !record.embarazada) {
    return null;
  }

  const fumDate = record.embarazoFum ? parseLocalIsoDate(record.embarazoFum) : null;
  if (!fumDate) {
    return {
      isPregnant: true,
      hasValidAnchorDate: false,
      elapsedDays: 0,
      weeks: 0,
      days: 0,
      monthsFloat: 0,
      monthsDisplay: 0,
      monthLabel: 'Embarazo en curso (sin fecha cargada)',
      detailedLabel: 'Embarazo en curso (sin fecha de gestación especificada)',
      trimester: 1,
      trimesterLabel: '1° Trimestre',
      dueDateFormatted: '',
      daysRemaining: 280,
      isFullTerm: false
    };
  }

  const todayNoon = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate(),
    12,
    0,
    0,
    0
  );

  const rawElapsed = Math.round((todayNoon.getTime() - fumDate.getTime()) / (1000 * 60 * 60 * 24));
  const elapsedDays = Math.min(308, Math.max(0, rawElapsed));

  const weeks = Math.floor(elapsedDays / 7);
  const days = elapsedDays % 7;

  const monthsFloat = elapsedDays / 30.4375;
  const completedMonths = Math.min(9, Math.floor(monthsFloat));
  const roundedMonth = Math.min(9, Math.max(1, Math.round(monthsFloat)));

  let monthLabel = '';
  if (elapsedDays < 28) {
    monthLabel = '1° mes (menos de 1 mes)';
  } else if (completedMonths >= 9 || weeks >= 38) {
    monthLabel = '9 meses (a término)';
  } else {
    const decimalPart = monthsFloat - completedMonths;
    if (decimalPart >= 0.35 && decimalPart <= 0.72 && completedMonths >= 1) {
      monthLabel = `${completedMonths} meses y medio`;
    } else {
      const m = roundedMonth;
      monthLabel = `${m} ${m === 1 ? 'mes' : 'meses'}`;
    }
  }

  const weekPart = `${weeks} ${weeks === 1 ? 'semana' : 'semanas'}${days > 0 ? ` y ${days} ${days === 1 ? 'día' : 'días'}` : ''}`;
  const detailedLabel = `${monthLabel} (${weekPart})`;

  const trimester: 1 | 2 | 3 = weeks < 14 ? 1 : weeks < 28 ? 2 : 3;
  const trimesterLabel = trimester === 1 ? '1° Trimestre' : trimester === 2 ? '2° Trimestre' : '3° Trimestre';

  const dueDate = new Date(fumDate.getTime());
  dueDate.setDate(dueDate.getDate() + 280);
  const dueDateFormatted = dueDate.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });

  const daysRemaining = Math.max(0, 280 - elapsedDays);

  return {
    isPregnant: true,
    hasValidAnchorDate: true,
    elapsedDays,
    weeks,
    days,
    monthsFloat: Number(monthsFloat.toFixed(1)),
    monthsDisplay: completedMonths < 1 ? 1 : completedMonths,
    monthLabel,
    detailedLabel,
    trimester,
    trimesterLabel,
    dueDateFormatted,
    daysRemaining,
    isFullTerm: weeks >= 37
  };
}

const STORAGE_KEY = 'vortexid';
const PIN_KEY = 'vortexpin';
const REGISTRY_KEY = 'vortexid_keychains';

/**
 * Encodes medical record object to URL-safe Base64
 */
export function encodeRecordToHash(record: MedicalRecord): string {
  try {
    const json = JSON.stringify(record);
    const utf8Bytes = new TextEncoder().encode(json);
    let binary = '';
    const len = utf8Bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(utf8Bytes[i]);
    }
    const base64 = btoa(binary);
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  } catch (e) {
    console.error('Error encoding record:', e);
    return '';
  }
}

/**
 * Decodes URL-safe Base64 into MedicalRecord
 */
export function decodeRecordFromHash(hashString: string): MedicalRecord | null {
  try {
    const cleaned = hashString.replace(/^#?d=/, '').replace(/^#?data=/, '');
    const standardBase64 = cleaned.replace(/-/g, '+').replace(/_/g, '/');
    const pad = standardBase64.length % 4;
    const padded = pad ? standardBase64 + '='.repeat(4 - pad) : standardBase64;
    const binaryStr = atob(padded);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    const decodedUtf8 = new TextDecoder().decode(bytes);
    const parsed = JSON.parse(decodedUtf8);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    // Fallback for legacy records encoded with escape/unescape
    try {
      const cleaned = hashString.replace(/^#?d=/, '').replace(/^#?data=/, '');
      const standardBase64 = cleaned.replace(/-/g, '+').replace(/_/g, '/');
      const pad = standardBase64.length % 4;
      const padded = pad ? standardBase64 + '='.repeat(4 - pad) : standardBase64;
      const json = decodeURIComponent(escape(atob(padded)));
      const parsed = JSON.parse(json);
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
      return null;
    }
  }
}

/**
 * Checks if a record has any populated field
 */
export function hasMedicalData(record: MedicalRecord | null | undefined): boolean {
  if (!record) return false;
  if (record.historialClinico && record.historialClinico.length > 0) return true;
  return Object.values(record).some((v) => typeof v === 'string' && v.trim().length > 0);
}

export interface LoadRecordResult {
  record: MedicalRecord | null;
  isFromLink: boolean;
  scannedKeychainNumber?: string;
  isUnlinkedScannedKeychain?: boolean;
}

/**
 * Retrieve the dictionary of correlative keychains
 */
export function getKeychainRegistry(): Record<string, MedicalRecord> {
  try {
    const raw = localStorage.getItem(REGISTRY_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/**
 * Find record by physical keychain ID (e.g. "0042", "VTX-0042")
 */
export function getRecordByKeychainId(keychainId: string): MedicalRecord | null {
  const clean = keychainId.trim().toUpperCase().replace(/^#/, '');
  const registry = getKeychainRegistry();
  if (registry[clean]) return registry[clean];

  // Also check stored primary record
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as MedicalRecord;
      if (parsed.keychainId && parsed.keychainId.trim().toUpperCase().replace(/^#/, '') === clean) {
        return parsed;
      }
    }
  } catch {
    // ignore
  }

  return null;
}

/**
 * Link an existing MedicalRecord to a physical correlative keychain ID without retyping data
 */
export function linkRecordToKeychain(
  arg1: string | MedicalRecord,
  arg2: string | MedicalRecord
): MedicalRecord {
  const keychainId = typeof arg1 === 'string' ? arg1 : (arg2 as string);
  const record = (typeof arg1 === 'object' ? arg1 : arg2) as MedicalRecord;

  const cleanId = (keychainId || '').trim().toUpperCase().replace(/^#/, '');
  const updated: MedicalRecord = {
    ...record,
    keychainId: cleanId
  };
  saveMedicalRecord(updated);

  // Background sync with cloud
  try {
    fetch('/api/records/link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keychainId: cleanId, record: updated })
    }).catch(() => {});
  } catch {
    // ignore
  }

  return updated;
}

/**
 * Unlinks physical keychain ID from record
 */
export function unlinkRecordFromKeychain(record: MedicalRecord): MedicalRecord {
  const oldId = record.keychainId?.trim().toUpperCase().replace(/^#/, '');
  if (oldId) {
    const registry = getKeychainRegistry();
    delete registry[oldId];
    try {
      localStorage.setItem(REGISTRY_KEY, JSON.stringify(registry));
    } catch {
      // ignore
    }
  }
  const { keychainId: _, ...rest } = record;
  saveMedicalRecord(rest);
  return rest;
}

/**
 * Load record from URL Hash, URL search query, or localStorage
 */
export function loadMedicalRecord(): LoadRecordResult {
  const rawHash = window.location.hash || '';

  // Extract ID if present (#id=0042)
  const matchId = rawHash.match(/[#&](?:id|tag|llavero)=([A-Za-z0-9_-]+)/i);
  let scannedNum: string | undefined = matchId ? matchId[1].toUpperCase().split(/[/?&#]/)[0] : undefined;

  // Extract hash data if present (#d=... or &d=...)
  let hashData = '';
  if (rawHash.startsWith('#d=')) {
    hashData = rawHash.slice(3);
  } else if (rawHash.startsWith('#data=')) {
    hashData = rawHash.slice(6);
  } else {
    const matchD = rawHash.match(/[#&](?:d|data)=([A-Za-z0-9_-]+)/i);
    if (matchD) hashData = matchD[1];
  }

  // 1. If full data hash is present, decode it directly (contains offline photo + all medical details)
  if (hashData) {
    let cleanHash = hashData.split(/[/?&#]/)[0];
    try {
      cleanHash = decodeURIComponent(cleanHash);
    } catch {
      // keep raw
    }
    const recordFromHash = decodeRecordFromHash(cleanHash);
    if (recordFromHash && hasMedicalData(recordFromHash)) {
      if (scannedNum && !recordFromHash.keychainId) {
        recordFromHash.keychainId = scannedNum;
      }
      return {
        record: recordFromHash,
        isFromLink: true,
        scannedKeychainNumber: scannedNum || recordFromHash.keychainId
      };
    }
  }

  // 2. Check URL Hash for correlative keychain ID without embedded hash
  if (scannedNum) {
    const linked = getRecordByKeychainId(scannedNum);
    if (linked && hasMedicalData(linked)) {
      return { record: linked, isFromLink: true, scannedKeychainNumber: scannedNum };
    }
    return { record: null, isFromLink: true, scannedKeychainNumber: scannedNum, isUnlinkedScannedKeychain: true };
  }

  // 3. Check search query: ?id=0042
  try {
    const params = new URLSearchParams(window.location.search);
    const queryId = params.get('id') || params.get('tag') || params.get('llavero');
    if (queryId) {
      const num = queryId.trim().toUpperCase();
      const linked = getRecordByKeychainId(num);
      if (linked && hasMedicalData(linked)) {
        return { record: linked, isFromLink: true, scannedKeychainNumber: num };
      }
      return { record: null, isFromLink: true, scannedKeychainNumber: num, isUnlinkedScannedKeychain: true };
    }
  } catch {
    // ignore
  }

  // 4. Fallback to localStorage primary record
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (hasMedicalData(parsed)) {
        return { record: parsed, isFromLink: false };
      }
    }
  } catch (e) {
    console.warn('Could not read from localStorage', e);
  }

  return { record: null, isFromLink: false };
}

/**
 * Fetch record from Cloud API (handles cross-device sync and keychain lookups)
 */
export async function fetchRecordFromCloud(keychainId?: string): Promise<MedicalRecord | null> {
  try {
    const url = keychainId
      ? `/api/records/keychain/${encodeURIComponent(keychainId.trim().toUpperCase().replace(/^#/, ''))}`
      : `/api/records/primary`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const rec = data.record as MedicalRecord | undefined;
    if (rec && hasMedicalData(rec)) {
      // Cache in local storage
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(rec));
        if (rec.keychainId) {
          const cleanId = rec.keychainId.trim().toUpperCase().replace(/^#/, '');
          const reg = getKeychainRegistry();
          reg[cleanId] = rec;
          localStorage.setItem(REGISTRY_KEY, JSON.stringify(reg));
        }
      } catch {
        // ignore
      }
      return rec;
    }
  } catch {
    // Network offline or endpoint unavailable
  }
  return null;
}

/**
 * Ensures record.foto stays crisp & high resolution (up to 400x400 HD, <= ~48KB)
 * while generating a crisp compact offline QR face portrait in record.fotoQr (<= 1,520 B, up to 128x128px).
 */
export async function optimizeRecordPhoto(
  record: MedicalRecord,
  forceUpgradeQr = false
): Promise<MedicalRecord> {
  if (!record.foto || !record.foto.startsWith('data:image/')) {
    return record;
  }
  try {
    const { compressHdProfilePhoto, compressProfilePhoto } = await import('./imageCompressor');
    let nextFoto = record.foto;
    let changed = false;

    // Only normalize huge unresized images (>55KB) down to crisp 400x400 HD; never degrade HD portraits
    if (nextFoto.length > 55000) {
      nextFoto = await compressHdProfilePhoto(nextFoto, 400, 0.9, 48000);
      changed = nextFoto !== record.foto;
    }

    let nextFotoQr = record.fotoQr;
    const isLegacyTinyQr = Boolean(nextFotoQr && nextFotoQr.length <= 950 && nextFoto.length > 3000 && forceUpgradeQr);
    if (!nextFotoQr || !nextFotoQr.startsWith('data:image/') || nextFotoQr.length > 1650 || isLegacyTinyQr || changed) {
      nextFotoQr = await compressProfilePhoto(nextFoto, 128, 0.72, 1520);
      if (nextFotoQr !== record.fotoQr) {
        changed = true;
      }
    }

    if (!changed) return record;
    const updated: MedicalRecord = { ...record, foto: nextFoto, fotoQr: nextFotoQr };
    saveMedicalRecord(updated);
    return updated;
  } catch (err) {
    console.warn('Could not optimize photo', err);
    return record;
  }
}

/**
 * Checks whether two MedicalRecord entries refer to the same titular person
 * (by keychainId, DNI digits, or normalized full name) so HD photos can safely hydrate.
 */
export function recordsMatchSamePerson(
  scanned: MedicalRecord | null | undefined,
  candidate: MedicalRecord | null | undefined
): boolean {
  if (!scanned || !candidate) return false;
  const kcA = (scanned.keychainId || '').trim().toUpperCase().replace(/^#/, '');
  const kcB = (candidate.keychainId || '').trim().toUpperCase().replace(/^#/, '');
  if (kcA && kcB && kcA === kcB) return true;

  const dniA = (scanned.dni || '').replace(/\D/g, '');
  const dniB = (candidate.dni || '').replace(/\D/g, '');
  if (dniA.length >= 6 && dniB.length >= 6 && dniA === dniB) return true;

  const nameA = normalizeIdentityText(scanned.nombre || '');
  const nameB = normalizeIdentityText(candidate.nombre || '');
  if (nameA.length >= 4 && nameB.length >= 4 && nameA === nameB) return true;

  return false;
}

/**
 * Searches local device storage & keychain registry for an HD portrait matching a scanned QR record.
 */
export function findMatchingLocalHdPhoto(scanned: MedicalRecord | null | undefined): string | null {
  if (!scanned) return null;
  const currentLen = scanned.foto?.length || 0;
  try {
    const candidates: MedicalRecord[] = [];
    const primaryRaw = localStorage.getItem(STORAGE_KEY);
    if (primaryRaw) {
      const parsed = JSON.parse(primaryRaw) as MedicalRecord;
      if (parsed) candidates.push(parsed);
    }
    const registry = getKeychainRegistry();
    for (const val of Object.values(registry)) {
      if (val) candidates.push(val);
    }
    let bestFoto: string | null = null;
    let bestLen = currentLen + 1000;
    for (const cand of candidates) {
      if (
        cand.foto &&
        cand.foto.startsWith('data:image/') &&
        cand.foto.length > bestLen &&
        recordsMatchSamePerson(scanned, cand)
      ) {
        bestFoto = cand.foto;
        bestLen = cand.foto.length;
      }
    }
    return bestFoto;
  } catch {
    return null;
  }
}

/**
 * Save record to localStorage and registry, and sync to Cloud backend
 */
export function saveMedicalRecord(record: MedicalRecord): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(record));

    // If keychainId is defined, also store in the registry
    if (record.keychainId && record.keychainId.trim()) {
      const cleanId = record.keychainId.trim().toUpperCase().replace(/^#/, '');
      const registry = getKeychainRegistry();
      registry[cleanId] = record;
      localStorage.setItem(REGISTRY_KEY, JSON.stringify(registry));
    }

    // Background sync to Cloud API
    try {
      fetch('/api/records/primary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(record)
      }).catch(() => {});
    } catch {
      // ignore
    }

    return true;
  } catch (e) {
    console.error('Could not save to localStorage', e);
    return false;
  }
}

/**
 * Hash PIN using SHA-256
 */
export async function hashPin(pin: string): Promise<string> {
  const enc = new TextEncoder();
  const data = enc.encode('vortexid:' + pin.trim());
  const buffer = await crypto.subtle.digest('SHA-256', data);
  const arr = Array.from(new Uint8Array(buffer));
  return arr.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Get stored PIN hash
 */
export function getStoredPinHash(): string | null {
  try {
    return localStorage.getItem(PIN_KEY);
  } catch {
    return null;
  }
}

/**
 * Set stored PIN hash
 */
export function savePinHash(hashedPin: string): boolean {
  try {
    localStorage.setItem(PIN_KEY, hashedPin);
    return true;
  } catch {
    return false;
  }
}

/**
 * Removes PIN protection
 */
export function removeStoredPin(): void {
  try {
    localStorage.removeItem(PIN_KEY);
  } catch {
    // ignore
  }
}

function normalizeIdentityText(val: string): string {
  return val
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

/**
 * Verifies the owner's identity using registered Ficha fields (DNI, emergency phone,
 * WhatsApp family contact, keychain ID, name if no ID/phone was entered, or Google session)
 * and sets a new 4-6 digit personal PIN hash.
 */
export async function recoverPersonalRecordPin(params: {
  record: MedicalRecord | null | undefined;
  identityInput: string;
  newPin: string;
  isGoogleVerifiedOwner?: boolean;
}): Promise<{ ok: boolean; error?: string }> {
  const cleanPin = (params.newPin || '').trim();
  if (!/^\d{4,6}$/.test(cleanPin)) {
    return { ok: false, error: 'La nueva clave debe tener entre 4 y 6 números.' };
  }

  const rec = params.record;
  const rawInput = (params.identityInput || '').trim();
  const rawDigits = rawInput.replace(/\D/g, '');
  const rawUpper = rawInput.toUpperCase().replace(/^#/, '');
  const rawNorm = normalizeIdentityText(rawInput);

  const dniDigits = (rec?.dni || '').replace(/\D/g, '');
  const telDigits = (rec?.tel || '').replace(/\D/g, '');
  const cfamDigits = (rec?.cfam || '').replace(/\D/g, '');
  const camiDigits = (rec?.cami || '').replace(/\D/g, '');
  const keychainUpper = (rec?.keychainId || '').trim().toUpperCase().replace(/^#/, '');
  const nombreNorm = normalizeIdentityText(rec?.nombre || '');

  const hasStrongField = Boolean(
    dniDigits.length >= 6 ||
      telDigits.length >= 6 ||
      cfamDigits.length >= 6 ||
      camiDigits.length >= 6 ||
      keychainUpper
  );

  let verified = Boolean(params.isGoogleVerifiedOwner);

  if (!verified && rawInput) {
    if (dniDigits.length >= 6 && rawDigits === dniDigits) {
      verified = true;
    } else if (
      telDigits.length >= 6 &&
      rawDigits.length >= 6 &&
      (telDigits.endsWith(rawDigits) || rawDigits.endsWith(telDigits))
    ) {
      verified = true;
    } else if (
      cfamDigits.length >= 6 &&
      rawDigits.length >= 6 &&
      (cfamDigits.endsWith(rawDigits) || rawDigits.endsWith(cfamDigits))
    ) {
      verified = true;
    } else if (
      camiDigits.length >= 6 &&
      rawDigits.length >= 6 &&
      (camiDigits.endsWith(rawDigits) || rawDigits.endsWith(camiDigits))
    ) {
      verified = true;
    } else if (keychainUpper && rawUpper === keychainUpper) {
      verified = true;
    } else if (!hasStrongField && nombreNorm && rawNorm === nombreNorm) {
      verified = true;
    }
  } else if (!verified && !hasStrongField && !nombreNorm) {
    verified = true;
  }

  if (!verified) {
    const hints: string[] = [];
    if (dniDigits.length >= 6) hints.push('DNI');
    if (telDigits.length >= 6 || cfamDigits.length >= 6) hints.push('teléfono/WhatsApp registrado');
    if (keychainUpper) hints.push('N° de llavero');
    if (!hasStrongField && nombreNorm) hints.push('nombre completo');
    const hintText = hints.length > 0 ? hints.join(', ') : 'tus datos';
    return {
      ok: false,
      error: `No pudimos verificar tu identidad. Ingresá tu ${hintText} o verificá con tu cuenta Google.`
    };
  }

  const hashed = await hashPin(cleanPin);
  const saved = savePinHash(hashed);
  if (!saved) {
    return { ok: false, error: 'No se pudo guardar la nueva clave en este dispositivo.' };
  }
  return { ok: true };
}

/**
 * Clears medical record and PIN from local storage and server
 */
export function clearMedicalRecord(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(PIN_KEY);
    if (typeof fetch !== 'undefined') {
      fetch('/api/records/primary', { method: 'DELETE' }).catch(() => {});
    }
  } catch (e) {
    console.warn('Could not clear medical record', e);
  }
}

/**
 * Pre-configured sample/demo record for testing
 */
export const SAMPLE_DEMO_RECORD: MedicalRecord = {
  keychainId: '0042',
  nombre: 'Carlos Alberto Gómez',
  dni: '28.452.910',
  domicilio: 'Rivadavia 350, Punta Alta',
  sangre: 'O+',
  enf: 'Hipertensión controlada · Alergia a Penicilina',
  med: 'Losartán 50mg (1 comp. diario)',
  obraSocial: 'DIBA / IOSFA (Afiliado N° 48201-9)',
  doc: 'Dra. Marcela Rossi (Clínica Rosales)',
  tel: '02932421222',
  cfam: '2932456789',
  cami: '2932654321',
  cmed: '02932421222',
  foto: generateVerifiedFacePhoto({ name: 'Carlos Alberto Gómez' }),
  cirugiasPrevias: 'Apendicectomía (2018 - Hospital Naval)',
  internacionesPrevias: 'Neumonía bilateral (Julio 2021 - Hospital Eva Perón)',
  antecedentesFamiliares: 'Padre: Infarto a los 62 años. Madre: Hipertensión.',
  historialClinicoProtected: true
};

/**
 * Build rich SOS Emergency WhatsApp message
 */
export function buildSosMessage(
  record: MedicalRecord | null,
  coords?: Coordinates | null,
  ipFallback?: Coordinates | null
): string {
  const lines: string[] = [
    '🚨 *AVISO DE EMERGENCIA · VORTEX ID PUNTA ALTA*',
    'Esta persona necesita asistencia de salud o auxilio urgente:'
  ];

  if (record?.nombre) lines.push(`👤 *Nombre:* ${record.nombre}`);
  if (record?.sexo) lines.push(`⚧ *Sexo:* ${record.sexo}`);
  if (record?.dni) lines.push(`🪪 *DNI:* ${record.dni}`);
  if (record?.domicilio) lines.push(`🏠 *Domicilio declarado (ficha):* ${record.domicilio}`);
  if (record?.sangre) lines.push(`🩸 *Grupo y Factor:* ${record.sangre}`);
  const pregnancy = calculatePregnancyProgress(record);
  if (pregnancy) {
    lines.push(`🤰 *EMBARAZO EN CURSO:* ${pregnancy.detailedLabel}${pregnancy.dueDateFormatted ? ` · FPP: ${pregnancy.dueDateFormatted}` : ''}`);
    if (record?.embarazoObstetra) {
      lines.push(`🩺 *Obstetricia:* ${record.embarazoObstetra}`);
    }
  }
  if (record?.enf) lines.push(`⚕️ *Enfermedades / Alergias:* ${record.enf}`);
  if (record?.med) lines.push(`💊 *Medicación habitual:* ${record.med}`);
  if (record?.obraSocial) lines.push(`🏥 *Obra Social:* ${record.obraSocial}`);
  if (record?.doc) lines.push(`👨‍⚕️ *Médico de cabecera:* ${record.doc}`);
  if (record?.tel) lines.push(`📞 *Teléfono de auxilio:* ${record.tel}`);

  lines.push('');
  if (coords && isVerifiedEmergencyCoords(coords)) {
    const freshness = getCoordsFreshnessInfo(coords);
    const accLabel = freshness.accuracyMeters ? ` (±${freshness.accuracyMeters}m)` : '';
    const ageNote = coords.source !== 'manual' && freshness.ageLabel ? ` · ${freshness.ageLabel}` : '';
    const areaRef = describePuntaAltaLocation(coords);

    if (coords.source === 'manual') {
      lines.push(`📍 *Ubicación del accidente (confirmada${coords.label ? `: ${coords.label}` : ''}):*`);
    } else if (coords.source === 'network') {
      lines.push(`📍 *Ubicación del incidente por red móvil/WiFi${accLabel}${ageNote}:*`);
    } else {
      lines.push(`📍 *Ubicación GPS satelital del incidente${accLabel}${ageNote}:*`);
    }
    if (areaRef && areaRef !== 'Punta Alta') {
      const travelPrefix = isWithinPuntaAltaArea(coords) ? '' : 'En viaje / ruta · ';
      lines.push(`📌 *Referencia:* ${travelPrefix}${areaRef}`);
    }
    lines.push(`https://www.google.com/maps?q=${coords.lat},${coords.lng}`);
  } else {
    const coarseIp = isCoarseIpCoords(coords) ? coords : isCoarseIpCoords(ipFallback) ? ipFallback : null;
    if (coarseIp && isWithinPuntaAltaArea(coarseIp)) {
      lines.push('⚠️ *GPS satelital sin señal — Ubicación aproximada por red IP (puede diferir del punto exacto):*');
      lines.push(`https://www.google.com/maps?q=${coarseIp.lat},${coarseIp.lng}`);
      lines.push('🗣️ _Confirmar calle y esquina exacta al hablar con 107 / 911._');
    } else {
      const remoteHint = coarseIp?.label ? ` (red detectada en ${coarseIp.label}, no exacta)` : '';
      lines.push(`⚠️ *Ubicación GPS del accidente:* Sin señal satelital o permiso GPS bloqueado${remoteHint}.`);
      lines.push('🗣️ _Indicar calle, intersección o kilómetro exacto al llamar al 107 / 911._');
    }
  }

  const now = new Date();
  const timeStr = now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  const dateStr = now.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  lines.push(`🕒 *Fecha y hora:* ${dateStr} - ${timeStr} hs`);
  lines.push('');
  lines.push('ℹ️ _Mensaje generado automáticamente mediante Vortex ID Punta Alta_');

  return lines.join('\n');
}

function pruneEmptyFields(obj: Record<string, unknown>): MedicalRecord {
  const cleaned: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(obj)) {
    if (val === undefined || val === null || val === '') continue;
    if (typeof val === 'boolean' && !val) continue;
    if (Array.isArray(val) && val.length === 0) continue;
    cleaned[key] = val;
  }
  return cleaned as MedicalRecord;
}

/**
 * Generate full link for keychain QR Code.
 * Includes full clinical data, pregnancy status, and clinical events safely within
 * QR byte capacity so scanning ALWAYS opens the user's real rescue sheet.
 */
export function generateKeychainUrl(record: MedicalRecord): string {
  const origin = getEffectiveOrigin();
  const path = typeof window !== 'undefined' ? window.location.pathname : '/';
  const baseUrl = origin + path;

  const cleanId = record.keychainId?.trim()
    ? record.keychainId.trim().toUpperCase().replace(/^#/, '')
    : '';
  const idPrefix = cleanId ? `id=${cleanId}&` : '';

  if (!hasMedicalData(record)) {
    if (cleanId) {
      return `${baseUrl}#id=${cleanId}`;
    }
    return `${baseUrl}?welcome=1`;
  }

  // Reserve space for baseUrl + "#" + idPrefix + "d=" within reliable mobile QR capacity (QR Level L holds 2,953 bytes)
  const maxEncodedPreferred = Math.max(950, 2030 - baseUrl.length - 3 - idPrefix.length);
  const maxEncodedWithPhoto = Math.max(1500, 2580 - baseUrl.length - 3 - idPrefix.length);
  const maxEncodedAbsolute = Math.max(1750, 2820 - baseUrl.length - 3 - idPrefix.length);

  const trimmedEvents = (record.historialClinico || []).slice(0, 3).map((ev) => ({
    id: ev.id,
    type: ev.type,
    title: (ev.title || '').slice(0, 55),
    ...(ev.date ? { date: ev.date.slice(0, 25) } : {}),
    ...(ev.institution ? { institution: ev.institution.slice(0, 40) } : {}),
    ...(ev.details ? { details: ev.details.slice(0, 65) } : {})
  }));

  const { fotoQr: _dropQr, foto: _rawFoto, ...recordWithoutPhoto } = record;
  const qrPhotoCandidate =
    record.fotoQr && record.fotoQr.startsWith('data:image/') && record.fotoQr.length <= 1750
      ? record.fotoQr
      : _rawFoto && _rawFoto.startsWith('data:image/') && _rawFoto.length <= 1750
        ? _rawFoto
        : undefined;

  if (qrPhotoCandidate) {
    // Step A0: Full record INCLUDING compact QR face thumbnail (HD portrait remains in Ficha & Cloud)
    const withPhotoA0 = pruneEmptyFields({
      ...recordWithoutPhoto,
      foto: qrPhotoCandidate
    } as Record<string, unknown>);
    const encodedA0 = encodeRecordToHash(withPhotoA0);
    if (encodedA0 && encodedA0.length <= maxEncodedPreferred) {
      return `${baseUrl}#${idPrefix}d=${encodedA0}`;
    }

    // Step A1: Trimmed clinical history + compact QR face thumbnail
    const withPhotoA1 = pruneEmptyFields({
      ...recordWithoutPhoto,
      foto: qrPhotoCandidate,
      historialClinico: trimmedEvents,
      cirugiasPrevias: record.cirugiasPrevias?.slice(0, 120),
      internacionesPrevias: record.internacionesPrevias?.slice(0, 120),
      antecedentesFamiliares: record.antecedentesFamiliares?.slice(0, 120),
      enf: record.enf?.slice(0, 150),
      med: record.med?.slice(0, 150)
    } as Record<string, unknown>);
    const encodedA1 = encodeRecordToHash(withPhotoA1);
    if (encodedA1 && encodedA1.length <= maxEncodedWithPhoto) {
      return `${baseUrl}#${idPrefix}d=${encodedA1}`;
    }

    // Step A2: Clinical summary (no event array) + compact QR face thumbnail
    const { historialClinico: _hcPhoto, ...summaryWithPhoto } = withPhotoA1;
    const encodedA2 = encodeRecordToHash(summaryWithPhoto);
    if (encodedA2 && encodedA2.length <= maxEncodedWithPhoto) {
      return `${baseUrl}#${idPrefix}d=${encodedA2}`;
    }

    // Step A3: Vital emergency rescue core + clinical notes + compact QR face thumbnail
    const coreWithPhoto = pruneEmptyFields({
      keychainId: cleanId || undefined,
      nombre: record.nombre?.slice(0, 55),
      dni: record.dni?.slice(0, 20),
      domicilio: record.domicilio?.slice(0, 70),
      sangre: record.sangre,
      sexo: record.sexo,
      embarazada: record.embarazada,
      embarazoFum: record.embarazoFum,
      enf: record.enf?.slice(0, 100),
      med: record.med?.slice(0, 100),
      obraSocial: record.obraSocial?.slice(0, 45),
      cirugiasPrevias: record.cirugiasPrevias?.slice(0, 70),
      internacionesPrevias: record.internacionesPrevias?.slice(0, 70),
      antecedentesFamiliares: record.antecedentesFamiliares?.slice(0, 70),
      tel: record.tel,
      cfam: record.cfam,
      cami: record.cami,
      cmed: record.cmed,
      foto: qrPhotoCandidate
    } as Record<string, unknown>);
    const encodedA3 = encodeRecordToHash(coreWithPhoto);
    if (encodedA3 && encodedA3.length <= maxEncodedWithPhoto) {
      return `${baseUrl}#${idPrefix}d=${encodedA3}`;
    }

    // Step A4: Minimal life-saving identity lock + ALL emergency/family contacts + compact QR face thumbnail
    const minimalIdentityWithPhoto = pruneEmptyFields({
      keychainId: cleanId || undefined,
      nombre: record.nombre?.slice(0, 45),
      dni: record.dni?.slice(0, 18),
      sangre: record.sangre,
      sexo: record.sexo,
      embarazada: record.embarazada,
      embarazoFum: record.embarazoFum,
      enf: record.enf?.slice(0, 60),
      med: record.med?.slice(0, 60),
      tel: record.tel,
      cfam: record.cfam,
      cami: record.cami,
      cmed: record.cmed,
      foto: qrPhotoCandidate
    } as Record<string, unknown>);
    const encodedA4 = encodeRecordToHash(minimalIdentityWithPhoto);
    if (encodedA4 && encodedA4.length <= maxEncodedAbsolute) {
      return `${baseUrl}#${idPrefix}d=${encodedA4}`;
    }

    // Step A5: Ultra-compact identity + ALL emergency contacts + QR photo (never drops family/companion phones)
    const ultraCompactWithContacts = pruneEmptyFields({
      keychainId: cleanId || undefined,
      nombre: record.nombre?.slice(0, 36),
      dni: record.dni?.slice(0, 16),
      sangre: record.sangre,
      embarazada: record.embarazada,
      embarazoFum: record.embarazoFum,
      enf: record.enf?.slice(0, 40),
      med: record.med?.slice(0, 40),
      tel: record.tel,
      cfam: record.cfam,
      cami: record.cami,
      cmed: record.cmed,
      foto: qrPhotoCandidate
    } as Record<string, unknown>);
    const encodedA5 = encodeRecordToHash(ultraCompactWithContacts);
    if (encodedA5 && encodedA5.length <= maxEncodedAbsolute) {
      return `${baseUrl}#${idPrefix}d=${encodedA5}`;
    }
  }

  const withoutPhoto = recordWithoutPhoto;

  // Step B: Full record without photo (only if photo itself was oversized/unavailable)
  const candidateA = pruneEmptyFields(withoutPhoto as Record<string, unknown>);
  const encodedA = encodeRecordToHash(candidateA);
  if (encodedA && encodedA.length <= maxEncodedPreferred) {
    return `${baseUrl}#${idPrefix}d=${encodedA}`;
  }

  const candidateB = pruneEmptyFields({
    ...withoutPhoto,
    historialClinico: trimmedEvents,
    cirugiasPrevias: record.cirugiasPrevias?.slice(0, 160),
    internacionesPrevias: record.internacionesPrevias?.slice(0, 160),
    antecedentesFamiliares: record.antecedentesFamiliares?.slice(0, 160),
    enf: record.enf?.slice(0, 180),
    med: record.med?.slice(0, 180)
  } as Record<string, unknown>);
  const encodedB = encodeRecordToHash(candidateB);
  if (encodedB && encodedB.length <= maxEncodedPreferred) {
    return `${baseUrl}#${idPrefix}d=${encodedB}`;
  }

  // Step C: Omit event array if still too long, keeping summary clinical fields
  const { historialClinico: _hc, ...summaryOnly } = candidateB;
  const encodedC = encodeRecordToHash(summaryOnly);
  if (encodedC && encodedC.length <= maxEncodedPreferred) {
    return `${baseUrl}#${idPrefix}d=${encodedC}`;
  }

  // Step D: Guaranteed compact rescue core (never drops back to ?welcome=1)
  const coreRecord = pruneEmptyFields({
    keychainId: cleanId || undefined,
    nombre: record.nombre?.slice(0, 60),
    dni: record.dni?.slice(0, 20),
    domicilio: record.domicilio?.slice(0, 80),
    sangre: record.sangre,
    sexo: record.sexo,
    embarazada: record.embarazada,
    embarazoFum: record.embarazoFum,
    embarazoObstetra: record.embarazoObstetra?.slice(0, 70),
    enf: record.enf?.slice(0, 120),
    med: record.med?.slice(0, 120),
    obraSocial: record.obraSocial?.slice(0, 60),
    doc: record.doc?.slice(0, 60),
    tel: record.tel,
    cfam: record.cfam,
    cami: record.cami,
    cmed: record.cmed,
    cirugiasPrevias: record.cirugiasPrevias?.slice(0, 90),
    internacionesPrevias: record.internacionesPrevias?.slice(0, 90),
    antecedentesFamiliares: record.antecedentesFamiliares?.slice(0, 90)
  } as Record<string, unknown>);
  const encodedCore = encodeRecordToHash(coreRecord);
  if (encodedCore) {
    return `${baseUrl}#${idPrefix}d=${encodedCore}`;
  }

  if (cleanId) {
    return `${baseUrl}#id=${cleanId}`;
  }
  return `${baseUrl}?welcome=1`;
}

/**
 * Generate correlative keychain direct URL (e.g. #id=0042)
 */
export function generateCorrelativeUrl(keychainId: string): string {
  const clean = keychainId.trim().toUpperCase().replace(/^#/, '');
  const origin = getEffectiveOrigin();
  const path = typeof window !== 'undefined' ? window.location.pathname : '/';
  const baseUrl = origin + path;
  return `${baseUrl}#id=${clean}`;
}


/**
 * Generates an executive, professional Medical Triage Report formatted for
 * emergency rooms, paramedics, doctors, and hospitals.
 * Ready for 1-click clipboard copying or emergency documentation.
 */
export function buildMedicalReportSummary(record: MedicalRecord, coords?: Coordinates | null): string {
  const parts: string[] = [
    '══════════════════════════════════════════════════',
    '🚨 FICHA DE TRIAGE MÉDICO DE EMERGENCIA · VORTEX ID',
    'PUNTA ALTA · PROVINCIA DE BUENOS AIRES',
    '══════════════════════════════════════════════════',
    `PACIENTE: ${record.nombre ? record.nombre.toUpperCase() : 'NO IDENTIFICADO'}`,
    ...(record.sexo ? [`SEXO: ${record.sexo.toUpperCase()}`] : []),
    `DNI: ${record.dni || 'Sin documento registrado'}`,
  ];

  if (record.keychainId) {
    parts.push(`LLAVERO VORTEX ID: #${record.keychainId}`);
  }

  if (record.domicilio) {
    parts.push(`DOMICILIO DECLARADO EN FICHA (REFERENCIA): ${record.domicilio}`);
  }

  parts.push('──────────────────────────────────────────────────');
  parts.push(`🩸 GRUPO Y FACTOR SANGUÍNEO: ${record.sangre || 'NO ESPECIFICADO'}`);
  const pregnancy = calculatePregnancyProgress(record);
  if (pregnancy) {
    parts.push(`🤰 EMBARAZO EN CURSO (ACTUALIZADO HOY): ${pregnancy.detailedLabel.toUpperCase()} · ${pregnancy.trimesterLabel}`);
    if (pregnancy.dueDateFormatted) {
      parts.push(`   Fecha Probable de Parto (FPP): ${pregnancy.dueDateFormatted}`);
    }
    if (record.embarazoObstetra) {
      parts.push(`   Obstetricia / Observaciones: ${record.embarazoObstetra}`);
    }
  }
  parts.push(`⚠️ ALERGIAS Y ENFERMEDADES PREVIAS: ${record.enf || 'Ninguna alergia declarada por el titular'}`);
  parts.push(`💊 MEDICACIÓN HABITUAL: ${record.med || 'No refiere medicación habitual'}`);

  if (record.obraSocial) {
    parts.push(`🏥 COBERTURA MÉDICA: ${record.obraSocial}`);
  }
  if (record.doc) {
    parts.push(`👨‍⚕️ MÉDICO DE CABECERA: ${record.doc}`);
  }

  if (record.cirugiasPrevias) {
    parts.push(`✂️ CIRUGÍAS PREVIAS: ${record.cirugiasPrevias}`);
  }
  if (record.internacionesPrevias) {
    parts.push(`🏨 INTERNACIONES PREVIAS: ${record.internacionesPrevias}`);
  }
  if (record.antecedentesFamiliares) {
    parts.push(`🧬 ANTECEDENTES FAMILIARES: ${record.antecedentesFamiliares}`);
  }

  if (record.historialClinico && record.historialClinico.length > 0) {
    parts.push('📋 EVENTOS CLÍNICOS REGISTRADOS:');
    record.historialClinico.forEach((ev, i) => {
      const datePart = ev.date ? ` (${ev.date})` : '';
      const instPart = ev.institution ? ` en ${ev.institution}` : '';
      parts.push(`  ${i + 1}. [${ev.type.toUpperCase()}] ${ev.title}${datePart}${instPart}`);
      if (ev.details) parts.push(`     Detalle: ${ev.details}`);
    });
  }

  parts.push('──────────────────────────────────────────────────');
  parts.push('📞 CONTACTOS DE AUXILIO DIRECTO:');
  if (record.cfam) parts.push(`• Familiar directo: ${record.cfam}`);
  if (record.tel) parts.push(`• Teléfono propio / titular: ${record.tel}`);
  if (record.cami) parts.push(`• Allegado / Amigo: ${record.cami}`);
  if (record.cmed) parts.push(`• Médico tratante: ${record.cmed}`);

  if (coords && isVerifiedEmergencyCoords(coords)) {
    const freshness = getCoordsFreshnessInfo(coords);
    const accPart = freshness.accuracyMeters ? ` (±${freshness.accuracyMeters}m)` : '';
    const agePart = coords.source !== 'manual' ? ` · ${freshness.ageLabel}` : coords.label ? ` · ${coords.label}` : '';
    const areaRef = describePuntaAltaLocation(coords);
    parts.push('──────────────────────────────────────────────────');
    parts.push(`📍 UBICACIÓN DEL ACCIDENTE${accPart}${agePart}: https://www.google.com/maps?q=${coords.lat},${coords.lng}`);
    if (areaRef && areaRef !== 'Punta Alta') {
      const prefix = isWithinPuntaAltaArea(coords) ? '' : 'En viaje / fuera de Punta Alta · ';
      parts.push(`📌 REFERENCIA ZONAL: ${prefix}${areaRef}`);
    }
  } else {
    parts.push('──────────────────────────────────────────────────');
    parts.push('⚠️ UBICACIÓN GPS DEL ACCIDENTE: Sin señal o permiso bloqueado al emitir el reporte (indicar esquina exacta).');
  }

  const now = new Date();
  const dateStr = now.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const timeStr = now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  parts.push(`🕒 REPORTE EMITIDO: ${dateStr} a las ${timeStr} hs`);
  parts.push('══════════════════════════════════════════════════');

  return parts.join('\n');
}

