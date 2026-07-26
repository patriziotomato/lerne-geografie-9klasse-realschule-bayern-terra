import { state, save, todayLog } from '../store.ts';

/** Lernsitzungen für den Eltern-Bereich.
 *  Eine Sitzung = Quiz-Aktivität; Pausen > 30 min starten eine neue Sitzung.
 *  Die Dauer zählt nur aktive Zeit (Lücken zwischen Antworten, max. 3 min pro Lücke),
 *  damit "App offen liegen lassen" nicht als Lernzeit gilt. */

const SESSION_GAP_MS = 30 * 60 * 1000;
const MAX_COUNTED_GAP_MS = 3 * 60 * 1000;
const MAX_SESSIONS = 200;

let lastActivityAt: number | null = null;
let activeMsCurrent = 0;

/** Bei jeder beantworteten Frage aufrufen. */
export function recordAnswer(correct: boolean, xp: number): void {
  const now = Date.now();
  const sessions = state.stats.sessions;
  let current = sessions[sessions.length - 1];

  const isNewSession =
    !current || lastActivityAt === null || now - lastActivityAt > SESSION_GAP_MS;

  if (isNewSession) {
    current = { start: new Date(now).toISOString(), minutes: 0, answered: 0, correct: 0, xp: 0 };
    sessions.push(current);
    if (sessions.length > MAX_SESSIONS) state.stats.sessions = sessions.slice(-MAX_SESSIONS);
    activeMsCurrent = 30 * 1000; // Startaufwand: Lesen der ersten Frage
  } else {
    activeMsCurrent += Math.min(now - (lastActivityAt as number), MAX_COUNTED_GAP_MS);
  }

  lastActivityAt = now;
  current = state.stats.sessions[state.stats.sessions.length - 1];
  current.answered++;
  if (correct) current.correct++;
  current.xp += xp;
  current.minutes = Math.max(1, Math.round(activeMsCurrent / 60000));

  todayLog().minutes = totalMinutesToday();
  save();
}

function totalMinutesToday(): number {
  const today = new Date().toDateString();
  return state.stats.sessions
    .filter((s) => new Date(s.start).toDateString() === today)
    .reduce((sum, s) => sum + s.minutes, 0);
}
