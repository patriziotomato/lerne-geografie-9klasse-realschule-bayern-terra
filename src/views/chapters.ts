import { bottomNav } from '../router.ts';
import { esc, ring } from '../ui.ts';
import { CHAPTERS } from '../data/chapters.ts';
import { conceptsOf } from '../data/content.ts';
import { chapterMastery, learnedCount } from '../logic/leitner.ts';
import { state } from '../store.ts';

export function renderChapters(root: HTMLElement): void {
  root.innerHTML = `
    <header class="page-head"><h1>📚 Kapitel</h1><p class="muted">Terra Geografie 9 · Realschule Bayern</p></header>
    <div class="chapter-list">
      ${CHAPTERS.map((ch) => {
        const total = conceptsOf(ch.id).length;
        const learned = learnedCount(ch.id);
        const mastery = chapterMastery(ch.id);
        const chestOpen = state.stats.openedChests.includes(ch.id);
        return `
        <a class="card chapter-card" href="#/quiz/${ch.id}" style="--ch-color:${ch.color}">
          <div class="ch-emoji" aria-hidden="true">${ch.emoji}</div>
          <div class="ch-info">
            <div class="ch-title">${esc(ch.title)}</div>
            <div class="muted small">${esc(ch.description)}</div>
            <div class="ch-meta">
              <span class="pill">${learned}/${total} gelernt</span>
              <span class="pill chest ${chestOpen ? 'open' : ''}">${chestOpen ? `${ch.chestBadge.emoji} Kiste offen` : '🎁 Kiste zu'}</span>
            </div>
          </div>
          <div class="ch-ring">
            <div class="ring-wrap small">
              ${ring(mastery, 56, 7, ch.color, `${Math.round(mastery * 100)} % gemeistert`)}
              <div class="ring-center small">${Math.round(mastery * 100)}%</div>
            </div>
          </div>
        </a>`;
      }).join('')}
      <a class="btn ghost big" href="#/quiz/mix">🎲 Mix aus allen Kapiteln</a>
    </div>
    ${bottomNav('chapters')}`;
}
