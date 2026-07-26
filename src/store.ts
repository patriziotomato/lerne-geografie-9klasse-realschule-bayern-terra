import type { AppState, DayLog } from './types.ts';

const KEY = 'geoquest.geo9.terra.v1';
const SCHEMA_VERSION = 2;

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
      openedChests: [],
      history: [],
      sessions: [],
    },
    settings: {
      remindersEnabled: true,
      soundEnabled: true,
      parentPinHash: null,
    },
  };
}

function load(): AppState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw) as Partial<AppState>;
    // Sanfte Migration: fehlende Felder mit Defaults auffüllen.
    const def = defaultState();
    return {
      ...def,
      ...parsed,
      version: SCHEMA_VERSION,
      stats: { ...def.stats, ...(parsed.stats ?? {}) },
      settings: { ...def.settings, ...(parsed.settings ?? {}) },
      progress: parsed.progress ?? {},
    };
  } catch {
    return defaultState();
  }
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
