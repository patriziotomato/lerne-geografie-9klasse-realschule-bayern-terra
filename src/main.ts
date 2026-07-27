import './styles.css';
import { register, startRouter } from './router.ts';
import { renderOnboarding } from './views/onboarding.ts';
import { renderHome } from './views/home.ts';
import { renderChapters } from './views/chapters.ts';
import { renderQuiz } from './views/quiz.ts';
import { renderResults } from './views/results.ts';
import { renderBadges } from './views/badges.ts';
import { renderParents } from './views/parents.ts';
import { renderSettings } from './views/settings.ts';
import { renderTopics } from './views/topics.ts';
import { renderMerkliste } from './views/merkliste.ts';
import { scheduleWhileOpen } from './logic/reminders.ts';
import { applyTheme, watchSystemTheme } from './logic/theme.ts';
import { APP_COMMIT } from './version.ts';

register('onboarding', renderOnboarding);
register('home', renderHome);
register('chapters', renderChapters);
register('quiz', (root, param) => renderQuiz(root, param ?? 'mix'));
register('results', renderResults);
register('badges', renderBadges);
register('parents', renderParents);
register('settings', renderSettings);
register('topics', (root, param) => renderTopics(root, param));
register('merkliste', renderMerkliste);

// Das Bootstrap-Skript in index.html hat das Schema schon gesetzt; hier wird
// es gegen den geladenen Zustand nochmal bestätigt (und korrigiert, falls der
// Speicher inzwischen migriert wurde).
applyTheme();
watchSystemTheme();

startRouter(document.getElementById('app')!);
scheduleWhileOpen();

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') scheduleWhileOpen();
});

// PWA: Service Worker registrieren (nur im Build sinnvoll, schadet im Dev nicht).
// Der Commit hängt als ?v= an der Script-URL: sw.js liest ihn als Cache-Namen,
// wodurch jeder Deploy den alten Cache aufräumt. Ohne das könnten die
// ungehashten Dateien (Manifest, Icons) beliebig lange veralten, weil sie
// cache-first ausgeliefert werden. Der Scope leitet sich aus dem Pfad ab und
// bleibt von der Query unberührt — es bleibt also dieselbe Registrierung.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js?v=${APP_COMMIT}`).catch(() => {
      // Ohne SW funktioniert die App trotzdem — nur nicht offline.
    });
  });
}
