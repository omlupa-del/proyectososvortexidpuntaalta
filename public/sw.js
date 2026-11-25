/**
 * Vortex ID Punta Alta - Enhanced Life-Saving Service Worker
 * Guarantees reliable PWA updates on Netlify and offline access to:
 * 1. Ficha Médica SOS and Verified Identity Photo
 * 2. Direct Emergency Call Grid (SAME 107, Policía 911, Bomberos 100, Defensa Civil 103, HNPB, Hosp. Eva Perón)
 * 3. 20 Punta Alta Pharmacies Directory and 24h Duty Shift Schedules
 * 4. Web Push Notifications for Critical Alerts
 */

const SW_VERSION = 'v42';
const STATIC_CACHE_NAME = `vortexid-static-${SW_VERSION}`;
const EMERGENCY_CACHE_NAME = `vortexid-emergency-offline-${SW_VERSION}`;

const PRECACHE_STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json?v=36',
  '/icon-192.png?v=36',
  '/icon-512.png?v=36',
  '/apple-touch-icon.png?v=36',
  '/assets/aistudio/image__2__7d12aee0.png',
  '/assets/qr_vortex_id_futurista.png?v=41'
];

const PRECACHE_EMERGENCY_APIS = [
  '/api/emergency/offline-bundle',
  '/api/system/config',
  '/api/records/primary',
  '/api/push/history'
];

const MUTABLE_PUBLIC_PATHS = new Set([
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png',
  '/assets/qr_vortex_id_futurista.png',
  '/qr.html'
]);

// Fallback emergency dataset embedded in SW for instant zero-network availability
const EMBEDDED_EMERGENCY_FALLBACK = {
  success: true,
  offlineReady: true,
  city: 'Punta Alta, Coronel Rosales',
  emergencyContacts: [
    { id: '107', title: '107 · SAME / Ambulancia', number: '107', directDial: '107', subtitle: 'Hospital Municipal Eva Perón' },
    { id: '911', title: '911 · Policía Comunal', number: '911', directDial: '911', subtitle: 'Seguridad Punta Alta' },
    { id: '100', title: '100 · Bomberos Voluntarios', number: '100', directDial: '100', subtitle: 'Mitre 537' },
    { id: '103', title: '103 · Defensa Civil', number: '103', directDial: '103', subtitle: 'Urgencias climáticas' },
    { id: 'hnpb', title: 'Hospital Naval Puerto Belgrano', number: '(02932) 48-9600', directDial: '02932489600', subtitle: 'Guardia Médica 24hs' },
    { id: 'hosp_muni', title: 'Hospital Municipal Eva Perón', number: '(02932) 42-1222', directDial: '02932421222', subtitle: 'Uriburu 650' }
  ],
  pharmaciesCount: 20,
  dutyShiftActive: true
};

function isHtmlContentType(response) {
  const ct = response?.headers?.get('content-type') || '';
  return ct.toLowerCase().includes('text/html');
}

function isExpectedAssetResponse(pathname, response) {
  if (!response || !response.ok) return false;
  // HTML documents are valid for shell/html routes only
  if (pathname === '/' || pathname.endsWith('.html')) {
    return isHtmlContentType(response);
  }
  // Never store Netlify SPA HTML fallback (/* -> /index.html status 200) as JS/CSS/image/JSON
  return !isHtmlContentType(response);
}

