import { state } from '../store.ts';
import { MAX_BOX, ROUND_SIZE, plannedConcepts } from './leitner.ts';

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

/** Schlechteste Note, die in der Lern-Ansicht überhaupt ausgesprochen wird.
 *  Eine 6 ist keine Nachricht, sondern Frust: Weil ungelernte Inhalte mit 0 zählen,
 *  ist die Schätzung am Anfang rechnerisch zwingend eine 6 — sie sagt also nichts über
 *  den Lernenden, nur über den noch offenen Stoff. Statt der 6 zeigen die Views den
 *  nächsten erreichbaren Meilenstein. Der Eltern-Bereich bleibt bewusst sachlich. */
export const WORST_NAMED_GRADE = 5;

/** Trefferquote, mit der die Restdistanz gerechnet wird, wenn noch nichts vorliegt. */
const DEFAULT_ACCURACY = 0.8;

/** Untergrenze der angenommenen Trefferquote — darunter würde die Restdistanz
 *  ins Unendliche laufen, weil eine Runde im Schnitt nichts mehr voranbringt. */
const MIN_ASSUMED_ACCURACY = 0.5;

/** Reißleine der Runden-Simulation. */
const MAX_SIM_ROUNDS = 200;

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

/** Box-Stände des Lernplans als einfaches Array — Simulationsgrundlage. */
const UNSEEN_BOX = -1;

function boxScore(box: number): number {
  return box === UNSEEN_BOX ? UNSEEN_SCORE : BOX_SCORE[box];
}

function boxSnapshot(): number[] {
  return plannedConcepts().map((e) => {
    const p = state.progress[e.concept.id];
    if (!p || p.lastSeen === null) return UNSEEN_BOX;
    return Math.min(MAX_BOX, Math.max(0, p.box));
  });
}

/** Bisher gemessene Trefferquote im Lernplan; ohne Daten eine wohlwollende Annahme. */
export function observedAccuracy(): number {
  let correct = 0;
  let total = 0;
  for (const e of plannedConcepts()) {
    const p = state.progress[e.concept.id];
    if (!p) continue;
    correct += p.correct;
    total += p.correct + p.wrong;
  }
  if (total === 0) return DEFAULT_ACCURACY;
  return Math.min(1, Math.max(MIN_ASSUMED_ACCURACY, correct / total));
}

/** Wie viele Runden fehlen noch, bis die Note steht?
 *
 *  Nicht aus conceptsNeededFor() ableitbar: Dort geht es um Inhalte, die bis Box 4
 *  gemeistert sein müssen, eine Runde hebt aber zehn Inhalte nur um je eine Box.
 *  Deshalb wird Runde für Runde simuliert — in derselben Reihenfolge, in der
 *  pickRound() den Stoff wirklich abfragt (schwächste zuerst), mit der Box-Mechanik
 *  von applyAnswer().
 *
 *  `accuracy` = 1 ist der Bestfall. Die falschen Antworten treffen absichtlich das
 *  obere Ende der Auswahl: Lägen sie auf den schwächsten Inhalten, blieben genau die
 *  für immer schwächste und blockierten in jeder Runde dieselben Plätze.
 *
 *  Gerechnet wird über den ganzen Lernplan, also inklusive vorgemerkter Themen.
 *  Die ruhen zwar in normalen Runden, kommen aber in der Merkliste-Runde dran —
 *  für eine Untergrenze zählen sie deshalb mit.
 *
 *  null = in absehbarer Zeit nicht erreichbar; die Views lassen den Satz dann weg. */
export function roundsNeededFor(grade: number, accuracy = 1): number | null {
  const boxes = boxSnapshot();
  if (boxes.length === 0) return null;

  const target = percentForGrade(grade) * boxes.length;
  const clamped = Math.min(1, Math.max(MIN_ASSUMED_ACCURACY, accuracy));
  const rightPerRound = Math.round(clamped * ROUND_SIZE);
  let sum = boxes.reduce((s, box) => s + boxScore(box), 0);

  for (let round = 0; round <= MAX_SIM_ROUNDS; round++) {
    if (sum >= target) return round;

    const picked = boxes
      .map((_, i) => i)
      .sort((a, b) => boxScore(boxes[a]) - boxScore(boxes[b]))
      .slice(0, ROUND_SIZE);

    picked.forEach((i, rank) => {
      // Eine falsche Antwort auf einen ungesehenen Inhalt lässt ihn in Box 0 zurück —
      // gesehen ist er trotzdem, der Score steigt also von 0 auf BOX_SCORE[0].
      const box = boxes[i] === UNSEEN_BOX ? 0 : boxes[i];
      const next = rank < rightPerRound ? Math.min(MAX_BOX, box + 1) : Math.max(0, box - 1);
      sum += boxScore(next) - boxScore(boxes[i]);
      boxes[i] = next;
    });
  }
  return null;
}

