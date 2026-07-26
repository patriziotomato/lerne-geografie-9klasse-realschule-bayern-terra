import { bottomNav } from '../router.ts';
import { esc, fmtDate, fmtTime, sha256Hex } from '../ui.ts';
import { state, todayKey } from '../store.ts';
import { CHAPTERS } from '../data/chapters.ts';
import { conceptsOf } from '../data/content.ts';
import { chapterMastery, learnedCount, totalLearned } from '../logic/leitner.ts';
import { TOTAL_CONCEPTS } from '../data/content.ts';
import { pace, daysLeftLabel } from '../logic/pace.ts';

/** Eltern-Bereich: Lernhistorie, Fortschritt, Bericht — optional PIN-geschützt. */

let unlocked = false;

export function renderParents(root: HTMLElement): void {
  const pinHash = state.settings.parentPinHash;
  if (pinHash && !unlocked) {
    renderPinGate(root, pinHash);
    return;
  }
  renderDashboard(root);
}

function renderPinGate(root: HTMLElement, pinHash: string): void {
  root.innerHTML = `
    <header class="page-head"><h1>👨‍👩‍👧 Eltern-Bereich</h1><p class="muted">Mit PIN geschützt</p></header>
    <section class="card">
      <label class="field">
        <span>PIN eingeben</span>
        <input id="pin" type="password" inputmode="numeric" autocomplete="off" maxlength="8" />
      </label>
      <p class="error" id="pin-error" hidden>Falsche PIN.</p>
      <button class="btn primary big" id="pin-go">Öffnen</button>
    </section>
    ${bottomNav('settings')}`;

  root.querySelector('#pin-go')!.addEventListener('click', async () => {
    const val = (root.querySelector('#pin') as HTMLInputElement).value;
    if ((await sha256Hex(val)) === pinHash) {
      unlocked = true;
      renderDashboard(root);
    } else {
      (root.querySelector('#pin-error') as HTMLElement).hidden = false;
    }
  });
}

