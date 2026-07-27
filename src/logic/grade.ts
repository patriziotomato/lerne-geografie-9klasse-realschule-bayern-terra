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

/** Box-Stand eines nie abgefragten Inhalts. Muss von Box 0 unterscheidbar bleiben:
 *  Box 0 heißt „zuletzt falsch beantwortet", nicht „noch nie gesehen". */
const UNSEEN_BOX = -1;

/** Anteil der Schätzung, der an der Themenabdeckung hängt statt am Lernstand.
 *
 *  Der reine Box-Durchschnitt belohnt Tiefe: Der halbe Stoff gemeistert ergibt 0,48,
 *  der ganze Stoff einmal richtig beantwortet nur 0,40 — obwohl das Zweite viermal
 *  weniger Antworten kostet und in einer Prüfung, die quer über alle Themen fragt,
 *  klar besser trägt. Ein nie gesehenes Thema ist außerdem kein „halb gekonnt",
 *  sondern ein sicherer Ausfall.
 *
 *  Deshalb zählt ein Fünftel der Schätzung schlicht, wie viel vom Lernplan überhaupt
 *  schon einmal dran war. Ab 0,14 kippt der Vergleich oben; 0,2 macht ihn als
 *  Notensprung sichtbar (4 statt 5), lässt aber den Lernstand dominieren — alles
 *  einmal gesehen und nichts davon gekonnt bleibt eine 5.
 *
 *  Die Obergrenze muss über der Schwelle für Note 1 liegen, sonst wäre eine 1
 *  unerreichbar: alles gemeistert ergibt 0,8 · 0,96 + 0,2 = 0,968. */
const COVERAGE_WEIGHT = 0.2;

/** Unter so vielen gesehenen Inhalten ist jede Schätzung Kaffeesatz. */
const MIN_SEEN = 10;

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

function boxScore(box: number): number {
  if (box === UNSEEN_BOX) return UNSEEN_SCORE;
  return BOX_SCORE[Math.min(MAX_BOX, Math.max(0, box))];
}

/** Box-Stände des Lernplans als einfaches Array — gemeinsame Grundlage von
 *  Schätzung und Simulation. UNSEEN_BOX für alles, was noch nie dran war. */
function boxSnapshot(): number[] {
  return plannedConcepts().map((e) => {
    const p = state.progress[e.concept.id];
    if (!p || p.lastSeen === null) return UNSEEN_BOX;
    return Math.min(MAX_BOX, Math.max(0, p.box));
  });
}

/** Lernstand (Tiefe) und Themenabdeckung (Breite) zur geschätzten Prüfungsleistung
 *  (0..1) zusammensetzen. Die einzige Stelle, an der die Formel steht:
 *  conceptsNeededFor() und roundsNeededFor() rechnen mit derselben, sonst
 *  widerspräche die genannte Restdistanz der angezeigten Note. */
function blend(scoreSum: number, seen: number, total: number): number {
  if (total === 0) return 0;
  return (1 - COVERAGE_WEIGHT) * (scoreSum / total) + COVERAGE_WEIGHT * (seen / total);
}

function scoreSumOf(boxes: number[]): number {
  return boxes.reduce((s, box) => s + boxScore(box), 0);
}

function seenCountOf(boxes: number[]): number {
  return boxes.reduce((n, box) => n + (box === UNSEEN_BOX ? 0 : 1), 0);
}

/** Geschätzte Prüfungsleistung (0..1) über den ganzen Lernplan — noch nicht
 *  gelernte Inhalte drücken die Schätzung bewusst doppelt: über den Lernstand 0
 *  und über die fehlende Abdeckung. */
export function estimatedPercent(): number {
  const boxes = boxSnapshot();
  return blend(scoreSumOf(boxes), seenCountOf(boxes), boxes.length);
}

/** Anzahl der Inhalte im Lernplan, die schon mindestens einmal drankamen */
export function seenConcepts(): number {
  return plannedConcepts().filter((e) => state.progress[e.concept.id]?.lastSeen != null).length;
}

/** Themenabdeckung des Lernplans. Fließt mit COVERAGE_WEIGHT in die Schätzung ein,
 *  deshalb liegt die Aufbereitung hier und nicht in den Views. */
export interface Coverage {
  /** Inhalte, die schon mindestens einmal abgefragt wurden */
  seen: number;
  /** Inhalte, die noch nie dran waren */
  unseen: number;
  total: number;
  /** seen / total (0..1) */
  ratio: number;
  /** true = jeder Inhalt des Lernplans war mindestens einmal dran */
  complete: boolean;
}

export function coverage(): Coverage {
  const total = plannedConcepts().length;
  const seen = seenConcepts();
  return {
    seen,
    unseen: total - seen,
    total,
    ratio: total === 0 ? 0 : seen / total,
    complete: total > 0 && seen >= total,
  };
}

/** Geschätzte Note — null, solange zu wenig beantwortet wurde. */
export function estimatedGrade(): number | null {
  if (seenConcepts() < MIN_SEEN) return null;
  return gradeForPercent(estimatedPercent());
}

