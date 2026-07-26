import { state, save } from '../store.ts';
import { navigate } from '../router.ts';
import { esc } from '../ui.ts';
import { gradePicker, bindGradePicker } from './gradePicker.ts';
import { CHAPTERS } from '../data/chapters.ts';
import { conceptsOf } from '../data/content.ts';

/** 3-Schritte-Onboarding: Wer bist du? → Was willst du lernen? → Welche Note?
 *  Lernziel-Datum und Lernzeiten sind optional und werden später in den
 *  Einstellungen gesetzt. */

interface Draft {
  firstName: string;
  phone: string;
  chapters: Set<string>;
  targetGrade: number;
}

const draft: Draft = {
  firstName: '',
  phone: '',
  chapters: new Set(CHAPTERS.map((c) => c.id)), // Default: Alle Inhalte
  targetGrade: 2,
};

let step = 0;

const STEPS = [renderStep1, renderStep2, renderStep3];

export function renderOnboarding(root: HTMLElement): void {
  root.innerHTML = `
    <div class="onboarding">
      <div class="ob-progress">
        ${STEPS.map((_, i) => `<span class="ob-dot ${i <= step ? 'on' : ''}"></span>`).join('')}
      </div>
      <div class="ob-body">${STEPS[step]()}</div>
    </div>`;
  bind(root);
}

function renderStep1(): string {
  return `
    <div class="ob-hero">🌍</div>
    <h1>Hi! Bereit für<br><span class="grad">Geo-Quest</span>?</h1>
    <p class="muted">Dein Trainer für Geografie, 9. Klasse. Sag kurz, wer du bist:</p>
    <label class="field">
      <span>Dein Vorname</span>
      <input id="ob-name" type="text" autocomplete="given-name" placeholder="z. B. Lena" value="${esc(draft.firstName)}" maxlength="30" />
    </label>
    <label class="field">
      <span>Deine Handynummer</span>
      <input id="ob-phone" type="tel" autocomplete="tel" inputmode="tel" placeholder="z. B. 0151 2345678" value="${esc(draft.phone)}" maxlength="20" />
      <small class="muted">Bleibt auf deinem Gerät. Später können wir dich damit per SMS erinnern.</small>
    </label>
    <p class="error" id="ob-error" hidden></p>
    <button class="btn primary big" id="ob-next">Weiter 👉</button>`;
}

function renderStep2(): string {
  const allSelected = draft.chapters.size === CHAPTERS.length;
  const selectedConcepts = [...draft.chapters].reduce((n, id) => n + conceptsOf(id).length, 0);
  return `
    <div class="ob-hero">🎯</div>
    <h1>Was willst du<br>lernen?</h1>
    <p class="muted">Wähl deine Themenblöcke — du kannst das jederzeit ändern.</p>

    <button class="topic-all ${allSelected ? 'on' : ''}" id="ob-all">
      <span class="topic-all-emoji">🌍</span>
      <span class="topic-all-text"><strong>Alle Inhalte</strong><br><small>Das komplette Schuljahr</small></span>
      <span class="topic-check">${allSelected ? '✓' : ''}</span>
    </button>

    <div class="topic-grid">
      ${CHAPTERS.map((ch) => {
        const on = draft.chapters.has(ch.id);
        return `
        <button class="topic-card ${on ? 'on' : ''}" data-id="${ch.id}">
          <span class="topic-emoji">${ch.emoji}</span>
          <span class="topic-name">${esc(ch.short)}</span>
          <span class="topic-check">${on ? '✓' : ''}</span>
        </button>`;
      }).join('')}
    </div>

    <p class="muted small center" id="ob-count">${draft.chapters.size} Themenblöcke · ${selectedConcepts} Inhalte ausgewählt</p>
    <p class="error" id="ob-error" hidden></p>
    <div class="ob-nav">
      <button class="btn ghost" id="ob-back">Zurück</button>
      <button class="btn primary big" id="ob-next">Weiter 👉</button>
    </div>`;
}

function renderStep3(): string {
  return `
    <div class="ob-hero">📈</div>
    <h1>Welche Note<br>willst du schreiben?</h1>
    <p class="muted">Danach richte ich deinen Lernfortschritt aus: Ich sage dir künftig, für welche Note dein Lernstand gerade reicht — und wie weit es noch bis zu deiner Wunschnote ist. Änderbar bleibt das jederzeit in den Einstellungen.</p>
    ${gradePicker(draft.targetGrade)}
    <p class="error" id="ob-error" hidden></p>
    <div class="ob-nav">
      <button class="btn ghost" id="ob-back">Zurück</button>
      <button class="btn primary big" id="ob-done">Los geht's! 🚀</button>
    </div>`;
}

function showError(root: HTMLElement, msg: string): void {
  const el = root.querySelector<HTMLElement>('#ob-error');
  if (el) {
    el.textContent = msg;
    el.hidden = false;
  }
}

function bind(root: HTMLElement): void {
  root.querySelector('#ob-back')?.addEventListener('click', () => {
    step--;
    renderOnboarding(root);
  });

  root.querySelector('#ob-next')?.addEventListener('click', () => {
    if (step === 0) {
      const name = (root.querySelector('#ob-name') as HTMLInputElement).value.trim();
      const phone = (root.querySelector('#ob-phone') as HTMLInputElement).value.trim();
      if (name.length < 2) return showError(root, 'Sag mir bitte deinen Vornamen (min. 2 Zeichen).');
      if (!/^[+0-9][0-9 \-/]{5,}$/.test(phone)) return showError(root, 'Das sieht noch nicht nach einer Handynummer aus.');
      draft.firstName = name;
      draft.phone = phone;
    }
    if (step === 1 && draft.chapters.size === 0) {
      return showError(root, 'Wähl mindestens einen Themenblock.');
    }
    step++;
    renderOnboarding(root);
  });

  root.querySelector('#ob-all')?.addEventListener('click', () => {
    if (draft.chapters.size === CHAPTERS.length) draft.chapters.clear();
    else draft.chapters = new Set(CHAPTERS.map((c) => c.id));
    renderOnboarding(root);
  });

  root.querySelectorAll<HTMLButtonElement>('.topic-card').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id!;
      if (draft.chapters.has(id)) draft.chapters.delete(id);
      else draft.chapters.add(id);
      renderOnboarding(root);
    });
  });

  // Schritt 3 (Zielnote) braucht keine Prüfung — es ist immer eine Note gewählt.
  bindGradePicker(root, (grade) => {
    draft.targetGrade = grade;
    renderOnboarding(root);
  });

  root.querySelector('#ob-done')?.addEventListener('click', () => {
    if (draft.chapters.size === 0) return showError(root, 'Wähl mindestens einen Themenblock.');
    state.profile = {
      firstName: draft.firstName,
      phone: draft.phone,
      deadline: null,
      studyTimes: [],
      chapters: [...draft.chapters],
      targetGrade: draft.targetGrade,
      createdAt: new Date().toISOString(),
    };
    save();
    navigate('#/home');
  });
}