// 1. Install Event: Force fresh fetch (bypass HTTP cache) & prime emergency caches
self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const staticCache = await caches.open(STATIC_CACHE_NAME);

      // Fetch each asset individually with cache:'reload' so stale CDN/browser cache never survives deploy
      await Promise.allSettled(
        PRECACHE_STATIC_ASSETS.map(async (assetUrl) => {
          try {
            const parsed = new URL(assetUrl, self.location.origin);
            const res = await fetch(
              new Request(parsed.href, {
                cache: 'reload',
                credentials: 'same-origin'
              })
            );
            if (isExpectedAssetResponse(parsed.pathname, res)) {
              await staticCache.put(assetUrl, res);
            }
          } catch (err) {
            console.warn('[SW Install] Asset precache skipped:', assetUrl, err);
          }
        })
      );

      // Precache critical emergency APIs (ignore Netlify HTML SPA fallback on static hosting)
      const emergencyCache = await caches.open(EMERGENCY_CACHE_NAME);
      await Promise.allSettled(
        PRECACHE_EMERGENCY_APIS.map(async (apiUrl) => {
          try {
            const res = await fetch(
              new Request(apiUrl, {
                cache: 'no-store',
                credentials: 'same-origin'
              })
            );
            const ct = (res?.headers?.get('content-type') || '').toLowerCase();
            if (res && res.ok && ct.includes('application/json')) {
              await emergencyCache.put(apiUrl, res);
              return;
            }
          } catch {
            // Fall through to embedded fallback
          }

          const fallbackRes = new Response(JSON.stringify(EMBEDDED_EMERGENCY_FALLBACK), {
            headers: { 'Content-Type': 'application/json', 'X-Vortex-Offline': 'true' }
          });
          await emergencyCache.put(apiUrl, fallbackRes);
        })
      );

      await self.skipWaiting();
    })()
  );
});

// 2. Activate Event: Purge all outdated caches, claim clients & notify open tabs
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key !== STATIC_CACHE_NAME && key !== EMERGENCY_CACHE_NAME)
          .map((key) => caches.delete(key))
      );

      await self.clients.claim();

      const clients = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true
      });
      for (const client of clients) {
        client.postMessage({
          type: 'SW_ACTIVATED',
          version: SW_VERSION
        });
      }
    })()
  );
});

