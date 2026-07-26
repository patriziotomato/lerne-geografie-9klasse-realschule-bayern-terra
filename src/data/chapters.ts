import type { Chapter } from '../types.ts';

/** Kapitel-Metadaten. Titel/Reihenfolge lassen sich hier jederzeit an das
 *  Inhaltsverzeichnis des Terra-Buchs anpassen — die Fragen liegen in
 *  src/data/questions/<id>.json. */
export const CHAPTERS: Chapter[] = [
  {
    id: 'landschaften',
    title: 'Landschaften & Naturgefahren',
    short: 'Landschaften',
    emoji: '🏔️',
    color: '#3b82f6',
    description: 'Großlandschaften, Eiszeit, Küsten, Hochwasser & Co.',
    chestBadge: { emoji: '🗻', name: 'Landschafts-Legende' },
  },
  {
    id: 'arbeitstechniken',
    title: 'Geo-Arbeitstechniken',
    short: 'Arbeitstechniken',
    emoji: '🧭',
    color: '#8b5cf6',
    description: 'Karten, Maßstab, Gradnetz, Diagramme & GIS.',
    chestBadge: { emoji: '🗺️', name: 'Karten-Profi' },
  },
  {
    id: 'landwirtschaft',
    title: 'Landwirtschaft & Ernährung',
    short: 'Landwirtschaft',
    emoji: '🌾',
    color: '#f59e0b',
    description: 'Öko vs. konventionell, EU-Agrarpolitik, Welternährung.',
    chestBadge: { emoji: '🚜', name: 'Ernte-Meister:in' },
  },
  {
    id: 'staedte',
    title: 'Städtische Räume',
    short: 'Städte',
    emoji: '🏙️',
    color: '#ec4899',
    description: 'Berlin, München, Stadtentwicklung & Megastädte.',
    chestBadge: { emoji: '🌆', name: 'City-Champion' },
  },
  {
    id: 'bevoelkerung',
    title: 'Bevölkerung & Migration',
    short: 'Bevölkerung',
    emoji: '🧑‍🤝‍🧑',
    color: '#10b981',
    description: 'Demographischer Wandel, Push & Pull, Bevölkerungspolitik.',
    chestBadge: { emoji: '🌍', name: 'Demografie-Genie' },
  },
  {
    id: 'europa',
    title: 'Europa & Globalisierung',
    short: 'Europa',
    emoji: '🇪🇺',
    color: '#06b6d4',
    description: 'EU, Binnenmarkt, Global Players & Welthandel.',
    chestBadge: { emoji: '🚢', name: 'Weltenbummler:in' },
  },
];

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
