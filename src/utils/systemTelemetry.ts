import { doc, getDocFromServer } from 'firebase/firestore';
import { auth, db } from '../firebase/firebase';
import { getLastRealGpsCoords } from './geo';

export type TelemetryLogLevel = 'info' | 'warn' | 'error';
export type TelemetryLogCategory = 'gps' | 'sync' | 'firestore' | 'gemini' | 'api' | 'auth' | 'sw';

export interface SystemLogEntry {
  id: string;
  timestamp: string;
  level: TelemetryLogLevel;
  category: TelemetryLogCategory;
  source: string;
  message: string;
  detail?: string;
}

export type ServiceHealthState =
  | 'nominal'
  | 'degraded'
  | 'error'
  | 'offline'
  | 'unconfigured'
  | 'checking';

export interface ServiceNodeTelemetry {
  id: 'firestore' | 'gemini' | 'backend' | 'gps_sw';
  name: string;
  status: ServiceHealthState;
  statusLabel: string;
  latencyMs: number | null;
  detail: string;
  endpoint: string;
  checkedAt: string;
}

export interface SystemTelemetrySnapshot {
  nodes: ServiceNodeTelemetry[];
  backendUptimeSec: number | null;
  backendMemoryMb: number | null;
  backendKeychains: number | null;
  backendPushAlerts: number | null;
  checkedAt: string;
}

const LOGS_STORAGE_KEY = 'vortex_system_logs_v1';
const MAX_LOGS = 150;

let inMemoryLogs: SystemLogEntry[] | null = null;

function loadStoredLogs(): SystemLogEntry[] {
  if (inMemoryLogs) return inMemoryLogs;
  try {
    const raw = localStorage.getItem(LOGS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        inMemoryLogs = parsed.slice(0, MAX_LOGS);
        return inMemoryLogs;
      }
    }
  } catch {
    // ignore storage read error
  }
  inMemoryLogs = [];
  return inMemoryLogs;
}

function persistLogs(logs: SystemLogEntry[]): void {
  inMemoryLogs = logs.slice(0, MAX_LOGS);
  try {
    localStorage.setItem(LOGS_STORAGE_KEY, JSON.stringify(inMemoryLogs));
  } catch {
    // ignore storage quota error
  }
}

export function getSystemLogs(): SystemLogEntry[] {
  return [...loadStoredLogs()];
}

export function logSystemEvent(
  input: Omit<SystemLogEntry, 'id' | 'timestamp'>
): SystemLogEntry {
  const entry: SystemLogEntry = {
    id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
    ...input
  };

  const current = loadStoredLogs();
  const next = [entry, ...current].slice(0, MAX_LOGS);
  persistLogs(next);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('vortex_system_log_added', { detail: entry }));
  }

  return entry;
}

export function clearSystemLogs(): void {
  persistLogs([]);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('vortex_system_logs_cleared'));
  }
}

export function formatLogsAsText(logs: SystemLogEntry[]): string {
  return logs
    .map((log) => {
      const ts = new Date(log.timestamp).toLocaleString('es-AR', { hour12: false });
      const lvl = log.level.toUpperCase().padEnd(5, ' ');
      const cat = log.category.toUpperCase();
      return `[${ts}] [${lvl}] [${cat} · ${log.source}] ${log.message}${log.detail ? ` — ${log.detail}` : ''}`;
    })
    .join('\n');
}

