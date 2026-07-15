const CACHE_NAME = 'broussard-legal-v3';
const SHELL_CACHE = 'broussard-shell-v3';

// App shell — pages that form the PWA offline experience
const APP_SHELL_PAGES = [
  '/',
  '/services',
  '/contact',
  '/portal/login',
  '/book-consultation',
];

// Static assets always cached
const STATIC_ASSETS = [
  '/manifest.json',
  '/favicon.ico',
  '/assets/images/app_logo.png',
  '/assets/images/og-image.png',
];

// ── Install: cache static assets + app shell pages ───────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    Promise.all([
      caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)),
      // Pre-cache app shell pages for offline support
      caches.open(SHELL_CACHE).then((cache) =>
        Promise.allSettled(
          APP_SHELL_PAGES.map((url) =>
            fetch(url, { credentials: 'same-origin' })
              .then((res) => { if (res.ok) cache.put(url, res); })
              .catch(() => {/* ignore network errors during install */})
          )
        )
      ),
    ])
  );
  self.skipWaiting();
});

// ── Activate: clean old caches ────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME && k !== SHELL_CACHE)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ── Fetch strategy ────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET and cross-origin requests
  if (event.request.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;

  // CRITICAL: Never intercept Next.js build output — stale chunks cause webpack errors
  if (url.pathname.startsWith('/_next/')) return;

  // Skip API, portal, admin, and auth routes — always network
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/portal/') ||
    url.pathname.startsWith('/admin/') ||
    url.pathname.startsWith('/auth/')
  ) {
    return;
  }

  // Cache-first for true static assets (images, icons, manifest)
  if (
    url.pathname.startsWith('/assets/') ||
    url.pathname === '/favicon.ico' ||
    url.pathname === '/manifest.json' ||
    url.pathname === '/browserconfig.xml'
  ) {
    event.respondWith(
      caches.match(event.request).then(
        (cached) =>
          cached ||
          fetch(event.request).then((res) => {
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

  // Network-first for app shell pages — fall back to cached version offline
  if (APP_SHELL_PAGES.includes(url.pathname) || url.pathname === '/') {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(SHELL_CACHE).then((cache) => cache.put(event.request, clone));
          }
          return res;
        })
        .catch(() =>
          caches.match(event.request).then(
            (cached) => cached || caches.match('/')
          )
        )
    );
    return;
  }

  // Network-first for all other pages
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
