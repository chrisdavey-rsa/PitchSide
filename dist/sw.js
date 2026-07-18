/* PitchSide Service Worker
 * - Network-first with cache fallback for offline resilience (same-origin GET only).
 * - Never intercept Supabase API traffic or mutating HTTP methods.
 * - Push placeholder ready for future "As It Stands" Web Push alerts.
 */

const CACHE_VERSION = 'pitchside-v4';
const OFFLINE_URLS = ['/', '/index.html', '/manifest.json'];

function isSupabaseRequest(urlString) {
  try {
    const host = new URL(urlString).hostname;
    return host === 'supabase.co' || host.endsWith('.supabase.co');
  } catch {
    return false;
  }
}

function isMutatingMethod(method) {
  const m = (method || 'GET').toUpperCase();
  return m === 'POST' || m === 'PUT' || m === 'PATCH' || m === 'DELETE';
}

/** Requests the SW must never intercept — always hit the real network. */
function shouldBypassServiceWorker(request) {
  if (!request.url.startsWith('http')) return true;
  if (isMutatingMethod(request.method)) return true;
  if (isSupabaseRequest(request.url)) return true;
  return false;
}

// --- Install: pre-cache the app shell -------------------------------------
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(OFFLINE_URLS))
      .catch(() => undefined)
  );
  self.skipWaiting();
});

// --- Activate: clean up old cache versions --------------------------------
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

// --- Fetch handler (required for Chrome installability / beforeinstallprompt) ---
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Critical: let Supabase + POST/PUT/PATCH/DELETE go straight to the network.
  // Returning without respondWith means the browser handles the request natively.
  if (shouldBypassServiceWorker(request)) {
    return;
  }

  // Only cache-assist same-origin GET navigation / asset requests.
  if (request.method !== 'GET') {
    return;
  }

  // Navigations (direct deep links / refresh): prefer network, then app shell.
  // After vercel.json SPA rewrites, the network returns index.html for /join/*.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) return response;
          return caches.match('/index.html').then((cached) => cached || response);
        })
        .catch(() =>
          caches.match('/index.html').then(
            (cached) =>
              cached ||
              new Response('PitchSide offline', {
                status: 503,
                headers: { 'Content-Type': 'text/plain' },
              }),
          ),
        ),
    );
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        const copy = response.clone();
        if (response.ok && new URL(request.url).origin === self.location.origin) {
          caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy)).catch(() => undefined);
        }
        return response;
      })
      .catch(() =>
        caches.match(request).then((cached) => cached || caches.match('/index.html'))
      )
  );
});

// Allow the page to force activation of a waiting worker.
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// --- Push: placeholder for future Web Push notifications -------------------
self.addEventListener('push', (event) => {
  let payload = { title: 'PitchSide', body: 'You have a new update.' };
  try {
    if (event.data) {
      payload = { ...payload, ...event.data.json() };
    }
  } catch (_) {
    if (event.data) payload.body = event.data.text();
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: payload.data || {},
    })
  );
});

// --- Notification click: focus or open the app ----------------------------
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow('/');
    })
  );
});