/** Restdistanz als Spanne: min = alles richtig, max = mit der gemessenen Trefferquote. */
export interface RoundEstimate {
  min: number;
  max: number;
}

/** Nächster erreichbarer Meilenstein: die nächstbessere Note und was sie noch kostet. */
export interface Milestone {
  grade: number;
  rounds: RoundEstimate | null;
}

/** „1 Fragerunde" · „ca. 3 Fragerunden" · „ca. 2–3 Fragerunden" — Singular, Plural
 *  und Spanne an einer Stelle, damit die Views nur einsetzen müssen. */
export function roundsLabel(est: RoundEstimate): string {
  if (est.max === 0) return 'fast geschafft';
  if (est.min === est.max) return est.min === 1 ? '1 Fragerunde' : `ca. ${est.min} Fragerunden`;
  return `ca. ${est.min}–${est.max} Fragerunden`;
}

export function roundEstimate(grade: number): RoundEstimate | null {
  const min = roundsNeededFor(grade);
  if (min === null) return null;
  const max = roundsNeededFor(grade, observedAccuracy());
  return { min, max: Math.max(min, max ?? min) };
}

/** Nächstbessere Note über dem aktuellen Stand — null, wenn es keine mehr gibt. */
export function nextBetterGrade(current: number | null): number | null {
  if (current === null || current > WORST_NAMED_GRADE) return WORST_NAMED_GRADE;
  return current > 1 ? current - 1 : null;
}

function milestoneFor(current: number | null): Milestone | null {
  const grade = nextBetterGrade(current);
  if (grade === null) return null;
  return { grade, rounds: roundEstimate(grade) };
}

export type GradeVerdict =
  /** Es wurde noch keine Zielnote festgelegt */
  | { kind: 'no-target' }
  /** Zu wenig beantwortet für eine seriöse Schätzung */
  | { kind: 'no-data'; target: number; next: Milestone }
  /** Stand rechnerisch noch bei einer 6. Die Lern-Ansicht nennt die Note nicht und
   *  zeigt nur den Weg dorthin; der Eltern-Bereich führt `current` sachlich mit. */
  | { kind: 'warmup'; target: number; current: number; next: Milestone }
  /** Aktueller Stand schlechter als das Ziel; early = erst ein kleiner Teil gesehen */
  | {
      kind: 'behind';
      target: number;
      current: number;
      needed: number;
      early: boolean;
      next: Milestone | null;
      targetRounds: RoundEstimate | null;
    }
  | { kind: 'on-target'; target: number; current: number }
  | { kind: 'ahead'; target: number; current: number };

/** Fertiger Anzeige-Zustand für die Views — dort bleibt keine Rechenlogik. */
export function gradeVerdict(): GradeVerdict {
  const target = state.profile?.targetGrade ?? null;
  if (target === null) return { kind: 'no-target' };

  // Solange die Schätzung im Wesentlichen den noch offenen Stoff spiegelt, wird gar
  // keine Note genannt — sondern der nächste Meilenstein, dessen Zahl nach jeder
  // Runde sichtbar sinkt. Beide Fälle sind absichtlich strukturgleich, damit die
  // Lern-Ansicht sie in einem Zweig behandeln kann; der Eltern-Bereich unterscheidet.
  const warmupNext = (): Milestone => ({
    grade: WORST_NAMED_GRADE,
    rounds: roundEstimate(WORST_NAMED_GRADE),
  });

  const current = estimatedGrade();
  if (current === null) return { kind: 'no-data', target, next: warmupNext() };
  if (current > WORST_NAMED_GRADE) return { kind: 'warmup', target, current, next: warmupNext() };

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
    next: milestoneFor(current),
    targetRounds: roundEstimate(target),
  };
}
