import {
  FeaturedAdOverride,
  fetchPublicSystemSettingsFromFirestore,
  savePublicSystemSettingsToFirestore
} from '../firebase/firestoreService';

export type { FeaturedAdOverride };

/**
 * System Configuration & Membership Pricing Manager for Vortex ID Punta Alta.
 * Manages the monthly service fee (default $3.000), payment alias (Mercado Pago / Banco),
 * WhatsApp receipt verification, activation code gating, and cloud synchronization (Firestore + Express).
 */

export interface SystemConfig {
  monthlyFee: number; // e.g. 3000
  currency: string; // 'ARS' ($)
  membershipTitle: string; // 'Membresía Mensual Vortex ID'
  billingDescription: string;
  paymentAlias: string; // Mercado Pago Alias
  paymentCbu: string;
  paymentHolder: string;
  adminPhone: string; // WhatsApp for payment slips and support
  adminPin?: string; // Only kept transiently when set/changed by admin; never exposed by public GETs
  adminPinHash?: string; // SHA-256 hex digest of admin PIN for static/offline verification
  hasCustomPin?: boolean;
  isMembershipRequired: boolean; // false = Prueba Abierta, true = Bloqueado (exige comprobante + código de alta)
  activationCodeHash?: string; // SHA-256 hex of the citizen activation code sent via WhatsApp
  customDomain?: string; // Optional custom production domain
  pharmacyAdOverride?: FeaturedAdOverride | null;
  remisAdOverride?: FeaturedAdOverride | null;
  updatedAt: string;
}

export const DEFAULT_ACTIVATION_CODE = 'VORTEXPA';
export const DEFAULT_ACTIVATION_CODE_HASH =
  '0e790feb7507f71d95d3743b15b81aacee754df726f79e9c11c937bac92afb8b';

export const DEFAULT_SYSTEM_CONFIG: SystemConfig = {
  monthlyFee: 3000,
  currency: 'ARS',
  membershipTitle: 'Membresía Oficial Vortex ID',
  billingDescription:
    'Mantenimiento del servicio 24hs, ficha médica protegida en la nube, farmacias de turno y respuesta inmediata ante accidentes en Punta Alta.',
  paymentAlias: 'vortex.id.auxilio',
  paymentCbu: '0000003100049281048201',
  paymentHolder: 'VORTEX ID · PUNTA ALTA',
  adminPhone: '2932420000',
  hasCustomPin: false,
  isMembershipRequired: false,
  activationCodeHash: DEFAULT_ACTIVATION_CODE_HASH,
  customDomain: '',
  updatedAt: '2026-01-01T00:00:00.000Z'
};

const SYSTEM_CONFIG_STORAGE_KEY = 'vortexid_system_config';
const MEMBERSHIP_UNLOCKED_KEY = 'vortexid_membership_unlocked_v1';
const ADMIN_LAST_ACTIVATION_CODE_KEY = 'vortexid_admin_activation_code_cache';

/**
 * Returns the effective public origin for sharing links and generating QR codes.
 */
export function getEffectiveOrigin(): string {
  try {
    const raw = localStorage.getItem(SYSTEM_CONFIG_STORAGE_KEY);
    if (raw) {
      const cfg = JSON.parse(raw);
      if (cfg?.customDomain && typeof cfg.customDomain === 'string' && cfg.customDomain.trim().startsWith('http')) {
        return cfg.customDomain.trim().replace(/\/+$/, '');
      }
    }
  } catch {
    // fallback
  }

  const PUBLIC_FALLBACK_URL = 'https://proyectososvortexid.netlify.app';

  if (typeof window !== 'undefined' && window.location && window.location.origin) {
    const currentOrigin = window.location.origin;
    if (
      currentOrigin.includes('aistudio.google.com') ||
      currentOrigin.includes('googleusercontent.com') ||
      currentOrigin.includes('ais-dev-') ||
      currentOrigin.includes('ais-pre-')
    ) {
      return PUBLIC_FALLBACK_URL;
    }
    return currentOrigin;
  }

  return PUBLIC_FALLBACK_URL;
}

function stripAdminPin(cfg: SystemConfig): SystemConfig {
  const { adminPin: _pin, ...safe } = cfg;
  return safe;
}

/**
 * Format currency in Argentine Pesos: 3000 -> "$3.000"
 */
