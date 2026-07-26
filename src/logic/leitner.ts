import type { Concept, ConceptProgress, Variant } from '../types.ts';
import { ALL_CONCEPTS, conceptsOf } from '../data/content.ts';
import { CHAPTERS } from '../data/chapters.ts';
import { state, save, todayLog } from '../store.ts';

export const MAX_BOX = 4;

/** Runden-ID der Merkliste-Übungsrunde (kein echtes Kapitel) */
export const MERK_ROUND = 'merkliste';

/** Ein Konzept mit seinem Kapitel */
export interface ConceptEntry {
  chapterId: string;
  concept: Concept;
}

/** IDs der aktuell gewählten Themenblöcke (leer/fehlend = alle) */
export function activeChapterIds(): string[] {
  const sel = state.profile?.chapters;
  return sel && sel.length > 0 ? sel : CHAPTERS.map((c) => c.id);
}

export function isChapterActive(chapterId: string): boolean {
  return activeChapterIds().includes(chapterId);
}

// ---------------------------------------------------------------------------
// Unterthemen-Markierungen. Ein Unterthema (Concept.topic) ist 1:1 ein Konzept,
// markiert wird deshalb über die Konzept-ID.
// ---------------------------------------------------------------------------

/** „Hatten wir noch nicht" — zählt nicht zum Lernplan */
export function isExcluded(conceptId: string): boolean {
  return state.topics.excluded.includes(conceptId);
}

/** „Muss ich noch lernen" — im Lernplan, ruht in normalen Runden */
export function isTodo(conceptId: string): boolean {
  return state.topics.todo.includes(conceptId);
}

/** Konzepte der gewählten Themenblöcke, ohne Unterthemen-Filter.
 *  Absichtlich privat: jeder Nenner soll plannedConcepts() nehmen, sonst zählen
 *  ausgeschlossene Unterthemen wieder mit. */
function activeConcepts(): ConceptEntry[] {
  const active = new Set(activeChapterIds());
  return ALL_CONCEPTS.filter((e) => active.has(e.chapterId));
}

/** Der Lernplan: gewählte Themenblöcke minus ausgeschlossene Unterthemen.
 *  Basis ALLER Nenner (Mastery, Schatzkiste, Notenschätzung, Tagespensum).
 *  Vorgemerkte Themen bleiben drin — sie müssen ja gelernt werden. */
export function plannedConcepts(): ConceptEntry[] {
  const excluded = new Set(state.topics.excluded);
  return activeConcepts().filter((e) => !excluded.has(e.concept.id));
}

/** Lernplan-Konzepte eines Kapitels. Die Kapitel-Auswahl wird hier bewusst NICHT
 *  geprüft — die Kapitelliste zeigt auch abgewählte Kapitel mit echtem Lernstand. */
export function plannedConceptsOf(chapterId: string): Concept[] {
  const excluded = new Set(state.topics.excluded);
  return conceptsOf(chapterId).filter((c) => !excluded.has(c.id));
}

/** Die Merkliste, quer über alle Kapitel — ignoriert die Kapitel-Auswahl, weil
 *  diese Themen bewusst einzeln vorgemerkt wurden. */
export function todoConcepts(): ConceptEntry[] {
  const excluded = new Set(state.topics.excluded);
  const todo = new Set(state.topics.todo);
  return ALL_CONCEPTS.filter((e) => todo.has(e.concept.id) && !excluded.has(e.concept.id));
}

/** Was eine Runde ziehen darf: Lernplan minus ruhende Merklisten-Themen.
 *  Ausgeschlossene Unterthemen fliegen auch aus Einzelkapitel-Runden — anders als
 *  bei der Kapitel-Auswahl, die abgewählte Kapitel direkt spielbar lässt. „Hatten
 *  wir noch nicht" heißt, der Stoff ist nicht dran, also taucht er nirgends auf. */
function drawablePool(chapterId: string): ConceptEntry[] {
  if (chapterId === MERK_ROUND) return todoConcepts();
  const todo = new Set(state.topics.todo);
  const pool =
    chapterId === 'mix'
      ? plannedConcepts()
      : plannedConceptsOf(chapterId).map((concept) => ({ chapterId, concept }));
  return pool.filter((e) => !todo.has(e.concept.id));
}

/** Ein Unterthema aus dem Lernplan nehmen. false = abgelehnt, weil sonst kein
 *  einziges Thema übrig bliebe: bei leerem Lernplan ist maxPoints() 0, damit gilt
 *  pace().done und die Startseite jubelt „Alles gemeistert", ohne dass etwas
 *  gelernt wäre. */
