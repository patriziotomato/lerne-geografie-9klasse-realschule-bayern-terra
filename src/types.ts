// Zentrale Typen der App.

/** Eine Frage-Variante. In den JSON-Dateien steht die richtige
 *  Antwort IMMER an Index 0 der options — angezeigt wird gemischt. */
export interface Variant {
  text: string;
  /** options[0] ist die korrekte Antwort (wird zur Anzeige gemischt) */
  options: string[];
  explanation: string;
  /** 1 = leicht, 2 = mittel, 3 = schwer */
  difficulty: number;
}

/** Ein Lernkonzept (= prüfbarer Inhalt) mit mehreren Formulierungs-Varianten.
 *  Gemeistert wird das Konzept, nicht die einzelne Frage. */
export interface Concept {
  id: string;
  topic: string;
  variants: Variant[];
}

export interface ChapterFile {
  chapterId: string;
  concepts: Concept[];
}

export interface Chapter {
  id: string;
  title: string;
  short: string;
  emoji: string;
  /** Akzentfarbe der Kapitel-Kachel (Identität, dekorativ) */
  color: string;
  description: string;
  /** Belohnung in der Schatzkiste bei 100 % Mastery */
  chestBadge: { emoji: string; name: string };
}

export interface Profile {
  firstName: string;
  phone: string;
  /** ISO-Datum (yyyy-mm-dd), bis wann gelernt sein muss — optional */
  deadline: string | null;
  /** Uhrzeiten "HH:MM", zu denen gelernt werden soll — optional, leer = keine */
  studyTimes: string[];
  /** Ausgewählte Themenblöcke (Kapitel-IDs); alle IDs = "Alle Inhalte" */
  chapters: string[];
  /** Angepeilte Schulnote (1–4); null = noch nicht gefragt */
  targetGrade: number | null;
  createdAt: string;
}

/** Leitner-Lernstand eines Konzepts */
export interface ConceptProgress {
  /** Box 0 (neu) … 4 (gemeistert) */
  box: number;
  lastSeen: string | null;
  /** Index der zuletzt gezeigten Variante (nie zweimal dieselbe nacheinander) */
  lastVariant: number;
  correct: number;
  wrong: number;
}

export interface DayLog {
  /** yyyy-mm-dd */
  date: string;
  answered: number;
  correct: number;
  xp: number;
  /** Netto gewonnene Box-Stufen (Lernpunkte) an diesem Tag */
  points: number;
  minutes: number;
}

/** Eine Lernsitzung (für den Eltern-Bereich) */
export interface SessionLog {
  /** ISO-Zeitstempel des Sitzungsbeginns */
  start: string;
  minutes: number;
  answered: number;
  correct: number;
  xp: number;
}

export interface Stats {
  xp: number;
  /** Anzahl komplett beantworteter Runden */
  rounds: number;
  streak: number;
  bestStreak: number;
  lastStudyDay: string | null;
  badges: string[];
  /** Beste je erreichte Notenschätzung. Gefeiert wird nur eine neue Bestnote —
   *  sonst gäbe es bei jedem Auf und Ab (5 → 4 → 5 → 4) erneut Konfetti. */
  bestGrade: number | null;
  /** Kapitel-IDs, deren Schatzkiste geöffnet wurde */
  openedChests: string[];
  history: DayLog[];
  sessions: SessionLog[];
}

export interface Settings {
  remindersEnabled: boolean;
  soundEnabled: boolean;
  /** SHA-256-Hex der Eltern-PIN, null = nicht gesetzt */
  parentPinHash: string | null;
}

export interface AppState {
  version: number;
  profile: Profile | null;
  progress: Record<string, ConceptProgress>;
  stats: Stats;
  settings: Settings;
}

/** Ergebnis einer beendeten Quiz-Runde (für den Results-Screen) */
export interface RoundResult {
  chapterId: string;
  total: number;
  correct: number;
  xpGained: number;
  bestCombo: number;
  leveledUpTo: number | null;
  newBadges: string[];
  /** Kapitel, deren Kiste durch diese Runde freigeschaltet wurde */
  unlockedChests: string[];
  /** Mit dieser Runde erstmals erreichte Bestnote; null = kein neuer Rekord.
   *  Ersetzt den früheren Vorher/Nachher-Vergleich: Gegen den persistenten
   *  stats.bestGrade gemessen, feiert ein Auf und Ab nicht mehrfach. */
  newBestGrade: number | null;
}
