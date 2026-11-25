/**
 * Push Notification System for Vortex ID Punta Alta.
 * Handles push notifications for emergencies, pharmacy shift changes,
 * weather alerts, and official service notices.
 */

export type PushAlertType = 'emergency' | 'pharmacy' | 'weather' | 'general';

export interface PushAlert {
  id: string;
  type: PushAlertType;
  title: string;
  body: string;
  timestamp: string;
  dataUrl?: string;
  author?: string;
  urgent?: boolean;
}

const STORAGE_KEY_ALERTS = 'vortex_push_alerts_history';
const STORAGE_KEY_PREFS = 'vortex_push_preferences';

export interface PushPreferences {
  emergencyAlerts: boolean;
  pharmacyAlerts: boolean;
  weatherAlerts: boolean;
  serviceAlerts: boolean;
}

export const DEFAULT_PUSH_PREFERENCES: PushPreferences = {
  emergencyAlerts: true,
  pharmacyAlerts: true,
  weatherAlerts: true,
  serviceAlerts: true
};

let swRegistration: ServiceWorkerRegistration | null = null;
let swRegistrationPromise: Promise<ServiceWorkerRegistration | null> | null = null;

let swListenersBound = false;
let lastSwUpdateCheckAt = 0;

function reloadOnceForNewSw() {
  try {
    const lastReload = Number(sessionStorage.getItem('vortex_sw_last_reload_ts') || '0');
    if (Date.now() - lastReload < 15000) return;
    sessionStorage.setItem('vortex_sw_last_reload_ts', String(Date.now()));
  } catch {
    // ignore storage errors
  }
  window.location.reload();
}

/**
 * Register Service Worker and initialize push notification listener
 */
export function initPushNotifications(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return Promise.resolve(null);
  }
  if (swRegistrationPromise) {
    return swRegistrationPromise;
  }

  swRegistrationPromise = (async () => {
    try {
      const hadController = Boolean(navigator.serviceWorker.controller);
      const reg = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
        updateViaCache: 'none'
      });
      swRegistration = reg;

      // If a newer worker is already waiting, promote it immediately
      if (reg.waiting) {
        reg.waiting.postMessage({ type: 'SKIP_WAITING' });
      }

      reg.addEventListener('updatefound', () => {
        const installing = reg.installing;
        if (!installing) return;
        installing.addEventListener('statechange', () => {
          if (installing.state === 'installed' && navigator.serviceWorker.controller) {
            installing.postMessage({ type: 'SKIP_WAITING' });
          }
        });
      });

      // Force immediate check for newer Service Worker builds (prevents stale Netlify versions)
      lastSwUpdateCheckAt = Date.now();
      reg.update().catch(() => {});

      if (!swListenersBound) {
        swListenersBound = true;

        // Auto-reload once when a new Service Worker takes over an existing session
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          if (!hadController) return;
          reloadOnceForNewSw();
        });

        // Re-check for Netlify SW updates when returning to the app or regaining connectivity
        const checkForUpdates = () => {
          if (document.visibilityState === 'hidden') return;
          const now = Date.now();
          if (now - lastSwUpdateCheckAt < 30000) return;
          lastSwUpdateCheckAt = now;
          reg.update().catch(() => {});
        };
        document.addEventListener('visibilitychange', checkForUpdates);
        window.addEventListener('online', checkForUpdates);

        // Listen for messages from SW (e.g. notification clicks or forced activation)
        navigator.serviceWorker.addEventListener('message', (event) => {
          if (event.data && event.data.type === 'PUSH_NOTIFICATION_CLICKED') {
            window.dispatchEvent(new CustomEvent('vortex_notification_opened', { detail: event.data.payload }));
          }
        });
      }

      return reg;
    } catch (err) {
      console.warn('Service worker registration failed:', err);
      return null;
    }
  })();

  return swRegistrationPromise;
}

/**
 * Check current push permission status
 */
export function getPushPermissionState(): 'granted' | 'denied' | 'default' | 'unsupported' {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission;
}

/**
 * Request notification permission from user
 */
export async function requestPushPermission(): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      if (!swRegistration) {
        await initPushNotifications();
      }
      return true;
    }
    return false;
  } catch (err) {
    console.error('Error requesting notification permission:', err);
    return false;
  }
}