export function formatCurrency(amount: number): string {
  try {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      maximumFractionDigits: 0
    }).format(amount);
  } catch {
    return `$${amount.toLocaleString('es-AR')}`;
  }
}

/**
 * Compute SHA-256 hex digest of normalized activation code (uppercase, trimmed)
 */
export async function hashActivationCode(code: string): Promise<string> {
  const normalized = code.trim().toUpperCase();
  const encoder = new TextEncoder();
  const data = encoder.encode(normalized);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Compute SHA-256 hex digest of the administrator PIN (preserves exact characters, trimmed)
 */
export async function hashAdminPin(pin: string): Promise<string> {
  const normalized = pin.trim();
  const encoder = new TextEncoder();
  const data = encoder.encode(normalized);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Verify a citizen's entered activation code against current SystemConfig
 */
export async function verifyActivationCode(
  enteredCode: string,
  config?: SystemConfig
): Promise<boolean> {
  const clean = enteredCode.trim().toUpperCase();
  if (!clean) return false;
  const activeCfg = config || getStoredSystemConfig();
  const expectedHash = activeCfg.activationCodeHash || DEFAULT_ACTIVATION_CODE_HASH;
  try {
    const candidateHash = await hashActivationCode(clean);
    return candidateHash === expectedHash;
  } catch {
    return clean === DEFAULT_ACTIVATION_CODE;
  }
}

/**
 * Check if this device has unlocked registration via verified membership code
 */
export function isMembershipUnlockedLocally(): boolean {
  try {
    const raw = localStorage.getItem(MEMBERSHIP_UNLOCKED_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    return Boolean(parsed?.unlocked);
  } catch {
    return false;
  }
}

/**
 * Mark device as membership-activated after code verification
 */
export function unlockMembershipLocally(meta?: { holderName?: string; phone?: string }): void {
  try {
    localStorage.setItem(
      MEMBERSHIP_UNLOCKED_KEY,
      JSON.stringify({
        unlocked: true,
        unlockedAt: new Date().toISOString(),
        holderName: meta?.holderName || '',
        phone: meta?.phone || ''
      })
    );
    window.dispatchEvent(new CustomEvent('vortex_membership_unlocked'));
  } catch {
    // ignore storage errors
  }
}

/**
 * Clear local membership activation (useful for testing blocked flow as admin)
 */
export function clearMembershipUnlockLocally(): void {
  try {
    localStorage.removeItem(MEMBERSHIP_UNLOCKED_KEY);
    window.dispatchEvent(new CustomEvent('vortex_membership_unlocked'));
  } catch {
    // ignore
  }
}

/**
 * Save/get admin's plain activation code hint locally on admin device so they remember what to send on WhatsApp
 */
export function getCachedAdminActivationCode(): string {
  try {
    return localStorage.getItem(ADMIN_LAST_ACTIVATION_CODE_KEY) || DEFAULT_ACTIVATION_CODE;
  } catch {
    return DEFAULT_ACTIVATION_CODE;
  }
}

export function setCachedAdminActivationCode(code: string): void {
  try {
    if (code.trim()) {
      localStorage.setItem(ADMIN_LAST_ACTIVATION_CODE_KEY, code.trim().toUpperCase());
    }
  } catch {
    // ignore
  }
}

/**
 * Normalize Argentine phone digits for wa.me link
 */
export function formatAdminWhatsAppNumber(rawPhone: string): string {
  const digits = (rawPhone || '2932420000').replace(/\D/g, '');
  if (digits.startsWith('549')) return digits;
  if (digits.startsWith('54')) return `549${digits.slice(2)}`;
  if (digits.startsWith('0')) return `549${digits.slice(1)}`;
  return `549${digits}`;
}

/**
 * Build WhatsApp receipt message URL for citizen to send proof of payment to admin
 */
export function buildMembershipWhatsAppUrl(
  config: SystemConfig,
  applicant?: { nombre?: string; dni?: string; telefono?: string }
): string {
  const waNum = formatAdminWhatsAppNumber(config.adminPhone);
  const feeText = formatCurrency(config.monthlyFee);
  const nameLine = applicant?.nombre?.trim() ? `• Titular: *${applicant.nombre.trim()}*\n` : '';
  const dniLine = applicant?.dni?.trim() ? `• DNI: ${applicant.dni.trim()}\n` : '';
  const phoneLine = applicant?.telefono?.trim() ? `• Celular: ${applicant.telefono.trim()}\n` : '';

  const text =
    `✅ *COMPROBANTE DE MEMBRESÍA VORTEX ID · PUNTA ALTA*\n` +
    `Hola! Ya realicé la transferencia de *${feeText}/mes* al alias *${config.paymentAlias || 'vortex.id.auxilio'}*.\n\n` +
    `${nameLine}${dniLine}${phoneLine}` +
    `📎 Adjunto el comprobante de pago para recibir mi *Código de Alta* y activar mi Ficha Médica SOS y QR.\n` +
    `¡Muchas gracias!`;

  return `https://wa.me/${waNum}?text=${encodeURIComponent(text)}`;
}

/**
 * Get synchronously from localStorage or return default
 */
export function getStoredSystemConfig(): SystemConfig {
  try {
    const raw = localStorage.getItem(SYSTEM_CONFIG_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as SystemConfig;
      return stripAdminPin({ ...DEFAULT_SYSTEM_CONFIG, ...parsed });
    }
  } catch {
    // fallback
  }
  return stripAdminPin(DEFAULT_SYSTEM_CONFIG);
}

/**
 * Verify admin PIN against server endpoint or synced SHA-256 hash without exposing the stored PIN.
 */
export async function verifyAdminPin(pin: string): Promise<{ valid: boolean; offline?: boolean; error?: string }> {
  const clean = pin.trim();
  if (!clean) {
    return { valid: false, error: 'Ingresá la clave PIN.' };
  }
  try {
    const res = await fetch('/api/system/verify-pin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: clean })
    });
    if (res.ok) {
      const data = await res.json();
      return { valid: Boolean(data?.valid) };
    }
    if (res.status === 401 || res.status === 400) {
      const data = await res.json().catch(() => ({}));
      return { valid: false, error: data?.error || 'PIN incorrecto.' };
    }
  } catch {
    // Express backend unreachable (e.g. static Netlify hosting) — fallback below
  }

  const stored = getStoredSystemConfig();
  if (stored.adminPinHash) {
    try {
      const candidateHash = await hashAdminPin(clean);
      if (candidateHash === stored.adminPinHash) {
        return { valid: true, offline: true };
      }
      return { valid: false, offline: true, error: 'PIN incorrecto.' };
    } catch {
      // fall through
    }
  }

  if (!stored.hasCustomPin && clean === '1234') {
    return { valid: true, offline: true };
  }
  return { valid: false, offline: true, error: 'PIN incorrecto.' };
}

/**
 * Recover or reset the single administrator PIN via Express server OR verified Google Admin (for Netlify).
 */
export async function recoverAdminPin(params: {
  identity?: string;
  newPin?: string;
  verifiedAdminEmail?: string | null;
}): Promise<{
  ok: boolean;
  adminPin?: string;
  config?: SystemConfig;
  syncedToCloud?: boolean;
  error?: string;
}> {
  const cleanedNewPin = (params.newPin || '').trim();
  if (cleanedNewPin && cleanedNewPin.length < 4) {
    return { ok: false, error: 'La nueva clave PIN debe tener al menos 4 caracteres.' };
  }

  const nextPin = cleanedNewPin ? cleanedNewPin.slice(0, 8) : '1234';
  const effectiveIdentity = (params.identity || params.verifiedAdminEmail || '').trim();
  const isVerifiedGoogleAdmin = (params.verifiedAdminEmail || '').trim().toLowerCase() === 'omlupa@gmail.com';

  if (!effectiveIdentity) {
    return {
      ok: false,
      error: 'Ingresá tu correo/WhatsApp de administrador o verificá con tu cuenta Google Admin.'
    };
  }

  const nextPinHash = await hashAdminPin(nextPin);
  const current = getStoredSystemConfig();

  // 1. Try Express backend first when available
  try {
    const res = await fetch('/api/system/recover-pin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identity: effectiveIdentity,
        newPin: cleanedNewPin ? nextPin : ''
      })
    });

    if (res.status !== 404) {
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        return { ok: false, error: data?.error || 'No se pudo verificar la identidad del administrador.' };
      }

      const updatedConfig: SystemConfig = stripAdminPin({
        ...current,
        ...(data.config || {}),
        adminPinHash: nextPinHash,
        hasCustomPin: nextPin !== '1234',
        updatedAt: new Date().toISOString()
      });

      try {
        localStorage.setItem(SYSTEM_CONFIG_STORAGE_KEY, JSON.stringify(updatedConfig));
      } catch {}

      const cloudSync = await savePublicSystemSettingsToFirestore({
        monthlyFee: updatedConfig.monthlyFee,
        currency: updatedConfig.currency,
        membershipTitle: updatedConfig.membershipTitle,
        billingDescription: updatedConfig.billingDescription,
        paymentAlias: updatedConfig.paymentAlias,
        paymentCbu: updatedConfig.paymentCbu,
        paymentHolder: updatedConfig.paymentHolder,
        adminPhone: updatedConfig.adminPhone,
        isMembershipRequired: updatedConfig.isMembershipRequired,
        activationCodeHash: updatedConfig.activationCodeHash,
        customDomain: updatedConfig.customDomain,
        adminPinHash: updatedConfig.adminPinHash,
        hasCustomPin: updatedConfig.hasCustomPin,
        pharmacyAdOverride: updatedConfig.pharmacyAdOverride,
        remisAdOverride: updatedConfig.remisAdOverride,
        updatedAt: updatedConfig.updatedAt
      });

      window.dispatchEvent(new CustomEvent('vortex_config_updated', { detail: updatedConfig }));
      return {
        ok: true,
        adminPin: nextPin,
        config: updatedConfig,
        syncedToCloud: cloudSync.ok
      };
    }
  } catch {
    // Express unreachable (static Netlify hosting) — fallback to Google Admin verification below
  }

  // 2. Static Netlify / Offline fallback: require verified Google Admin account
  if (!isVerifiedGoogleAdmin) {
    return {
      ok: false,
      error: 'En la web pública verificá tu identidad tocando "Verificar con Google Admin" (omlupa@gmail.com).'
    };
  }

  const updatedConfig: SystemConfig = stripAdminPin({
    ...current,
    adminPinHash: nextPinHash,
    hasCustomPin: nextPin !== '1234',
    updatedAt: new Date().toISOString()
  });

  try {
    localStorage.setItem(SYSTEM_CONFIG_STORAGE_KEY, JSON.stringify(updatedConfig));
  } catch {}

  const cloudSync = await savePublicSystemSettingsToFirestore({
    monthlyFee: updatedConfig.monthlyFee,
    currency: updatedConfig.currency,
    membershipTitle: updatedConfig.membershipTitle,
    billingDescription: updatedConfig.billingDescription,
    paymentAlias: updatedConfig.paymentAlias,
    paymentCbu: updatedConfig.paymentCbu,
    paymentHolder: updatedConfig.paymentHolder,
    adminPhone: updatedConfig.adminPhone,
    isMembershipRequired: updatedConfig.isMembershipRequired,
    activationCodeHash: updatedConfig.activationCodeHash,
    customDomain: updatedConfig.customDomain,
    adminPinHash: updatedConfig.adminPinHash,
    hasCustomPin: updatedConfig.hasCustomPin,
    pharmacyAdOverride: updatedConfig.pharmacyAdOverride,
    remisAdOverride: updatedConfig.remisAdOverride,
    updatedAt: updatedConfig.updatedAt
  });

  window.dispatchEvent(new CustomEvent('vortex_config_updated', { detail: updatedConfig }));
  return {
    ok: true,
    adminPin: nextPin,
    config: updatedConfig,
    syncedToCloud: cloudSync.ok
  };
}