export function excludeTopic(conceptId: string): boolean {
  if (isExcluded(conceptId)) return true;
  if (plannedConcepts().length <= 1) return false;
  state.topics.excluded = [...state.topics.excluded, conceptId];
  // Ausgeschlossen und vorgemerkt schließen sich aus.
  state.topics.todo = state.topics.todo.filter((id) => id !== conceptId);
  save();
  return true;
}

/** Ein Unterthema zurück in den Lernplan holen */
export function includeTopic(conceptId: string): void {
  state.topics.excluded = state.topics.excluded.filter((id) => id !== conceptId);
  save();
}

/** Auf die Merkliste. Ein ausgeschlossenes Thema wird dabei wieder aufgenommen
 *  („brauche ich doch") — die beiden Markierungen schließen sich aus. */
export function addTodo(conceptId: string): void {
  state.topics.excluded = state.topics.excluded.filter((id) => id !== conceptId);
  if (!isTodo(conceptId)) state.topics.todo = [...state.topics.todo, conceptId];
  save();
}

/** „Gelernt ✓" — von der Merkliste nehmen */
export function removeTodo(conceptId: string): void {
  state.topics.todo = state.topics.todo.filter((id) => id !== conceptId);
  save();
}

/** Themenblock in den Lernplan aufnehmen bzw. daraus entfernen.
 *  false = abgelehnt, weil mindestens ein Themenblock aktiv bleiben muss. */
export function toggleChapter(chapterId: string): boolean {
  const p = state.profile;
  if (!p) return false;
  if (p.chapters.includes(chapterId)) {
    if (p.chapters.length === 1) return false;
    p.chapters = p.chapters.filter((c) => c !== chapterId);
  } else {
    p.chapters = [...p.chapters, chapterId];
  }
  save();
  return true;
}

export function progressOf(conceptId: string): ConceptProgress {
  let p = state.progress[conceptId];
  if (!p) {
    p = { box: 0, lastSeen: null, lastVariant: -1, correct: 0, wrong: 0 };
    state.progress[conceptId] = p;
  }
  return p;
}

