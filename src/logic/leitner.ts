import type { Concept, ConceptProgress, Variant } from '../types.ts';
import { ALL_CONCEPTS, conceptsOf } from '../data/content.ts';
import { CHAPTERS } from '../data/chapters.ts';
import { state, save, todayLog } from '../store.ts';

export const MAX_BOX = 4;

/** IDs der aktuell gewählten Themenblöcke (leer/fehlend = alle) */
export function activeChapterIds(): string[] {
  const sel = state.profile?.chapters;
  return sel && sel.length > 0 ? sel : CHAPTERS.map((c) => c.id);
}

export function isChapterActive(chapterId: string): boolean {
  return activeChapterIds().includes(chapterId);
}

/** Konzepte der gewählten Themenblöcke */
export function activeConcepts(): { chapterId: string; concept: Concept }[] {
  const active = new Set(activeChapterIds());
  return ALL_CONCEPTS.filter((e) => active.has(e.chapterId));
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

/** Wählt für ein Konzept eine Variante, die nicht der letzten entspricht. */
function pickVariant(concept: Concept, lastVariant: number): number {
  const n = concept.variants.length;
  if (n <= 1) return 0;
  const candidates = concept.variants.map((_, i) => i).filter((i) => i !== lastVariant);
  return candidates[Math.floor(Math.random() * candidates.length)];
}

function toRoundItem(chapterId: string, concept: Concept): RoundItem {
  const p = progressOf(concept.id);
  const variantIndex = pickVariant(concept, p.lastVariant);
  const variant = concept.variants[variantIndex];
  const optionOrder = shuffle(variant.options.map((_, i) => i));
  return {
    chapterId,
    concept,
    variantIndex,
    variant,
    optionOrder,
    correctDisplayIndex: optionOrder.indexOf(0),
  };
}

/** Stellt eine Runde zusammen: niedrige Boxen und lange nicht Gesehenes zuerst.
 *  chapterId 'mix' zieht aus allen Kapiteln. */
export function pickRound(chapterId: string, count = 10): RoundItem[] {
  const pool =
    chapterId === 'mix'
      ? activeConcepts()
      : conceptsOf(chapterId).map((concept) => ({ chapterId, concept }));

  const scored = pool.map((entry) => {
    const p = progressOf(entry.concept.id);
    const age = p.lastSeen ? Date.now() - new Date(p.lastSeen).getTime() : Number.MAX_SAFE_INTEGER;
    // Niedrige Box dominiert; innerhalb der Box ältere zuerst; leichtes Rauschen
    // damit Runden nicht deterministisch identisch sind.
    const score = p.box * 1e15 - Math.min(age, 1e12) + Math.random() * 1e9;
    return { entry, score };
  });

  scored.sort((a, b) => a.score - b.score);
  return scored.slice(0, count).map(({ entry }) => toRoundItem(entry.chapterId, entry.concept));
}

/** Antwort verbuchen: Box rauf/runter, Tageslog & Zähler pflegen. */
export function applyAnswer(item: RoundItem, correct: boolean): void {
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
  save();
}

/** Mastery eines Kapitels: Ø Box-Level der Konzepte, 0..1 */
export function chapterMastery(chapterId: string): number {
  const concepts = conceptsOf(chapterId);
  if (concepts.length === 0) return 0;
  const sum = concepts.reduce((s, c) => s + (state.progress[c.id]?.box ?? 0), 0);
  return sum / (concepts.length * MAX_BOX);
}

/** Anzahl gelernter Konzepte (Box >= 4) eines Kapitels */
export function learnedCount(chapterId: string): number {
  return conceptsOf(chapterId).filter((c) => (state.progress[c.id]?.box ?? 0) >= MAX_BOX).length;
}

/** Gelernte Konzepte in den gewählten Themenblöcken */
export function totalLearned(): number {
  return activeConcepts().filter((e) => (state.progress[e.concept.id]?.box ?? 0) >= MAX_BOX).length;
}

/** Summe erreichter Box-Stufen (Lernpunkte) in den gewählten Themenblöcken */
export function totalPoints(): number {
  return activeConcepts().reduce((s, e) => s + (state.progress[e.concept.id]?.box ?? 0), 0);
}

export function maxPoints(): number {
  return activeConcepts().length * MAX_BOX;
}

/** Anzahl Konzepte in den gewählten Themenblöcken */
export function activeConceptCount(): number {
  return activeConcepts().length;
}
