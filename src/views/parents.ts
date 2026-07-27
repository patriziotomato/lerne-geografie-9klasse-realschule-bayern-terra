import { bottomNav } from '../router.ts';
import { esc, sha256Hex } from '../ui.ts';
import { state } from '../store.ts';
import { reportBody } from './reportBody.ts';
import { buildReport, fmtDay, type ReportData } from '../logic/report.ts';
import { saveReportPdf } from '../logic/reportPdf.ts';
import { createParentLink } from '../logic/parentLink.ts';

/** Eltern-Bereich: Lernhistorie, Fortschritt, Bericht — optional PIN-geschützt. */

let unlocked = false;

export function renderParents(root: HTMLElement): void {
  const pinHash = state.settings.parentPinHash;
  if (pinHash && !unlocked) {
    renderPinGate(root, pinHash);
    return;
  }
  renderDashboard(root);
}

function renderPinGate(root: HTMLElement, pinHash: string): void {
  root.innerHTML = `
    <header class="page-head"><h1>👨‍👩‍👧 Eltern-Bereich</h1><p class="muted">Mit PIN geschützt</p></header>
    <section class="card">
      <label class="field">
        <span>PIN eingeben</span>
        <input id="pin" type="password" inputmode="numeric" autocomplete="off" maxlength="8" />
      </label>
      <p class="error" id="pin-error" hidden>Falsche PIN.</p>
      <button class="btn primary big" id="pin-go">Öffnen</button>
    </section>
    ${bottomNav('settings')}`;

  root.querySelector('#pin-go')!.addEventListener('click', async () => {
    const val = (root.querySelector('#pin') as HTMLInputElement).value;
    if ((await sha256Hex(val)) === pinHash) {
      unlocked = true;
      renderDashboard(root);
    } else {
      (root.querySelector('#pin-error') as HTMLElement).hidden = false;
    }
  });
}

function renderDashboard(root: HTMLElement): void {
  const data = buildReport();

  root.innerHTML = `
    <header class="page-head"><h1>👨‍👩‍👧 Eltern-Bereich</h1>
      <p class="muted">Lernfortschritt von ${esc(data.name)}${
        data.deadline ? ` · Ziel: ${fmtDay(data.deadline)}` : ' · kein Ziel-Datum gesetzt'
      }</p>
    </header>

    ${reportBody(data, { live: true })}

    ${shareCard()}
    <a class="btn ghost big" href="#/settings">Zurück zu Einstellungen</a>
    ${bottomNav('settings')}`;

  bindShare(root, data);
}

/** Zwei Wege nach draußen — beide erzeugen etwas Fertiges.
 *
 *  Früher stand hier „Bericht teilen", das einen Fließtext an den Messenger
 *  übergab. Der landete dort in einem Eingabefeld: Minuten, Quote und Note ließen
 *  sich vor dem Absenden überschreiben. Genau deshalb gibt es jetzt eine Datei
 *  und einen Link statt Text. */
function shareCard(): string {
  return `
    <section class="card">
      <div class="card-title">Bericht für die Eltern</div>
      <p class="muted small">PDF und Link entstehen hier auf dem Gerät und lassen sich danach
        nicht mehr verändern.</p>
      <button class="btn primary big" id="report-pdf">📄 PDF erzeugen</button>
      <button class="btn ghost big" id="report-link">🔗 Eltern-Link erstellen</button>

      <div id="link-out" hidden>
        <label class="field">
          <span>Link zum Weitergeben</span>
          <input id="link-value" type="text" readonly />
        </label>
        <div class="link-actions">
          <button class="btn ghost small" id="link-copy">📋 Kopieren</button>
          <button class="btn ghost small" id="link-share">📤 Senden</button>
        </div>
        <p class="muted tiny">Eltern brauchen nur diesen Link — es gibt nichts abzutippen.
          Er enthält den Bericht selbst, nicht nur einen Verweis: Es wird nichts hochgeladen, und
          wer den Link nicht hat, findet ihn auch nicht. Wer ihn weiterleitet, gibt den Bericht
          allerdings mit weiter.</p>
      </div>

      <p class="muted tiny">Beides ist eine Momentaufnahme von jetzt und altert. Für den
        garantiert aktuellen Stand: diesen Eltern-Bereich direkt auf dem Lerngerät öffnen.</p>
    </section>`;
}

function bindShare(root: HTMLElement, data: ReportData): void {
  const pdfBtn = root.querySelector('#report-pdf') as HTMLButtonElement;
  pdfBtn.addEventListener('click', async () => {
    pdfBtn.disabled = true;
    try {
      const how = await saveReportPdf(data);
      pdfBtn.textContent = how === 'saved' ? '✅ PDF gespeichert' : '📄 PDF erzeugen';
    } catch {
      pdfBtn.textContent = '⚠️ PDF konnte nicht erzeugt werden';
    }
    pdfBtn.disabled = false;
  });

  const linkBtn = root.querySelector('#report-link') as HTMLButtonElement;
  const out = root.querySelector('#link-out') as HTMLElement;
  const field = root.querySelector('#link-value') as HTMLInputElement;

  linkBtn.addEventListener('click', async () => {
    linkBtn.disabled = true;
    linkBtn.textContent = '⏳ Link wird erzeugt …';
    try {
      field.value = await createParentLink(data);
      out.hidden = false;
      linkBtn.textContent = '🔄 Neuen Link erstellen';
      field.focus();
      field.select();
    } catch {
      linkBtn.textContent = '⚠️ Link konnte nicht erzeugt werden';
    }
    linkBtn.disabled = false;
  });

  // Kopieren und Senden hängen bewusst an eigenen Knöpfen: Der Link entsteht
  // erst nach einer Schlüsselableitung, und nach diesem await verweigern
  // Browser den Teilen-Dialog — die Nutzergeste gilt dann als verbraucht.
  const copyBtn = root.querySelector('#link-copy') as HTMLButtonElement;
  copyBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(field.value);
      copyBtn.textContent = '✅ Kopiert';
    } catch {
      field.select();
      copyBtn.textContent = '📋 Bitte manuell kopieren';
    }
  });

  const shareBtn = root.querySelector('#link-share') as HTMLButtonElement;
  shareBtn.addEventListener('click', async () => {
    if (!navigator.share) {
      shareBtn.hidden = true;
      return;
    }
    try {
      await navigator.share({ title: `Lernbericht ${data.name}`, url: field.value });
    } catch {
      /* abgebrochen — der Link steht ja weiterhin im Feld */
    }
  });
}
