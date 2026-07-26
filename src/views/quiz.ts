import { navigate } from '../router.ts';
import { esc, vibrate } from '../ui.ts';
import { pickRound, applyAnswer, type RoundItem } from '../logic/leitner.ts';
import { xpForAnswer, PERFECT_BONUS, finishRound } from '../logic/gamification.ts';
import { recordAnswer } from '../logic/session.ts';
import { chapterById } from '../data/chapters.ts';
import type { RoundResult } from '../types.ts';
import { state } from '../store.ts';

const ROUND_SIZE = 10;

/** Wartezeit, bevor nach einer richtigen Antwort automatisch weitergeblättert
 *  wird. Nach einer falschen Antwort läuft kein Timer — dort soll die Erklärung
 *  in Ruhe gelesen werden. */
const AUTO_ADVANCE_MS = 1200;

interface RoundState {
  chapterId: string;
  items: RoundItem[];
  index: number;
  correct: number;
  combo: number;
  bestCombo: number;
  xp: number;
  answered: boolean;
}

let round: RoundState | null = null;
let lastResult: RoundResult | null = null;
let advanceTimer: number | null = null;

function clearAdvance(): void {
  if (advanceTimer !== null) {
    clearTimeout(advanceTimer);
    advanceTimer = null;
  }
}

export function takeLastResult(): RoundResult | null {
  const r = lastResult;
  lastResult = null;
  return r;
}

export function renderQuiz(root: HTMLElement, chapterId = 'mix'): void {
  clearAdvance();

  // Neue Runde starten, wenn keine läuft oder das Kapitel wechselt
  if (!round || round.chapterId !== chapterId || round.index >= round.items.length) {
    const items = pickRound(chapterId, ROUND_SIZE);
    if (items.length === 0) {
      navigate('#/chapters');
      return;
    }
    round = {
      chapterId,
      items,
      index: 0,
      correct: 0,
      combo: 0,
      bestCombo: 0,
      xp: 0,
      answered: false,
    };
  }

  // Beim Wiedereinstieg in eine laufende Runde die Frage wieder freigeben:
  // renderQuestion() zeichnet frische, aktive Buttons, answered wäre aber noch
  // vom Abbrechen her gesetzt und würde jeden Klick verschlucken.
  round.answered = false;
  renderQuestion(root);
}

function renderQuestion(root: HTMLElement): void {
  const r = round!;
  const item = r.items[r.index];
  const ch = chapterById(item.chapterId);
  const title = r.chapterId === 'mix' ? '🎲 Mix' : `${ch?.emoji ?? ''} ${ch?.short ?? ''}`;

  root.innerHTML = `
    <header class="quiz-head">
      <a class="btn icon" href="#/chapters" aria-label="Abbrechen">✕</a>
      <div class="quiz-progress" role="progressbar" aria-valuemin="0" aria-valuemax="${r.items.length}" aria-valuenow="${r.index}">
        ${r.items.map((_, i) => `<span class="qdot ${i < r.index ? 'done' : i === r.index ? 'now' : ''}"></span>`).join('')}
      </div>
      <div class="combo ${r.combo >= 3 ? 'hot' : ''}">${r.combo >= 2 ? `⚡${r.combo}` : ''}</div>
    </header>

    <div class="quiz-body">
      <div class="quiz-chapter">${title} · Frage ${r.index + 1}/${r.items.length}</div>
      <h2 class="question">${esc(item.variant.text)}</h2>
      <div class="answers">
        ${item.optionOrder
          .map(
            (orig, display) => `
          <button class="answer" data-display="${display}" data-orig="${orig}">
            <span class="answer-key">${'ABCD'[display]}</span>
            <span>${esc(item.variant.options[orig])}</span>
          </button>`,
          )
          .join('')}
      </div>
      <div id="feedback"></div>
    </div>`;

  root.querySelectorAll<HTMLButtonElement>('.answer').forEach((btn) => {
    btn.addEventListener('click', () => answer(root, btn));
  });
}

