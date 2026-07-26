import { navigate, bottomNav } from '../router.ts';
import { esc, confetti, countUp, vibrate } from '../ui.ts';
import { takeLastResult } from './quiz.ts';
import { badgeById } from '../logic/gamification.ts';
import { chapterById } from '../data/chapters.ts';

export function renderResults(root: HTMLElement): void {
  const r = takeLastResult();
  if (!r) {
    navigate('#/home');
    return;
  }

  const ratio = r.total > 0 ? r.correct / r.total : 0;
  const perfect = r.correct === r.total;
  const headline = perfect
    ? 'PERFEKT! 💯'
    : ratio >= 0.7
      ? 'Stark! 💪'
      : ratio >= 0.4
        ? 'Weiter so! 👍'
        : 'Dranbleiben! 🌱';

  const retryHash = `#/quiz/${r.chapterId}`;

  root.innerHTML = `
    <div class="results">
      <div class="res-headline pop">${headline}</div>
      <div class="res-score">
        <span class="res-big">${r.correct}</span><span class="res-total">/${r.total}</span>
      </div>
      <div class="res-xp">+<span id="xp-count">0</span> XP${r.bestCombo >= 3 ? ` · beste Combo ⚡${r.bestCombo}` : ''}</div>

      ${r.leveledUpTo ? `<div class="res-levelup pop">🎉 LEVEL UP! Du bist jetzt Level ${r.leveledUpTo}!</div>` : ''}

      ${
        r.newBadges.length > 0
          ? `<div class="res-badges">
              ${r.newBadges
                .map((id) => {
                  const b = badgeById(id);
                  return b ? `<div class="badge-toast pop"><span class="badge-emoji">${b.emoji}</span><div><strong>${esc(b.name)}</strong><br><small class="muted">${esc(b.description)}</small></div></div>` : '';
                })
                .join('')}
            </div>`
          : ''
      }

      <div id="chest-area"></div>

      <div class="res-actions">
        <a class="btn primary big" href="${retryHash}">Nächste Runde 🔄</a>
        <a class="btn ghost big" href="#/home">Zur Übersicht</a>
      </div>
    </div>
    ${bottomNav('home')}`;

  countUp(root.querySelector('#xp-count') as HTMLElement, r.xpGained);
  if (perfect || r.leveledUpTo || r.newBadges.length > 0) confetti();

  // Schatzkisten nacheinander präsentieren
  const chestArea = root.querySelector('#chest-area') as HTMLElement;
  for (const chId of r.unlockedChests) {
    const ch = chapterById(chId);
    if (!ch) continue;
    const box = document.createElement('div');
    box.className = 'chest-cere';
    box.innerHTML = `
      <div class="chest-gift shake" role="button" tabindex="0" aria-label="Schatzkiste öffnen">🎁</div>
      <div class="muted">Kapitel <strong>${esc(ch.title)}</strong> komplett gelernt!<br>Tippe auf die Kiste!</div>`;
    chestArea.appendChild(box);
    const chest = box.querySelector('.chest-gift') as HTMLElement;
    const open = () => {
      vibrate([40, 30, 80]);
      confetti();
      box.innerHTML = `
        <div class="chest-open pop">${ch.chestBadge.emoji}</div>
        <div><strong>${esc(ch.chestBadge.name)}</strong><br><small class="muted">Neues Sammel-Badge freigeschaltet — sieh es dir unter „Erfolge" an!</small></div>`;
    };
    chest.addEventListener('click', open, { once: true });
    chest.addEventListener('keydown', (e) => {
      if ((e as KeyboardEvent).key === 'Enter') open();
    });
  }
}
