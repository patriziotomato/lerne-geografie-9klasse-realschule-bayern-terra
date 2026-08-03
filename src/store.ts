import type { AppState, DayLog, Profile, ThemeChoice } from './types.ts';
import { CHAPTERS } from './data/chapters.ts';

/** ACHTUNG: Dieser Schlüssel steht ein zweites Mal im Bootstrap-Skript in
 *  index.html, das das Farbschema noch vor dem ersten Paint setzt. Wird er
 *  hier geändert, muss er dort mitgeändert werden. */
const KEY = 'geoquest.geo9.terra.v1';
const SCHEMA_VERSION = 6;

/** Kapitel-IDs, wie sie vor der Umstellung auf die Buchstruktur existierten.
 *  „arbeitstechniken“ ist entfallen (im Buch gibt es kein solches Kapitel),
 *  „klima“ ist neu dazugekommen. Gebraucht wird die Liste nur noch, um alte
 *  Profile zu erkennen — siehe migrateChapters(). */
const LEGACY_CHAPTERS = [
  'landschaften',
  'arbeitstechniken',
  'landwirtschaft',
  'staedte',
  'bevoelkerung',
  'europa',
];

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
      theme: 'system',
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
    // Mit Schema 6 hat sich der Inhaltsbestand geändert: 49 Konzepte sind
    // entfallen, 61 sind neu — knapp die Hälfte. Eine Bestnote, die auf dem
    // alten Bestand erreicht wurde, ist damit nicht mehr vergleichbar und würde
    // als Sperre jede Feier auf dem Weg zurück verschlucken. Deshalb einmalig
    // zurücksetzen: Angezeigt wird bestGrade nirgends, es steuert nur den
    // Notensprung — der Preis ist also nur eine Feier, die schon einmal war.
    const contentChanged = (parsed.version ?? 0) < 6;
    const rawProfile = parsed.profile as Partial<Profile> | null | undefined;
    const profile: Profile | null = rawProfile
      ? {
          firstName: rawProfile.firstName ?? '',
          phone: rawProfile.phone ?? '',
          deadline: rawProfile.deadline ?? null,
          studyTimes: rawProfile.studyTimes ?? [],
          chapters: migrateChapters(rawProfile.chapters),
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
      stats: {
        ...def.stats,
        ...(parsed.stats ?? {}),
        ...(contentChanged ? { bestGrade: null } : {}),
      },
      settings: {
        ...def.settings,
        ...(parsed.settings ?? {}),
        theme: validTheme(parsed.settings?.theme),
      },
      // Der Lernstand entfallener Konzepte bleibt absichtlich liegen: Gelesen
      // wird ausschließlich per Lookup über ALL_CONCEPTS, unbekannte Schlüssel
      // können also keine Zahl verfälschen — und käme ein Thema je zurück, wäre
      // sein Lernstand noch da. Dasselbe gilt für topics und stats.openedChests.
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

/** Kapitelauswahl aus dem Speicher auf die Buchstruktur bringen.
 *
 *  Drei Fälle:
 *  1. Profile von vor der Themenauswahl (leer) lernen weiterhin alles.
 *  2. Wer vorher „Alle Inhalte“ gewählt hatte, bekommt auch das neue Kapitel
 *     „Klima und Klimawandel“ — sonst fiele stillschweigend ein ganzes
 *     Buchkapitel aus dem Lernplan.
 *  3. Wer bewusst nur einzelne Kapitel gewählt hatte, behält seine Auswahl.
 *     Über „klima“ konnte er noch gar nicht entscheiden, deshalb wird es
 *     hier NICHT dazugeschummelt — er findet es im Themenkatalog.
 *
 *  Entfallene IDs (`arbeitstechniken`) fliegen in jedem Fall raus. Bleibt
 *  dabei nichts übrig, wäre der Lernplan leer — dann lieber alles. */
function migrateChapters(stored: string[] | undefined): string[] {
  const all = CHAPTERS.map((c) => c.id);
  if (!Array.isArray(stored) || stored.length === 0) return all;

  const hadEverything = LEGACY_CHAPTERS.every((id) => stored.includes(id));
  if (hadEverything) return all;

  const known = new Set(all);
  const kept = stored.filter((id) => known.has(id));
  return kept.length > 0 ? kept : all;
}

/** Zielnote aus dem Speicher übernehmen, sofern sie eine echte Schulnote ist.
 *  Die Grenzen stehen absichtlich hier inline — ein Import aus logic/grade.ts
 *  würde einen Zyklus store → grade → store erzeugen. */
/** Profile von vor der Farbschema-Wahl (und alles Unbekannte) folgen dem
 *  System — das ist der Zustand, den sie bisher hatten. */
function validTheme(theme: unknown): ThemeChoice {
  return theme === 'light' || theme === 'dark' || theme === 'system' ? theme : 'system';
}

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
