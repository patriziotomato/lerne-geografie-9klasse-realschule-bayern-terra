import { esc, fmtDate, fmtTime } from '../ui.ts';
import { chapterById } from '../data/chapters.ts';
import { daysLeftLabel } from '../logic/pace.ts';
import {
  fmtDay,
  quotePercent,
  statusLabel,
  weekdayLabel,
  type ReportData,
} from '../logic/report.ts';

/** Der Berichtsinhalt als HTML — einmal, für beide Ansichten.
 *
 *  Der Eltern-Bereich auf dem Lerngerät und der geteilte Eltern-Link zeigen
 *  dieselben Zahlen. Zwei Renderer dafür wären zwei Wahrheiten: Jede spätere
 *  Änderung müsste an beiden Stellen ankommen, und ausgerechnet der Link — den
 *  niemand mehr gegenprüfen kann — würde still veralten.
 *
 *  Unterschied ist nur die Zeitform: Das Dashboard zeigt jetzt, der Link zeigt
 *  einen Stichtag. Dafür gibt es `live`.
 */

export interface BodyOptions {
  /** true = laufender Zustand auf dem Lerngerät, false = Momentaufnahme */
  live: boolean;
}

export function reportBody(data: ReportData, { live }: BodyOptions): string {
  return [
    tiles(data),
    paceCard(data, live),
    gradeCard(data, live),
    chaptersCard(data),
    weekCard(data),
    sessionsCard(data),
  ].join('');
}

function tiles(data: ReportData): string {
  const items: [string, string][] = [
    [String(data.minutes), 'Minuten gesamt'],
    [String(data.sessionCount), 'Lerneinheiten'],
    [`${quotePercent(data.correct, data.answered)}%`, 'Richtig-Quote'],
    [`${data.learned}/${data.planned}`, 'Inhalte gelernt'],
  ];
  return `<section class="stat-tiles">${items
    .map(
      ([value, label]) =>
        `<div class="tile"><div class="tile-num">${esc(value)}</div><div class="tile-label">${label}</div></div>`,
    )
    .join('')}</section>`;
}

function paceCard(data: ReportData, live: boolean): string {
  const p = data.pace;
  const mod = p.done ? 'done' : !p.hasDeadline ? 'neutral' : p.onTrack ? 'ok' : 'behind';
  const st = statusLabel(p);
  const when = live ? 'heute' : 'am Berichtstag';
  const detail = p.hasDeadline
    ? `${daysLeftLabel(p)} · Tagespensum: ${p.dailyTarget} Lernpunkte · ${when}: ${p.todayPoints}`
    : `Freies Lernen · ${when}: ${p.todayPoints} Lernpunkte`;

  return `
    <section class="card pace-card ${mod}">
      <div class="pace-emoji">${st.emoji}</div>
      <div><strong>${st.text}</strong><br>
      <span class="muted small">${esc(detail)}</span></div>
    </section>`;
}

/** Noten-Einschätzung, sachlich formuliert — hier lesen Eltern mit, deshalb
 *  steht die Note ungeschönt da, auch eine 6. */
function gradeCard(data: ReportData, live: boolean): string {
  const g = data.grade;
  if (g.target === null) return '';

  const notes = g.notes.map((n) => `<span class="muted small">${esc(n)}</span>`).join('<br>');

  if (g.current === null) {
    return card(
      'unknown',
      '🔍',
      `<strong>Noch keine Noten-Einschätzung</strong><br>${notes}`,
    );
  }

  const mod = g.current < g.target ? 'ahead' : g.current === g.target ? 'reached' : 'behind';
  const emoji = g.current < g.target ? '🌟' : g.current === g.target ? '✅' : '📈';
  // `today` statt eines Zuschnitts von `createdAt`: Der ISO-Zeitstempel steht in
  // UTC, ein Bericht von 00:30 Uhr deutscher Zeit trüge dort noch den Vortag —
  // und widerspräche damit dem Datum in der Kopfzeile.
  const stamp = live ? 'Stand heute' : `Stand am ${fmtDay(data.today)}`;

  return card(
    mod,
    emoji,
    `<strong>${stamp}: Note <span class="grade-num">${g.current}</span></strong><br>${notes}`,
  );
}

function card(mod: string, emoji: string, body: string): string {
  return `<section class="card grade-card ${mod}"><div class="pace-emoji">${emoji}</div><div>${body}</div></section>`;
}

function chaptersCard(data: ReportData): string {
  return `
    <section class="card">
      <div class="card-title">Fortschritt pro Kapitel</div>
      ${data.chapters
        .map((ch) => {
          const meta = chapterById(ch.id);
          const name = `${meta ? `${meta.emoji} ` : ''}${esc(meta?.short ?? ch.id)}`;
          return `
        <div class="parent-ch ${ch.active ? '' : 'inactive'}">
          <div class="parent-ch-head">
            <span>${name}${ch.active ? '' : ' <span class="pill off">nicht im Lernplan</span>'}</span>
            <span class="muted small">${ch.learned}/${ch.planned} · ${Math.round(ch.mastery * 100)} %</span>
          </div>
          <div class="bar"><span style="width:${(clamp01(ch.mastery) * 100).toFixed(0)}%"></span></div>
        </div>`;
        })
        .join('')}
    </section>`;
}

function weekCard(data: ReportData): string {
  const max = Math.max(1, ...data.week.map((d) => d.minutes));
  return `
    <section class="card week-card">
      <div class="card-title">Lernminuten — letzte 7 Tage</div>
      <div class="week-bars">
        ${data.week
          .map(
            (d) => `
          <div class="week-col">
            <div class="week-bar-track"><span class="week-bar ${d.minutes === 0 ? 'zero' : ''}" style="height:${Math.round((d.minutes / max) * 100)}%"></span></div>
            <div class="week-day ${d.date === data.today ? 'today' : ''}">${weekdayLabel(d.date)}</div>
          </div>`,
          )
          .join('')}
      </div>
    </section>`;
}

function sessionsCard(data: ReportData): string {
  if (data.sessions.length === 0) {
    return `<section class="card">
      <div class="card-title">Letzte Lerneinheiten</div>
      <p class="muted">Noch keine Lerneinheiten aufgezeichnet.</p>
    </section>`;
  }
  return `
    <section class="card">
      <div class="card-title">Letzte Lerneinheiten</div>
      <table class="session-table">
        <thead><tr><th>Wann</th><th>Dauer</th><th>Fragen</th><th>Quote</th></tr></thead>
        <tbody>
        ${data.sessions
          .map(
            (x) =>
              `<tr><td>${fmtDate(x.start)} ${fmtTime(x.start)}</td><td>${x.minutes} min</td><td>${x.answered}</td><td>${quotePercent(x.correct, x.answered)} %</td></tr>`,
          )
          .join('')}
        </tbody>
      </table>
    </section>`;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}
