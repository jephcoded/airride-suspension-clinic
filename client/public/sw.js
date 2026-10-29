/*
 * Airride service worker: makes the installed app open instantly and survive weak connections.
 * - Website files (JS, CSS, fonts, images) are cached after first use.
 * - Pages: network first, falling back to the cached app shell when offline.
 * - /api/* (repairs, payments, logins) is NEVER cached: always live data.
 */
const VERSION = 'airride-v2';
const SHELL = ['/', '/manifest.webmanifest', '/icon-192.png', '/logo-mark.png', '/favicon.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  // Page loads: always try the network so customers see the latest site.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put('/', copy));
          return res;
        })
        .catch(() => caches.match('/')),
    );
    return;
  }

  // Hashed build files, images and icons: cache first, refresh in the background.
  if (/^\/(assets|images)\//.test(url.pathname) || /\.(png|webp|jpg|svg|woff2?)$/.test(url.pathname)) {
    event.respondWith(
      caches.match(req).then((hit) => {
        const fresh = fetch(req)
          .then((res) => {
            if (res.ok) caches.open(VERSION).then((c) => c.put(req, res.clone()));
            return res;
          })
          .catch(() => hit);
        return hit || fresh;
      }),
    );
  }
});

// ---- Live repair alerts (Web Push) ----
self.addEventListener('push', (event) => {
  let msg = { title: 'Airride update', body: 'There is an update on your repair.', url: '/', tag: 'airride' };
  try {
    msg = { ...msg, ...event.data.json() };
  } catch {
    /* plain text or empty push */
  }
  event.waitUntil(
    Promise.all([
      self.registration.showNotification(msg.title, {
        body: msg.body,
        icon: '/icon-192.png',
        badge: '/badge-96.png',
        tag: msg.tag,
        renotify: true,
        vibrate: [120, 60, 120],
        data: { url: msg.url },
      }),
      // Tell any open tracking page to refresh straight away.
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => wins.forEach((w) => w.postMessage({ type: 'repair-update', tag: msg.tag }))),
    ]),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || '/', self.location.origin);
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      const same = wins.find((w) => new URL(w.url).pathname === url.pathname);
      if (same) return same.focus();
      return self.clients.openWindow(url.pathname + url.search);
    }),
  );
});
