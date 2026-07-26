import { state, save } from '../store.ts';
import { navigate } from '../router.ts';
import { esc } from '../ui.ts';
import { gradePicker, bindGradePicker } from './gradePicker.ts';
import { requestPermission } from '../logic/reminders.ts';
import { TOTAL_CONCEPTS } from '../data/content.ts';

/** 4-Schritte-Onboarding: Wer bist du? → Bis wann? → Welche Note? → Wann lernst du? */

interface Draft {
  firstName: string;
  phone: string;
  deadline: string;
  targetGrade: number;
  studyTimes: string[];
}

const draft: Draft = {
  firstName: '',
  phone: '',
  deadline: defaultDeadline(),
  targetGrade: 2,
  studyTimes: ['14:30', '20:30'],
};

let step = 0;

function defaultDeadline(): string {
  const d = new Date(Date.now() + 28 * 86400000);
  return d.toISOString().slice(0, 10);
}

function minDeadline(): string {
  return new Date(Date.now() + 86400000).toISOString().slice(0, 10);
}

const STEPS = [renderStep1, renderStep2, renderStep3, renderStep4];

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
    <p class="muted">Dein Trainer für Geografie, 9. Klasse — ${TOTAL_CONCEPTS} Inhalte warten auf dich. Sag kurz, wer du bist:</p>
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
  return `
    <div class="ob-hero">🗓️</div>
    <h1>Bis wann musst du<br>fit sein?</h1>
    <p class="muted">Zum Beispiel der Tag der Schulaufgabe. Daraus berechne ich dein Tagespensum, damit du entspannt rechtzeitig fertig wirst.</p>
    <label class="field">
      <span>Mein Lernziel-Datum</span>
      <input id="ob-deadline" type="date" value="${draft.deadline}" min="${minDeadline()}" />
    </label>
    <p class="error" id="ob-error" hidden></p>
    <div class="ob-nav">
      <button class="btn ghost" id="ob-back">Zurück</button>
      <button class="btn primary big" id="ob-next">Weiter 👉</button>
    </div>`;
}

function renderStep3(): string {
  return `
    <div class="ob-hero">🎯</div>
    <h1>Welche Note<br>willst du schreiben?</h1>
    <p class="muted">Danach richte ich deinen Lernfortschritt aus: Ich sage dir künftig, für welche Note dein Lernstand gerade reicht — und wie weit es noch bis zu deiner Wunschnote ist. Änderbar bleibt das jederzeit in den Einstellungen.</p>
    ${gradePicker(draft.targetGrade)}
    <div class="ob-nav">
      <button class="btn ghost" id="ob-back">Zurück</button>
      <button class="btn primary big" id="ob-next">Weiter 👉</button>
    </div>`;
}

function renderStep4(): string {
  return `
    <div class="ob-hero">⏰</div>
    <h1>Wann willst du<br>lernen?</h1>
    <p class="muted">Wähl feste Zeiten — ich erinnere dich und dein Kalender kann es auch. Kurze Runden reichen: 10 Fragen ≈ 5 Minuten.</p>
    <div id="ob-times">${renderTimes()}</div>
    <button class="btn ghost small" id="ob-add-time">+ Zeit hinzufügen</button>
    <p class="error" id="ob-error" hidden></p>
    <div class="ob-nav">
      <button class="btn ghost" id="ob-back">Zurück</button>
      <button class="btn primary big" id="ob-done">Los geht's! 🚀</button>
    </div>`;
}

function renderTimes(): string {
  return draft.studyTimes
    .map(
      (t, i) => `
      <div class="time-row">
        <input type="time" value="${t}" data-idx="${i}" class="ob-time" />
        ${draft.studyTimes.length > 1 ? `<button class="btn icon ob-del-time" data-idx="${i}" aria-label="Zeit entfernen">✕</button>` : ''}
      </div>`,
    )
    .join('');
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
    if (step === 1) {
      const dl = (root.querySelector('#ob-deadline') as HTMLInputElement).value;
      if (!dl || dl < minDeadline()) return showError(root, 'Wähl ein Datum in der Zukunft.');
      draft.deadline = dl;
    }
    // Schritt 3 (Zielnote) braucht keine Prüfung — es ist immer eine Note gewählt.
    step++;
    renderOnboarding(root);
  });

  bindGradePicker(root, (grade) => {
    draft.targetGrade = grade;
    renderOnboarding(root);
  });

  root.querySelectorAll<HTMLInputElement>('.ob-time').forEach((input) => {
    input.addEventListener('change', () => {
      draft.studyTimes[Number(input.dataset.idx)] = input.value || '14:30';
    });
  });
  root.querySelectorAll<HTMLButtonElement>('.ob-del-time').forEach((btn) => {
    btn.addEventListener('click', () => {
      draft.studyTimes.splice(Number(btn.dataset.idx), 1);
      renderOnboarding(root);
    });
  });
  root.querySelector('#ob-add-time')?.addEventListener('click', () => {
    if (draft.studyTimes.length < 4) draft.studyTimes.push('17:00');
    renderOnboarding(root);
  });

  root.querySelector('#ob-done')?.addEventListener('click', async () => {
    const times = [...new Set(draft.studyTimes)].sort();
    if (times.length === 0) return showError(root, 'Mindestens eine Lernzeit brauchst du.');
    state.profile = {
      firstName: draft.firstName,
      phone: draft.phone,
      deadline: draft.deadline,
      studyTimes: times,
      targetGrade: draft.targetGrade,
      createdAt: new Date().toISOString(),
    };
    save();
    await requestPermission(); // freundlich fragen; Ablehnung ist ok
    navigate('#/home');
  });
}