async function probeFirestoreNode(): Promise<ServiceNodeTelemetry> {
  const checkedAt = new Date().toISOString();
  const start = performance.now();

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return {
      id: 'firestore',
      name: 'Firebase Firestore',
      status: 'offline',
      statusLabel: 'Sin red local',
      latencyMs: null,
      detail: 'Navegador en modo sin conexión (offline). Lecturas servidas desde caché local.',
      endpoint: 'systemSettings/public',
      checkedAt
    };
  }

  try {
    await getDocFromServer(doc(db, 'systemSettings', 'public'));
    const latencyMs = Math.max(1, Math.round(performance.now() - start));
    return {
      id: 'firestore',
      name: 'Firebase Firestore',
      status: latencyMs > 1800 ? 'degraded' : 'nominal',
      statusLabel: latencyMs > 1800 ? 'Latencia alta' : 'Nominal',
      latencyMs,
      detail: `Lectura directa desde servidor verificada (${auth.currentUser?.email || 'Acceso público'}).`,
      endpoint: 'systemSettings/public',
      checkedAt
    };
  } catch (err) {
    const latencyMs = Math.max(1, Math.round(performance.now() - start));
    const msg = err instanceof Error ? err.message : String(err);
    const isOffline = /offline|unavailable|network|failed to fetch/i.test(msg);

    logSystemEvent({
      level: isOffline ? 'warn' : 'error',
      category: 'firestore',
      source: 'Sonda Firestore',
      message: isOffline ? 'Firestore sin conectividad de servidor' : 'Fallo al consultar Firestore',
      detail: msg
    });

    return {
      id: 'firestore',
      name: 'Firebase Firestore',
      status: isOffline ? 'offline' : 'error',
      statusLabel: isOffline ? 'Desconectado' : 'Error de enlace',
      latencyMs,
      detail: msg.slice(0, 140),
      endpoint: 'systemSettings/public',
      checkedAt
    };
  }
}

interface BackendTelemetryApiResponse {
  status?: string;
  uptimeSec?: number;
  memoryRssMb?: number;
  keychainsCount?: number;
  pushAlertsCount?: number;
  gemini?: {
    configured?: boolean;
    status?: string;
    httpStatus?: number;
    latencyMs?: number | null;
    detail?: string;
  };
}

async function probeBackendAndGeminiNodes(force: boolean): Promise<{
  backend: ServiceNodeTelemetry;
  gemini: ServiceNodeTelemetry;
  uptimeSec: number | null;
  memoryMb: number | null;
  keychains: number | null;
  pushAlerts: number | null;
}> {
  const checkedAt = new Date().toISOString();
  const start = performance.now();

  try {
    const res = await fetch(`/api/telemetry/status${force ? '?force=1' : ''}`, {
      cache: 'no-store'
    });
    const latencyMs = Math.max(1, Math.round(performance.now() - start));
    const contentType = res.headers.get('content-type') || '';

    if (!res.ok || !contentType.includes('application/json')) {
      const isStaticHost =
        typeof window !== 'undefined' &&
        /netlify\.app|vortexid/i.test(window.location.hostname);

      return {
        backend: {
          id: 'backend',
          name: 'API Backend Express',
          status: isStaticHost ? 'degraded' : 'error',
          statusLabel: isStaticHost ? 'Hosting estático' : `HTTP ${res.status}`,
          latencyMs,
          detail: isStaticHost
            ? 'Entorno estático Netlify: la sincronización usa Firestore en la nube.'
            : `El endpoint /api/telemetry/status devolvió estado ${res.status}.`,
          endpoint: '/api/telemetry/status',
          checkedAt
        },
        gemini: {
          id: 'gemini',
          name: 'Google Gemini API',
          status: 'unconfigured',
          statusLabel: isStaticHost ? 'Solo servidor Node' : 'Sin enlace API',
          latencyMs: null,
          detail: isStaticHost
            ? 'Requiere backend Express activo para sondear la clave GEMINI_API_KEY.'
            : 'No se pudo consultar el estado de Gemini desde el servidor.',
          endpoint: 'generativelanguage.googleapis.com',
          checkedAt
        },
        uptimeSec: null,
        memoryMb: null,
        keychains: null,
        pushAlerts: null
      };
    }

    const data = (await res.json()) as BackendTelemetryApiResponse;
    const g = data.gemini || {};

    let geminiStatus: ServiceHealthState = 'unconfigured';
    let geminiLabel = 'Sin clave API';
    if (g.configured) {
      if (g.status === 'nominal') {
        geminiStatus = (g.latencyMs ?? 0) > 2500 ? 'degraded' : 'nominal';
        geminiLabel = (g.latencyMs ?? 0) > 2500 ? 'Latencia alta' : 'Nominal';
      } else {
        geminiStatus = 'error';
        geminiLabel = g.httpStatus ? `Error HTTP ${g.httpStatus}` : 'Error de enlace';
        logSystemEvent({
          level: 'error',
          category: 'gemini',
          source: 'Sonda Gemini',
          message: 'Fallo en verificación de Gemini API',
          detail: g.detail || `HTTP ${g.httpStatus || 'desconocido'}`
        });
      }
    }

    return {
      backend: {
        id: 'backend',
        name: 'API Backend Express',
        status: latencyMs > 1500 ? 'degraded' : 'nominal',
        statusLabel: latencyMs > 1500 ? 'Lento' : 'Nominal',
        latencyMs,
        detail: `Node activo · ${data.keychainsCount ?? 0} llaveros · ${data.pushAlertsCount ?? 0} alertas push.`,
        endpoint: '/api/telemetry/status',
        checkedAt
      },
      gemini: {
        id: 'gemini',
        name: 'Google Gemini API',
        status: geminiStatus,
        statusLabel: geminiLabel,
        latencyMs: typeof g.latencyMs === 'number' ? g.latencyMs : null,
        detail: g.detail || 'Verificación de modelos Generative Language.',
        endpoint: 'generativelanguage.googleapis.com',
        checkedAt
      },
      uptimeSec: typeof data.uptimeSec === 'number' ? data.uptimeSec : null,
      memoryMb: typeof data.memoryRssMb === 'number' ? data.memoryRssMb : null,
      keychains: typeof data.keychainsCount === 'number' ? data.keychainsCount : null,
      pushAlerts: typeof data.pushAlertsCount === 'number' ? data.pushAlertsCount : null
    };
  } catch (err) {
    const latencyMs = Math.max(1, Math.round(performance.now() - start));
    const msg = err instanceof Error ? err.message : String(err);

    logSystemEvent({
      level: 'warn',
      category: 'api',
      source: 'Sonda API',
      message: 'Backend Express no alcanzable desde el cliente',
      detail: msg
    });

    return {
      backend: {
        id: 'backend',
        name: 'API Backend Express',
        status: 'offline',
        statusLabel: 'Inaccesible',
        latencyMs,
        detail: 'Sin respuesta de /api/telemetry/status. Operando en modo Firestore / offline.',
        endpoint: '/api/telemetry/status',
        checkedAt
      },
      gemini: {
        id: 'gemini',
        name: 'Google Gemini API',
        status: 'offline',
        statusLabel: 'Sin proxy API',
        latencyMs: null,
        detail: 'No se puede verificar Gemini sin conexión al servidor Express.',
        endpoint: 'generativelanguage.googleapis.com',
        checkedAt
      },
      uptimeSec: null,
      memoryMb: null,
      keychains: null,
      pushAlerts: null
    };
  }
}