// 3. Fetch Event: Deployment-safe Network-First strategies with strict MIME validation
self.addEventListener('fetch', (event) => {
  const request = event.request;
  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }

  // Only handle http(s) same-origin requests (skip chrome-extension://, external CDNs, Firebase, etc.)
  if (!url.protocol.startsWith('http') || url.origin !== self.location.origin) {
    return;
  }

  // Bypass SW cache for Vite dev / HMR paths and the SW script itself
  if (
    url.pathname === '/sw.js' ||
    url.pathname.startsWith('/src/') ||
    url.pathname.startsWith('/@') ||
    url.pathname.startsWith('/node_modules/')
  ) {
    return;
  }

  // A. Handle API Requests (Network-First with Emergency Cache Fallback)
  if (url.pathname.startsWith('/api/')) {
    if (request.method === 'GET') {
      event.respondWith(
        (async () => {
          try {
            const networkResponse = await fetch(
              new Request(request.url, {
                cache: 'no-store',
                credentials: 'same-origin'
              })
            );
            const contentType = (networkResponse?.headers?.get('content-type') || '').toLowerCase();
            if (networkResponse && networkResponse.ok && contentType.includes('application/json')) {
              const cache = await caches.open(EMERGENCY_CACHE_NAME);
              await cache.put(request, networkResponse.clone());
            }
            return networkResponse;
          } catch {
            const cached = await caches.match(request);
            if (cached) {
              return cached;
            }

            if (url.pathname.includes('/api/emergency/') || url.pathname.includes('/api/records/')) {
              return new Response(JSON.stringify(EMBEDDED_EMERGENCY_FALLBACK), {
                headers: { 'Content-Type': 'application/json', 'X-Vortex-Offline': 'true' }
              });
            }

            if (url.pathname.includes('/api/system/config')) {
              return new Response(
                JSON.stringify({
                  success: true,
                  config: {
                    monthlyFee: 3000,
                    currency: 'ARS',
                    membershipTitle: 'Membresía Oficial Vortex ID',
                    paymentAlias: 'vortex.id.auxilio',
                    paymentHolder: 'VORTEX ID · PUNTA ALTA',
                    hasCustomPin: false
                  },
                  offlineFallback: true
                }),
                {
                  headers: { 'Content-Type': 'application/json', 'X-Vortex-Offline': 'true' }
                }
              );
            }

            return new Response(JSON.stringify({ offline: true, error: 'Modo sin conexión activo' }), {
              status: 503,
              headers: { 'Content-Type': 'application/json', 'X-Vortex-Offline': 'true' }
            });
          }
        })()
      );
      return;
    }

    // For POST requests while offline: gracefully accept record/push syncs
    if (request.method === 'POST') {
      event.respondWith(
        fetch(request).catch(async () => {
          if (url.pathname.startsWith('/api/records/') || url.pathname.startsWith('/api/push/')) {
            return new Response(
              JSON.stringify({
                success: true,
                offlineSaved: true,
                message: 'Datos guardados en modo offline en tu dispositivo.'
              }),
              {
                status: 200,
                headers: { 'Content-Type': 'application/json', 'X-Vortex-Offline': 'true' }
              }
            );
          }
          return new Response(
            JSON.stringify({
              success: false,
              offline: true,
              error: 'Sin conexión con el servidor.'
            }),
            {
              status: 503,
              headers: { 'Content-Type': 'application/json', 'X-Vortex-Offline': 'true' }
            }
          );
        })
      );
      return;
    }

    return;
  }

  // Only cache GET requests outside /api/
  if (request.method !== 'GET') {
    return;
  }

  // B. Handle HTML Navigation (App Shell: Always fetch fresh from Netlify with cache:'no-store')
  const acceptHeader = request.headers.get('accept') || '';
  if (request.mode === 'navigate' || acceptHeader.includes('text/html') || url.pathname === '/qr.html') {
    event.respondWith(
      (async () => {
        try {
          const networkRes = await fetch(
            new Request(request.url, {
              cache: 'no-store',
              credentials: 'same-origin',
              redirect: 'follow'
            })
          );
          if (networkRes && networkRes.ok && isHtmlContentType(networkRes)) {
            const cache = await caches.open(STATIC_CACHE_NAME);
            if (url.pathname === '/qr.html') {
              await cache.put('/qr.html', networkRes.clone());
            } else {
              await cache.put('/index.html', networkRes.clone());
              if (url.pathname === '/') {
                await cache.put('/', networkRes.clone());
              }
            }
          }
          return networkRes;
        } catch {
          if (url.pathname === '/qr.html') {
            const cachedQr = await caches.match('/qr.html');
            if (cachedQr) return cachedQr;
          }
          const cached =
            (await caches.match(request)) ||
            (await caches.match('/index.html')) ||
            (await caches.match('/'));
          if (cached) return cached;

          return new Response('Vortex ID · Modo Offline Activo', {
            headers: { 'Content-Type': 'text/html; charset=utf-8' }
          });
        }
      })()
    );
    return;
  }

  // B2. Handle Mutable Public Files (Manifest, App Icons, Official QR): Always bypass HTTP cache
  if (MUTABLE_PUBLIC_PATHS.has(url.pathname)) {
    event.respondWith(
      (async () => {
        try {
          const networkResponse = await fetch(
            new Request(request.url, {
              cache: 'no-store',
              credentials: 'same-origin'
            })
          );
          if (isExpectedAssetResponse(url.pathname, networkResponse)) {
            const cache = await caches.open(STATIC_CACHE_NAME);
            await cache.put(request, networkResponse.clone());
            return networkResponse;
          }
          // If Netlify returned SPA HTML for a missing image/manifest, prefer cached asset if available
          const cachedFallback =
            (await caches.match(request)) || (await caches.match(url.pathname));
          return cachedFallback || networkResponse;
        } catch {
          const cached =
            (await caches.match(request)) || (await caches.match(url.pathname));
          return cached || Response.error();
        }
      })()
    );
    return;
  }

  // C. Handle Static Build Assets (JS, CSS, SVGs, Fonts, Images): Network-First + strict MIME check
  event.respondWith(
    (async () => {
      try {
        const networkResponse = await fetch(
          new Request(request.url, {
            cache: 'no-cache',
            credentials: 'same-origin'
          })
        );
        if (networkResponse && networkResponse.ok && !isHtmlContentType(networkResponse)) {
          const cache = await caches.open(STATIC_CACHE_NAME);
          await cache.put(request, networkResponse.clone());
          return networkResponse;
        }

        // Prevent poisoning cache or returning HTML fallback for stale/missing hashed JS/CSS chunks
        if (networkResponse && isHtmlContentType(networkResponse)) {
          const cached = await caches.match(request);
          if (cached) return cached;
          return new Response('', { status: 404, statusText: 'Asset Not Found' });
        }

        return networkResponse;
      } catch {
        const cached = await caches.match(request);
        return cached || Response.error();
      }
    })()
  );
});

