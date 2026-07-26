import { bottomNav } from '../router.ts';
import { esc, ring } from '../ui.ts';
import { CHAPTERS } from '../data/chapters.ts';
import { chapterMastery, learnedCount, isChapterActive, plannedConceptsOf, toggleChapter } from '../logic/leitner.ts';
import { state } from '../store.ts';

export function renderChapters(root: HTMLElement): void {
  root.innerHTML = `
    <header class="page-head"><h1>📚 Kapitel</h1><p class="muted">Terra Geografie 9 · Realschule Bayern — tippe ⭐, um Themen für deinen Lernplan zu wählen</p></header>
    <div class="chapter-list">
      ${CHAPTERS.map((ch) => {
        const total = plannedConceptsOf(ch.id).length;
        const learned = learnedCount(ch.id);
        const mastery = chapterMastery(ch.id);
        const chestOpen = state.stats.openedChests.includes(ch.id);
        const active = isChapterActive(ch.id);
        return `
        <a class="card chapter-card ${active ? '' : 'inactive'}" href="#/quiz/${ch.id}">
          <div class="ch-emoji" aria-hidden="true">${ch.emoji}</div>
          <div class="ch-info">
            <div class="ch-title">${esc(ch.title)}</div>
            <div class="muted small">${esc(ch.description)}</div>
            <div class="ch-meta">
              <span class="pill">${learned}/${total} gelernt</span>
              <span class="pill chest ${chestOpen ? 'open' : ''}">${chestOpen ? `${ch.chestBadge.emoji} Kiste offen` : '🎁 Kiste zu'}</span>
              ${active ? '' : '<span class="pill off">Nicht im Lernplan</span>'}
              ${total === 0 ? '<span class="pill off">Kein Thema im Lernplan</span>' : ''}
            </div>
          </div>
          <div class="ch-side">
            <button class="btn icon ch-toggle ${active ? 'on' : ''}" data-id="${ch.id}"
              aria-label="${active ? 'Aus dem Lernplan entfernen' : 'Zum Lernplan hinzufügen'}"
              title="${active ? 'Im Lernplan' : 'Nicht im Lernplan'}">${active ? '⭐' : '☆'}</button>
            <div class="ring-wrap small">
              ${ring(mastery, 56, 7, 'var(--accent)', `${Math.round(mastery * 100)} % gemeistert`)}
              <div class="ring-center small">${Math.round(mastery * 100)}%</div>
            </div>
          </div>
        </a>`;
      }).join('')}
      <a class="btn ghost big" href="#/quiz/mix">🎲 Mix aus meinem Lernplan</a>
      <a class="btn ghost" href="#/topics">🗂️ Themenkatalog: einzelne Unterthemen wählen</a>
    </div>
    ${bottomNav('chapters')}`;

  root.querySelectorAll<HTMLButtonElement>('.ch-toggle').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      // Der Button steckt in einem <a>, das ins Quiz führt.
      e.preventDefault();
      e.stopPropagation();
      if (toggleChapter(btn.dataset.id!)) renderChapters(root);
    });
  });
}
