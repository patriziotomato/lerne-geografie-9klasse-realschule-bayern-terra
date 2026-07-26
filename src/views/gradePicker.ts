import { SELECTABLE_GRADES, gradeLabel } from '../logic/grade.ts';

/** Geteiltes Bedienelement für die Zielnote — genutzt von Onboarding,
 *  Startseite (Nachfrage für Bestandsnutzer) und Einstellungen. */

export function gradePicker(selected: number | null): string {
  return `<div class="grade-picker" role="group" aria-label="Zielnote">
    ${SELECTABLE_GRADES.map(
      (g) => `
      <button type="button" class="grade-opt ${g === selected ? 'on' : ''}" data-grade="${g}"
        aria-pressed="${g === selected}">
        <span class="grade-opt-num">${g}</span>
        <span class="grade-opt-label">${gradeLabel(g)}</span>
      </button>`,
    ).join('')}
  </div>`;
}

/** Klick-Handler für alle Noten-Buttons innerhalb von root */
export function bindGradePicker(root: HTMLElement, onPick: (grade: number) => void): void {
  root.querySelectorAll<HTMLButtonElement>('.grade-opt').forEach((btn) => {
    btn.addEventListener('click', () => onPick(Number(btn.dataset.grade)));
  });
}
