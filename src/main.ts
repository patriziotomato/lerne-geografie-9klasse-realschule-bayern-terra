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

startRouter(document.getElementById('app')!);
scheduleWhileOpen();

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') scheduleWhileOpen();
});

// PWA: Service Worker registrieren (nur im Build sinnvoll, schadet im Dev nicht)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {
      // Ohne SW funktioniert die App trotzdem — nur nicht offline.
    });
  });
}
