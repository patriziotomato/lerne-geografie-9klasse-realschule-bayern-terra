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

/** Tag des GitHub-Releases, zu dem dieser Build gehört („v1.0.0“) — leer, solange
 *  es noch keines gibt oder ohne Tags gebaut wurde. */
export const APP_RELEASE: string = import.meta.env.VITE_APP_RELEASE ?? '';

/** Commits zwischen dem Release und diesem Build. 0 = genau der Release-Stand,
 *  alles darüber ist ein Vorschau-Build von main. */
export const APP_RELEASE_AHEAD: number = Number(import.meta.env.VITE_APP_RELEASE_AHEAD ?? 0);

/** Link auf die Release-Seite mit den Notizen; leer ohne Release. */
export const APP_RELEASE_URL: string = import.meta.env.VITE_APP_RELEASE_URL ?? '';

/** Anzeigename des Releases ohne führendes „v“ — „1.0.0“. Fällt auf die Nummer
 *  aus package.json zurück, wenn noch kein Release existiert.
 *
 *  Bewusst das Release und nicht package.json bevorzugt: Nach einem Versions-Bump
 *  steht dort schon die nächste Nummer, veröffentlicht ist aber noch die alte.
 *  Was hier steht, soll sich auf GitHub wiederfinden lassen. */
export function releaseName(): string {
  return APP_RELEASE.replace(/^v/, '') || APP_VERSION;
}

/** „1.0.0“ bzw. „1.0.0 +3“ für einen Build nach dem Release. */
export function releaseLabel(): string {
  return APP_RELEASE_AHEAD > 0 ? `${releaseName()} +${APP_RELEASE_AHEAD}` : releaseName();
}

/** „Version 1.0.0 · 6e87aaf · 27.07.2026, 11:01“
 *
 *  Eigener Formatter statt fmtDate() aus ui.ts: Das lässt das Jahr weg, was bei
 *  einem Datum in der Zukunft praktisch ist, bei einem Build-Stempel aber die
 *  wichtigste Information verschluckt. */
export function versionLine(): string {
  const parts = [`Version ${releaseLabel()}`, APP_COMMIT];
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
