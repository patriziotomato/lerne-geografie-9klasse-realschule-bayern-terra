import { state, save, todayKey } from '../store.ts';
import { bottomNav } from '../router.ts';
import { esc, ring } from '../ui.ts';
import { gradePicker, bindGradePicker } from './gradePicker.ts';
import { gradeVerdict, roundsLabel, type GradeVerdict } from '../logic/grade.ts';
import { levelProgress } from '../logic/gamification.ts';
import { pace, daysLeftLabel } from '../logic/pace.ts';
import { totalLearned, activeConceptCount, activeChapterIds, chapterMastery } from '../logic/leitner.ts';
import { CHAPTERS } from '../data/chapters.ts';
import { nudge } from '../logic/reminders.ts';

export function renderHome(root: HTMLElement): void {
  const p = state.profile!;
  const s = state.stats;
  const lp = levelProgress(s.xp);
  const pc = pace();
  const learned = totalLearned();
  const totalConcepts = activeConceptCount();
  const overall = totalConcepts > 0 ? learned / totalConcepts : 0;
  const hint = nudge();
  const streakActiveToday = s.lastStudyDay === todayKey();
  const verdict = gradeVerdict();

  // Schwächstes gewähltes Kapitel als Empfehlung
  const activeIds = activeChapterIds();
  const activeChapters = CHAPTERS.filter((c) => activeIds.includes(c.id));
  const nextChapter =
    [...activeChapters].sort((a, b) => chapterMastery(a.id) - chapterMastery(b.id))[0] ?? CHAPTERS[0];

  const last7 = lastDays(7);
  const maxPts = Math.max(1, ...last7.map((d) => d.points));

  root.innerHTML = `
    <header class="home-head">
      <div>
        <div class="greet">Hi ${esc(p.firstName)} 👋</div>
        <div class="muted small">${pc.hasDeadline ? `${daysLeftLabel(pc)} bis zu deinem Ziel` : 'Geografie 9 · Realschule Bayern'}</div>
      </div>
      <div class="streak ${streakActiveToday ? 'hot' : ''}" title="Tage in Folge gelernt">
        <span class="flame">🔥</span><span class="streak-n">${s.streak}</span>
      </div>
    </header>

    ${hint ? `<div class="nudge">${hint.emoji} ${esc(hint.text)}</div>` : ''}

    ${verdict.kind === 'no-target' ? gradeAskCard() : ''}

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
        <div class="muted small">${learned} von ${totalConcepts} Inhalten gelernt (${Math.round(overall * 100)} %)</div>
      </div>
    </section>

    ${
      pc.done
        ? `<section class="card pace-card done"><div class="pace-emoji">🎓</div><div><strong>Alles gemeistert!</strong><br><span class="muted small">Du bist bereit. Halte dein Wissen mit Mix-Runden frisch!</span></div></section>`
        : !pc.hasDeadline
          ? `<a class="card pace-card neutral" href="#/settings"><div class="pace-emoji">🗓️</div><div><strong>Tagesziel: ${pc.todayPoints}/${pc.dailyTarget} Lernpunkte</strong><br><span class="muted small">Tipp: Setz dir in den Einstellungen ein Ziel-Datum — dann rechne ich dein Pensum aus.</span></div></a>`
          : pc.onTrack
            ? `<section class="card pace-card ok"><div class="pace-emoji">🎯</div><div><strong>Du bist auf Kurs!</strong><br><span class="muted small">Tagesziel geschafft: ${pc.todayPoints}/${pc.dailyTarget} Lernpunkte. Stark!</span></div></section>`
            : `<section class="card pace-card behind"><div class="pace-emoji">💪</div><div><strong>Heute noch ${pc.dailyTarget - pc.todayPoints} Lernpunkte</strong><br><span class="muted small">${pc.todayPoints}/${pc.dailyTarget} geschafft — jede richtige Antwort zählt!</span></div></section>`
    }

    ${gradeCard(verdict)}

    <a class="btn primary big cta" href="#/quiz/${nextChapter.id}">
      Weiterlernen: ${nextChapter.emoji} ${esc(nextChapter.short)} 🚀
    </a>
    <a class="btn ghost big" href="#/quiz/mix">🎲 Mix aus meinem Lernplan</a>

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

  bindGradePicker(root, (grade) => {
    state.profile!.targetGrade = grade;
    save();
    renderHome(root);
  });
}

/** Einmalige Nachfrage für alle, die vor dem Zielnoten-Feature angefangen haben. */
function gradeAskCard(): string {
  return `
    <section class="card grade-ask">
      <div class="card-title">🎯 Welche Note willst du schreiben?</div>
      <p class="muted small">Dann sage ich dir künftig, für welche Note dein Lernstand gerade reicht — und wie weit es noch bis zu deinem Ziel ist.</p>
      ${gradePicker(null)}
    </section>`;
}

/** „Du hast bisher für eine 4 gelernt, du willst aber eine 2." */
function gradeCard(v: GradeVerdict): string {
  if (v.kind === 'no-target') return '';

  const card = (mod: string, emoji: string, body: string) =>
    `<section class="card grade-card ${mod}">
      <div class="pace-emoji">${emoji}</div>
      <div>${body}</div>
    </section>`;

  // Am Anfang zählt jeder ungelernte Inhalt mit 0 — die Schätzung wäre also zwingend
  // eine 6 und würde nur den offenen Stoff spiegeln, nicht den Lernenden. Statt einer
  // Note steht hier deshalb der nächste erreichbare Meilenstein; seine Zahl sinkt mit
  // jeder Runde um eins und ist damit die Rückmeldung, die eine 6 nie war.
  if (v.kind === 'no-data' || v.kind === 'warmup') {
    const rounds = v.next.rounds;
    return card(
      'warmup',
      '📈',
      `<strong>Auf dem Weg zur <span class="grade-num">${v.next.grade}</span></strong><br>
       <span class="muted small">${
         rounds
           ? `Noch <strong>${roundsLabel(rounds)}</strong>, dann reicht dein Lernstand für eine <span class="grade-num">${v.next.grade}</span>.`
           : 'Jede Runde bringt dich näher ran.'
       } Dein Ziel: <span class="grade-num">${v.target}</span>.</span>`,
    );
  }

  if (v.kind === 'ahead') {
    return card(
      'ahead',
      '🌟',
      `<strong>Besser als dein Ziel!</strong><br>
       <span class="muted small">Du hast bisher schätzungsweise für eine <span class="grade-num">${v.current}</span> gelernt — dein Ziel war eine <span class="grade-num">${v.target}</span>.</span>`,
    );
  }

  if (v.kind === 'on-target') {
    return card(
      'reached',
      '✅',
      `<strong>Deine <span class="grade-num">${v.target}</span> steht!</strong><br>
       <span class="muted small">Dein Lernstand reicht gerade für dein Ziel. Halte ihn mit kurzen Runden — sonst rutscht er wieder ab.</span>`,
    );
  }

  const early = v.early ? ' Du stehst aber noch ganz am Anfang — das geht jetzt schnell nach oben.' : '';

  // Erst die kleine, erreichbare Zahl (nächstbessere Note), das Ziel nachgestellt.
  // Fällt die nächstbessere Note mit der Zielnote zusammen, bleibt es bei einem Satz.
  const nextRounds = v.next?.rounds ?? null;
  let todo = '';
  if (v.next && nextRounds && v.next.grade !== v.target) {
    todo =
      ` Noch <strong>${roundsLabel(nextRounds)}</strong> bis zur <span class="grade-num">${v.next.grade}</span>` +
      (v.targetRounds
        ? ` — bis zu deiner <span class="grade-num">${v.target}</span> sind es ${roundsLabel(v.targetRounds)}.`
        : '.');
  } else if (v.targetRounds) {
    todo = ` Noch <strong>${roundsLabel(v.targetRounds)}</strong>, dann steht die <span class="grade-num">${v.target}</span>.`;
  } else if (v.needed > 0) {
    todo = ` Noch mindestens <strong>${v.needed}</strong> Inhalte, dann steht die <span class="grade-num">${v.target}</span>.`;
  }

  // Eigenes Emoji und „wenn die Prüfung heute wäre": Die Pace-Karte darüber blickt auf
  // die Deadline und kann „auf Kurs" melden, während diese Karte den Stand von jetzt
  // zeigt. Ohne diese Trennung lesen sich die beiden Karten wie ein Widerspruch.
  return card(
    'behind',
    '📈',
    `<strong>Du hast bisher schätzungsweise für eine <span class="grade-num">${v.current}</span> gelernt — du willst aber eine <span class="grade-num">${v.target}</span>.</strong><br>
     <span class="muted small">Das ist der Stand, wenn die Prüfung heute wäre.${todo}${early}</span>`,
  );
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
