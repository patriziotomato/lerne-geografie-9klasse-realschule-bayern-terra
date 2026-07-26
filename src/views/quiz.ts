import { navigate, bottomNav } from '../router.ts';
import { esc, vibrate } from '../ui.ts';
import {
  pickRound,
  applyAnswer,
  excludeTopic,
  addTodo,
  plannedConceptsOf,
  plannedConcepts,
  MERK_ROUND,
  ROUND_SIZE,
  type RoundItem,
} from '../logic/leitner.ts';
import { xpForAnswer, PERFECT_BONUS, finishRound } from '../logic/gamification.ts';
import { recordAnswer } from '../logic/session.ts';
import { chapterById, roundLabel } from '../data/chapters.ts';
import type { RoundResult } from '../types.ts';
import { state } from '../store.ts';

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
  /** Wie viele Fragen ungewertet aus der Runde geflogen sind (🚫 / 📌) */
  dropped: number;
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
      renderEmpty(root, chapterId);
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
      dropped: 0,
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
  const label = roundLabel(r.chapterId);
  // Mix- und Merkliste-Runden springen zwischen Kapiteln — ohne den Zusatz weiß
  // man nicht, aus welchem Kapitel die Frage kommt.
  const mixed = r.chapterId === 'mix' || r.chapterId === MERK_ROUND;
  const sub = mixed ? ` · ${chapterById(item.chapterId)?.short ?? ''}` : '';
  const isMerk = r.chapterId === MERK_ROUND;

  root.innerHTML = `
    <header class="quiz-head">
      <a class="btn icon" href="${isMerk ? '#/merkliste' : '#/chapters'}" aria-label="Abbrechen">✕</a>
      <div class="quiz-progress" role="progressbar" aria-valuemin="0" aria-valuemax="${r.items.length}" aria-valuenow="${r.index}">
        ${r.items.map((_, i) => `<span class="qdot ${i < r.index ? 'done' : i === r.index ? 'now' : ''}"></span>`).join('')}
      </div>
      <div class="combo ${r.combo >= 3 ? 'hot' : ''}">${r.combo >= 2 ? `⚡${r.combo}` : ''}</div>
    </header>

    <div class="quiz-body">
      <div class="quiz-chapter">${label.emoji} ${esc(label.short)}${esc(sub)} · Frage ${r.index + 1}/${r.items.length}</div>
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
      <div class="qa-flag">
        <button class="btn ghost small" id="flag-open" aria-expanded="false">🙋 Thema noch nicht dran?</button>
        <div class="qa-flag-panel" id="flag-panel" hidden>
          <div class="muted small">Thema: <strong>${esc(item.concept.topic)}</strong></div>
          <button class="btn ghost" id="flag-skip">🚫 Das Thema hatten wir noch nicht</button>
          ${isMerk ? '' : '<button class="btn ghost" id="flag-todo">📌 Das muss ich noch lernen</button>'}
          <p class="muted tiny">Beides kannst du im Themenkatalog wieder ändern.</p>
        </div>
      </div>
      <div id="feedback"></div>
    </div>`;

  root.querySelectorAll<HTMLButtonElement>('.answer').forEach((btn) => {
    btn.addEventListener('click', () => answer(root, btn));
  });
  bindFlag(root);
}

/** Die zwei Themen-Aktionen. Sie stehen bewusst nur zur Verfügung, solange noch
 *  nicht geantwortet wurde: nach applyAnswer() sind Box, lastSeen und die
 *  Tageszähler nicht mehr treu rücknehmbar, und bei richtiger Antwort wäre der
 *  Button gegen den 1,2-s-Timer plus scrollIntoView praktisch nicht treffbar. */
function bindFlag(root: HTMLElement): void {
  const panel = root.querySelector<HTMLElement>('#flag-panel');
  const openBtn = root.querySelector<HTMLButtonElement>('#flag-open');
  if (!panel || !openBtn) return;

  openBtn.addEventListener('click', () => {
    const open = panel.hidden;
    panel.hidden = !open;
    openBtn.setAttribute('aria-expanded', String(open));
  });

  root.querySelector<HTMLButtonElement>('#flag-skip')?.addEventListener('click', () => {
    const id = round!.items[round!.index].concept.id;
    if (!excludeTopic(id)) {
      panel.innerHTML = '<p class="error">Mindestens ein Thema muss im Lernplan bleiben.</p>';
      return;
    }
    dropCurrent(root, '#/home');
  });

  root.querySelector<HTMLButtonElement>('#flag-todo')?.addEventListener('click', () => {
    addTodo(round!.items[round!.index].concept.id);
    dropCurrent(root, '#/merkliste');
  });
}

/** Das aktuelle Thema verlässt die Runde, ohne gewertet zu werden.
 *
 *  Das gedroppte Item steht AN r.index — nach dem Filtern rutscht das nächste auf
 *  diesen Platz, r.index darf also NICHT hochgezählt werden (anders als in
 *  goNext()). Items vor r.index sind schon beantwortet und bleiben drin, ihre
 *  Punkte stecken bereits in r.correct/r.xp.
 *
 *  Herausgeschnitten statt nur übersprungen: sonst müssten Fortschrittspunkte,
 *  aria-valuemax, „Frage x/y", das `last` in answer() und total/perfect in
 *  finishRound() alle dieselbe gefilterte Anzahl kennen. So stimmen sie von selbst,
 *  und die Lernerin sieht eine ehrliche 9er-Runde. */