/** Wie viele Inhalte müssen noch gemeistert werden, damit die Note steht?
 *  Gemeistert springt jeder Inhalt auf denselben Wert — den größten Sprung machen also
 *  die schwächsten, und noch nie gesehene bringen zusätzlich Abdeckung mit. Sie liegen
 *  bei Score 0 ohnehin vorn, aufsteigend sortiert steht damit weiterhin der jeweils
 *  größte Sprung zuerst. Das ergibt die kleinstmögliche Anzahl, und es ist zugleich die
 *  Reihenfolge, in der pickRound() den Stoff tatsächlich abfragt (niedrigste Box
 *  zuerst, ungesehene wegen ihres unendlichen Alters davor). */
export function conceptsNeededFor(grade: number): number {
  const boxes = boxSnapshot();
  if (boxes.length === 0) return 0;

  const target = percentForGrade(grade);
  let sum = scoreSumOf(boxes);
  let seen = seenCountOf(boxes);
  if (blend(sum, seen, boxes.length) >= target) return 0;

  const open = boxes
    .map((_, i) => i)
    .filter((i) => boxes[i] < MAX_BOX)
    .sort((a, b) => boxScore(boxes[a]) - boxScore(boxes[b]));

  let needed = 0;
  for (const i of open) {
    sum += BOX_SCORE[MAX_BOX] - boxScore(boxes[i]);
    if (boxes[i] === UNSEEN_BOX) seen++;
    needed++;
    if (blend(sum, seen, boxes.length) >= target) break;
  }
  return needed;
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
 *  von applyAnswer(). Mitgezählt wird auch die Abdeckung: Ein Inhalt, der in der Runde
 *  drankommt, ist danach gesehen — auch wenn die Antwort falsch war.
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

  const target = percentForGrade(grade);
  const clamped = Math.min(1, Math.max(MIN_ASSUMED_ACCURACY, accuracy));
  const rightPerRound = Math.round(clamped * ROUND_SIZE);
  let sum = scoreSumOf(boxes);
  let seen = seenCountOf(boxes);

  for (let round = 0; round <= MAX_SIM_ROUNDS; round++) {
    if (blend(sum, seen, boxes.length) >= target) return round;

    const picked = boxes
      .map((_, i) => i)
      .sort((a, b) => boxScore(boxes[a]) - boxScore(boxes[b]))
      .slice(0, ROUND_SIZE);

    picked.forEach((i, rank) => {
      // Eine falsche Antwort auf einen ungesehenen Inhalt lässt ihn in Box 0 zurück —
      // gesehen ist er trotzdem, der Score steigt also von 0 auf BOX_SCORE[0] und die
      // Abdeckung um eins.
      const wasUnseen = boxes[i] === UNSEEN_BOX;
      const box = wasUnseen ? 0 : boxes[i];
      const next = rank < rightPerRound ? Math.min(MAX_BOX, box + 1) : Math.max(0, box - 1);
      sum += boxScore(next) - boxScore(boxes[i]);
      if (wasUnseen) seen++;
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

type GradeStatus =
  /** Es wurde noch keine Zielnote festgelegt */
  | { kind: 'no-target' }
  /** Zu wenig beantwortet für eine seriöse Schätzung */
  | { kind: 'no-data'; target: number; next: Milestone }
  /** Stand rechnerisch noch bei einer 6. Die Lern-Ansicht nennt die Note nicht und
   *  zeigt nur den Weg dorthin; der Eltern-Bereich führt `current` sachlich mit. */
  | { kind: 'warmup'; target: number; current: number; next: Milestone }
  /** Aktueller Stand schlechter als das Ziel */
  | {
      kind: 'behind';
      target: number;
      current: number;
      needed: number;
      next: Milestone | null;
      targetRounds: RoundEstimate | null;
    }
  | { kind: 'on-target'; target: number; current: number }
  | { kind: 'ahead'; target: number; current: number };

/** Anzeige-Zustand der Notenkarte. Die Abdeckung hängt an jedem Fall, weil sie in
 *  jeden Fall einrechnet — deshalb steht sie neben der Union statt in ihr. */
export type GradeVerdict = GradeStatus & { coverage: Coverage };

/** Fertiger Anzeige-Zustand für die Views — dort bleibt keine Rechenlogik. */
export function gradeVerdict(): GradeVerdict {
  return { ...gradeStatus(), coverage: coverage() };
}

function gradeStatus(): GradeStatus {
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

  // Kein „steht noch am Anfang"-Flag mehr: Wer erst ein Viertel des Lernplans gesehen
  // hat, kommt rechnerisch über 24 % nicht hinaus und landet damit zwingend im
  // warmup-Zweig — die Bedingung war nie erfüllbar. Die Abdeckung an GradeVerdict
  // sagt dasselbe, nur mit Zahl und in jedem Zweig.
  return {
    kind: 'behind',
    target,
    current,
    needed: conceptsNeededFor(target),
    next: milestoneFor(current),
    targetRounds: roundEstimate(target),
  };
}
