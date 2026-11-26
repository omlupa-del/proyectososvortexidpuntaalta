import { playChirp } from './callHandler';
import { getPushPermissionState } from './pushNotifications';

export interface DailyMedication {
  id: string;
  name: string;
  dose: string;
  time: string; // "HH:MM" 24h format
  reminderEnabled: boolean;
  notes?: string;
  createdAt: number;
}

export interface MedicationDueEventDetail {
  medication: DailyMedication;
  isTest?: boolean;
}

const STORAGE_KEY_MEDS = 'vortex_daily_medications_v1';
const STORAGE_KEY_TAKEN = 'vortex_med_taken_log_v1';
const STORAGE_KEY_SNOOZE = 'vortex_med_snooze_v1';
const STORAGE_KEY_NOTIFIED = 'vortex_med_notified_v1';

export const DAILY_MEDS_UPDATED_EVENT = 'vortex_daily_meds_updated';
export const MEDICATION_DUE_EVENT = 'vortex_medication_due';

export function getLocalDateKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getMinutesOfDay(date: Date = new Date()): number {
  return date.getHours() * 60 + date.getMinutes();
}

function parseTimeToMinutes(hhmm: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec((hhmm || '').trim());
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (!Number.isFinite(h) || !Number.isFinite(m) || h < 0 || h > 23 || m < 0 || m > 59) {
    return null;
  }
  return h * 60 + m;
}

function normalizeTime(hhmm: string): string {
  const mins = parseTimeToMinutes(hhmm);
  if (mins === null) return '08:00';
  const h = String(Math.floor(mins / 60)).padStart(2, '0');
  const m = String(mins % 60).padStart(2, '0');
  return `${h}:${m}`;
}

function emitMedsUpdated(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(DAILY_MEDS_UPDATED_EVENT));
  }
}

export function sortMedicationsByTime(meds: DailyMedication[]): DailyMedication[] {
  return [...meds].sort((a, b) => {
    const am = parseTimeToMinutes(a.time) ?? 0;
    const bm = parseTimeToMinutes(b.time) ?? 0;
    if (am !== bm) return am - bm;
    return a.name.localeCompare(b.name);
  });
}

export function loadDailyMedications(): DailyMedication[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY_MEDS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const cleaned: DailyMedication[] = parsed
      .filter((item) => item && typeof item.name === 'string' && item.name.trim().length > 0)
      .map((item) => ({
        id: String(item.id || `med_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`),
        name: String(item.name).trim(),
        dose: String(item.dose || '').trim(),
        time: normalizeTime(String(item.time || '08:00')),
        reminderEnabled: item.reminderEnabled !== false,
        notes: item.notes ? String(item.notes).trim() : '',
        createdAt: Number(item.createdAt) || Date.now()
      }));
    return sortMedicationsByTime(cleaned);
  } catch {
    return [];
  }
}

export function saveDailyMedications(meds: DailyMedication[]): DailyMedication[] {
  const sorted = sortMedicationsByTime(meds);
  try {
    localStorage.setItem(STORAGE_KEY_MEDS, JSON.stringify(sorted));
  } catch {
    // ignore storage quota errors
  }
  emitMedsUpdated();
  return sorted;
}

