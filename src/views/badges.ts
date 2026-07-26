import { bottomNav } from '../router.ts';
import { esc } from '../ui.ts';
import { BADGES } from '../logic/gamification.ts';
import { CHAPTERS } from '../data/chapters.ts';
import { state } from '../store.ts';

export function renderBadges(root: HTMLElement): void {
  const owned = new Set(state.stats.badges);
  const chests = new Set(state.stats.openedChests);

  root.innerHTML = `
    <header class="page-head"><h1>🏆 Erfolge</h1><p class="muted">Deine Sammlung — hol dir alle!</p></header>

    <section class="card">
      <div class="card-title">🎁 Kapitel-Kisten</div>
      <div class="chest-gallery">
        ${CHAPTERS.map((ch) => {
          const open = chests.has(ch.id);
          return `
          <div class="chest-slot ${open ? 'open' : 'locked'}" title="${esc(ch.title)}">
            <div class="chest-slot-emoji">${open ? ch.chestBadge.emoji : '🎁'}</div>
            <div class="chest-slot-name">${open ? esc(ch.chestBadge.name) : esc(ch.short)}</div>
            <div class="muted tiny">${open ? 'Freigeschaltet!' : 'Kapitel zu 100 % lernen'}</div>
          </div>`;
        }).join('')}
      </div>
    </section>

    <section class="card">
      <div class="card-title">🎖️ Abzeichen (${owned.size}/${BADGES.length})</div>
      <div class="badge-grid">
        ${BADGES.map((b) => {
          const has = owned.has(b.id);
          return `
          <div class="badge-slot ${has ? 'owned' : 'locked'}">
            <div class="badge-slot-emoji">${has ? b.emoji : '🔒'}</div>
            <div class="badge-slot-name">${esc(b.name)}</div>
            <div class="muted tiny">${esc(b.description)}</div>
          </div>`;
        }).join('')}
      </div>
    </section>
    ${bottomNav('badges')}`;
}
