#!/usr/bin/env node
// Prüft die Fragen-JSONs auf Struktur, Länge und Ratbarkeit.
//
// Hintergrund: In der ersten Fassung war die richtige Antwort in 73,9 % der Fälle
// die längste der vier Optionen — wer immer die längste antippt, kam ohne Wissen
// auf ~74 %. Regel L2 (alle Optionen ungefähr gleich lang) verhindert das, B1
// misst nach, ob es wirkt.
//
// Aufruf: node scripts/check-questions.mjs [--update-baseline]

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const QUESTIONS_DIR = join(ROOT, 'src/data/questions');
const BASELINE = join(ROOT, 'scripts/questions-baseline.json');

/** Harte Grenzen — Verstoß = Exit-Code 1 */
const LIMITS = {
  /** L1: einzelne Antwortoption */
  option: 60,
  /** L2: längste minus kürzeste Option innerhalb einer Frage */
  spread: 15,
  /** L3: Erklärung */
  explanation: 110,
  /** B1: Anteil Varianten, in denen die richtige Antwort die eindeutig längste ist */
  longestIsCorrect: 0.3,
};

/** Zielwerte — Verstoß = nur Warnung. Bewusst etwas über dem erreichten
 *  Stand (Ø 41 / Ø 70), damit die Warnung Rückschritte meldet statt dauernd
 *  zu feuern. Unter ~40 Zeichen bleiben Distraktoren kaum noch parallel. */
const TARGETS = { avgOption: 45, avgExplanation: 80 };

const errors = [];
const warnings = [];

function fail(file, id, rule, message) {
  errors.push(`${file} · ${id} · [${rule}] ${message}`);
}

// ---------------------------------------------------------------- Einlesen ---

const files = readdirSync(QUESTIONS_DIR).filter((f) => f.endsWith('.json')).sort();
const chapters = files.map((f) => ({
  file: f,
  data: JSON.parse(readFileSync(join(QUESTIONS_DIR, f), 'utf8')),
}));

/** Flache Liste aller Varianten mit Herkunft */
const all = [];
for (const { file, data } of chapters) {
  for (const concept of data.concepts ?? []) {
    for (const [i, variant] of (concept.variants ?? []).entries()) {
      all.push({ file, concept, variant, label: `${concept.id}#${i + 1}` });
    }
  }
}

// -------------------------------------------------- Baseline (S1/S2) --------

const currentBaseline = {
  concepts: chapters.flatMap(({ data }) =>
    (data.concepts ?? []).map((c) => ({
      id: c.id,
      texts: (c.variants ?? []).map((v) => v.text),
    })),
  ),
};

if (process.argv.includes('--update-baseline')) {
  writeFileSync(BASELINE, JSON.stringify(currentBaseline, null, 2) + '\n');
  console.log(
    `Baseline geschrieben: ${currentBaseline.concepts.length} Konzepte, ` +
      `${currentBaseline.concepts.reduce((n, c) => n + c.texts.length, 0)} Varianten.`,
  );
  process.exit(0);
}

let baseline = null;
try {
  baseline = JSON.parse(readFileSync(BASELINE, 'utf8'));
} catch {
  errors.push(
    `scripts/questions-baseline.json fehlt oder ist unlesbar — ` +
      `einmalig mit "node scripts/check-questions.mjs --update-baseline" erzeugen.`,
  );
}

if (baseline) {
  const byId = new Map(currentBaseline.concepts.map((c) => [c.id, c]));
  const baseIds = new Set(baseline.concepts.map((c) => c.id));

  // S1: Konzept-IDs sind der Schlüssel des Leitner-Fortschritts im localStorage.
  // Driftet eine ID, verliert die Nutzerin ihren Lernstand.
  for (const id of baseIds) {
    if (!byId.has(id)) errors.push(`[S1] Konzept "${id}" aus der Baseline fehlt jetzt.`);
  }
  for (const c of currentBaseline.concepts) {
    if (!baseIds.has(c.id)) errors.push(`[S1] Konzept "${c.id}" ist neu — Baseline aktualisieren?`);
  }

  // S2: Fragetexte bleiben unangetastet, gekürzt werden nur Optionen und Erklärungen.
  for (const base of baseline.concepts) {
    const now = byId.get(base.id);
    if (!now) continue;
    if (now.texts.length !== base.texts.length) {
      errors.push(
        `[S2] ${base.id}: ${base.texts.length} Varianten in der Baseline, jetzt ${now.texts.length}.`,
      );
      continue;
    }
    base.texts.forEach((text, i) => {
      if (now.texts[i] !== text) {
        errors.push(`[S2] ${base.id}#${i + 1}: Fragetext wurde verändert.`);
      }
    });
  }
}

// ---------------------------------------------------- Struktur & Längen -----

