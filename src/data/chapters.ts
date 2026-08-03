import type { Chapter } from '../types.ts';

/** Kapitel-Metadaten. Reihenfolge, Titel und Seitenbereiche folgen dem
 *  Inhaltsverzeichnis des Schulbuchs — die Fragen liegen in
 *  src/data/questions/<id>.json und tragen dort die Seitenzahl mit.
 *
 *  Die IDs sind bewusst nicht durchnummeriert: Sie sind der Schlüssel der
 *  Kapitelauswahl im Profil, eine Umbenennung würde sie zurücksetzen.
 *  `europa` heißt im Buch „Grenzen im Wandel“ — der Titel führt, nicht die ID. */
export const CHAPTERS: Chapter[] = [
  {
    id: 'landschaften',
    title: 'Landschaft und Naturrisiken',
    short: 'Landschaft',
    emoji: '🏔️',
    description: 'Schalenbau, Plattentektonik, Alpen bis Tiefland, Wald.',
    book: { chapter: 1, from: 4, to: 29 },
    chestBadge: { emoji: '🗻', name: 'Landschafts-Legende' },
  },
  {
    id: 'klima',
    title: 'Klima und Klimawandel',
    short: 'Klima',
    emoji: '🌡️',
    description: 'Wetterlagen, Treibhauseffekt, Meeresspiegel, Klimaschutz.',
    book: { chapter: 2, from: 30, to: 51 },
    chestBadge: { emoji: '❄️', name: 'Klima-Kenner:in' },
  },
  {
    id: 'landwirtschaft',
    title: 'Landwirtschaft – ein Blick über den Tellerrand',
    short: 'Landwirtschaft',
    emoji: '🌾',
    description: 'Globalisierte Landwirtschaft, Vermaisung, Gentechnik, Welternährung.',
    book: { chapter: 3, from: 52, to: 71 },
    chestBadge: { emoji: '🚜', name: 'Ernte-Meister:in' },
  },
  {
    id: 'staedte',
    title: 'Städtische Siedlungs- und Lebensräume',
    short: 'Städte',
    emoji: '🏙️',
    description: 'München, Île-de-France, Tokio, Curitiba & Verstädterung.',
    book: { chapter: 4, from: 72, to: 89 },
    chestBadge: { emoji: '🌆', name: 'City-Champion' },
  },
  {
    id: 'bevoelkerung',
    title: 'Bevölkerung und Migration',
    short: 'Bevölkerung',
    emoji: '🧑‍🤝‍🧑',
    description: 'Weltbevölkerung, Bayern, Migration, Integration, Tragfähigkeit.',
    book: { chapter: 5, from: 90, to: 117 },
    chestBadge: { emoji: '🌍', name: 'Demografie-Genie' },
  },
  {
    id: 'europa',
    title: 'Grenzen im Wandel',
    short: 'Grenzen',
    emoji: '🇪🇺',
    description: 'Europa wächst zusammen, adidas, neue Grenzen, EU-Bilanz.',
    book: { chapter: 6, from: 118, to: 131 },
    chestBadge: { emoji: '🚢', name: 'Weltenbummler:in' },
  },
];

/** „Kapitel 4 · S. 72–89“ — Buchbezug als Anzeigetext. */
export function bookRef(ch: Chapter): string {
  return `Kapitel ${ch.book.chapter} · S. ${ch.book.from}–${ch.book.to}`;
}

export function chapterById(id: string): Chapter | undefined {
  return CHAPTERS.find((c) => c.id === id);
}

/** Runden-Label: Emoji, Kurzname, Titel. */
export interface RoundLabel {
  emoji: string;
  short: string;
  title: string;
}

/** Runden-IDs, die kein echtes Kapitel sind — chapterById() liefert für sie
 *  undefined, die Quiz-Kopfzeile bliebe also leer. */
export const PSEUDO_CHAPTERS: Record<string, RoundLabel> = {
  mix: { emoji: '🎲', short: 'Mix', title: 'Mix aus meinem Lernplan' },
  merkliste: { emoji: '📌', short: 'Merkliste', title: 'Merkliste üben' },
};

/** Anzeige-Label einer Runde — echtes Kapitel oder Pseudo-Kapitel. */
export function roundLabel(chapterId: string): RoundLabel {
  const pseudo = PSEUDO_CHAPTERS[chapterId];
  if (pseudo) return pseudo;
  const ch = chapterById(chapterId);
  return ch ? { emoji: ch.emoji, short: ch.short, title: ch.title } : { emoji: '📚', short: '', title: '' };
}
