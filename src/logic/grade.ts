import { state } from '../store.ts';
import { MAX_BOX, plannedConcepts } from './leitner.ts';

/** Übersetzt den Leitner-Lernstand in eine geschätzte Schulnote und
 *  vergleicht sie mit der Zielnote. Reine Lesefunktionen — keine Seiteneffekte.
 *  Gerechnet wird über den Lernplan (die gewählten Themenblöcke), nicht über
 *  alle Kapitel — abgewählte Themen kommen in der Prüfung ja nicht dran. */

/** Notenschlüssel Realschule Bayern: Mindest-Prozentsatz für Note 1…5 (darunter 6) */
const GRADE_THRESHOLDS = [0.92, 0.81, 0.67, 0.5, 0.3];

/** Erwartete Trefferquote in einer echten Prüfung je Leitner-Box.
 *  Bewusst nicht linear: Box 4 ist wegen Prüfungsstress und Transferfragen
 *  keine 100 %, und aus Box 0 ist nach einem Fehler noch etwas hängengeblieben.
 *  Der Höchstwert muss über der Schwelle für Note 1 liegen — sonst wäre eine 1
 *  rechnerisch unerreichbar, egal wie viel gelernt wird. */
const BOX_SCORE = [0.15, 0.4, 0.62, 0.82, 0.96];

/** Nie gesehene Inhalte zählen null — was man nie gelesen hat, kann man nicht. */
const UNSEEN_SCORE = 0;

/** Unter so vielen gesehenen Inhalten ist jede Schätzung Kaffeesatz. */
const MIN_SEEN = 10;

/** Bis zu diesem Anteil gesehener Inhalte gilt man als „am Anfang". */
const EARLY_COVERAGE = 0.25;

/** Als Ziel wählbare Noten — eine 5 oder 6 will niemand anstreben. */
export const SELECTABLE_GRADES = [1, 2, 3, 4];

const GRADE_LABELS = ['sehr gut', 'gut', 'befriedigend', 'ausreichend', 'mangelhaft', 'ungenügend'];

export function gradeLabel(grade: number): string {
  return GRADE_LABELS[grade - 1] ?? '';
}

/** Note zu einem Prozentwert (0..1) */
export function gradeForPercent(percent: number): number {
  const index = GRADE_THRESHOLDS.findIndex((min) => percent >= min);
  return index === -1 ? 6 : index + 1;
}

/** Mindest-Prozentsatz für eine Note */
export function percentForGrade(grade: number): number {
  return GRADE_THRESHOLDS[grade - 1] ?? 0;
}

function scoreOf(conceptId: string): number {
  const p = state.progress[conceptId];
  if (!p || p.lastSeen === null) return UNSEEN_SCORE;
  return BOX_SCORE[Math.min(MAX_BOX, Math.max(0, p.box))];
}

/** Geschätzte Prüfungsleistung (0..1) über den ganzen Lernplan — noch nicht
 *  gelernte Inhalte drücken die Schätzung bewusst. */
export function estimatedPercent(): number {
  const concepts = plannedConcepts();
  if (concepts.length === 0) return 0;
  const sum = concepts.reduce((s, e) => s + scoreOf(e.concept.id), 0);
  return sum / concepts.length;
}

/** Anzahl der Inhalte im Lernplan, die schon mindestens einmal drankamen */
export function seenConcepts(): number {
  return plannedConcepts().filter((e) => state.progress[e.concept.id]?.lastSeen != null).length;
}

/** Geschätzte Note — null, solange zu wenig beantwortet wurde. */
export function estimatedGrade(): number | null {
  if (seenConcepts() < MIN_SEEN) return null;
  return gradeForPercent(estimatedPercent());
}

/** Wie viele Inhalte müssen noch gemeistert werden, damit die Note steht?
 *  Gemeistert springt jeder Inhalt auf denselben Wert — den größten Sprung machen also
 *  die schwächsten. Aufsteigend sortiert ergibt das die kleinstmögliche Anzahl, und es
 *  ist zugleich die Reihenfolge, in der pickRound() den Stoff tatsächlich abfragt
 *  (niedrigste Box zuerst). */
export function conceptsNeededFor(grade: number): number {
  const concepts = plannedConcepts();
  if (concepts.length === 0) return 0;
  const scores = concepts.map((e) => scoreOf(e.concept.id));
  const target = percentForGrade(grade) * concepts.length;
  let sum = scores.reduce((s, v) => s + v, 0);
  if (sum >= target) return 0;

  const open = scores.filter((score) => score < BOX_SCORE[MAX_BOX]).sort((a, b) => a - b);

  let needed = 0;
  for (const score of open) {
    if (sum >= target) break;
    sum += BOX_SCORE[MAX_BOX] - score;
    needed++;
  }
  return needed;
}

export type GradeVerdict =
  /** Es wurde noch keine Zielnote festgelegt */
  | { kind: 'no-target' }
  /** Zu wenig beantwortet für eine seriöse Schätzung */
  | { kind: 'no-data'; target: number }
  /** Aktueller Stand schlechter als das Ziel; early = erst ein kleiner Teil gesehen */
  | { kind: 'behind'; target: number; current: number; needed: number; early: boolean }
  | { kind: 'on-target'; target: number; current: number }
  | { kind: 'ahead'; target: number; current: number };

/** Fertiger Anzeige-Zustand für die Views — dort bleibt keine Rechenlogik. */
export function gradeVerdict(): GradeVerdict {
  const target = state.profile?.targetGrade ?? null;
  if (target === null) return { kind: 'no-target' };

  const current = estimatedGrade();
  if (current === null) return { kind: 'no-data', target };

  // Kleinere Zahl = bessere Note.
  if (current < target) return { kind: 'ahead', target, current };
  if (current === target) return { kind: 'on-target', target, current };

  const planSize = plannedConcepts().length;
  return {
    kind: 'behind',
    target,
    current,
    needed: conceptsNeededFor(target),
    early: planSize === 0 || seenConcepts() / planSize < EARLY_COVERAGE,
  };
}
