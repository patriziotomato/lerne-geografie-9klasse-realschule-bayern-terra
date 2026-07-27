import { CHAPTERS } from '../data/chapters.ts';
import { state, todayKey } from '../store.ts';
import {
  chapterMastery,
  isChapterActive,
  learnedCount,
  plannedConceptCount,
  plannedConceptsOf,
  totalLearned,
} from './leitner.ts';
import { pace } from './pace.ts';
import { gradeVerdict, gradeLabel, roundsLabel } from './grade.ts';

/** Der Lernbericht als abgeschlossene Momentaufnahme.
 *
 *  Warum ein eigener Datentyp statt „die Views lesen den Zustand"? Weil der
 *  Bericht das Gerät verlässt: als PDF und als Eltern-Link. Auf dem Elterngerät
 *  gibt es keinen `state`, keine Fortschritts-Historie und keine Notenlogik —
 *  dort liegt nur noch dieses Objekt. Alles, was der Bericht zeigt, muss also
 *  darin stehen.
 *
 *  Daraus folgt die zweite Regel: Der Bericht rechnet nichts nach. Ein Wert wie
 *  „noch 12 Tage" gilt für den Zeitpunkt `createdAt` — würde ihn das Elterngerät
 *  beim Öffnen neu berechnen, stünden im selben Bericht frische neben alten
 *  Zahlen. Deshalb ist `createdAt` die wichtigste Zeile des Berichts, und jede
 *  Ansicht muss sie zeigen.
 */

/** Formatversion. Ein Eltern-Link kann Tage später mit einer neueren App-Version
 *  geöffnet werden — die muss erkennen, ob sie das Format überhaupt versteht. */
export const REPORT_VERSION = 1;

/** So viele Lerneinheiten führt der Bericht einzeln auf. */
const MAX_SESSIONS = 20;

/** Ab diesem Alter (in Tagen) weist die Eltern-Ansicht darauf hin, dass der
 *  Bericht überholt sein könnte. */
export const STALE_AFTER_DAYS = 2;

export interface ReportPace {
  hasDeadline: boolean;
  done: boolean;
  onTrack: boolean;
  overdue: boolean;
  daysLeft: number;
  dailyTarget: number;
  todayPoints: number;
}

export interface ReportGrade {
  /** Zielnote; null = keine gesetzt, dann entfällt die Karte ganz */
  target: number | null;
  /** Geschätzte Note zum Stichtag; null = zu wenig Daten */
  current: number | null;
  /** Wie viele Inhalte des Lernplans schon mindestens einmal abgefragt wurden.
   *  Steht bewusst neben der Note: Die Abdeckung fließt zu einem Fünftel in die
   *  Schätzung ein, ist also kein Nebensatz, sondern erklärt einen Teil davon. */
  coverage: { seen: number; total: number };
  /** Fertig formulierte Zusätze („Bis zur Note 3 sind es ca. 4 Fragerunden").
   *  Bewusst Text statt Zahlen: Die Sätze entstehen aus einer Simulation, die
   *  den ganzen Lernstand braucht — auf dem Elterngerät liegt der nicht vor. */
  notes: string[];
}

export interface ReportChapter {
  id: string;
  learned: number;
  planned: number;
  /** 0..1 */
  mastery: number;
  /** false = Kapitel ist nicht im Lernplan */
  active: boolean;
}

export interface ReportDay {
  /** yyyy-mm-dd — der Wochentag wird beim Anzeigen daraus abgeleitet */
  date: string;
  minutes: number;
}

export interface ReportSession {
  start: string;
  minutes: number;
  answered: number;
  correct: number;
}

export interface ReportData {
  v: number;
  name: string;
  /** ISO-Zeitstempel der Erstellung */
  createdAt: string;
  /** Tag der Erstellung als yyyy-mm-dd — markiert „heute" im Wochenbalken */
  today: string;
  deadline: string | null;
  pace: ReportPace;
  grade: ReportGrade;
  minutes: number;
  sessionCount: number;
  answered: number;
  correct: number;
  learned: number;
  planned: number;
  streak: number;
  bestStreak: number;
  chapters: ReportChapter[];
  week: ReportDay[];
  sessions: ReportSession[];
}

