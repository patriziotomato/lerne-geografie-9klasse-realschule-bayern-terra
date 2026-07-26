import { state, todayKey } from '../store.ts';
import { maxPoints, totalPoints } from './leitner.ts';

export interface PaceInfo {
  /** Ist überhaupt ein Lernziel-Datum gesetzt? */
  hasDeadline: boolean;
  /** Kalendertage bis zur Deadline, heute mitgezählt (min. 0) */
  daysLeft: number;
  /** Noch offene Lernpunkte (Box-Stufen) bis alles gemeistert ist */
  remainingPoints: number;
  /** Nötige Lernpunkte pro Tag, um rechtzeitig fertig zu werden */
  dailyTarget: number;
  /** Heute bereits gesammelte Lernpunkte */
  todayPoints: number;
  onTrack: boolean;
  /** Alles gelernt? */
  done: boolean;
  /** Deadline schon vorbei? */
  overdue: boolean;
}

export function pace(): PaceInfo {
  const deadline = state.profile?.deadline;
  const remaining = maxPoints() - totalPoints();
  const today = todayLogPoints();

  let daysLeft = 1;
  let overdue = false;
  if (deadline) {
    const end = new Date(deadline + 'T23:59:59');
    const ms = end.getTime() - Date.now();
    overdue = ms < 0;
    daysLeft = Math.max(0, Math.ceil(ms / 86400000));
  }

  const effectiveDays = Math.max(1, daysLeft);
  const done = remaining <= 0;
  // Ohne Deadline gibt es kein Pensum — sanftes Standardziel: 1 Runde ≈ 8 Punkte.
  const dailyTarget = done ? 0 : deadline ? Math.max(1, Math.ceil(remaining / effectiveDays)) : 8;

  return {
    hasDeadline: !!deadline,
    daysLeft,
    remainingPoints: remaining,
    dailyTarget,
    todayPoints: today,
    onTrack: done || today >= dailyTarget,
    done,
    overdue,
  };
}

function todayLogPoints(): number {
  const log = state.stats.history.find((h) => h.date === todayKey());
  return Math.max(0, log?.points ?? 0);
}

/** Formatiert die Restzeit menschenlesbar ("noch 12 Tage") */
export function daysLeftLabel(p: PaceInfo): string {
  if (!p.hasDeadline) return 'Kein Ziel-Datum gesetzt';
  if (p.overdue) return 'Deadline vorbei';
  if (p.daysLeft === 0) return 'Heute ist der letzte Tag!';
  if (p.daysLeft === 1) return 'Noch 1 Tag';
  return `Noch ${p.daysLeft} Tage`;
}
