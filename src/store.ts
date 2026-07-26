import type { AppState, DayLog, Profile } from './types.ts';
import { CHAPTERS } from './data/chapters.ts';

const KEY = 'geoquest.geo9.terra.v1';
const SCHEMA_VERSION = 5;

function defaultState(): AppState {
  return {
    version: SCHEMA_VERSION,
    profile: null,
    progress: {},
    stats: {
      xp: 0,
      rounds: 0,
      streak: 0,
      bestStreak: 0,
      lastStudyDay: null,
      badges: [],
      // Bestandsnutzer starten hier bei null, weil store.ts die Note nicht selbst
      // schätzen darf (der Import aus logic/grade.ts wäre ein Zyklus, s. u.). Sie
      // bekommen dadurch beim nächsten Rundenende einmal Konfetti für eine Note, die
      // sie schon hatten — ein harmloser Preis für eine Migration ohne Sonderfall.
      bestGrade: null,
      openedChests: [],
      history: [],
      sessions: [],
    },
    settings: {
      remindersEnabled: true,
      soundEnabled: true,
      parentPinHash: null,
    },
    topics: { excluded: [], todo: [] },
  };
}

function load(): AppState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw) as Partial<AppState>;
    // Sanfte Migration: fehlende Felder mit Defaults auffüllen.
    const def = defaultState();
    const rawProfile = parsed.profile as Partial<Profile> | null | undefined;
    const profile: Profile | null = rawProfile
      ? {
          firstName: rawProfile.firstName ?? '',
          phone: rawProfile.phone ?? '',
          deadline: rawProfile.deadline ?? null,
          studyTimes: rawProfile.studyTimes ?? [],
          // Profile von vor der Themenauswahl lernen weiterhin alles.
          chapters:
            rawProfile.chapters && rawProfile.chapters.length > 0
              ? rawProfile.chapters
              : CHAPTERS.map((c) => c.id),
          // Profile von vor der Zielnoten-Abfrage werden auf der Startseite gefragt.
          targetGrade: validGrade(rawProfile.targetGrade),
          createdAt: rawProfile.createdAt ?? new Date().toISOString(),
        }
      : null;
    return {
      ...def,
      ...parsed,
      profile,
      version: SCHEMA_VERSION,
      stats: { ...def.stats, ...(parsed.stats ?? {}) },
      settings: { ...def.settings, ...(parsed.settings ?? {}) },
      progress: parsed.progress ?? {},
      // Profile von vor dem Themenkatalog haben noch keine Markierungen.
      topics: {
        excluded: idList(parsed.topics?.excluded),
        todo: idList(parsed.topics?.todo),
      },
    };
  } catch {
    return defaultState();
  }
}

/** Zielnote aus dem Speicher übernehmen, sofern sie eine echte Schulnote ist.
 *  Die Grenzen stehen absichtlich hier inline — ein Import aus logic/grade.ts
 *  würde einen Zyklus store → grade → store erzeugen. */
function validGrade(grade: unknown): number | null {
  const ok = typeof grade === 'number' && Number.isInteger(grade) && grade >= 1 && grade <= 6;
  return ok ? (grade as number) : null;
}

/** Konzept-ID-Liste aus dem Speicher säubern: nur Strings, keine Duplikate.
 *  Der Spread aus dem gespeicherten Objekt allein würde ein kaputtes topics
 *  (z. B. null aus einem handeditierten Export) übernehmen, und jedes includes()
 *  darauf würde werfen. Unbekannte IDs bleiben absichtlich drin — geprüft wird per
 *  Set-Lookup, und ein vorübergehend fehlendes Konzept soll die Markierung nicht
 *  stillschweigend löschen. */
function idList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((v): v is string => typeof v === 'string'))];
}

/** Globaler App-Zustand. Nach Mutationen save() aufrufen. */
export const state: AppState = load();

export function save(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Speicher voll o. ä. — App bleibt benutzbar, nur ohne Persistenz.
  }
}

export function resetAll(): void {
  localStorage.removeItem(KEY);
  location.reload();
}

/** yyyy-mm-dd in lokaler Zeit */
export function todayKey(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Tages-Log für heute holen (bei Bedarf anlegen) */
export function todayLog(): DayLog {
  const key = todayKey();
  let log = state.stats.history.find((h) => h.date === key);
  if (!log) {
    log = { date: key, answered: 0, correct: 0, xp: 0, points: 0, minutes: 0 };
    state.stats.history.push(log);
    // Historie begrenzen (ca. 1 Jahr)
    if (state.stats.history.length > 370) {
      state.stats.history = state.stats.history.slice(-370);
    }
  }
  return log;
}

export function exportJson(): string {
  return JSON.stringify(state, null, 2);
}
