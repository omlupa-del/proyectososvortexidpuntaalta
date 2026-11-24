/**
 * Modo Desatendido (Unattended Sentinel Emergency Mode)
 *
 * Designed for extreme crisis scenarios (loss of consciousness, walking in danger,
 * violent attack, or acute medical failure).
 *
 * When triggered:
 * 1. Automatically compiles patient medical emergency sheet + exact GPS coordinates link.
 * 2. Automatically dispatches alerts to predefined emergency contacts (family, doctor, friends).
 * 3. Immediately triggers a phone call to the primary emergency service (default: 911)
 *    WITHOUT waiting for user confirmation!
 * 4. Provides a prominent warning before activation, plus a countdown grace period
 *    and a persistent, unambiguous UI to disarm at any moment.
 */

import { Coordinates, isVerifiedEmergencyCoords, acquireFreshGpsCoordinates } from './geo';
import { MedicalRecord, buildSosMessage } from './medicalData';
import { triggerDirectCall, formatWhatsAppNumber, playChirp } from './callHandler';
import { triggerPushNotification } from './pushNotifications';

export interface UnattendedContact {
  id: string;
  label: string;
  phone: string;
  enabled: boolean;
}

export interface UnattendedContactLink {
  id: string;
  label: string;
  phone: string;
  waUrl: string;
  smsUrl: string;
}

export interface UnattendedConfig {
  isArmed: boolean;
  primaryEmergencyNumber: string; // '911' | '107' | '100' | '103' | custom
  primaryEmergencyLabel: string;
  graceCountdownSeconds: number; // 0, 5, 10 seconds before auto-firing
  timerMinutes: number; // 0 = off, 15, 30, 45, 60 min (Dead Man's Switch)
  timerExpiresAt: number | null; // epoch timestamp if timer active
  contacts: UnattendedContact[];
  armedAt: string | null;
  lastTriggeredAt: string | null;
}

const STORAGE_KEY = 'vortex_unattended_config_v1';

export const DEFAULT_UNATTENDED_CONFIG: UnattendedConfig = {
  isArmed: false,
  primaryEmergencyNumber: '911',
  primaryEmergencyLabel: '911 · Policía y Emergencias',
  graceCountdownSeconds: 5,
  timerMinutes: 0,
  timerExpiresAt: null,
  contacts: [],
  armedAt: null,
  lastTriggeredAt: null
};

/**
 * Syncs contacts from MedicalRecord while preserving user toggles & custom contacts.
 */
function buildRecordDerivedContacts(
  record: MedicalRecord | null | undefined,
  existingContacts: UnattendedContact[]
): UnattendedContact[] {
  const existingMap = new Map<string, UnattendedContact>();
  for (const c of existingContacts) {
    existingMap.set(c.id, c);
  }

  const synced: UnattendedContact[] = [];
  const recordSlots: Array<{ id: string; label: string; phone?: string; defaultEnabled: boolean }> = [
    { id: 'cfam', label: 'Familiar directo', phone: record?.cfam, defaultEnabled: true },
    { id: 'cami', label: 'Amigo / Allegado', phone: record?.cami, defaultEnabled: true },
    { id: 'cmed', label: 'Médico de cabecera', phone: record?.cmed, defaultEnabled: true },
    { id: 'tel', label: 'Teléfono propio de auxilio', phone: record?.tel, defaultEnabled: false }
  ];

  for (const slot of recordSlots) {
    const cleanPhone = (slot.phone || '').trim();
    if (!cleanPhone) continue;
    const prev = existingMap.get(slot.id);
    synced.push({
      id: slot.id,
      label: slot.label,
      phone: cleanPhone,
      enabled: prev ? prev.enabled : slot.defaultEnabled
    });
  }

  for (const c of existingContacts) {
    if (c.id.startsWith('custom-') && c.phone.trim()) {
      synced.push(c);
    }
  }

  return synced;
}

/**
 * Load unattended mode configuration from localStorage, synchronizing with medicalRecord contacts
 */
export function getUnattendedConfig(record?: MedicalRecord | null): UnattendedConfig {
  let config: UnattendedConfig = { ...DEFAULT_UNATTENDED_CONFIG };

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      config = { ...config, ...parsed };
    }
  } catch {
    // fallback
  }

  if (record) {
    config.contacts = buildRecordDerivedContacts(record, config.contacts || []);
  }

  return config;
}

/**
 * Save configuration and notify listeners
 */
export function saveUnattendedConfig(config: UnattendedConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch {
    // ignore
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('vortex_unattended_config_changed', { detail: config }));
  }
}

let sharedAudioCtx: AudioContext | null = null;

/**
 * Unlocks / resumes Web Audio inside a user gesture so delayed Sentinel timers can sound the siren.
 */
export function unlockEmergencyAudio(): void {
  try {
    if (typeof window === 'undefined') return;
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    if (!sharedAudioCtx) {
      sharedAudioCtx = new AudioCtx();
    }
    if (sharedAudioCtx.state === 'suspended') {
      sharedAudioCtx.resume().catch(() => {});
    }
  } catch {
    // ignore
  }
}

/**
 * Play loud emergency siren for unattended activation
 */
