import type { RoundResult } from '../types.ts';
import { state, save, todayKey, todayLog } from '../store.ts';
import { CHAPTERS } from '../data/chapters.ts';
import { chapterMastery, learnedCount } from './leitner.ts';
import { estimatedGrade, WORST_NAMED_GRADE } from './grade.ts';
import { conceptsOf } from '../data/content.ts';

/** XP für eine richtige Antwort bei gegebener Combo (Anzahl richtiger davor in Serie) */
export function xpForAnswer(combo: number): number {
  return 10 + Math.min(combo, 5) * 2; // 10,12,…,20
}

export const PERFECT_BONUS = 50;

/** Kumulative XP-Schwelle, um Level n abzuschließen (Level beginnt bei 1) */
export function xpThreshold(level: number): number {
  return 50 * level * (level + 1); // 100, 300, 600, 1000, 1500, …
}

export function levelForXp(xp: number): number {
  let level = 1;
  while (xp >= xpThreshold(level)) level++;
  return level;
}

/** Fortschritt innerhalb des aktuellen Levels, 0..1 */
export function levelProgress(xp: number): { level: number; into: number; needed: number; ratio: number } {
  const level = levelForXp(xp);
  const prev = level === 1 ? 0 : xpThreshold(level - 1);
  const next = xpThreshold(level);
  const into = xp - prev;
  const needed = next - prev;
  return { level, into, needed, ratio: Math.min(1, into / needed) };
}

export interface BadgeDef {
  id: string;
  emoji: string;
  name: string;
  description: string;
}

export const BADGES: BadgeDef[] = [
  { id: 'first-round', emoji: '🎯', name: 'Erster Schritt', description: 'Erste Runde abgeschlossen' },
  { id: 'perfect-round', emoji: '💯', name: 'Perfekte Runde', description: 'Alle Fragen einer Runde richtig' },
  { id: 'combo-10', emoji: '⚡', name: 'Combo-Meister', description: '10 richtige Antworten am Stück' },
  { id: 'streak-3', emoji: '🔥', name: 'Warmgelaufen', description: '3 Tage in Folge gelernt' },
  { id: 'streak-7', emoji: '🚀', name: 'Wochen-Streak', description: '7 Tage in Folge gelernt' },
  { id: 'streak-14', emoji: '🌟', name: 'Durchzieher', description: '14 Tage in Folge gelernt' },
  { id: 'streak-30', emoji: '👑', name: 'Unaufhaltsam', description: '30 Tage in Folge gelernt' },
  { id: 'early-bird', emoji: '🌅', name: 'Frühaufsteher', description: 'Vor 8 Uhr gelernt' },
  { id: 'night-owl', emoji: '🦉', name: 'Nachteule', description: 'Nach 21 Uhr gelernt' },
  { id: 'on-schedule', emoji: '⏰', name: 'Plantreu', description: 'Zur eingestellten Lernzeit gelernt' },
  { id: 'xp-1000', emoji: '💎', name: 'XP-Sammler', description: '1.000 XP erreicht' },
  { id: 'xp-5000', emoji: '🏆', name: 'XP-Vermögen', description: '5.000 XP erreicht' },
  { id: 'level-5', emoji: '🎖️', name: 'Level 5', description: 'Level 5 erreicht' },
  { id: 'level-10', emoji: '🥇', name: 'Level 10', description: 'Level 10 erreicht' },
  { id: 'half-way', emoji: '⛰️', name: 'Bergfest', description: 'Die Hälfte aller Inhalte gelernt' },
  { id: 'all-master', emoji: '🌐', name: 'Geo-Legende', description: 'ALLE Inhalte gemeistert' },
];

export function badgeById(id: string): BadgeDef | undefined {
  return BADGES.find((b) => b.id === id);
}

function award(id: string, collected: string[]): void {
  if (!state.stats.badges.includes(id)) {
    state.stats.badges.push(id);
    collected.push(id);
  }
}