function dropCurrent(root: HTMLElement, emptyHash: string): void {
  const r = round!;
  clearAdvance();
  const id = r.items[r.index].concept.id;
  // Nach Konzept-ID filtern, nicht nach Index: bliebe korrekt, falls eine Runde
  // irgendwann mehrere Items desselben Themas enthalten kann.
  r.items = r.items.filter((it, i) => i < r.index || it.concept.id !== id);
  r.dropped++;
  r.answered = false;

  if (r.index >= r.items.length) {
    // Wurde vorher schon geantwortet, ist es eine echte, nur kürzere Runde.
    // Ohne eine einzige Antwort gibt es nichts zu verbuchen: finishRound() würde
    // Streak, Runden-Zähler und das „erste Runde"-Badge für null Antworten
    // vergeben, und der Ergebnis-Screen zeigte 0/0 als „PERFEKT 💯".
    if (r.items.length === 0) {
      round = null;
      navigate(emptyHash);
      return;
    }
    finishAndGoToResults();
    return;
  }
  renderQuestion(root);
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
  // Ab jetzt ist die Antwort verbucht und nicht mehr treu rücknehmbar.
  root.querySelector('.qa-flag')?.remove();

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

  const { todoCleared } = applyAnswer(item, isCorrect);
  recordAnswer(isCorrect, gained);

  const last = r.index === r.items.length - 1;
  const feedback = root.querySelector('#feedback')!;
  feedback.innerHTML = `
    <div class="feedback ${isCorrect ? 'ok' : 'bad'}">
      <div class="fb-head">${isCorrect ? `Richtig! +${gained} XP ${r.combo >= 3 ? '⚡' : '🎉'}` : 'Leider falsch 😅'}</div>
      <div class="fb-expl">${esc(item.variant.explanation)}</div>
      ${todoCleared ? '<div class="fb-expl">📌 Gelernt! Das Thema ist von deiner Merkliste abgehakt.</div>' : ''}
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
    if (r.index >= r.items.length) finishAndGoToResults();
    else renderQuestion(root);
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

/** Runde abrechnen und zum Ergebnis. Wird sowohl vom Weiter-Button als auch von
 *  dropCurrent() genutzt, wenn das letzte Item aus der Runde geflogen ist. */
function finishAndGoToResults(): void {
  const r = round!;
  // r.items enthält am Rundenende genau die beantworteten Fragen — gedroppte sind
  // herausgeschnitten. Die dropped-Bedingung verhindert, dass man sich den
  // Perfekt-Bonus holt, indem man 9 von 10 Fragen wegklickt.
  const perfect = r.correct === r.items.length && r.dropped === 0;
  const totalXp = r.xp + (perfect ? PERFECT_BONUS : 0);
  lastResult = finishRound({
    chapterId: r.chapterId,
    total: r.items.length,
    correct: r.correct,
    perfect,
    xpGained: totalXp,
    bestCombo: r.bestCombo,
  });
  if (perfect && state.stats.sessions.length > 0) {
    // Bonus-XP auch in der Session verbuchen
    state.stats.sessions[state.stats.sessions.length - 1].xp += PERFECT_BONUS;
  }
  round = null;
  navigate('#/results');
}

/** Kein Nachschub. Seit man einzelne Unterthemen ausnehmen kann, ist dieser Fall
 *  gut erreichbar — ein stiller Rücksprung läse sich wie ein kaputter Tipp. */
function renderEmpty(root: HTMLElement, chapterId: string): void {
  const isChapter = chapterId !== 'mix' && chapterId !== MERK_ROUND;
  const planned = isChapter ? plannedConceptsOf(chapterId).length : plannedConcepts().length;
  const parkedOnTodo = planned > 0;

  let emoji = '🗂️';
  let title = 'Hier ist gerade nichts zu üben';
  let text = '';
  let actions = '<a class="btn primary big" href="#/topics">🗂️ Themenkatalog öffnen</a>';

  if (chapterId === MERK_ROUND) {
    emoji = '🎉';
    title = 'Deine Merkliste ist leer';
    text = 'Nichts vorgemerkt — du bist auf dem Stand. Vorgemerkte Themen landen hier, sobald du in einer Runde auf 🙋 tippst.';
    actions = `
      <a class="btn primary big" href="#/quiz/mix">🎲 Mix üben</a>
      <a class="btn ghost big" href="#/home">Zur Übersicht</a>`;
  } else if (parkedOnTodo) {
    emoji = '📌';
    title = isChapter
      ? 'Alle Themen dieses Kapitels stehen auf deiner Merkliste'
      : 'Alle Themen deines Lernplans stehen auf deiner Merkliste';
    text = 'Sie ruhen in normalen Runden, bis du sie abhakst. Übe sie gezielt über die Merkliste.';
    actions = `
      <a class="btn primary big" href="#/quiz/merkliste">📌 Merkliste üben</a>
      <a class="btn ghost big" href="#/merkliste">Merkliste ansehen</a>`;
  } else if (isChapter) {
    emoji = '🚫';
    title = 'Alle Themen dieses Kapitels sind ausgenommen';
    text = 'Du hast alle Unterthemen dieses Kapitels als „hatten wir noch nicht" markiert. Im Themenkatalog kannst du sie wieder aufnehmen.';
    actions = `
      <a class="btn primary big" href="#/topics/${encodeURIComponent(chapterId)}">🗂️ Unterthemen dieses Kapitels</a>
      <a class="btn ghost big" href="#/chapters">Zu den Kapiteln</a>`;
  } else {
    emoji = '🚫';
    title = 'Dein Lernplan ist leer';
    text = 'Es ist kein Unterthema mehr im Lernplan. Nimm im Themenkatalog wieder Themen auf.';
  }

  root.innerHTML = `
    <header class="page-head"><h1>${emoji} ${esc(title)}</h1></header>
    <section class="card">
      <p class="muted">${esc(text)}</p>
      ${actions}
    </section>
    ${bottomNav('chapters')}`;
}