function hasStoredSystemConfig(): boolean {
  try {
    return Boolean(localStorage.getItem(SYSTEM_CONFIG_STORAGE_KEY));
  } catch {
    return false;
  }
}

/**
 * Push a locally saved config up to Firestore when the admin later connects with Google.
 */
export async function syncLocalSystemConfigToCloudIfNewer(): Promise<{
  synced: boolean;
  config?: SystemConfig;
  error?: string;
}> {
  if (!hasStoredSystemConfig()) return { synced: false };
  const localCfg = getStoredSystemConfig();
  const cloudCfg = await fetchPublicSystemSettingsFromFirestore();
  const localTime = Date.parse(localCfg.updatedAt || '') || 0;
  const cloudTime = Date.parse(cloudCfg?.updatedAt || '') || 0;
  if (localTime <= cloudTime) return { synced: false };

  const cloudSync = await savePublicSystemSettingsToFirestore({
    monthlyFee: localCfg.monthlyFee,
    currency: localCfg.currency,
    membershipTitle: localCfg.membershipTitle,
    billingDescription: localCfg.billingDescription,
    paymentAlias: localCfg.paymentAlias,
    paymentCbu: localCfg.paymentCbu,
    paymentHolder: localCfg.paymentHolder,
    adminPhone: localCfg.adminPhone,
    isMembershipRequired: localCfg.isMembershipRequired,
    activationCodeHash: localCfg.activationCodeHash,
    customDomain: localCfg.customDomain,
    adminPinHash: localCfg.adminPinHash,
    hasCustomPin: localCfg.hasCustomPin,
    pharmacyAdOverride: localCfg.pharmacyAdOverride,
    remisAdOverride: localCfg.remisAdOverride,
    updatedAt: localCfg.updatedAt
  });
  return { synced: cloudSync.ok, config: localCfg, error: cloudSync.error };
}