/** Momentaufnahme aus dem aktuellen Zustand ziehen. */
export function buildReport(): ReportData {
  const p = state.profile!;
  const s = state.stats;
  const pc = pace();

  return {
    v: REPORT_VERSION,
    name: p.firstName,
    createdAt: new Date().toISOString(),
    today: todayKey(),
    deadline: p.deadline,
    pace: {
      hasDeadline: pc.hasDeadline,
      done: pc.done,
      onTrack: pc.onTrack,
      overdue: pc.overdue,
      daysLeft: pc.daysLeft,
      dailyTarget: pc.dailyTarget,
      todayPoints: pc.todayPoints,
    },
    grade: buildGrade(),
    minutes: s.sessions.reduce((n, x) => n + x.minutes, 0),
    sessionCount: s.sessions.length,
    answered: s.sessions.reduce((n, x) => n + x.answered, 0),
    correct: s.sessions.reduce((n, x) => n + x.correct, 0),
    learned: totalLearned(),
    planned: plannedConceptCount(),
    streak: s.streak,
    bestStreak: s.bestStreak,
    chapters: CHAPTERS.map((ch) => ({
      id: ch.id,
      learned: learnedCount(ch.id),
      planned: plannedConceptsOf(ch.id).length,
      mastery: Math.round(chapterMastery(ch.id) * 1000) / 1000,
      active: isChapterActive(ch.id),
    })),
    week: lastDays(7),
    sessions: [...s.sessions]
      .reverse()
      .slice(0, MAX_SESSIONS)
      .map((x) => ({ start: x.start, minutes: x.minutes, answered: x.answered, correct: x.correct })),
  };
}

/** Die Noten-Einschätzung in Zahlen plus fertige Sätze übersetzen. Der
 *  Eltern-Bereich nennt die Note ungeschönt — auch eine 6. */
function buildGrade(): ReportGrade {
  const v = gradeVerdict();
  const cov = { seen: v.coverage.seen, total: v.coverage.total };
  if (v.kind === 'no-target') return { target: null, current: null, coverage: cov, notes: [] };
  if (v.kind === 'no-data') {
    return {
      target: v.target,
      current: null,
      coverage: cov,
      notes: [
        `Für eine Einschätzung sind noch zu wenige Inhalte abgefragt worden. Zielnote: ${v.target} (${gradeLabel(v.target)}).`,
      ],
    };
  }

  // Restdistanz in Fragerunden statt in Inhalten: „noch X Inhalte" sagt nichts
  // darüber, wie viel Lernzeit das bedeutet — eine Runde hebt zehn Inhalte um je
  // eine Box, nicht auf gemeistert.
  const distances: string[] = [];
  if (v.kind === 'warmup' && v.next.rounds) {
    distances.push(`Bis zur Note ${v.next.grade} sind es ${roundsLabel(v.next.rounds)}`);
  }
  if (v.kind === 'behind') {
    if (v.next && v.next.rounds && v.next.grade !== v.target) {
      distances.push(`Bis zur Note ${v.next.grade} sind es ${roundsLabel(v.next.rounds)}`);
    }
    if (v.targetRounds) {
      distances.push(`bis zur Zielnote ${v.target} ${roundsLabel(v.targetRounds)}`);
    } else if (v.needed > 0) {
      distances.push(`bis zur Zielnote ${v.target} fehlen mindestens ${v.needed} Inhalte`);
    }
  }

  const notes = [
    `Zielnote: ${v.target} (${gradeLabel(v.target)}). Die Schätzung beschreibt den Lernstand zum Zeitpunkt des Berichts, nicht das Ergebnis am Prüfungstag.`,
  ];
  if (distances.length > 0) notes.push(`${distances.join(' · ')}.`);
  return { target: v.target, current: v.current, coverage: cov, notes };
}

/** „Themen mindestens einmal abgefragt: 74 von 106" — einmal formuliert für
 *  Eltern-Bereich, Eltern-Link und PDF. */
export function coverageLabel(g: ReportGrade): string {
  return `Themen mindestens einmal abgefragt: ${g.coverage.seen} von ${g.coverage.total}`;
}