/** Eine Abfrage-Einheit in einer Runde */
export interface RoundItem {
  chapterId: string;
  concept: Concept;
  variantIndex: number;
  variant: Variant;
  /** Anzeige-Reihenfolge der Optionen; shuffled[i] = Original-Index */
  optionOrder: number[];
  correctDisplayIndex: number;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Positionen (0..3) der richtigen Antwort über eine ganze Runde.
 *
 *  Würfelt man je Frage unabhängig, klumpt es spürbar: In 31 % aller
 *  10er-Runden kommt ein Buchstabe fünfmal oder öfter vor, in 35 % steht
 *  dreimal derselbe hintereinander. Das ist statistisch normal, fühlt sich
 *  aber nach „C ist immer richtig“ an. Deshalb ziehen wir aus einem Beutel
 *  aus vollständigen A–D-Blöcken: pro vier Fragen kommt jeder Buchstabe
 *  genau einmal dran. */
function balancedPositions(n: number): number[] {
  const bag: number[] = [];
  while (bag.length < n) bag.push(...shuffle([0, 1, 2, 3]));
  const out = bag.slice(0, n);

  // An den Blockgrenzen kann derselbe Buchstabe trotzdem mehrfach in Folge
  // auftauchen — solche Läufe hier auflösen.
  for (let i = 2; i < out.length; i++) {
    if (out[i] === out[i - 1] && out[i] === out[i - 2]) {
      const j = out.findIndex((v, k) => k > i && v !== out[i]);
      if (j > -1) [out[i], out[j]] = [out[j], out[i]];
    }
  }
  return out;
}

/** Wählt für ein Konzept eine Variante, die nicht der letzten entspricht. */
function pickVariant(concept: Concept, lastVariant: number): number {
  const n = concept.variants.length;
  if (n <= 1) return 0;
  const candidates = concept.variants.map((_, i) => i).filter((i) => i !== lastVariant);
  return candidates[Math.floor(Math.random() * candidates.length)];
}

/** correctDisplayIndex gibt vor, an welcher Anzeigeposition die richtige
 *  Antwort landet; die drei Distraktoren werden weiterhin frei gemischt. */
function toRoundItem(chapterId: string, concept: Concept, correctDisplayIndex: number): RoundItem {
  const p = progressOf(concept.id);
  const variantIndex = pickVariant(concept, p.lastVariant);
  const variant = concept.variants[variantIndex];
  const distractors = shuffle(variant.options.map((_, i) => i).slice(1));
  const optionOrder = variant.options.map((_, i) =>
    i === correctDisplayIndex ? 0 : distractors.pop()!,
  );
  return {
    chapterId,
    concept,
    variantIndex,
    variant,
    optionOrder,
    correctDisplayIndex,
  };
}

/** Stellt eine Runde zusammen: niedrige Boxen und lange nicht Gesehenes zuerst.
 *  chapterId 'mix' zieht aus dem ganzen Lernplan, 'merkliste' nur aus den
 *  vorgemerkten Themen. */
export function pickRound(chapterId: string, count = 10): RoundItem[] {
  const pool = drawablePool(chapterId);

  const scored = pool.map((entry) => {
    const p = progressOf(entry.concept.id);
    const age = p.lastSeen ? Date.now() - new Date(p.lastSeen).getTime() : Number.MAX_SAFE_INTEGER;
    // Niedrige Box dominiert; innerhalb der Box ältere zuerst; leichtes Rauschen
    // damit Runden nicht deterministisch identisch sind. Das Rauschen entspricht
    // gut einem Tag — genug für Abwechslung innerhalb einer Lernsitzung, aber
    // klein genug, dass über mehrere Tage wieder das Alter den Ausschlag gibt.
    const score = p.box * 1e15 - Math.min(age, 1e12) + Math.random() * 1e8;
    return { entry, score };
  });

  scored.sort((a, b) => a.score - b.score);
  const chosen = scored.slice(0, count);
  const positions = balancedPositions(chosen.length);
  return chosen.map(({ entry }, i) => toRoundItem(entry.chapterId, entry.concept, positions[i]));
}

/** Antwort verbuchen: Box rauf/runter, Tageslog & Zähler pflegen.
 *  Meldet zurück, ob das Thema damit von der Merkliste verschwunden ist. */
export function applyAnswer(item: RoundItem, correct: boolean): { todoCleared: boolean } {
  const p = progressOf(item.concept.id);
  const before = p.box;
  if (correct) {
    p.box = Math.min(MAX_BOX, p.box + 1);
    p.correct++;
  } else {
    p.box = Math.max(0, p.box - 1);
    p.wrong++;
  }
  p.lastSeen = new Date().toISOString();
  p.lastVariant = item.variantIndex;

  const log = todayLog();
  log.answered++;
  if (correct) log.correct++;
  log.points += p.box - before;

  // Ein vorgemerktes Thema, das Box 4 erreicht, ist gelernt und hakt sich selbst
  // ab. Sonst blockiert es dauerhaft Schatzkiste und Tagespensum: es bleibt im
  // Nenner, wird aber nie abgehakt. Das ist der einzige Schreibpfad für Boxen —
  // die Invariante gehört hierhin, nicht in die View.
  const todoCleared = p.box >= MAX_BOX && isTodo(item.concept.id);
  if (todoCleared) {
    state.topics.todo = state.topics.todo.filter((id) => id !== item.concept.id);
  }

  save();
  return { todoCleared };
}

/** Mastery eines Kapitels: Ø Box-Level der Lernplan-Konzepte, 0..1.
 *  Ausgeschlossene Unterthemen fallen aus dem Nenner — sonst wäre die
 *  100-%-Schatzkiste nach der ersten Ausnahme unerreichbar. */
export function chapterMastery(chapterId: string): number {
  const concepts = plannedConceptsOf(chapterId);
  if (concepts.length === 0) return 0;
  const sum = concepts.reduce((s, c) => s + (state.progress[c.id]?.box ?? 0), 0);
  return sum / (concepts.length * MAX_BOX);
}

/** Anzahl gelernter Konzepte (Box >= 4) im Lernplan eines Kapitels */
export function learnedCount(chapterId: string): number {
  return plannedConceptsOf(chapterId).filter((c) => (state.progress[c.id]?.box ?? 0) >= MAX_BOX)
    .length;
}

/** Gelernte Konzepte im Lernplan */
export function totalLearned(): number {
  return plannedConcepts().filter((e) => (state.progress[e.concept.id]?.box ?? 0) >= MAX_BOX).length;
}

/** Summe erreichter Box-Stufen (Lernpunkte) im Lernplan */
export function totalPoints(): number {
  return plannedConcepts().reduce((s, e) => s + (state.progress[e.concept.id]?.box ?? 0), 0);
}

export function maxPoints(): number {
  return plannedConcepts().length * MAX_BOX;
}

/** Anzahl Konzepte im Lernplan */
export function plannedConceptCount(): number {
  return plannedConcepts().length;
}