/**
 * Retrieve saved notification preferences
 */
export function getPushPreferences(): PushPreferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PREFS);
    if (raw) return { ...DEFAULT_PUSH_PREFERENCES, ...JSON.parse(raw) };
  } catch {
    // fallback
  }
  return DEFAULT_PUSH_PREFERENCES;
}

/**
 * Save notification preferences
 */
export function savePushPreferences(prefs: PushPreferences): void {
  try {
    localStorage.setItem(STORAGE_KEY_PREFS, JSON.stringify(prefs));
  } catch {
    // ignore
  }
}

/**
 * Retrieve push alert history
 */
export function getPushHistory(): PushAlert[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ALERTS);
    if (raw) {
      const parsed = JSON.parse(raw) as PushAlert[];
      return parsed.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }
  } catch {
    // ignore
  }

  // Prepopulate default recent critical alerts for Punta Alta
  const initialAlerts: PushAlert[] = [
    {
      id: 'alert-01',
      type: 'pharmacy',
      title: '💊 Farmacias de Turno Activas en Punta Alta',
      body: 'Guardia oficial 24hs (08:30 a 08:30 hs) actualizada con geolocalización y cálculo Haversine en vivo.',
      timestamp: new Date().toISOString(),
      urgent: false
    },
    {
      id: 'alert-02',
      type: 'emergency',
      title: '🚨 Guardia de Salud SAME 107 Punta Alta',
      body: 'Canal de auxilio rápido activado. Tocá el botón de 1 toque ante emergencias médicas en la vía pública.',
      timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
      urgent: true
    }
  ];

  try {
    localStorage.setItem(STORAGE_KEY_ALERTS, JSON.stringify(initialAlerts));
  } catch {
    // ignore
  }

  return initialAlerts;
}

/**
 * Save alert to history
 */
export function saveAlertToHistory(alert: PushAlert): void {
  try {
    const history = getPushHistory();
    const updated = [alert, ...history.filter((a) => a.id !== alert.id)].slice(0, 50);
    localStorage.setItem(STORAGE_KEY_ALERTS, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent('vortex_alerts_updated', { detail: updated }));
  } catch {
    // ignore
  }
}

/**
 * Send / Trigger a Push Notification
 * Broadcasts to Service Worker and to backend server
 */
export async function triggerPushNotification(params: {
  type: PushAlertType;
  title: string;
  body: string;
  dataUrl?: string;
  urgent?: boolean;
  adminPin?: string;
}): Promise<PushAlert> {
  const alert: PushAlert = {
    id: `vtx-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type: params.type,
    title: params.title,
    body: params.body,
    timestamp: new Date().toISOString(),
    dataUrl: params.dataUrl || '/',
    urgent: params.urgent ?? (params.type === 'emergency')
  };

  // 1. Save locally in history
  saveAlertToHistory(alert);

  // 2. Trigger native browser push notification via Service Worker
  try {
    if ('serviceWorker' in navigator) {
      const reg = swRegistration || (await navigator.serviceWorker.ready);
      if (reg && 'showNotification' in reg) {
        let vibration = [200, 100, 200];
        if (alert.type === 'emergency') {
          vibration = [400, 150, 400, 150, 600];
        }

        await reg.showNotification(alert.title, {
          body: alert.body,
          icon: '/icon-192.png?v=36',
          badge: '/icon-192.png?v=36',
          tag: alert.id,
          vibrate: vibration,
          data: { url: alert.dataUrl },
          requireInteraction: alert.type === 'emergency'
        } as unknown as NotificationOptions);
      }
    } else if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(alert.title, {
        body: alert.body,
        icon: '/icon-192.png?v=36'
      });
    }
  } catch (err) {
    console.warn('Native push notification error:', err);
  }

  // 3. Sync to server API so connected clients also receive the alert
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (params.adminPin) {
      headers['x-admin-pin'] = params.adminPin;
    }
    const res = await fetch('/api/push/broadcast', {
      method: 'POST',
      headers,
      body: JSON.stringify(alert)
    });
    if (!res.ok) {
      console.warn('Push broadcast server response:', res.status);
    }
  } catch {
    // ignore
  }

  return alert;
}
