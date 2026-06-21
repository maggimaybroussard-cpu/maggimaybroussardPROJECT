const CACHE_NAME = 'broussard-legal-v2';
const STATIC_ASSETS = [
  '/manifest.json',
  '/favicon.ico',
  '/assets/images/app_logo.png',
];

// Install: cache only truly static assets (not Next.js chunks)
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: NEVER cache /_next/ paths — they must always be fresh from network
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET and cross-origin requests
  if (event.request.method !== 'GET') return;

  // CRITICAL: Never intercept Next.js build output — stale chunks cause
  // "Cannot read properties of undefined (reading 'call')" webpack errors
  if (url.pathname.startsWith('/_next/')) return;

  // Skip API, portal, and admin routes — always network
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/portal/') ||
    url.pathname.startsWith('/admin/')
  ) {
    return;
  }

  // Cache-first for true static assets only (images, icons, manifest)
  if (
    url.pathname.startsWith('/assets/') ||
    url.pathname === '/favicon.ico' ||
    url.pathname === '/manifest.json'
  ) {
    event.respondWith(
      caches.match(event.request).then(
        (cached) => cached || fetch(event.request).then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return res;
        })
      )
    );
    return;
  }

  // Network-first for all pages
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});

// ── Push Notifications ────────────────────────────────────────────────────────

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: 'Broussard Legal', body: event.data.text() };
  }

  const { title = 'Broussard Legal Services', body = '', icon, badge, url, tag } = payload;

  const options = {
    body,
    icon: icon || '/assets/images/app_logo.png',
    badge: badge || '/assets/images/app_logo.png',
    tag: tag || 'broussard-notification',
    data: { url: url || '/' },
    requireInteraction: false,
    silent: false,
    vibrate: [200, 100, 200],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === url && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});
