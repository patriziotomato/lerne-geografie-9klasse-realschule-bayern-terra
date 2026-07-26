import { state, todayKey } from '../store.ts';
import { bottomNav } from '../router.ts';
import { esc, ring } from '../ui.ts';
import { levelProgress } from '../logic/gamification.ts';
import { pace, daysLeftLabel } from '../logic/pace.ts';
import { totalLearned } from '../logic/leitner.ts';
import { TOTAL_CONCEPTS } from '../data/content.ts';
import { CHAPTERS } from '../data/chapters.ts';
import { chapterMastery } from '../logic/leitner.ts';
import { nudge } from '../logic/reminders.ts';

export function renderHome(root: HTMLElement): void {
  const p = state.profile!;
  const s = state.stats;
  const lp = levelProgress(s.xp);
  const pc = pace();
  const learned = totalLearned();
  const overall = TOTAL_CONCEPTS > 0 ? learned / TOTAL_CONCEPTS : 0;
  const hint = nudge();
  const streakActiveToday = s.lastStudyDay === todayKey();

  // Schwächstes, noch nicht gemeistertes Kapitel als Empfehlung
  const nextChapter =
    [...CHAPTERS].sort((a, b) => chapterMastery(a.id) - chapterMastery(b.id))[0] ?? CHAPTERS[0];

  const last7 = lastDays(7);
  const maxPts = Math.max(1, ...last7.map((d) => d.points));

  root.innerHTML = `
    <header class="home-head">
      <div>
        <div class="greet">Hi ${esc(p.firstName)} 👋</div>
        <div class="muted small">${daysLeftLabel(pc)} bis zu deinem Ziel</div>
      </div>
      <div class="streak ${streakActiveToday ? 'hot' : ''}" title="Tage in Folge gelernt">
        <span class="flame">🔥</span><span class="streak-n">${s.streak}</span>
      </div>
    </header>

    ${hint ? `<div class="nudge">${hint.emoji} ${esc(hint.text)}</div>` : ''}

    <section class="card level-card">
      <div class="ring-wrap">
        ${ring(lp.ratio, 92, 10, 'var(--accent)', `Level ${lp.level}`)}
        <div class="ring-center">
          <div class="lvl-label">LVL</div>
          <div class="lvl-num">${lp.level}</div>
        </div>
      </div>
      <div class="level-info">
        <div class="xp-line"><strong>${s.xp.toLocaleString('de-DE')} XP</strong></div>
        <div class="muted small">Noch ${(lp.needed - lp.into).toLocaleString('de-DE')} XP bis Level ${lp.level + 1}</div>
        <div class="bar"><span style="width:${(overall * 100).toFixed(0)}%"></span></div>
        <div class="muted small">${learned} von ${TOTAL_CONCEPTS} Inhalten gelernt (${Math.round(overall * 100)} %)</div>
      </div>
    </section>

    <section class="card pace-card ${pc.done ? 'done' : pc.onTrack ? 'ok' : 'behind'}">
      ${
        pc.done
          ? `<div class="pace-emoji">🎓</div><div><strong>Alles gemeistert!</strong><br><span class="muted small">Du bist bereit. Halte dein Wissen mit Mix-Runden frisch!</span></div>`
          : pc.onTrack
            ? `<div class="pace-emoji">🎯</div><div><strong>Du bist auf Kurs!</strong><br><span class="muted small">Tagesziel geschafft: ${pc.todayPoints}/${pc.dailyTarget} Lernpunkte. Stark!</span></div>`
            : `<div class="pace-emoji">💪</div><div><strong>Heute noch ${pc.dailyTarget - pc.todayPoints} Lernpunkte</strong><br><span class="muted small">${pc.todayPoints}/${pc.dailyTarget} geschafft — jede richtige Antwort zählt!</span></div>`
      }
    </section>

    <a class="btn primary big cta" href="#/quiz/${nextChapter.id}">
      Weiterlernen: ${nextChapter.emoji} ${esc(nextChapter.short)} 🚀
    </a>
    <a class="btn ghost big" href="#/quiz/mix">🎲 Mix aus allen Kapiteln</a>

    <section class="card week-card">
      <div class="card-title">Deine Woche</div>
      <div class="week-bars">
        ${last7
          .map(
            (d) => `
          <div class="week-col">
            <div class="week-bar-track"><span class="week-bar ${d.points === 0 ? 'zero' : ''}" style="height:${Math.round((d.points / maxPts) * 100)}%"></span></div>
            <div class="week-day ${d.date === todayKey() ? 'today' : ''}">${d.label}</div>
          </div>`,
          )
          .join('')}
      </div>
      <div class="muted small center">Lernpunkte pro Tag</div>
    </section>

    ${bottomNav('home')}`;
}

function lastDays(n: number): { date: string; label: string; points: number }[] {
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    const key = todayKey(d);
    const log = state.stats.history.find((h) => h.date === key);
    out.push({
      date: key,
      label: d.toLocaleDateString('de-DE', { weekday: 'short' }).slice(0, 2),
      points: Math.max(0, log?.points ?? 0),
    });
  }
  return out;
}
