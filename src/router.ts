import { state } from './store.ts';

export type View = (root: HTMLElement, param?: string) => void;

const routes = new Map<string, View>();
let appRoot: HTMLElement;

export function register(path: string, view: View): void {
  routes.set(path, view);
}

export function navigate(hash: string): void {
  if (location.hash === hash) render();
  else location.hash = hash;
}

function parse(): { path: string; param?: string } {
  const raw = location.hash.replace(/^#\/?/, '');
  const [path, param] = raw.split('/');
  return { path: path || 'home', param };
}

function render(): void {
  const { path, param } = parse();

  // Ohne Profil immer zuerst das Onboarding.
  if (!state.profile && path !== 'onboarding') {
    location.hash = '#/onboarding';
    return;
  }
  if (state.profile && path === 'onboarding') {
    location.hash = '#/home';
    return;
  }

  const view = routes.get(path) ?? routes.get('home')!;
  appRoot.className = `view view-${path}`;
  window.scrollTo(0, 0);
  view(appRoot, param);
}

export function startRouter(root: HTMLElement): void {
  appRoot = root;
  window.addEventListener('hashchange', render);
  render();
}

/** Untere Tab-Navigation für die Hauptbereiche */
export function bottomNav(active: string): string {
  const items = [
    { path: 'home', emoji: '🏠', label: 'Start' },
    { path: 'chapters', emoji: '📚', label: 'Kapitel' },
    { path: 'badges', emoji: '🏆', label: 'Erfolge' },
    { path: 'settings', emoji: '⚙️', label: 'Mehr' },
  ];
  return `<nav class="bottom-nav">${items
    .map(
      (i) => `
      <a href="#/${i.path}" class="nav-item ${active === i.path ? 'active' : ''}" aria-label="${i.label}">
        <span class="nav-emoji">${i.emoji}</span>
        <span class="nav-label">${i.label}</span>
      </a>`,
    )
    .join('')}</nav>`;
}
