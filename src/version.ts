/** Build-Stempel der laufenden App — sichtbar in den Einstellungen und als
 *  <meta app-*> im HTML, damit sich der ausgelieferte Stand von außen prüfen und
 *  in Fehlermeldungen benennen lässt.
 *
 *  Die Werte setzt vite.config.ts zur Build-Zeit ein, landen also im gehashten
 *  JS-Bundle. Eine version.json unter public/ wäre der naheliegendere Weg,
 *  scheidet aber aus: Alles Ungehashte liefert der Service Worker cache-first
 *  aus (sw.js) — die App würde damit den vorigen Deploy als aktuell melden.
 *
 *  Nicht zu verwechseln mit state.version / SCHEMA_VERSION in store.ts: Das ist
 *  die Version des Speicherformats und läuft bewusst getrennt. */

export const APP_VERSION: string = import.meta.env.VITE_APP_VERSION ?? '0.0.0';

/** Kurzer Commit-Hash (7 Zeichen); 'dev' im Dev-Server ohne git. */
export const APP_COMMIT: string = import.meta.env.VITE_APP_COMMIT ?? 'dev';

/** ISO-Zeitstempel des Builds, leer wenn nicht gesetzt. */
export const APP_BUILD_TIME: string = import.meta.env.VITE_APP_BUILD_TIME ?? '';

/** „Version 1.0.0 · 6e87aaf · 27.07.2026, 11:01“
 *
 *  Eigener Formatter statt fmtDate() aus ui.ts: Das lässt das Jahr weg, was bei
 *  einem Datum in der Zukunft praktisch ist, bei einem Build-Stempel aber die
 *  wichtigste Information verschluckt. */
export function versionLine(): string {
  const parts = [`Version ${APP_VERSION}`, APP_COMMIT];
  if (APP_BUILD_TIME) {
    const built = new Date(APP_BUILD_TIME);
    if (!Number.isNaN(built.getTime())) {
      parts.push(
        built.toLocaleString('de-DE', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }),
      );
    }
  }
  return parts.join(' · ');
}
