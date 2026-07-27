import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { defineConfig, type Plugin } from 'vite';

// GitHub-Pages-Deployment liegt unter /<repo-name>/ — lokal bleibt es "/".
const base = process.env.GITHUB_PAGES === 'true'
  ? '/lerne-geografie-9klasse-realschule-bayern-terra/'
  : '/';

/** Commit des Builds. In der Action steht GITHUB_SHA in jedem Step bereit,
 *  lokal fragen wir git. Ein Tag-basierter Name (git describe) wäre keine
 *  Option: Das Repo hat keine Tags und actions/checkout klont mit fetch-depth 1. */
function commitSha(): string {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA;
  try {
    return execSync('git rev-parse HEAD', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    // Kein git (z. B. Build aus einem Tarball) — dann bleibt der Stempel unspezifisch.
    return 'dev';
  }
}

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
const APP_VERSION: string = pkg.version;
const APP_COMMIT = commitSha();
const APP_COMMIT_SHORT = APP_COMMIT.slice(0, 7);
const APP_BUILD_TIME = new Date().toISOString();

/** Denselben Stempel zusätzlich in den <head> schreiben. Nur so ist der
 *  ausgelieferte Stand von außen prüfbar — ohne die App zu bedienen und ohne
 *  Profil, denn ohne Profil zeigt der Router ausschließlich das Onboarding.
 *
 *  Bewusst injiziert statt als %VITE_X%-Platzhalter à la %BASE_URL% in
 *  index.html: Ein nicht aufgelöster Platzhalter landet dort wörtlich im Output,
 *  der Stempel wäre also still kaputt statt schlicht falsch. */
function versionMeta(): Plugin {
  return {
    name: 'geoquest-version-meta',
    transformIndexHtml: {
      order: 'post',
      handler: () => [
        { tag: 'meta', attrs: { name: 'app-version', content: APP_VERSION }, injectTo: 'head' },
        { tag: 'meta', attrs: { name: 'app-commit', content: APP_COMMIT }, injectTo: 'head' },
        { tag: 'meta', attrs: { name: 'app-build-time', content: APP_BUILD_TIME }, injectTo: 'head' },
      ],
    },
  };
}

export default defineConfig({
  base,
  plugins: [versionMeta()],
  /* Als import.meta.env.VITE_*-Schlüssel und nicht als nackte Globals
     (__APP_VERSION__ o. ä.): Letztere bräuchten eine eigene .d.ts unter src/,
     weil tsconfig nur "src" einliest. VITE_* typechecked über die
     ImportMetaEnv-Index-Signatur aus vite/client — und import.meta.env ist im
     Projekt schon Konvention (main.ts, logic/notify.ts). */
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(APP_VERSION),
    'import.meta.env.VITE_APP_COMMIT': JSON.stringify(APP_COMMIT_SHORT),
    'import.meta.env.VITE_APP_BUILD_TIME': JSON.stringify(APP_BUILD_TIME),
  },
  build: {
    target: 'es2021',
  },
});
