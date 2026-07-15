/* PitchSide Service Worker
 * - Network-first with cache fallback for offline resilience.
 * - Push placeholder ready for future "As It Stands" Web Push alerts.
 */

const CACHE_VERSION = 'pitchside-v1';
const OFFLINE_URLS = ['/', '/index.html', '/manifest.json'];

// --- Install: pre-cache the app shell -------------------------------------
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(OFFLINE_URLS))
      .catch(() => undefined)
  );
  // Activate this worker as soon as it finishes installing.
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

// --- Fetch: network-first, falling back to cache --------------------------
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only handle GET requests over http(s); let everything else pass through.
  if (request.method !== 'GET' || !request.url.startsWith('http')) {
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        // Cache a copy of successful same-origin responses for offline use.
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

// --- Push: placeholder for future Web Push notifications -------------------
// When we wire up Web Push (e.g. "As It Stands" score alerts), the server will
// send a payload here and we surface it via showNotification.
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
