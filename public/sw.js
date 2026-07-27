/* Geo-Quest Service Worker: App-Shell cachen, damit die PWA offline läuft.
 * Strategie: Navigation → Netz zuerst (Fallback Cache), Assets → Cache zuerst
 * mit Hintergrund-Aktualisierung (stale-while-revalidate). */

/* Cache-Name aus dem Commit des Builds: main.ts registriert diesen Worker als
 * sw.js?v=<hash>. Dadurch bumpt jeder Deploy den Cache von allein und der
 * activate-Handler unten räumt den alten weg — sonst könnten die ungehashten
 * Dateien (Manifest, Icons) unbegrenzt veralten, weil sie cache-first
 * ausgeliefert werden. Vorher stand hier eine handgepflegte Nummer, die bei
 * jedem Release mitgezogen werden musste. */
const VERSION = `geoquest-${new URLSearchParams(self.location.search).get('v') || 'dev'}`;

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
        .catch(() => caches.open(VERSION).then((c) => c.match('./'))),
    );
    return;
  }

  /* Assets: Cache zuerst, im Hintergrund aktualisieren.
   *
   * Gelesen wird ausdrücklich nur aus dem Cache dieses Builds, nicht über das
   * globale caches.match() — das durchsucht ALLE Caches des Origin. Beim Deploy
   * kann der Cache des Vorgängers kurz überleben: Der alte Worker kontrolliert
   * die Seite noch, während der neue schon installiert, und seine
   * Hintergrund-Aktualisierungen legen ihn nach dem Aufräumen in activate
   * womöglich wieder an. Global gesucht käme dann eine veraltete Datei zurück,
   * weil der ältere Cache zuerst gefunden wird. Der Rest räumt sich beim
   * nächsten Deploy weg und wird bis dahin nie gelesen. */
  event.respondWith(
    caches.open(VERSION).then((cache) =>
      cache.match(req).then((cached) => {
        const network = fetch(req)
          .then((res) => {
            if (res.ok) cache.put(req, res.clone());
            return res;
          })
          .catch(() => cached);
        return cached || network;
      }),
    ),
  );
});
