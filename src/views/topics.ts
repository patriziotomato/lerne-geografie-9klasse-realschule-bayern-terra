import { bottomNav } from '../router.ts';
import { esc } from '../ui.ts';
import { CHAPTERS, chapterById, bookRef } from '../data/chapters.ts';
import { conceptsOf } from '../data/content.ts';
import {
  MAX_BOX,
  isChapterActive,
  isExcluded,
  isTodo,
  excludeTopic,
  includeTopic,
  addTodo,
  removeTodo,
  toggleChapter,
  plannedConceptsOf,
} from '../logic/leitner.ts';
import { state } from '../store.ts';

/** Themenkatalog: Hauptthemen (Kapitel) in der Übersicht, Unterthemen im Detail.
 *
 *  Aufgeklappt wird über den Routen-Parameter statt über <details>: jeder Toggle
 *  rendert die View komplett neu und würde ein offenes <details> zuklappen. Der
 *  Parameter übersteht das kostenlos und hält jeden Screen bei ~22 statt 130 Zeilen. */
export function renderTopics(root: HTMLElement, chapterId?: string): void {
  if (chapterId && chapterById(chapterId)) renderChapterDetail(root, chapterId);
  else renderOverview(root);
}

function renderOverview(root: HTMLElement): void {
  root.innerHTML = `
    <header class="page-head">
      <h1>🗂️ Themenkatalog</h1>
      <p class="muted">Die Hauptthemen sind die Kapitel des Schulbuchs. Mit ⭐ ganz abwählen — oder einzelne Unterthemen ausnehmen, die im Unterricht noch nicht dran waren.</p>
    </header>

    ${CHAPTERS.map((ch) => {
      const all = conceptsOf(ch.id);
      const planned = plannedConceptsOf(ch.id).length;
      const todo = all.filter((c) => isTodo(c.id)).length;
      const active = isChapterActive(ch.id);
      return `
      <section class="card ${active ? '' : 'chapter-card inactive'}">
        <div class="topic-row">
          <div class="topic-row-main">
            <strong>${ch.emoji} ${esc(ch.title)}</strong><br>
            <span class="muted small">${bookRef(ch)}</span><br>
            <span class="muted small">${planned} von ${all.length} Unterthemen im Lernplan${todo > 0 ? ` · ${todo} auf der Merkliste` : ''}</span>
          </div>
          <div class="topic-row-actions">
            <button class="btn icon ch-toggle ${active ? 'on' : ''}" data-id="${ch.id}"
              aria-label="${active ? 'Hauptthema aus dem Lernplan entfernen' : 'Hauptthema zum Lernplan hinzufügen'}"
              title="${active ? 'Im Lernplan' : 'Nicht im Lernplan'}">${active ? '⭐' : '☆'}</button>
          </div>
        </div>
        ${active ? '' : '<p class="muted small">Ganzes Hauptthema nicht im Lernplan.</p>'}
        <a class="btn ghost small" href="#/topics/${encodeURIComponent(ch.id)}">Unterthemen zeigen →</a>
      </section>`;
    }).join('')}

    <a class="btn ghost" href="#/merkliste">📌 Merkliste</a>
    ${bottomNav('chapters')}`;

  root.querySelectorAll<HTMLButtonElement>('.ch-toggle').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (toggleChapter(btn.dataset.id!)) renderOverview(root);
    });
  });
}

function renderChapterDetail(root: HTMLElement, chapterId: string): void {
  const ch = chapterById(chapterId)!;
  const all = conceptsOf(chapterId);
  const planned = plannedConceptsOf(chapterId).length;

  root.innerHTML = `
    <header class="page-head">
      <a class="btn ghost small" href="#/topics">← Themenkatalog</a>
      <h1>${ch.emoji} ${esc(ch.title)}</h1>
      <p class="muted">${bookRef(ch)} · ${planned} von ${all.length} Unterthemen im Lernplan</p>
    </header>

    <section class="card">
      ${all
        .map((c) => {
          const excluded = isExcluded(c.id);
          const todo = isTodo(c.id);
          const box = state.progress[c.id]?.box ?? 0;
          const pill = excluded
            ? '<span class="pill off">Ausgenommen</span>'
            : todo
              ? '<span class="pill">📌 Merkliste</span>'
              : '';
          return `
        <div class="topic-row">
          <div class="topic-row-main">
            <div>${esc(c.topic)}</div>
            <span class="muted small">S.&nbsp;${c.source.page} · ${esc(c.source.lesson)}</span><br>
            <span class="muted small">Box ${box}/${MAX_BOX}${pill ? ' ' : ''}</span>${pill}
          </div>
          <div class="topic-row-actions">
            <button class="btn icon topic-skip" data-id="${c.id}"
              aria-label="${excluded ? 'Wieder in den Lernplan aufnehmen' : 'Thema ausnehmen — hatten wir noch nicht'}"
              title="${excluded ? 'Wieder aufnehmen' : 'Hatten wir noch nicht'}">${excluded ? '↩️' : '🚫'}</button>
            <button class="btn icon topic-todo" data-id="${c.id}"
              aria-label="${todo ? 'Von der Merkliste abhaken' : 'Auf die Merkliste setzen'}"
              title="${todo ? 'Gelernt — abhaken' : 'Muss ich noch lernen'}">${todo ? '✓' : '📌'}</button>
          </div>
        </div>`;
        })
        .join('')}
      <p class="error" id="topic-err" hidden>Mindestens ein Thema muss im Lernplan bleiben.</p>
      <button class="btn ghost small" id="topic-all">Alle Unterthemen wieder aufnehmen</button>
    </section>

    ${bottomNav('chapters')}`;

  const rerender = (): void => renderChapterDetail(root, chapterId);

  root.querySelectorAll<HTMLButtonElement>('.topic-skip').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id!;
      if (isExcluded(id)) {
        includeTopic(id);
      } else if (!excludeTopic(id)) {
        root.querySelector<HTMLElement>('#topic-err')!.hidden = false;
        return;
      }
      rerender();
    });
  });

  root.querySelectorAll<HTMLButtonElement>('.topic-todo').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id!;
      if (isTodo(id)) removeTodo(id);
      else addTodo(id);
      rerender();
    });
  });

  root.querySelector<HTMLButtonElement>('#topic-all')!.addEventListener('click', () => {
    for (const c of all) includeTopic(c.id);
    rerender();
  });
}
