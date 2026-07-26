import type { ChapterFile, Concept } from '../types.ts';
import landschaften from './questions/landschaften.json';
import arbeitstechniken from './questions/arbeitstechniken.json';
import landwirtschaft from './questions/landwirtschaft.json';
import staedte from './questions/staedte.json';
import bevoelkerung from './questions/bevoelkerung.json';
import europa from './questions/europa.json';

const FILES: ChapterFile[] = [
  landschaften,
  arbeitstechniken,
  landwirtschaft,
  staedte,
  bevoelkerung,
  europa,
];

/** Konzepte je Kapitel */
export const CONCEPTS_BY_CHAPTER: Record<string, Concept[]> = Object.fromEntries(
  FILES.map((f) => [f.chapterId, f.concepts]),
);

/** Alle Konzepte (für "Mix"-Runden und Gesamtfortschritt) */
export const ALL_CONCEPTS: { chapterId: string; concept: Concept }[] = FILES.flatMap((f) =>
  f.concepts.map((concept) => ({ chapterId: f.chapterId, concept })),
);

const CONCEPT_INDEX = new Map(ALL_CONCEPTS.map((e) => [e.concept.id, e]));

export function conceptById(id: string): { chapterId: string; concept: Concept } | undefined {
  return CONCEPT_INDEX.get(id);
}

export function conceptsOf(chapterId: string): Concept[] {
  return CONCEPTS_BY_CHAPTER[chapterId] ?? [];
}

export const TOTAL_CONCEPTS = ALL_CONCEPTS.length;
