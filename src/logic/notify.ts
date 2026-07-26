import { state } from '../store.ts';

/** Eine System-Benachrichtigung anzeigen.
 *
 *  Bewusst über den Service Worker: `new Notification(...)` wirft auf Android/Chrome
 *  („Illegal constructor"), dort ist `ServiceWorkerRegistration.showNotification()`
 *  der einzige zulässige Weg. Der Konstruktor bleibt als Fallback für Browser ohne
 *  Service Worker (u. a. der Dev-Betrieb ohne registrierten SW).
 *
 *  Ohne Server kann nichts gesendet werden, solange die App geschlossen ist — echtes
 *  Web-Push bräuchte ein Backend mit VAPID-Schlüsseln. Für den Notensprung genügt das:
 *  Der passiert genau in dem Moment, in dem die App offen ist. */
export function notificationsSupported(): boolean {
  return 'Notification' in window;
}

export async function requestPermission(): Promise<boolean> {
  if (!notificationsSupported()) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const result = await Notification.requestPermission();
  return result === 'granted';
}

/** Ziel innerhalb der App, das ein Tap auf die Benachrichtigung öffnet. */
export interface NotifyOptions {
  /** Hash-Route, z. B. '#/home'. Wird im Service Worker gegen dessen Scope aufgelöst. */
  route?: string;
}

export async function notify(
  title: string,
  body: string,
  tag: string,
  options: NotifyOptions = {},
): Promise<void> {
  if (!state.settings.remindersEnabled) return;
  if (!notificationsSupported() || Notification.permission !== 'granted') return;

  const base = import.meta.env.BASE_URL;
  const payload: NotificationOptions & { data: { url: string } } = {
    body,
    tag,
    icon: `${base}icons/icon-192.png`,
    badge: `${base}icons/icon-192.png`,
    // Relativ, damit der Service Worker den Repo-Unterpfad auf GitHub Pages
    // selbst ergänzt (vgl. vite.config.ts).
    data: { url: `.${options.route ?? '#/home'}` },
  };

  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification(title, payload);
      return;
    }
  } catch {
    // Kein aktiver Service Worker — unten den Konstruktor versuchen.
  }

  try {
    new Notification(title, payload);
  } catch {
    // Plattform erlaubt den Konstruktor nicht — dann still bleiben.
  }
}