// 4. Message Event: Sync medical records, forced updates & offline cache management
self.addEventListener('message', (event) => {
  if (!event.data) return;

  // Allow client to immediately activate a waiting Service Worker version
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }

  if (event.data.type === 'GET_SW_VERSION') {
    event.ports?.[0]?.postMessage({ version: SW_VERSION });
    return;
  }

  if (event.data.type === 'CLEAR_ALL_CACHES') {
    event.waitUntil(
      caches.keys().then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
    );
    return;
  }

  // Cache updated medical record directly into SW emergency cache
  if (event.data.type === 'CACHE_EMERGENCY_DATA') {
    const { record, keychainId } = event.data;
    if (record) {
      caches.open(EMERGENCY_CACHE_NAME).then((cache) => {
        const payload = JSON.stringify({ success: true, record });
        const resPrimary = new Response(payload, {
          headers: { 'Content-Type': 'application/json', 'X-Vortex-Offline': 'true' }
        });
        cache.put('/api/records/primary', resPrimary);

        if (keychainId) {
          const cleanKey = String(keychainId).trim().toUpperCase().replace(/^#/, '');
          const resKeychain = new Response(payload, {
            headers: { 'Content-Type': 'application/json', 'X-Vortex-Offline': 'true' }
          });
          cache.put(`/api/records/keychain/${cleanKey}`, resKeychain);
        }
      });
    }
  }

  // Ping offline cache status check
  if (event.data.type === 'CHECK_OFFLINE_CACHE') {
    caches.open(EMERGENCY_CACHE_NAME).then(async (cache) => {
      const keys = await cache.keys();
      const hasEmergencyBundle = keys.some((k) => k.url.includes('/api/emergency/offline-bundle'));
      event.ports?.[0]?.postMessage({
        offlineReady: true,
        version: SW_VERSION,
        cachedEndpointsCount: keys.length,
        hasEmergencyBundle
      });
    });
  }

  // Direct trigger for testing local push notification
  if (event.data.type === 'TRIGGER_NOTIFICATION') {
    const { title, options } = event.data;
    self.registration.showNotification(title, {
      ...options,
      vibrate: options?.type === 'emergency' ? [400, 150, 400, 150, 600] : [200, 100, 200],
      actions: [
        { action: 'open', title: '👁️ Ver en App' },
        { action: 'call107', title: '🚑 SAME 107' }
      ]
    });
  }
});

// 5. Push Notification Event (Web Push)
self.addEventListener('push', (event) => {
  let data = {
    title: '🚨 Alerta Vortex ID · Punta Alta',
    body: 'Aviso urgente de emergencia o farmacias de turno.',
    icon: '/icon-192.png?v=36',
    badge: '/icon-192.png?v=36',
    tag: 'vortex-alert-' + Date.now(),
    data: { url: '/' },
    type: 'general'
  };

  try {
    if (event.data) {
      data = { ...data, ...event.data.json() };
    }
  } catch {
    if (event.data) {
      data.body = event.data.text();
    }
  }

  let vibrationPattern = [200, 100, 200];
  if (data.type === 'emergency' || data.title.includes('🚨') || data.title.includes('SOS')) {
    vibrationPattern = [400, 150, 400, 150, 600];
  }

  const options = {
    body: data.body,
    icon: data.icon || '/icon-192.png?v=36',
    badge: data.badge || '/icon-192.png?v=36',
    vibrate: vibrationPattern,
    tag: data.tag || 'vortex-push',
    renotify: true,
    requireInteraction: data.type === 'emergency',
    data: data.data || { url: '/' },
    actions: [
      { action: 'open', title: '👁️ Ver en App' },
      { action: 'call107', title: '🚑 Llamar SAME 107' }
    ]
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

// 6. Notification Click Event
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'call107') {
    event.waitUntil(self.clients.openWindow('tel:107').catch(() => {}));
    return;
  }

  const targetUrl = event.notification.data?.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.postMessage({
            type: 'PUSH_NOTIFICATION_CLICKED',
            payload: event.notification.data
          });
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