/** Streak fortschreiben — beim Abschluss einer Runde aufrufen. */
function updateStreak(): void {
  const today = todayKey();
  const s = state.stats;
  if (s.lastStudyDay === today) return;
  const yesterday = todayKey(new Date(Date.now() - 86400000));
  s.streak = s.lastStudyDay === yesterday ? s.streak + 1 : 1;
  s.bestStreak = Math.max(s.bestStreak, s.streak);
  s.lastStudyDay = today;
}

/** Liegt jetzt ±45 min um eine der eingestellten Lernzeiten? */
function isWithinStudyTime(now = new Date()): boolean {
  const times = state.profile?.studyTimes ?? [];
  const mins = now.getHours() * 60 + now.getMinutes();
  return times.some((t) => {
    const [h, m] = t.split(':').map(Number);
    return Math.abs(mins - (h * 60 + m)) <= 45;
  });
}

/** Verbucht eine abgeschlossene Runde: XP, Streak, Badges, Kisten.
 *  Gibt das Ergebnis für den Results-Screen zurück. */
export function finishRound(input: {
  chapterId: string;
  total: number;
  correct: number;
  xpGained: number;
  bestCombo: number;
}): RoundResult {
  const s = state.stats;
  const levelBefore = levelForXp(s.xp);

  s.xp += input.xpGained;
  s.rounds++;
  todayLog().xp += input.xpGained;
  updateStreak();

  const newBadges: string[] = [];
  award('first-round', newBadges);
  if (input.correct === input.total && input.total > 0) award('perfect-round', newBadges);
  if (input.bestCombo >= 10) award('combo-10', newBadges);
  for (const n of [3, 7, 14, 30]) if (s.streak >= n) award(`streak-${n}`, newBadges);
  const hour = new Date().getHours();
  if (hour < 8) award('early-bird', newBadges);
  if (hour >= 21) award('night-owl', newBadges);
  if (isWithinStudyTime()) award('on-schedule', newBadges);
  if (s.xp >= 1000) award('xp-1000', newBadges);
  if (s.xp >= 5000) award('xp-5000', newBadges);
  const level = levelForXp(s.xp);
  if (level >= 5) award('level-5', newBadges);
  if (level >= 10) award('level-10', newBadges);

  // Kapitel-Kisten: 100 % Mastery schaltet die Schatzkiste frei.
  const unlockedChests: string[] = [];
  for (const ch of CHAPTERS) {
    if (conceptsOf(ch.id).length === 0) continue;
    if (s.openedChests.includes(ch.id)) continue;
    if (chapterMastery(ch.id) >= 1) {
      s.openedChests.push(ch.id);
      unlockedChests.push(ch.id);
    }
  }

  // Gesamt-Badges nach Kisten-Check
  const learnedAll = CHAPTERS.every((ch) => {
    const n = conceptsOf(ch.id).length;
    return n > 0 && learnedCount(ch.id) === n;
  });
  const totalConcepts = CHAPTERS.reduce((n, ch) => n + conceptsOf(ch.id).length, 0);
  const learnedTotal = CHAPTERS.reduce((n, ch) => n + learnedCount(ch.id), 0);
  if (totalConcepts > 0 && learnedTotal >= totalConcepts / 2) award('half-way', newBadges);
  if (learnedAll) award('all-master', newBadges);

  // Notensprung: gefeiert wird nur eine neue Bestnote. Ein Vergleich mit dem Stand
  // beim Rundenstart würde bei jedem Auf und Ab erneut auslösen, und eine 6 ist kein
  // Anlass zum Feiern — sie kommt allein daher, dass der Rest noch offen ist.
  const gradeAfter = estimatedGrade();
  const isRecord =
    gradeAfter !== null &&
    gradeAfter <= WORST_NAMED_GRADE &&
    (s.bestGrade === null || gradeAfter < s.bestGrade);
  if (isRecord) s.bestGrade = gradeAfter;

  save();

  return {
    chapterId: input.chapterId,
    total: input.total,
    correct: input.correct,
    xpGained: input.xpGained,
    bestCombo: input.bestCombo,
    leveledUpTo: level > levelBefore ? level : null,
    newBadges,
    unlockedChests,
    newBestGrade: isRecord ? gradeAfter : null,
  };
}