function lastDays(n: number): ReportDay[] {
  const out: ReportDay[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const key = todayKey(new Date(Date.now() - i * 86400000));
    out.push({ date: key, minutes: state.stats.history.find((h) => h.date === key)?.minutes ?? 0 });
  }
  return out;
}

/** Richtig-Quote in Prozent (ganzzahlig), 0 wenn nichts beantwortet wurde. */
export function quotePercent(correct: number, answered: number): number {
  return answered > 0 ? Math.round((correct / answered) * 100) : 0;
}

/** yyyy-mm-dd als lokales Datum lesen. `new Date('2026-07-27')` wäre UTC-Mitternacht
 *  und damit westlich von Greenwich der Vortag — hier stehen Tagesschlüssel und
 *  Wochentagsnamen nebeneinander, das darf nicht verrutschen. */
function parseDay(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

/** Der Stichtag des Berichts: „Mo., 27.07.2026, 14:32 Uhr".
 *  Die wichtigste Zeile jeder Ansicht — sie ist das Einzige, was Eltern
 *  eigenständig einordnen können. */
export function fmtStamp(iso: string): string {
  const d = new Date(iso);
  const day = d.toLocaleDateString('de-DE', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  return `${day}, ${d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr`;
}

/** Reines Datum, z. B. für das Lernziel: „15.10.2026".
 *  Zweistellig erzwungen — die Standardformatierung liefert „5.9.2026" und
 *  stünde damit neben dem zweistelligen Stichtag im selben Bericht. */
export function fmtDay(key: string): string {
  return parseDay(key).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/** Zweibuchstabiger Wochentag für die Wochenbalken */
export function weekdayLabel(key: string): string {
  return parseDay(key).toLocaleDateString('de-DE', { weekday: 'short' }).slice(0, 2);
}

/** Statuszeile des Lernplans — gleiche Worte wie auf der Startseite. */
export function statusLabel(p: ReportPace): { emoji: string; text: string } {
  if (p.done) return { emoji: '🎓', text: 'Lernziel erreicht' };
  if (!p.hasDeadline) return { emoji: '🗓️', text: 'Kein Ziel-Datum gesetzt' };
  return p.onTrack ? { emoji: '🎯', text: 'Auf Kurs' } : { emoji: '⚠️', text: 'Hinter dem Plan' };
}

/** Alter des Berichts in Tagen. Negativ = das Erstellungsdatum liegt in der
 *  Zukunft; das kann nur an einer verstellten Uhr liegen und ist erwähnenswert. */
export function reportAgeDays(data: ReportData, now = Date.now()): number {
  return Math.floor((now - new Date(data.createdAt).getTime()) / 86400000);
}

/** Dateiname für den PDF-Export: „Lernbericht-Anna-2026-07-27.pdf".
 *  Datiert über `today` (Ortszeit), nicht über den UTC-Zeitstempel — sonst
 *  trüge ein Bericht von 00:30 Uhr im Dateinamen den Vortag. */
export function reportFileName(data: ReportData): string {
  return `Lernbericht-${asciiName(data.name) || 'Geo-Quest'}-${data.today}.pdf`;
}

/** Nur ASCII im Dateinamen.
 *
 *  Nicht kosmetisch: Enthält das `download`-Attribut ein Nicht-ASCII-Zeichen,
 *  verwirft Chrome den Namen **komplett** und legt die Datei als „download" ab.
 *  Bei deutschen Vornamen (Müller, Groß, Sofía) wäre das der Normalfall — und
 *  ein Lernbericht, der im Download-Ordner „download" heißt, ist genau das
 *  Gegenteil von nachvollziehbar.
 *
 *  Die Umlaute werden vor der Zerlegung ersetzt, sonst würde aus „ü" ein „u"
 *  statt „ue". */
function asciiName(name: string): string {
  return name
    .replaceAll('ä', 'ae')
    .replaceAll('ö', 'oe')
    .replaceAll('ü', 'ue')
    .replaceAll('Ä', 'Ae')
    .replaceAll('Ö', 'Oe')
    .replaceAll('Ü', 'Ue')
    .replaceAll('ß', 'ss')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // zerlegte Akzente: í wird zu i
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
