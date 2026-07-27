import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { defineConfig, type Plugin } from 'vite';

/** Einmal notiert: daraus leiten sich der Pages-Pfad und die Release-Links ab. */
const REPO = 'patriziotomato/lerne-geografie-9klasse-realschule-bayern-terra';

// GitHub-Pages-Deployment liegt unter /<repo-name>/ — lokal bleibt es "/".
const base = process.env.GITHUB_PAGES === 'true' ? `/${REPO.split('/')[1]}/` : '/';

/** Commit des Builds. In der Action steht GITHUB_SHA in jedem Step bereit,
 *  lokal fragen wir git. Bleibt bewusst der Hash und nicht der Tag-Name: Der Tag
 *  benennt das Release (siehe release() unten), der Hash den exakten Stand — und
 *  den braucht es gerade für die Vorschau-Builds zwischen zwei Releases. */
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

/** Das GitHub-Release, zu dem dieser Build gehört: der nächstgelegene `v*`-Tag
 *  und wie viele Commits seitdem dazugekommen sind (`ahead > 0` = Vorschau-Build
 *  nach dem Release, kein Release-Stand).
 *
 *  `--long` erzwingt das Suffix `-<n>-g<sha>` auch genau auf dem Tag — sonst
 *  druckt describe dort nur den Tag-Namen und das Format wäre mal so, mal so.
 *
 *  Braucht Historie UND Tags: `.github/workflows/deploy.yml` checkt darum mit
 *  `fetch-depth: 0` und `fetch-tags: true` aus. Fehlt beides (Tarball, frisches
 *  Repo ohne Tag), bleibt es bei null und die App zeigt weiter die Nummer aus
 *  package.json. */
function release(): { tag: string; ahead: number } | null {
  try {
    const described = execSync("git describe --tags --long --match 'v*'", {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    const m = /^(.+)-(\d+)-g[0-9a-f]+$/.exec(described);
    return m ? { tag: m[1], ahead: Number(m[2]) } : null;
  } catch {
    return null;
  }
}

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
const APP_VERSION: string = pkg.version;
const APP_COMMIT = commitSha();
const APP_COMMIT_SHORT = APP_COMMIT.slice(0, 7);
const APP_BUILD_TIME = new Date().toISOString();
const REL = release();
const APP_RELEASE = REL?.tag ?? '';
const APP_RELEASE_AHEAD = REL?.ahead ?? 0;
const APP_RELEASE_URL = REL ? `https://github.com/${REPO}/releases/tag/${REL.tag}` : '';

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
        { tag: 'meta', attrs: { name: 'app-release', content: APP_RELEASE }, injectTo: 'head' },
        { tag: 'meta', attrs: { name: 'app-release-ahead', content: String(APP_RELEASE_AHEAD) }, injectTo: 'head' },
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
    'import.meta.env.VITE_APP_RELEASE': JSON.stringify(APP_RELEASE),
    'import.meta.env.VITE_APP_RELEASE_AHEAD': JSON.stringify(APP_RELEASE_AHEAD),
    'import.meta.env.VITE_APP_RELEASE_URL': JSON.stringify(APP_RELEASE_URL),
  },
  build: {
    target: 'es2021',
  },
});