function renderDashboard(root: HTMLElement): void {
  const s = state.stats;
  const p = state.profile!;
  const pc = pace();
  const sessions = [...s.sessions].reverse().slice(0, 20);
  const totalMinutes = s.sessions.reduce((n, x) => n + x.minutes, 0);
  const totalAnswered = s.sessions.reduce((n, x) => n + x.answered, 0);
  const totalCorrect = s.sessions.reduce((n, x) => n + x.correct, 0);
  const quote = totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0;
  const learned = totalLearned();

  const last7 = lastDays(7);
  const maxMin = Math.max(1, ...last7.map((d) => d.minutes));

  root.innerHTML = `
    <header class="page-head"><h1>👨‍👩‍👧 Eltern-Bereich</h1>
      <p class="muted">Lernfortschritt von ${esc(p.firstName)} · Ziel: ${new Date(p.deadline).toLocaleDateString('de-DE')}</p>
    </header>

    <section class="stat-tiles">
      <div class="tile"><div class="tile-num">${totalMinutes}</div><div class="tile-label">Minuten gesamt</div></div>
      <div class="tile"><div class="tile-num">${s.sessions.length}</div><div class="tile-label">Lerneinheiten</div></div>
      <div class="tile"><div class="tile-num">${quote}%</div><div class="tile-label">Richtig-Quote</div></div>
      <div class="tile"><div class="tile-num">${learned}/${TOTAL_CONCEPTS}</div><div class="tile-label">Inhalte gelernt</div></div>
    </section>

    <section class="card ${pc.done ? 'pace-card done' : pc.onTrack ? 'pace-card ok' : 'pace-card behind'}">
      <div class="pace-emoji">${pc.done ? '🎓' : pc.onTrack ? '🎯' : '⚠️'}</div>
      <div><strong>${pc.done ? 'Lernziel erreicht' : pc.onTrack ? 'Auf Kurs' : 'Hinter dem Plan'}</strong><br>
      <span class="muted small">${daysLeftLabel(pc)} · Tagespensum: ${pc.dailyTarget} Lernpunkte · heute: ${pc.todayPoints}</span></div>
    </section>

    <section class="card">
      <div class="card-title">Fortschritt pro Kapitel</div>
      ${CHAPTERS.map((ch) => {
        const m = chapterMastery(ch.id);
        return `
        <div class="parent-ch">
          <div class="parent-ch-head"><span>${ch.emoji} ${esc(ch.short)}</span><span class="muted small">${learnedCount(ch.id)}/${conceptsOf(ch.id).length} · ${Math.round(m * 100)} %</span></div>
          <div class="bar"><span style="width:${(m * 100).toFixed(0)}%; background:${ch.color}"></span></div>
        </div>`;
      }).join('')}
    </section>

    <section class="card week-card">
      <div class="card-title">Lernminuten — letzte 7 Tage</div>
      <div class="week-bars">
        ${last7
          .map(
            (d) => `
          <div class="week-col">
            <div class="week-bar-track"><span class="week-bar ${d.minutes === 0 ? 'zero' : ''}" style="height:${Math.round((d.minutes / maxMin) * 100)}%"></span></div>
            <div class="week-day ${d.date === todayKey() ? 'today' : ''}">${d.label}</div>
          </div>`,
          )
          .join('')}
      </div>
    </section>

    <section class="card">
      <div class="card-title">Letzte Lerneinheiten</div>
      ${
        sessions.length === 0
          ? '<p class="muted">Noch keine Lerneinheiten aufgezeichnet.</p>'
          : `<table class="session-table">
              <thead><tr><th>Wann</th><th>Dauer</th><th>Fragen</th><th>Quote</th></tr></thead>
              <tbody>
              ${sessions
                .map((x) => {
                  const q = x.answered > 0 ? Math.round((x.correct / x.answered) * 100) : 0;
                  return `<tr><td>${fmtDate(x.start)} ${fmtTime(x.start)}</td><td>${x.minutes} min</td><td>${x.answered}</td><td>${q} %</td></tr>`;
                })
                .join('')}
              </tbody>
            </table>`
      }
    </section>

    <button class="btn primary big" id="share-report">📤 Bericht teilen</button>
    <a class="btn ghost big" href="#/settings">Zurück zu Einstellungen</a>
    ${bottomNav('settings')}`;

  root.querySelector('#share-report')!.addEventListener('click', async () => {
    const text = buildReport();
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Geo-Quest Lernbericht', text });
        return;
      } catch {
        /* abgebrochen → Fallback */
      }
    }
    await navigator.clipboard.writeText(text).catch(() => {});
    const btn = root.querySelector('#share-report') as HTMLElement;
    btn.textContent = '✅ In Zwischenablage kopiert';
  });
}

function buildReport(): string {
  const p = state.profile!;
  const s = state.stats;
  const pc = pace();
  const totalMinutes = s.sessions.reduce((n, x) => n + x.minutes, 0);
  const lines = [
    `📊 Geo-Quest Lernbericht — ${p.firstName}`,
    `Ziel: ${new Date(p.deadline).toLocaleDateString('de-DE')} (${daysLeftLabel(pc)})`,
    `Status: ${pc.done ? 'Alles gelernt 🎓' : pc.onTrack ? 'Auf Kurs 🎯' : 'Hinter dem Plan ⚠️'}`,
    `Inhalte gelernt: ${totalLearned()}/${TOTAL_CONCEPTS}`,
    `Lernzeit gesamt: ${totalMinutes} min in ${s.sessions.length} Einheiten`,
    `Streak: ${s.streak} Tage (Rekord: ${s.bestStreak})`,
    '',
    ...CHAPTERS.map((ch) => `${ch.emoji} ${ch.short}: ${Math.round(chapterMastery(ch.id) * 100)} %`),
  ];
  return lines.join('\n');
}

function lastDays(n: number): { date: string; label: string; minutes: number }[] {
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    const key = todayKey(d);
    const log = state.stats.history.find((h) => h.date === key);
    out.push({
      date: key,
      label: d.toLocaleDateString('de-DE', { weekday: 'short' }).slice(0, 2),
      minutes: log?.minutes ?? 0,
    });
  }
  return out;
}