/**
 * Fetch latest system configuration from Firestore (global cloud) and Express server API,
 * never overwriting a newer local unsynced edit with older remote data.
 */
export async function fetchSystemConfig(): Promise<SystemConfig> {
  let cloudCfg: SystemConfig | null = null;
  let serverCfg: SystemConfig | null = null;

  const [cloudRes, serverRes] = await Promise.allSettled([
    fetchPublicSystemSettingsFromFirestore(),
    fetch('/api/system/config').then((r) => (r.ok ? r.json() : null))
  ]);

  if (cloudRes.status === 'fulfilled' && cloudRes.value) {
    cloudCfg = stripAdminPin({ ...DEFAULT_SYSTEM_CONFIG, ...cloudRes.value });
  }
  if (serverRes.status === 'fulfilled' && serverRes.value?.config) {
    serverCfg = stripAdminPin({ ...DEFAULT_SYSTEM_CONFIG, ...serverRes.value.config });
  }

  let chosen: SystemConfig | null = null;
  if (cloudCfg && serverCfg) {
    const cloudTime = Date.parse(cloudCfg.updatedAt || '') || 0;
    const serverTime = Date.parse(serverCfg.updatedAt || '') || 0;
    chosen = cloudTime >= serverTime ? cloudCfg : serverCfg;
  } else {
    chosen = cloudCfg || serverCfg;
  }

  if (chosen) {
    if (hasStoredSystemConfig()) {
      const localCfg = getStoredSystemConfig();
      const localTime = Date.parse(localCfg.updatedAt || '') || 0;
      const chosenTime = Date.parse(chosen.updatedAt || '') || 0;
      // Preserve newer local edits instead of reverting to stale cloud/server data
      if (localTime > chosenTime) {
        return localCfg;
      }
    }
    try {
      localStorage.setItem(SYSTEM_CONFIG_STORAGE_KEY, JSON.stringify(chosen));
    } catch {}
    return chosen;
  }

  return getStoredSystemConfig();
}