for (const { file, variant, label } of all) {
  const { options = [], explanation = '', difficulty } = variant;

  // S3
  if (options.length !== 4) fail(file, label, 'S3', `${options.length} statt 4 Optionen.`);
  const seen = new Set(options.map((o) => o.trim().toLowerCase()));
  if (seen.size !== options.length) fail(file, label, 'S3', 'doppelte Antwortoption.');
  if (![1, 2, 3].includes(difficulty)) fail(file, label, 'S3', `difficulty "${difficulty}" ungültig.`);
  if (!explanation.trim()) fail(file, label, 'S3', 'Erklärung ist leer.');

  // L1
  for (const [i, o] of options.entries()) {
    if (o.length > LIMITS.option) {
      fail(file, label, 'L1', `Option ${i + 1} hat ${o.length} Zeichen (max ${LIMITS.option}).`);
    }
  }

  // L2 — der eigentliche Schutz gegen "die längste ist die richtige"
  if (options.length === 4) {
    const lens = options.map((o) => o.length);
    const spread = Math.max(...lens) - Math.min(...lens);
    if (spread > LIMITS.spread) {
      fail(file, label, 'L2', `Längen-Spreizung ${spread} (max ${LIMITS.spread}), Längen ${lens.join('/')}.`);
    }
  }

  // L3
  if (explanation.length > LIMITS.explanation) {
    fail(file, label, 'L3', `Erklärung hat ${explanation.length} Zeichen (max ${LIMITS.explanation}).`);
  }
}

// ------------------------------------------------------- Statistik (B1) -----

const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

function statsFor(items) {
  const optionLens = items.flatMap((e) => e.variant.options.map((o) => o.length));
  const explLens = items.map((e) => e.variant.explanation.length);
  const longest = items.filter((e) => {
    const lens = e.variant.options.map((o) => o.length);
    const max = Math.max(...lens);
    return lens[0] === max && lens.filter((l) => l === max).length === 1;
  }).length;
  return {
    variants: items.length,
    avgOption: avg(optionLens),
    avgExplanation: avg(explLens),
    longestShare: items.length ? longest / items.length : 0,
  };
}

const total = statsFor(all);

if (total.longestShare > LIMITS.longestIsCorrect) {
  errors.push(
    `[B1] Die richtige Antwort ist in ${(total.longestShare * 100).toFixed(1)} % der Varianten ` +
      `die eindeutig längste (max ${(LIMITS.longestIsCorrect * 100).toFixed(0)} %). ` +
      `Sie ist damit ohne Wissen erratbar.`,
  );
}
if (total.avgOption > TARGETS.avgOption) {
  warnings.push(`[Z1] Ø Option ${total.avgOption.toFixed(0)} Zeichen (Ziel ≤ ${TARGETS.avgOption}).`);
}
if (total.avgExplanation > TARGETS.avgExplanation) {
  warnings.push(
    `[Z1] Ø Erklärung ${total.avgExplanation.toFixed(0)} Zeichen (Ziel ≤ ${TARGETS.avgExplanation}).`,
  );
}

// ---------------------------------------------------------------- Ausgabe ---

const pad = (s, n) => String(s).padEnd(n);
const num = (s, n) => String(s).padStart(n);

console.log(`${pad('Datei', 24)} ${num('Var.', 5)} ${num('Ø Opt.', 7)} ${num('Ø Erkl.', 8)} ${num('längste=richtig', 16)}`);
console.log('-'.repeat(64));
for (const { file } of chapters) {
  const s = statsFor(all.filter((e) => e.file === file));
  console.log(
    `${pad(file, 24)} ${num(s.variants, 5)} ${num(s.avgOption.toFixed(0), 7)} ` +
      `${num(s.avgExplanation.toFixed(0), 8)} ${num((s.longestShare * 100).toFixed(1) + ' %', 16)}`,
  );
}
console.log('-'.repeat(64));
console.log(
  `${pad('GESAMT', 24)} ${num(total.variants, 5)} ${num(total.avgOption.toFixed(0), 7)} ` +
    `${num(total.avgExplanation.toFixed(0), 8)} ${num((total.longestShare * 100).toFixed(1) + ' %', 16)}`,
);
console.log(
  `\n${chapters.length} Kapitel · ${currentBaseline.concepts.length} Konzepte · ${all.length} Varianten`,
);

for (const w of warnings) console.warn(`\n⚠️  ${w}`);

if (errors.length) {
  console.error(`\n❌ ${errors.length} Verstöße:\n`);
  for (const e of errors.slice(0, 40)) console.error(`   ${e}`);
  if (errors.length > 40) console.error(`   … und ${errors.length - 40} weitere.`);
  process.exit(1);
}

console.log('\n✅ Alle Prüfungen bestanden.');
