import { bottomNav } from '../router.ts';
import { esc } from '../ui.ts';
import { chapterById } from '../data/chapters.ts';
import {
  MAX_BOX,
  todoConcepts,
  removeTodo,
  excludeTopic,
  type ConceptEntry,
} from '../logic/leitner.ts';
import { state } from '../store.ts';

/** Merkliste: Unterthemen, die noch gelernt werden müssen. Sie ruhen in normalen
 *  Runden, bleiben aber im Lernplan — gezielt geübt werden sie über #/quiz/merkliste. */
export function renderMerkliste(root: HTMLElement): void {
  const entries = todoConcepts();

  root.innerHTML = `
    <header class="page-head">
      <h1>📌 Merkliste</h1>
      <p class="muted">Themen, die du noch lernen musst. Sie ruhen in normalen Runden, bis du sie abhakst — im Fortschritt zählen sie weiter mit.</p>
    </header>

    ${entries.length === 0 ? emptyState() : list(entries)}

    ${bottomNav('home')}`;

  root.querySelectorAll<HTMLButtonElement>('.todo-done').forEach((btn) => {
    btn.addEventListener('click', () => {
      removeTodo(btn.dataset.id!);
      renderMerkliste(root);
    });
  });

  root.querySelectorAll<HTMLButtonElement>('.todo-skip').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (!excludeTopic(btn.dataset.id!)) {
        root.querySelector<HTMLElement>('#merk-err')!.hidden = false;
        return;
      }
      renderMerkliste(root);
    });
  });
}

function emptyState(): string {
  return `
    <section class="card">
      <div class="card-title">Nichts offen 🎉</div>
      <p class="muted small">Tippe während einer Runde auf <strong>🙋</strong> und dann auf <strong>📌 Das muss ich noch lernen</strong> — dann landet das Thema hier.</p>
      <a class="btn primary big" href="#/quiz/mix">🎲 Mix aus meinem Lernplan</a>
    </section>`;
}

function list(entries: ConceptEntry[]): string {
  // Nach Kapitel gruppieren, in der Reihenfolge, in der die Kapitel vorkommen.
  const byChapter = new Map<string, ConceptEntry[]>();
  for (const e of entries) {
    const bucket = byChapter.get(e.chapterId);
    if (bucket) bucket.push(e);
    else byChapter.set(e.chapterId, [e]);
  }

  return `
    <a class="btn primary big" href="#/quiz/merkliste">📌 Merkliste üben (${entries.length})</a>

    ${[...byChapter.entries()]
      .map(([chapterId, items]) => {
        const ch = chapterById(chapterId);
        return `
      <section class="card">
        <div class="card-title">${ch?.emoji ?? '📚'} ${esc(ch?.short ?? '')}</div>
        ${items
          .map((e) => {
            const box = state.progress[e.concept.id]?.box ?? 0;
            return `
          <div class="topic-row">
            <div class="topic-row-main">
              <div>${esc(e.concept.topic)}</div>
              <span class="muted small">Box ${box}/${MAX_BOX}</span>
            </div>
            <div class="topic-row-actions">
              <button class="btn ghost small todo-done" data-id="${e.concept.id}" title="Gelernt — von der Merkliste nehmen">✓ Gelernt</button>
              <button class="btn icon todo-skip" data-id="${e.concept.id}" aria-label="Thema ausnehmen — hatten wir noch nicht" title="Hatten wir noch nicht">🚫</button>
            </div>
          </div>`;
          })
          .join('')}
      </section>`;
      })
      .join('')}

    <p class="error" id="merk-err" hidden>Mindestens ein Thema muss im Lernplan bleiben.</p>
    <p class="muted small center">Themen verschwinden von der Liste, sobald du sie abhakst — oder automatisch, wenn du sie bis Box ${MAX_BOX} gemeistert hast.</p>`;
}
