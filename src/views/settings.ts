import { bottomNav } from '../router.ts';
import { esc, sha256Hex } from '../ui.ts';
import { versionLine } from '../version.ts';
import { gradePicker, bindGradePicker } from './gradePicker.ts';
import { state, save, resetAll, exportJson } from '../store.ts';
import { downloadIcs } from '../logic/ics.ts';
import { scheduleWhileOpen } from '../logic/reminders.ts';
import { requestPermission, notificationsSupported } from '../logic/notify.ts';
import { THEME_CHOICES, setTheme, resolvedTheme } from '../logic/theme.ts';
import type { ThemeChoice } from '../types.ts';
import { CHAPTERS } from '../data/chapters.ts';
import { plannedConceptCount, toggleChapter, todoConcepts } from '../logic/leitner.ts';

export function renderSettings(root: HTMLElement): void {
  const p = state.profile!;
  const st = state.settings;
  const notifState = notificationsSupported() ? Notification.permission : 'unsupported';

  root.innerHTML = `
    <header class="page-head"><h1>⚙️ Einstellungen</h1></header>

    <section class="card">
      <div class="card-title">Profil</div>
      <label class="field"><span>Vorname</span>
        <input id="set-name" type="text" value="${esc(p.firstName)}" maxlength="30" /></label>
      <label class="field"><span>Handynummer</span>
        <input id="set-phone" type="tel" value="${esc(p.phone)}" maxlength="20" />
        <small class="muted">Für spätere SMS-Erinnerungen — bleibt bis dahin nur auf diesem Gerät.</small></label>
      <label class="field"><span>Lernziel-Datum (optional)</span>
        <input id="set-deadline" type="date" value="${p.deadline ?? ''}" />
        <small class="muted">${p.deadline ? 'Daraus berechne ich dein Tagespensum.' : 'Kein Ziel gesetzt — z. B. der Tag der Schulaufgabe.'}</small></label>
      ${p.deadline ? '<button class="btn ghost small" id="set-deadline-clear">Ziel entfernen</button>' : ''}
      <div class="field"><span>Meine Zielnote</span>
        ${gradePicker(p.targetGrade)}
        <small class="muted">Danach richtet sich die Einschätzung auf der Startseite: für welche Note dein Lernstand gerade reicht.</small></div>
    </section>

    <section class="card">
      <div class="card-title">🎯 Meine Themen</div>
      <p class="muted small">Diese Themenblöcke zählen für Fortschritt, Mix-Runden und Tagespensum.</p>
      <div class="topic-grid">
        ${CHAPTERS.map((ch) => {
          const on = p.chapters.includes(ch.id);
          return `
          <button class="topic-card ${on ? 'on' : ''}" data-id="${ch.id}">
            <span class="topic-emoji">${ch.emoji}</span>
            <span class="topic-name">${esc(ch.short)}</span>
            <span class="topic-check">${on ? '✓' : ''}</span>
          </button>`;
        }).join('')}
      </div>
      <button class="btn ghost small" id="set-all-topics">🌍 Alle Inhalte auswählen</button>
      <p class="muted small">${p.chapters.length} Themenblöcke · ${plannedConceptCount()} Inhalte im Lernplan</p>
      <a class="btn ghost" href="#/topics">🗂️ Themenkatalog</a>
      <p class="muted small">Dort kannst du einzelne Unterthemen ausnehmen, die im Unterricht noch nicht dran waren.</p>
      <a class="btn ghost" href="#/merkliste">📌 Merkliste${todoConcepts().length > 0 ? ` (${todoConcepts().length})` : ''}</a>
    </section>

    <section class="card">
      <div class="card-title">Lernzeiten & Erinnerungen</div>
      ${p.studyTimes.length === 0 ? '<p class="muted small">Noch keine Lernzeiten — leg fest, wann du lernen willst (z. B. 14:30 und 20:30), dann können App und Kalender dich erinnern.</p>' : ''}
      <div id="set-times">
        ${p.studyTimes
          .map(
            (t, i) => `
          <div class="time-row">
            <input type="time" value="${t}" data-idx="${i}" class="set-time" />
            <button class="btn icon set-del-time" data-idx="${i}" aria-label="Zeit entfernen">✕</button>
          </div>`,
          )
          .join('')}
      </div>
      <button class="btn ghost small" id="set-add-time">+ Zeit hinzufügen</button>

      <label class="toggle-row">
        <span>Erinnerungen (bei geöffneter App)</span>
        <input type="checkbox" id="set-reminders" ${st.remindersEnabled ? 'checked' : ''} />
      </label>
      ${
        notifState === 'denied'
          ? '<p class="muted small">⚠️ Benachrichtigungen sind im Browser blockiert — in den Browser-Einstellungen erlauben.</p>'
          : notifState === 'default'
            ? '<button class="btn ghost small" id="set-perm">🔔 Benachrichtigungen erlauben</button>'
            : ''
      }
      ${
        p.studyTimes.length > 0
          ? `<button class="btn primary" id="set-ics">📅 Lernzeiten in Kalender eintragen (.ics)</button>
             <p class="muted small">Tipp: Der Kalender-Eintrag erinnert dich zuverlässig — auch wenn die App zu ist. Echte SMS-Erinnerungen kommen in einer späteren Version.</p>`
          : ''
      }
    </section>

    <section class="card">
      <div class="card-title">👨‍👩‍👧 Eltern-Bereich</div>
      <p class="muted small">Lernhistorie, Dauer und Fortschritt ansehen${st.parentPinHash ? ' (PIN gesetzt)' : ''}.</p>
      <a class="btn ghost" href="#/parents">Eltern-Bereich öffnen</a>
      <button class="btn ghost" id="set-pin">${st.parentPinHash ? 'PIN ändern' : 'PIN festlegen'}</button>
      ${st.parentPinHash ? '<button class="btn ghost" id="del-pin">PIN entfernen</button>' : ''}
    </section>

    <section class="card">
      <div class="card-title">Darstellung</div>
      <div class="field">
        <span>Farbschema</span>
        <div class="seg" role="group" aria-label="Farbschema">
          ${THEME_CHOICES.map(
            (c) => `
            <button type="button" class="seg-opt ${st.theme === c.value ? 'on' : ''}"
              data-theme-choice="${c.value}" aria-pressed="${st.theme === c.value}">${c.label}</button>`,
          ).join('')}
        </div>
        <small class="muted">${
          st.theme === 'system'
            ? `Folgt deinem Gerät — gerade ${resolvedTheme() === 'dark' ? 'dunkel' : 'hell'}.`
            : 'Gilt auf diesem Gerät, unabhängig von der Systemeinstellung.'
        }</small>
      </div>
    </section>

    <section class="card">
      <div class="card-title">Sonstiges</div>
      <label class="toggle-row">
        <span>Sound-Effekte</span>
        <input type="checkbox" id="set-sound" ${st.soundEnabled ? 'checked' : ''} />
      </label>
      <button class="btn ghost" id="set-export">💾 Daten exportieren (JSON)</button>
      <button class="btn danger" id="set-reset">🗑️ Alles zurücksetzen</button>
    </section>

    <p class="muted small center">Geo-Quest · Geografie 9 · Realschule Bayern (Terra)<br>Inhalte orientiert am LehrplanPLUS</p>
    <p class="muted tiny center">
      <button type="button" class="version-line" id="set-version">${esc(versionLine())}</button>
    </p>
    ${bottomNav('settings')}`;

  bind(root);
}

