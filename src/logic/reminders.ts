import { state, todayKey } from '../store.ts';
import { notify, notificationsSupported } from './notify.ts';

/** Erinnerungen ohne Server: Benachrichtigungen können nur ausgelöst werden,
 *  solange die App/PWA geöffnet ist (Web-Limitierung). Zusätzlich gibt es
 *  Motivations-Nudges beim Öffnen und den Kalender-Export (ics.ts).
 *  Das Anzeigen selbst liegt in notify.ts. */

let timer: number | null = null;

/** Nächste eingestellte Lernzeit ab jetzt (heute oder morgen) */
export function nextStudyTime(now = new Date()): Date | null {
  const times = state.profile?.studyTimes ?? [];
  if (times.length === 0) return null;
  const candidates = times.map((t) => {
    const [h, m] = t.split(':').map(Number);
    const d = new Date(now);
    d.setHours(h, m, 0, 0);
    if (d.getTime() <= now.getTime()) d.setDate(d.getDate() + 1);
    return d;
  });
  candidates.sort((a, b) => a.getTime() - b.getTime());
  return candidates[0];
}

/** Plant die nächste Benachrichtigung, solange die App offen ist. */
export function scheduleWhileOpen(): void {
  if (timer !== null) {
    clearTimeout(timer);
    timer = null;
  }
  if (!state.settings.remindersEnabled) return;
  if (!notificationsSupported() || Notification.permission !== 'granted') return;
  const next = nextStudyTime();
  if (!next) return;
  const delay = next.getTime() - Date.now();
  if (delay > 12 * 60 * 60 * 1000) return; // nur sinnvoll nahe Zeitfenster

  timer = window.setTimeout(() => {
    const name = state.profile?.firstName ?? '';
    void notify(
      'Zeit zum Lernen! 🌍',
      `${name ? name + ', d' : 'D'}eine Geo-Runde wartet. 10 Fragen — los geht's! 🚀`,
      'geoquest-reminder',
      { route: '#/quiz/mix' },
    );
    scheduleWhileOpen(); // nächste Zeit planen
  }, delay);
}

/** Motivierender Hinweis fürs Dashboard (oder null) */
export function nudge(): { emoji: string; text: string } | null {
  const p = state.profile;
  if (!p) return null;
  const now = new Date();
  const mins = now.getHours() * 60 + now.getMinutes();

  // Gerade Lernzeit?
  for (const t of p.studyTimes) {
    const [h, m] = t.split(':').map(Number);
    const diff = mins - (h * 60 + m);
    if (diff >= 0 && diff <= 45 && state.stats.lastStudyDay !== todayKey()) {
      return { emoji: '⏰', text: `Jetzt ist deine Lernzeit (${t} Uhr) — perfekter Moment für eine Runde!` };
    }
  }

  // Streak in Gefahr?
  const yesterday = todayKey(new Date(Date.now() - 86400000));
  if (state.stats.streak > 0 && state.stats.lastStudyDay === yesterday && now.getHours() >= 18) {
    return { emoji: '🔥', text: `Dein ${state.stats.streak}-Tage-Streak läuft heute ab — rette ihn mit einer Runde!` };
  }

  return null;
}