export function playUnattendedSiren(): void {
  try {
    if (typeof window === 'undefined') return;
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = sharedAudioCtx || new AudioCtx();
    sharedAudioCtx = ctx;
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    // Modulating wail: 800Hz to 1400Hz siren
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.linearRampToValueAtTime(1400, now + 0.35);
    osc.frequency.linearRampToValueAtTime(800, now + 0.7);
    osc.frequency.linearRampToValueAtTime(1400, now + 1.05);

    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 1.2);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 1.2);
  } catch {
    // Ignore audio autoplay restrictions
  }
}

/**
 * Execute unattended emergency dispatch:
 * - Builds SOS location message
 * - Dispatches alerts to all enabled emergency contacts
 * - Calls primary emergency number (911) directly WITHOUT user confirmation!
 */
export async function executeUnattendedDispatch(
  record: MedicalRecord | null,
  coords: Coordinates | null,
  config: UnattendedConfig,
  options?: { dialSynchronouslyLaunched?: boolean }
): Promise<{
  success: boolean;
  contactsNotified: number;
  primaryCalled: string;
  dispatchTime: string;
  contactLinks: UnattendedContactLink[];
  usedCoords: Coordinates | null;
}> {
  // 1. Audible & Haptic alert
  playUnattendedSiren();
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    try {
      navigator.vibrate([300, 100, 300, 100, 600]);
    } catch {}
  }

  // 2. Ensure freshest verified GPS coordinates (quick 2s refresh if missing or older than 20s)
  let effectiveEmergencyCoords: Coordinates | null = isVerifiedEmergencyCoords(coords) ? coords : null;
  const isStale =
    !effectiveEmergencyCoords?.timestamp ||
    Date.now() - effectiveEmergencyCoords.timestamp > 20000;

  if (!effectiveEmergencyCoords || isStale) {
    try {
      const fresh = await acquireFreshGpsCoordinates(2000);
      if (fresh) {
        effectiveEmergencyCoords = fresh;
      }
    } catch {
      // keep effectiveEmergencyCoords as is
    }
  }

  // Build full message with verified GPS link (or honest fallback warning)
  const sosMessage = buildSosMessage(record, effectiveEmergencyCoords);
  const now = new Date();
  const timeStr = now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });

  // 3. Build instant dispatch links for enabled contacts
  const enabledContacts = config.contacts.filter((c) => c.enabled && c.phone.trim());

  const contactLinks: UnattendedContactLink[] = enabledContacts.map((c) => {
    const wa = formatWhatsAppNumber(c.phone);
    const cleanPhone = c.phone.replace(/[^\d+]/g, '');
    const waUrl = wa
      ? `https://wa.me/${wa}?text=${encodeURIComponent(sosMessage)}`
      : `https://wa.me/?text=${encodeURIComponent(sosMessage)}`;
    const smsUrl = `sms:${cleanPhone}?body=${encodeURIComponent(sosMessage)}`;
    return {
      id: c.id,
      label: c.label,
      phone: c.phone,
      waUrl,
      smsUrl
    };
  });

  // Send push notification locally
  try {
    await triggerPushNotification({
      type: 'emergency',
      title: '🚨 MODO DESATENDIDO EJECUTADO',
      body: effectiveEmergencyCoords
        ? `Alerta automática lista con GPS (${effectiveEmergencyCoords.lat.toFixed(4)}, ${effectiveEmergencyCoords.lng.toFixed(4)}). Marcando al ${config.primaryEmergencyNumber}.`
        : `Alerta automática lista (GPS sin señal). Marcando al ${config.primaryEmergencyNumber} sin confirmación.`,
      urgent: true
    });
  } catch {}

  // Broadcast to server push history so responders can see it in real-time
  try {
    await fetch('/api/push/broadcast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'emergency',
        title: `🚨 MODO DESATENDIDO: AUXILIO AUTOMÁTICO (${record?.nombre || 'Persona no identificada'})`,
        body: effectiveEmergencyCoords
          ? `Ubicación GPS: ${effectiveEmergencyCoords.lat.toFixed(5)}, ${effectiveEmergencyCoords.lng.toFixed(5)}. Contactando al ${config.primaryEmergencyNumber}.`
          : `GPS sin señal en este instante${record?.domicilio ? ` (Domicilio declarado: ${record.domicilio})` : ''}. Contactando al ${config.primaryEmergencyNumber}.`,
        urgent: true
      })
    });
  } catch {}

  // Update last triggered timestamp & disarm sentinel
  const updatedConfig: UnattendedConfig = {
    ...config,
    isArmed: false,
    timerExpiresAt: null,
    timerMinutes: 0,
    lastTriggeredAt: now.toISOString()
  };
  saveUnattendedConfig(updatedConfig);

  // 4. Mount high-priority EmergencyDialerModal (z-[60], above UnattendedModeModal)
  // which handles a single clean tel: launch + OS block detection + 1-tap retry without colliding calls.
  const targetNumber = config.primaryEmergencyNumber || '911';
  const targetLabel = config.primaryEmergencyLabel || '911 · Policía y Emergencias';
  playChirp('emergency');
  triggerDirectCall(targetNumber, `🚨 MODO DESATENDIDO: ${targetLabel}`, 'emergency', {
    isAsyncTrigger: !options?.dialSynchronouslyLaunched
  });

  return {
    success: true,
    contactsNotified: contactLinks.length,
    primaryCalled: targetNumber,
    dispatchTime: timeStr,
    contactLinks,
    usedCoords: effectiveEmergencyCoords
  };
}
