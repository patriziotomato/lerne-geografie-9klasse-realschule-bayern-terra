import { bottomNav } from '../router.ts';
import { esc, fmtDate, fmtTime, sha256Hex } from '../ui.ts';
import { state, todayKey } from '../store.ts';
import { CHAPTERS } from '../data/chapters.ts';
import { conceptsOf } from '../data/content.ts';
import { chapterMastery, learnedCount, totalLearned, activeConceptCount, isChapterActive } from '../logic/leitner.ts';
import { pace, daysLeftLabel } from '../logic/pace.ts';
import { gradeVerdict, gradeLabel, roundsLabel, type GradeVerdict } from '../logic/grade.ts';

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
      <p class="muted">Lernfortschritt von ${esc(p.firstName)}${p.deadline ? ` · Ziel: ${new Date(p.deadline).toLocaleDateString('de-DE')}` : ' · kein Ziel-Datum gesetzt'}</p>
    </header>

    <section class="stat-tiles">
      <div class="tile"><div class="tile-num">${totalMinutes}</div><div class="tile-label">Minuten gesamt</div></div>
      <div class="tile"><div class="tile-num">${s.sessions.length}</div><div class="tile-label">Lerneinheiten</div></div>
      <div class="tile"><div class="tile-num">${quote}%</div><div class="tile-label">Richtig-Quote</div></div>
      <div class="tile"><div class="tile-num">${learned}/${activeConceptCount()}</div><div class="tile-label">Inhalte gelernt</div></div>
    </section>

    <section class="card ${pc.done ? 'pace-card done' : !pc.hasDeadline ? 'pace-card neutral' : pc.onTrack ? 'pace-card ok' : 'pace-card behind'}">
      <div class="pace-emoji">${pc.done ? '🎓' : !pc.hasDeadline ? '🗓️' : pc.onTrack ? '🎯' : '⚠️'}</div>
      <div><strong>${pc.done ? 'Lernziel erreicht' : !pc.hasDeadline ? 'Kein Ziel-Datum gesetzt' : pc.onTrack ? 'Auf Kurs' : 'Hinter dem Plan'}</strong><br>
      <span class="muted small">${
        pc.hasDeadline
          ? `${daysLeftLabel(pc)} · Tagespensum: ${pc.dailyTarget} Lernpunkte · heute: ${pc.todayPoints}`
          : `Freies Lernen · heute: ${pc.todayPoints} Lernpunkte`
      }</span></div>
    </section>

    ${parentGradeCard(gradeVerdict())}

    <section class="card">
      <div class="card-title">Fortschritt pro Kapitel</div>
      ${CHAPTERS.map((ch) => {
        const m = chapterMastery(ch.id);
        const active = isChapterActive(ch.id);
        return `
        <div class="parent-ch ${active ? '' : 'inactive'}">
          <div class="parent-ch-head"><span>${ch.emoji} ${esc(ch.short)}${active ? '' : ' <span class="pill off">nicht im Lernplan</span>'}</span><span class="muted small">${learnedCount(ch.id)}/${conceptsOf(ch.id).length} · ${Math.round(m * 100)} %</span></div>
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

/** Noten-Einschätzung, sachlich formuliert — hier lesen Eltern mit. */
function parentGradeCard(v: GradeVerdict): string {
  if (v.kind === 'no-target') return '';

  const card = (mod: string, emoji: string, body: string) =>
    `<section class="card grade-card ${mod}">
      <div class="pace-emoji">${emoji}</div>
      <div>${body}</div>
    </section>`;

  if (v.kind === 'no-data') {
    return card(
      'unknown',
      '🔍',
      `<strong>Noch keine Noten-Einschätzung</strong><br>
       <span class="muted small">Dafür sind noch zu wenige Inhalte abgefragt worden. Zielnote: ${v.target} (${gradeLabel(v.target)}).</span>`,
    );
  }

  const mod = v.kind === 'ahead' ? 'ahead' : v.kind === 'on-target' ? 'reached' : 'behind';
  const emoji = v.kind === 'ahead' ? '🌟' : v.kind === 'on-target' ? '✅' : '📈';

  // Hier steht die Note ungeschönt — auch eine 6. Ergänzt um die Restdistanz in
  // Runden, weil „noch mindestens X Inhalte" nichts darüber sagt, wie viel Lernzeit
  // das bedeutet: Eine Runde hebt zehn Inhalte um je eine Box, nicht auf gemeistert.
  const distances: string[] = [];
  if (v.kind === 'warmup' && v.next.rounds) {
    distances.push(`Bis zur Note ${v.next.grade} sind es ${roundsLabel(v.next.rounds)}`);
  }
  if (v.kind === 'behind') {
    if (v.next && v.next.rounds && v.next.grade !== v.target) {
      distances.push(`Bis zur Note ${v.next.grade} sind es ${roundsLabel(v.next.rounds)}`);
    }
    if (v.targetRounds) {
      distances.push(`bis zur Zielnote ${v.target} ${roundsLabel(v.targetRounds)}`);
    } else if (v.needed > 0) {
      distances.push(`bis zur Zielnote ${v.target} fehlen mindestens ${v.needed} Inhalte`);
    }
  }
  const todo =
    distances.length > 0
      ? `<br><span class="muted small">${distances.join(' · ')}.</span>`
      : '';

  return card(
    mod,
    emoji,
    `<strong>Stand heute: Note <span class="grade-num">${v.current}</span></strong><br>
     <span class="muted small">Zielnote: ${v.target} (${gradeLabel(v.target)}). Die Schätzung beschreibt den Lernstand von jetzt, nicht das Ergebnis am Prüfungstag.</span>${todo}`,
  );
}

function buildReport(): string {
  const p = state.profile!;
  const s = state.stats;
  const pc = pace();
  const totalMinutes = s.sessions.reduce((n, x) => n + x.minutes, 0);
  const v = gradeVerdict();
  const lines = [
    `📊 Geo-Quest Lernbericht — ${p.firstName}`,
    p.deadline ? `Ziel: ${new Date(p.deadline).toLocaleDateString('de-DE')} (${daysLeftLabel(pc)})` : 'Kein Ziel-Datum gesetzt',
    `Status: ${pc.done ? 'Alles gelernt 🎓' : !pc.hasDeadline ? 'Freies Lernen 🗓️' : pc.onTrack ? 'Auf Kurs 🎯' : 'Hinter dem Plan ⚠️'}`,
    ...(v.kind === 'no-target'
      ? []
      : v.kind === 'no-data'
        ? [`Noten-Einschätzung: noch zu wenig Daten · Zielnote ${v.target}`]
        : [`Noten-Einschätzung: Stand ${v.current} · Zielnote ${v.target}`]),
    `Inhalte gelernt: ${totalLearned()}/${activeConceptCount()}`,
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
