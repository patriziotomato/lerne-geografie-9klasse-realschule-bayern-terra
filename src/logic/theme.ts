import type { ThemeChoice } from '../types.ts';
import { state, save } from '../store.ts';

/** Farbschema.
 *
 *  Das Stylesheet hängt bewusst NICHT an `prefers-color-scheme`, sondern an
 *  `data-theme` auf <html> — nur so lässt sich das Schema überhaupt gegen die
 *  Geräteeinstellung setzen. Die Auflösung von 'system' passiert hier.
 *
 *  Den ersten Wert setzt schon das Bootstrap-Skript in index.html, sonst
 *  blitzt beim Start kurz das falsche Schema auf. Die Farbwerte unten sind
 *  deshalb dort gespiegelt und müssen zu --bg in styles.css passen. */

const BG = { dark: '#0e1014', light: '#f6f7f9' } as const;

export const THEME_CHOICES: { value: ThemeChoice; label: string }[] = [
  { value: 'system', label: 'Automatisch' },
  { value: 'light', label: 'Hell' },
  { value: 'dark', label: 'Dunkel' },
];

const systemPrefersLight = (): boolean =>
  typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: light)').matches;

/** 'system' auf das Schema auflösen, das tatsächlich angezeigt wird. */
export function resolvedTheme(choice: ThemeChoice = state.settings.theme): 'light' | 'dark' {
  if (choice === 'light' || choice === 'dark') return choice;
  return systemPrefersLight() ? 'light' : 'dark';
}

/** Schema auf <html> schreiben und die Statusleiste nachziehen. */
export function applyTheme(): void {
  const theme = resolvedTheme();
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', BG[theme]);
}

export function setTheme(choice: ThemeChoice): void {
  state.settings.theme = choice;
  save();
  applyTheme();
}

/** Bei 'Automatisch' dem Gerät folgen, auch wenn es mitten in der Sitzung
 *  umschaltet (z. B. per Nachtmodus-Zeitplan). */
export function watchSystemTheme(): void {
  if (typeof matchMedia !== 'function') return;
  matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => {
    if (state.settings.theme === 'system') applyTheme();
  });
}