/**
 * Save and persist system configuration to Express server, Firestore (for static Netlify), and local storage.
 */
export async function saveSystemConfig(
  newConfig: Partial<SystemConfig> & { newAdminPin?: string },
  currentAdminPin?: string
): Promise<{ ok: boolean; config: SystemConfig; syncedToCloud?: boolean; localOnly?: boolean; error?: string }> {
  const current = getStoredSystemConfig();
  const { newAdminPin, adminPin, ...safeFields } = newConfig;
  const effectivePinForHash = (newAdminPin || adminPin || '').trim();
  const nextAdminPinHash = effectivePinForHash
    ? await hashAdminPin(effectivePinForHash)
    : current.adminPinHash;

  const sanitizedLocal: SystemConfig = stripAdminPin({
    ...current,
    ...safeFields,
    paymentAlias: (safeFields.paymentAlias !== undefined ? safeFields.paymentAlias : current.paymentAlias).trim(),
    paymentCbu: (safeFields.paymentCbu !== undefined ? safeFields.paymentCbu : current.paymentCbu).trim(),
    paymentHolder: (safeFields.paymentHolder !== undefined ? safeFields.paymentHolder : current.paymentHolder).trim(),
    adminPhone: (safeFields.adminPhone !== undefined ? safeFields.adminPhone : current.adminPhone).trim(),
    customDomain: (safeFields.customDomain !== undefined ? safeFields.customDomain : current.customDomain || '').trim(),
    adminPinHash: nextAdminPinHash,
    hasCustomPin: effectivePinForHash ? effectivePinForHash !== '1234' : current.hasCustomPin,
    updatedAt: new Date().toISOString()
  });

  let serverOk = false;
  let serverError = '';
  let finalConfig = sanitizedLocal;

  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (currentAdminPin) {
      headers['x-admin-pin'] = currentAdminPin;
    }

    const res = await fetch('/api/system/config', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        ...sanitizedLocal,
        currentAdminPin,
        ...(newAdminPin ? { newAdminPin } : adminPin ? { newAdminPin: adminPin } : {})
      })
    });

    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      finalConfig = stripAdminPin({ ...sanitizedLocal, ...(data?.config || {}) });
      serverOk = true;
    } else if (res.status !== 404) {
      const errData = await res.json().catch(() => ({}));
      serverError = errData?.error || 'PIN de administrador inválido.';
    }
  } catch {
    // Express server not reachable (e.g. static Netlify hosting)
  }

  // Sync to Firestore public settings if admin is authenticated via Google
  const cloudSync = await savePublicSystemSettingsToFirestore({
    monthlyFee: finalConfig.monthlyFee,
    currency: finalConfig.currency,
    membershipTitle: finalConfig.membershipTitle,
    billingDescription: finalConfig.billingDescription,
    paymentAlias: finalConfig.paymentAlias,
    paymentCbu: finalConfig.paymentCbu,
    paymentHolder: finalConfig.paymentHolder,
    adminPhone: finalConfig.adminPhone,
    isMembershipRequired: finalConfig.isMembershipRequired,
    activationCodeHash: finalConfig.activationCodeHash,
    customDomain: finalConfig.customDomain,
    adminPinHash: finalConfig.adminPinHash,
    hasCustomPin: finalConfig.hasCustomPin,
    pharmacyAdOverride: finalConfig.pharmacyAdOverride,
    remisAdOverride: finalConfig.remisAdOverride,
    updatedAt: finalConfig.updatedAt
  });

  // If server failed ONLY because of PIN mismatch when cloudSync succeeded, keep finalConfig anyway;
  // only reject when BOTH server rejected AND cloudSync failed.
  if (serverError && !cloudSync.ok) {
    import('./systemTelemetry')
      .then(({ logSystemEvent }) => {
        logSystemEvent({
          level: 'error',
          category: 'sync',
          source: 'Configuración',
          message: 'Error al sincronizar configuración del sistema',
          detail: cloudSync.error || serverError
        });
      })
      .catch(() => {});
    return {
      ok: false,
      config: current,
      syncedToCloud: false,
      error: serverError
    };
  }

  try {
    localStorage.setItem(SYSTEM_CONFIG_STORAGE_KEY, JSON.stringify(finalConfig));
  } catch {}

  window.dispatchEvent(new CustomEvent('vortex_config_updated', { detail: finalConfig }));

  if (cloudSync.ok || serverOk) {
    import('./systemTelemetry')
      .then(({ logSystemEvent }) => {
        logSystemEvent({
          level: 'info',
          category: 'sync',
          source: 'Configuración',
          message: cloudSync.ok
            ? 'Configuración guardada en la nube (Firestore)'
            : 'Configuración guardada en servidor local',
          detail: `Alias: ${finalConfig.paymentAlias} · Cuota: $${finalConfig.monthlyFee}`
        });
      })
      .catch(() => {});
    return {
      ok: true,
      config: finalConfig,
      syncedToCloud: cloudSync.ok,
      localOnly: !cloudSync.ok,
      error: !cloudSync.ok ? cloudSync.error : undefined
    };
  }

  import('./systemTelemetry')
    .then(({ logSystemEvent }) => {
      logSystemEvent({
        level: 'warn',
        category: 'sync',
        source: 'Configuración',
        message: 'Guardado solo en este navegador (falta conectar Google Admin)',
        detail: cloudSync.error || 'Sin sesión Google Admin'
      });
    })
    .catch(() => {});

  return {
    ok: true,
    config: finalConfig,
    syncedToCloud: false,
    localOnly: true,
    error: cloudSync.error || 'Guardado solo en este navegador. Conectá Google Admin para publicarlo en Netlify y otros celulares.'
  };
}
