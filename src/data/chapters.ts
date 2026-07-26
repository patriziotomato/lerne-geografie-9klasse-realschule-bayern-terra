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
