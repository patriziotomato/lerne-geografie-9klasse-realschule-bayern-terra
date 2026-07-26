/* Geo-Quest Service Worker: App-Shell cachen, damit die PWA offline läuft.
 * Strategie: Navigation → Netz zuerst (Fallback Cache), Assets → Cache zuerst
 * mit Hintergrund-Aktualisierung (stale-while-revalidate). */

const VERSION = 'geoquest-v2';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION).then((cache) => cache.addAll(['./', './manifest.webmanifest'])),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

/* Tap auf eine Benachrichtigung: bestehendes Fenster nach vorn holen, sonst öffnen.
 * Die Ziel-URL kommt relativ aus notify.ts und wird gegen den Scope der Registrierung
 * aufgelöst — damit stimmt der Repo-Unterpfad auf GitHub Pages von allein. */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url ?? './#/home', self.registration.scope);

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (!client.url.startsWith(self.registration.scope)) continue;
        // Hash nachziehen, damit der Tap auch bei schon offener App am Ziel landet.
        if ('navigate' in client) client.navigate(target.href).catch(() => {});
        return client.focus();
      }
      return self.clients.openWindow(target.href);
    }),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || !req.url.startsWith(self.location.origin)) return;

  // Seiten-Navigationen: Netz zuerst, sonst gecachte Shell
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put('./', copy));
          return res;
        })
        .catch(() => caches.match('./')),
    );
    return;
  }

  // Assets: Cache zuerst, im Hintergrund aktualisieren
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(VERSION).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    }),
  );
});
