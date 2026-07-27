import { esc } from '../ui.ts';
import { reportBody } from './reportBody.ts';
import { readParentLink, type ParentLinkReason } from '../logic/parentLink.ts';
import { saveReportPdf } from '../logic/reportPdf.ts';
import { fmtStamp, reportAgeDays, STALE_AFTER_DAYS, type ReportData } from '../logic/report.ts';

/** Die Eltern-Ansicht eines geteilten Berichts (`#/bericht/<token>`).
 *
 *  Läuft auf einem fremden Gerät: kein Profil, kein Lernstand, keine Navigation
 *  in die App hinein. Alles, was hier steht, kommt aus dem Link.
 *
 *  Die Ansicht verspricht bewusst nicht mehr, als sie halten kann. Sie zeigt
 *  einen Stichtag, keine Live-Daten, und sie sagt das auch: an erster Stelle das
 *  Erstellungsdatum, bei einem alten Bericht eine Warnung, und am Ende der
 *  Hinweis, wo der garantiert aktuelle Stand zu finden ist.
 */

export function renderReport(root: HTMLElement, param?: string): void {
  root.innerHTML = `
    <header class="page-head"><h1>👨‍👩‍👧 Lernbericht</h1>
      <p class="muted">Wird geöffnet …</p>
    </header>`;
  void load(root, param ?? '');
}

async function load(root: HTMLElement, token: string): Promise<void> {
  const result = await readParentLink(token);
  if (!result.ok) {
    renderError(root, result.reason);
    return;
  }
  renderReportPage(root, result.data);
}

function renderError(root: HTMLElement, reason: ParentLinkReason): void {
  const messages: Record<ParentLinkReason, string> = {
    empty: 'Dieser Link enthält keinen Bericht. Vermutlich wurde nur ein Teil davon kopiert.',
    unreadable:
      'Dieser Link lässt sich nicht öffnen. Beim Weiterleiten wurde er abgeschnitten, oder er wurde nachträglich verändert. Bitte einen neuen Bericht anfordern.',
    unsupported:
      'Dieser Browser ist zu alt, um den Bericht auszupacken. Der Link funktioniert unverändert in einem aktuellen Browser (Chrome, Safari ab iOS 16.4, Firefox).',
    version:
      'Dieser Bericht stammt aus einer neueren Version der App. Bitte die Seite neu laden und den Link noch einmal öffnen.',
  };

  root.innerHTML = `
    <header class="page-head"><h1>👨‍👩‍👧 Lernbericht</h1></header>
    <section class="card grade-card behind">
      <div class="pace-emoji">⚠️</div>
      <div><strong>Bericht nicht lesbar</strong><br>
        <span class="muted small">${esc(messages[reason])}</span>
      </div>
    </section>
    <p class="muted small center">Geo-Quest · Geografie 9 · Realschule Bayern (Terra)</p>`;
}

function renderReportPage(root: HTMLElement, data: ReportData): void {
  const age = reportAgeDays(data);

  root.innerHTML = `
    <header class="page-head"><h1>👨‍👩‍👧 Lernbericht</h1>
      <p class="muted">Lernfortschritt von ${esc(data.name)}</p>
    </header>

    <section class="card stamp-card">
      <div class="stamp-label">Stand</div>
      <div class="stamp-value">${esc(fmtStamp(data.createdAt))}</div>
      <p class="muted small">${esc(ageLabel(age))} · Momentaufnahme, sie aktualisiert sich nicht von selbst.</p>
    </section>

    ${ageWarning(age)}
    ${reportBody(data, { live: false })}

    <button class="btn primary big" id="report-pdf">📄 Als PDF sichern</button>

    <p class="muted small">
      Dieser Bericht wurde von der Geo-Quest-App auf dem Lerngerät von ${esc(data.name)} erzeugt und
      als Link verschickt. Er lässt sich nicht nachträglich ändern — wohl aber zu einem günstigen
      Zeitpunkt erstellen. Verlässlich ist deshalb vor allem das Datum oben.
      Wer ganz sicher gehen will, öffnet den Eltern-Bereich direkt in der App auf dem Lerngerät.
    </p>
    <p class="muted small center">Geo-Quest · Geografie 9 · Realschule Bayern (Terra)</p>`;

  const btn = root.querySelector('#report-pdf') as HTMLButtonElement;
  btn.addEventListener('click', async () => {
    btn.disabled = true;
    try {
      const how = await saveReportPdf(data);
      btn.textContent = how === 'saved' ? '✅ PDF gespeichert' : '📄 Als PDF sichern';
    } catch {
      btn.textContent = '⚠️ PDF konnte nicht erzeugt werden';
    }
    btn.disabled = false;
  });
}

function ageLabel(age: number): string {
  if (age < 0) return 'Das Erstellungsdatum liegt in der Zukunft';
  if (age === 0) return 'Von heute';
  if (age === 1) return 'Von gestern';
  return `${age} Tage alt`;
}

/** Was Eltern an diesem Bericht wirklich selbst prüfen können, ist sein Alter —
 *  also wird ein alter Bericht auch deutlich als solcher markiert. */
function ageWarning(age: number): string {
  if (age < 0) {
    return warn(
      '🕐',
      'Datum liegt in der Zukunft',
      'Auf dem Lerngerät ist die Uhr verstellt — oder der Bericht stimmt nicht. Am besten einen neuen anfordern.',
    );
  }
  if (age >= STALE_AFTER_DAYS) {
    return warn(
      '⏳',
      `Dieser Bericht ist ${age} Tage alt`,
      'Seitdem kann sich einiges getan haben — in beide Richtungen. Für den aktuellen Stand einen neuen Bericht anfordern.',
    );
  }
  return '';
}

function warn(emoji: string, title: string, text: string): string {
  return `
    <section class="card grade-card behind">
      <div class="pace-emoji">${emoji}</div>
      <div><strong>${esc(title)}</strong><br><span class="muted small">${esc(text)}</span></div>
    </section>`;
}