function probeClientGpsAndSw(): ServiceNodeTelemetry {
  const checkedAt = new Date().toISOString();
  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
  const hasSw =
    typeof navigator !== 'undefined' &&
    'serviceWorker' in navigator &&
    Boolean(navigator.serviceWorker.controller);
  const lastGps = getLastRealGpsCoords(15 * 60 * 1000);

  let status: ServiceHealthState = 'nominal';
  let statusLabel = 'Operativo';
  if (!isOnline) {
    status = 'offline';
    statusLabel = 'Offline (PWA)';
  } else if (!lastGps) {
    status = 'degraded';
    statusLabel = 'Sin fijación GPS';
  }

  const gpsText = lastGps
    ? `GPS ±${Math.round(lastGps.accuracy || 0)}m (${lastGps.source})`
    : 'Sin señal GPS reciente';
  const swText = hasSw ? 'Service Worker activo' : 'SW en espera';

  return {
    id: 'gps_sw',
    name: 'GPS & Caché Offline',
    status,
    statusLabel,
    latencyMs: lastGps?.accuracy ? Math.round(lastGps.accuracy) : null,
    detail: `${gpsText} · ${swText}.`,
    endpoint: 'navigator.geolocation / sw.js',
    checkedAt
  };
}

export async function probeAllServices(force = false): Promise<SystemTelemetrySnapshot> {
  const [firestoreNode, serverPair] = await Promise.all([
    probeFirestoreNode(),
    probeBackendAndGeminiNodes(force)
  ]);
  const clientNode = probeClientGpsAndSw();
  const checkedAt = new Date().toISOString();

  return {
    nodes: [firestoreNode, serverPair.gemini, serverPair.backend, clientNode],
    backendUptimeSec: serverPair.uptimeSec,
    backendMemoryMb: serverPair.memoryMb,
    backendKeychains: serverPair.keychains,
    backendPushAlerts: serverPair.pushAlerts,
    checkedAt
  };
}