function bind(root: HTMLElement): void {
  const p = state.profile!;

  root.querySelector('#set-name')!.addEventListener('change', (e) => {
    const v = (e.target as HTMLInputElement).value.trim();
    if (v.length >= 2) {
      p.firstName = v;
      save();
    }
  });
  root.querySelector('#set-phone')!.addEventListener('change', (e) => {
    p.phone = (e.target as HTMLInputElement).value.trim();
    save();
  });
  root.querySelector('#set-deadline')!.addEventListener('change', (e) => {
    const v = (e.target as HTMLInputElement).value;
    p.deadline = v || null;
    save();
    renderSettings(root);
  });
  root.querySelector('#set-deadline-clear')?.addEventListener('click', () => {
    p.deadline = null;
    save();
    renderSettings(root);
  });

  root.querySelectorAll<HTMLButtonElement>('.topic-card').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (toggleChapter(btn.dataset.id!)) renderSettings(root);
    });
  });
  root.querySelector('#set-all-topics')!.addEventListener('click', () => {
    p.chapters = CHAPTERS.map((c) => c.id);
    save();
    renderSettings(root);
  });

  bindGradePicker(root, (grade) => {
    p.targetGrade = grade;
    save();
    renderSettings(root);
  });

  root.querySelectorAll<HTMLInputElement>('.set-time').forEach((input) => {
    input.addEventListener('change', () => {
      p.studyTimes[Number(input.dataset.idx)] = input.value || '14:30';
      p.studyTimes = [...new Set(p.studyTimes)].sort();
      save();
      scheduleWhileOpen();
      renderSettings(root);
    });
  });
  root.querySelectorAll<HTMLButtonElement>('.set-del-time').forEach((btn) => {
    btn.addEventListener('click', () => {
      p.studyTimes.splice(Number(btn.dataset.idx), 1);
      save();
      scheduleWhileOpen();
      renderSettings(root);
    });
  });
  root.querySelector('#set-add-time')!.addEventListener('click', () => {
    if (p.studyTimes.length < 4) {
      p.studyTimes.push('17:00');
      save();
      renderSettings(root);
    }
  });

  root.querySelector('#set-reminders')!.addEventListener('change', async (e) => {
    const on = (e.target as HTMLInputElement).checked;
    state.settings.remindersEnabled = on;
    save();
    if (on) await requestPermission();
    scheduleWhileOpen();
  });
  root.querySelector('#set-perm')?.addEventListener('click', async () => {
    await requestPermission();
    scheduleWhileOpen();
    renderSettings(root);
  });
  root.querySelector('#set-ics')?.addEventListener('click', downloadIcs);

  root.querySelectorAll<HTMLButtonElement>('.seg-opt').forEach((btn) => {
    btn.addEventListener('click', () => {
      setTheme(btn.dataset.themeChoice as ThemeChoice);
      renderSettings(root);
    });
  });

  root.querySelector('#set-sound')!.addEventListener('change', (e) => {
    state.settings.soundEnabled = (e.target as HTMLInputElement).checked;
    save();
  });

  root.querySelector('#set-pin')!.addEventListener('click', async () => {
    const pin = prompt('Neue Eltern-PIN (4–8 Ziffern):');
    if (!pin) return;
    if (!/^\d{4,8}$/.test(pin)) {
      alert('Bitte 4–8 Ziffern.');
      return;
    }
    state.settings.parentPinHash = await sha256Hex(pin);
    save();
    renderSettings(root);
  });
  root.querySelector('#del-pin')?.addEventListener('click', () => {
    state.settings.parentPinHash = null;
    save();
    renderSettings(root);
  });

  root.querySelector('#set-export')!.addEventListener('click', () => {
    const blob = new Blob([exportJson()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'geoquest-daten.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  });

  root.querySelector('#set-reset')!.addEventListener('click', () => {
    if (confirm('Wirklich ALLE Daten (Fortschritt, XP, Badges) löschen?')) resetAll();
  });

  // Antippen kopiert den Build-Stempel — damit muss man ihn für eine
  // Fehlermeldung nicht vom Handy abtippen.
  root.querySelector('#set-version')!.addEventListener('click', async (e) => {
    const btn = e.currentTarget as HTMLButtonElement;
    try {
      await navigator.clipboard.writeText(versionLine());
      btn.textContent = 'Version kopiert ✓';
      setTimeout(() => {
        btn.textContent = versionLine();
      }, 1600);
    } catch {
      // Zwischenablage verweigert (ältere Browser, kein HTTPS) — der Text
      // bleibt sichtbar und lässt sich normal markieren.
    }
  });
}