function answer(root: HTMLElement, btn: HTMLButtonElement): void {
  const r = round!;
  if (r.answered) return;
  r.answered = true;

  const item = r.items[r.index];
  const isCorrect = Number(btn.dataset.orig) === 0;

  // Buttons einfrieren & einfärben
  root.querySelectorAll<HTMLButtonElement>('.answer').forEach((b) => {
    b.disabled = true;
    if (Number(b.dataset.orig) === 0) b.classList.add('correct');
  });

  let gained = 0;
  if (isCorrect) {
    gained = xpForAnswer(r.combo);
    r.combo++;
    r.bestCombo = Math.max(r.bestCombo, r.combo);
    r.correct++;
    r.xp += gained;
    btn.classList.add('correct');
    vibrate(30);
  } else {
    r.combo = 0;
    btn.classList.add('wrong');
    vibrate([60, 40, 60]);
  }

  applyAnswer(item, isCorrect);
  recordAnswer(isCorrect, gained);

  const last = r.index === r.items.length - 1;
  const feedback = root.querySelector('#feedback')!;
  feedback.innerHTML = `
    <div class="feedback ${isCorrect ? 'ok' : 'bad'}">
      <div class="fb-head">${isCorrect ? `Richtig! +${gained} XP ${r.combo >= 3 ? '⚡' : '🎉'}` : 'Leider falsch 😅'}</div>
      <div class="fb-expl">${esc(item.variant.explanation)}</div>
      <button class="btn primary big" id="next">${last ? 'Runde abschließen 🏁' : 'Weiter 👉'}</button>
      ${isCorrect ? '<div class="fb-autobar"><span></span></div>' : ''}
    </div>`;

  const nextBtn = feedback.querySelector<HTMLButtonElement>('#next')!;
  // Bei richtiger Antwort läuft gleich der Auto-Weiter-Timer — eine weiche
  // Scroll-Animation käme ihm dabei in die Quere.
  nextBtn.scrollIntoView({ behavior: isCorrect ? 'auto' : 'smooth', block: 'end' });

  let advanced = false;
  const goNext = (): void => {
    clearAdvance();
    // Der Router ersetzt beim Viewwechsel root.innerHTML; der gemerkte Button
    // hängt dann nicht mehr im Dokument. Ohne diese Prüfung könnte ein noch
    // laufender Timer nach "✕ Abbrechen" eine Runde weiterschalten oder
    // finishRound() ein zweites Mal auslösen.
    if (advanced || !nextBtn.isConnected) return;
    advanced = true;

    r.index++;
    r.answered = false;
    if (r.index >= r.items.length) {
      const perfect = r.correct === r.items.length;
      const totalXp = r.xp + (perfect ? PERFECT_BONUS : 0);
      lastResult = finishRound({
        chapterId: r.chapterId,
        total: r.items.length,
        correct: r.correct,
        xpGained: totalXp,
        bestCombo: r.bestCombo,
      });
      if (perfect && state.stats.sessions.length > 0) {
        // Bonus-XP auch in der Session verbuchen
        state.stats.sessions[state.stats.sessions.length - 1].xp += PERFECT_BONUS;
      }
      round = null;
      navigate('#/results');
    } else {
      renderQuestion(root);
    }
  };

  nextBtn.addEventListener('click', goNext);

  if (isCorrect) {
    // Wer die Erklärung doch lesen will, tippt irgendwo ins Feedback-Feld
    // (außerhalb des Weiter-Buttons) und stoppt damit den Countdown.
    feedback.querySelector('.feedback')!.addEventListener('click', (e) => {
      if (!(e.target as HTMLElement).closest('#next')) {
        clearAdvance();
        feedback.querySelector('.fb-autobar')?.remove();
      }
    });
    advanceTimer = window.setTimeout(goNext, AUTO_ADVANCE_MS);
  }
}