export function addDailyMedication(input: {
  name: string;
  dose?: string;
  time: string;
  reminderEnabled?: boolean;
  notes?: string;
}): DailyMedication[] {
  const current = loadDailyMedications();
  const nextItem: DailyMedication = {
    id: `med_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name: input.name.trim(),
    dose: (input.dose || '').trim(),
    time: normalizeTime(input.time),
    reminderEnabled: input.reminderEnabled !== false,
    notes: (input.notes || '').trim(),
    createdAt: Date.now()
  };
  return saveDailyMedications([...current, nextItem]);
}

export function updateDailyMedication(
  id: string,
  patch: Partial<Omit<DailyMedication, 'id' | 'createdAt'>>
): DailyMedication[] {
  const current = loadDailyMedications();
  const updated = current.map((med) => {
    if (med.id !== id) return med;
    return {
      ...med,
      ...patch,
      name: patch.name !== undefined ? patch.name.trim() : med.name,
      dose: patch.dose !== undefined ? patch.dose.trim() : med.dose,
      time: patch.time !== undefined ? normalizeTime(patch.time) : med.time,
      notes: patch.notes !== undefined ? patch.notes.trim() : med.notes
    };
  });
  return saveDailyMedications(updated);
}

export function deleteDailyMedication(id: string): DailyMedication[] {
  const current = loadDailyMedications();
  clearSnooze(id);
  return saveDailyMedications(current.filter((m) => m.id !== id));
}

export function toggleMedicationReminder(id: string): DailyMedication[] {
  const current = loadDailyMedications();
  return saveDailyMedications(
    current.map((m) => (m.id === id ? { ...m, reminderEnabled: !m.reminderEnabled } : m))
  );
}

function readTakenLog(): Record<string, string[]> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_TAKEN);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function getTakenTodayIds(date: Date = new Date()): string[] {
  const key = getLocalDateKey(date);
  const log = readTakenLog();
  const list = log[key];
  return Array.isArray(list) ? list.map(String) : [];
}

export function isMedicationTakenToday(id: string, date: Date = new Date()): boolean {
  return getTakenTodayIds(date).includes(id);
}

export function markMedicationTakenToday(id: string, taken: boolean = true, date: Date = new Date()): string[] {
  const key = getLocalDateKey(date);
  const log = readTakenLog();
  const existing = Array.isArray(log[key]) ? log[key].map(String) : [];
  const nextSet = new Set(existing);
  if (taken) {
    nextSet.add(id);
    clearSnooze(id);
  } else {
    nextSet.delete(id);
  }

  // Keep only recent 7 days to avoid unbounded storage growth
  const prunedLog: Record<string, string[]> = {};
  const keys = Object.keys(log).sort().slice(-6);
  for (const k of keys) {
    if (Array.isArray(log[k])) {
      prunedLog[k] = log[k];
    }
  }
  prunedLog[key] = Array.from(nextSet);

  try {
    localStorage.setItem(STORAGE_KEY_TAKEN, JSON.stringify(prunedLog));
  } catch {
    // ignore
  }
  emitMedsUpdated();
  return prunedLog[key];
}

function readSnoozeMap(): Record<string, number> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SNOOZE);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function clearSnooze(id: string): void {
  const map = readSnoozeMap();
  if (map[id] !== undefined) {
    delete map[id];
    try {
      localStorage.setItem(STORAGE_KEY_SNOOZE, JSON.stringify(map));
    } catch {}
  }
}

export function snoozeMedicationReminder(id: string, minutes: number = 10): number {
  const until = Date.now() + minutes * 60 * 1000;
  const map = readSnoozeMap();
  map[id] = until;
  try {
    localStorage.setItem(STORAGE_KEY_SNOOZE, JSON.stringify(map));
  } catch {}
  emitMedsUpdated();
  return until;
}

function readNotifiedKeys(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_NOTIFIED);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function markNotifiedKey(key: string): void {
  const existing = readNotifiedKeys().filter((k) => k !== key);
  existing.push(key);
  try {
    localStorage.setItem(STORAGE_KEY_NOTIFIED, JSON.stringify(existing.slice(-60)));
  } catch {}
}

export function getNextPendingMedication(
  meds: DailyMedication[],
  takenIds: string[],
  now: Date = new Date()
): DailyMedication | null {
  const pending = sortMedicationsByTime(meds).filter((m) => !takenIds.includes(m.id));
  if (pending.length === 0) return null;
  const nowMin = getMinutesOfDay(now);
  const upcoming = pending.find((m) => {
    const mins = parseTimeToMinutes(m.time);
    return mins !== null && mins >= nowMin - 15;
  });
  return upcoming || pending[0];
}

export function formatMedicationsForSosField(meds: DailyMedication[]): string {
  const sorted = sortMedicationsByTime(meds);
  return sorted
    .map((m) => {
      const parts = [m.name];
      if (m.dose) parts.push(m.dose);
      return `${parts.join(' ')} (${m.time} hs)`;
    })
    .join(', ');
}

async function sendMedicationNotification(med: DailyMedication, isTest: boolean): Promise<void> {
  if (typeof window === 'undefined') return;

  playChirp('success');

  window.dispatchEvent(
    new CustomEvent<MedicationDueEventDetail>(MEDICATION_DUE_EVENT, {
      detail: { medication: med, isTest }
    })
  );

  if (getPushPermissionState() !== 'granted') return;

  const title = isTest
    ? `💊 Recordatorio de prueba: ${med.name}`
    : `💊 Hora de tu medicación: ${med.name}`;
  const bodyParts = [
    med.dose ? `Dosis: ${med.dose}` : null,
    `Horario: ${med.time} hs`,
    med.notes ? med.notes : null
  ].filter(Boolean);
  const body = bodyParts.join(' · ') || 'Tocá para marcar como tomada en tu Ficha Médica.';

  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) {
        await reg.showNotification(title, {
          body,
          icon: '/assets/logo.png',
          badge: '/assets/logo.png',
          tag: isTest ? 'vortex-med-test' : `vortex-med-${med.id}-${med.time}`,
          requireInteraction: true,
          data: { url: '/#ficha-medica' }
        });
        return;
      }
    }
  } catch {
    // Fallback to window Notification below
  }

  try {
    new Notification(title, {
      body,
      icon: '/assets/logo.png',
      tag: isTest ? 'vortex-med-test' : `vortex-med-${med.id}-${med.time}`
    });
  } catch {
    // Some browsers disallow direct new Notification in favor of SW
  }
}

export async function triggerTestMedicationReminder(med?: DailyMedication): Promise<void> {
  const meds = loadDailyMedications();
  const target: DailyMedication = med ||
    meds[0] || {
      id: 'med_demo',
      name: 'Medicación de ejemplo',
      dose: '1 comprimido',
      time: normalizeTime(
        `${String(new Date().getHours()).padStart(2, '0')}:${String(new Date().getMinutes()).padStart(2, '0')}`
      ),
      reminderEnabled: true,
      notes: 'Aviso de prueba Vortex ID',
      createdAt: Date.now()
    };

  await sendMedicationNotification(target, true);
}

export function checkDueMedicationReminders(now: Date = new Date()): void {
  if (typeof window === 'undefined') return;
  const meds = loadDailyMedications();
  if (meds.length === 0) return;

  const dateKey = getLocalDateKey(now);
  const nowMinutes = getMinutesOfDay(now);
  const nowMs = now.getTime();
  const takenIds = new Set(getTakenTodayIds(now));
  const snoozeMap = readSnoozeMap();
  const notifiedKeys = new Set(readNotifiedKeys());

  for (const med of meds) {
    if (!med.reminderEnabled) continue;
    if (takenIds.has(med.id)) continue;

    // 1. Check active snooze first
    const snoozeUntil = snoozeMap[med.id];
    if (typeof snoozeUntil === 'number' && snoozeUntil > 0) {
      if (nowMs >= snoozeUntil) {
        const snoozeKey = `snooze|${med.id}|${snoozeUntil}`;
        clearSnooze(med.id);
        if (!notifiedKeys.has(snoozeKey)) {
          markNotifiedKey(snoozeKey);
          void sendMedicationNotification(med, false);
          return;
        }
      }
      continue;
    }

    // 2. Check regular daily schedule (fires within [scheduledMin, scheduledMin + 2] minutes)
    const scheduledMinutes = parseTimeToMinutes(med.time);
    if (scheduledMinutes === null) continue;
    const diffMinutes = nowMinutes - scheduledMinutes;
    if (diffMinutes >= 0 && diffMinutes <= 2) {
      const slotKey = `${dateKey}|${med.time}|${med.id}`;
      if (!notifiedKeys.has(slotKey)) {
        markNotifiedKey(slotKey);
        void sendMedicationNotification(med, false);
        return;
      }
    }
  }
}

export function startMedicationReminderLoop(): () => void {
  if (typeof window === 'undefined') return () => {};

  checkDueMedicationReminders();
  const intervalId = window.setInterval(() => {
    checkDueMedicationReminders();
  }, 20000);

  const handleVisibility = () => {
    if (document.visibilityState === 'visible') {
      checkDueMedicationReminders();
    }
  };
  document.addEventListener('visibilitychange', handleVisibility);

  return () => {
    window.clearInterval(intervalId);
    document.removeEventListener('visibilitychange', handleVisibility);
  };
}
