import { createPdf, PAGE_H, PAGE_W, type Pdf } from './pdf.ts';
import { chapterById } from '../data/chapters.ts';
import { daysLeftLabel } from './pace.ts';
import {
  coverageLabel,
  fmtDay,
  fmtStamp,
  quotePercent,
  reportFileName,
  statusLabel,
  weekdayLabel,
  type ReportData,
} from './report.ts';
import { fmtDate, fmtTime } from '../ui.ts';

/** Der Lernbericht als PDF.
 *
 *  Warum überhaupt ein PDF: Ein geteilter Text landet im Messenger in einem
 *  Eingabefeld und lässt sich vor dem Absenden umschreiben. Eine fertige Datei
 *  nicht — sie ist das, was sie beim Erzeugen war.
 *
 *  Das Dokument ist bewusst in Graustufen gehalten. Es wird eher gedruckt und
 *  weitergereicht als am Bildschirm bewundert, und die Markenfarbe der App
 *  trägt hier keine Bedeutung, die ein Balken nicht auch in Grau trägt.
 *
 *  Ohne Emojis: Die PDF-Standardschriften können nur WinAnsi (siehe pdf.ts).
 *  Kapitelnamen kommen deshalb aus `Chapter.short`, nicht aus `emoji + short`.
 */

const M = 52;
const CONTENT_W = PAGE_W - 2 * M;
/** Erste Grundlinie auf Folgeseiten */
const TOP = 66;
/** Ab hier gehört das Blatt der Fußzeile */
const BOTTOM = PAGE_H - 62;

const INK = 0;
const INK_2 = 0.42;
const INK_3 = 0.58;
const TRACK = 0.88;
const FILL = 0.3;
const BOX = 0.945;

/** Schreibmarke. Ein einziger wandernder Wert statt durchgereichter
 *  y-Parameter — sonst schreibt ein Abschnitt nach einem Seitenumbruch weiter
 *  an der Grundlinie der alten Seite. */
interface Flow {
  y: number;
}

export function reportPdf(data: ReportData): Blob {
  const pdf = createPdf();
  const flow: Flow = { y: 0 };

  titleBlock(pdf, flow, data);
  tiles(pdf, flow, data);
  status(pdf, flow, data);
  chapters(pdf, flow, data);
  week(pdf, flow, data);
  sessions(pdf, flow, data);
  closing(pdf, flow, data);
  footers(pdf, data);

  return pdf.blob(`Lernbericht ${data.name}`);
}

/** Reicht der Rest der Seite noch für einen Block dieser Höhe? */
function ensure(pdf: Pdf, flow: Flow, height: number): void {
  if (flow.y + height <= BOTTOM) return;
  pdf.newPage();
  flow.y = TOP;
}

function heading(pdf: Pdf, flow: Flow, text: string): void {
  ensure(pdf, flow, 58);
  flow.y += 20;
  pdf.text(text, M, flow.y, { size: 11.5, font: 'bold' });
  flow.y += 6;
  pdf.hline(M, M + CONTENT_W, flow.y, TRACK, 0.8);
  flow.y += 16;
}

/** Umbrochener Fließtext */
function paragraph(
  pdf: Pdf,
  flow: Flow,
  text: string,
  opts: { size: number; gray: number },
): void {
  for (const line of pdf.wrap(text, CONTENT_W, 'regular', opts.size)) {
    ensure(pdf, flow, 14);
    pdf.text(line, M, flow.y, opts);
    flow.y += opts.size + 3.2;
  }
}

/** Kopf: Wer, und vor allem — wann. */
function titleBlock(pdf: Pdf, flow: Flow, data: ReportData): void {
  pdf.text('Lernbericht', M, 66, { size: 23, font: 'bold' });
  pdf.text('Geo-Quest · Geografie 9 · Realschule Bayern (Terra)', M, 82, {
    size: 8.5,
    gray: INK_3,
  });
  pdf.hline(M, M + CONTENT_W, 94, TRACK, 0.8);

  pdf.text(data.name, M, 122, { size: 15, font: 'bold' });

  // Der Stichtag steht bewusst so prominent wie der Name: Er ist das Einzige am
  // Bericht, das Eltern ohne die App selbst einordnen können.
  pdf.text(`Stand: ${fmtStamp(data.createdAt)}`, M + CONTENT_W, 122, {
    size: 10.5,
    font: 'bold',
    align: 'right',
  });

  const goal = data.deadline
    ? `Lernziel: ${fmtDay(data.deadline)} · ${daysLeftLabel(data.pace)}`
    : 'Kein Lernziel-Datum gesetzt';
  pdf.text(goal, M, 138, { size: 9, gray: INK_2 });
  flow.y = 164;
}

/** Vier Kennzahlen nebeneinander */
function tiles(pdf: Pdf, flow: Flow, data: ReportData): void {
  const items: [string, string][] = [
    [String(data.minutes), 'Minuten gesamt'],
    [String(data.sessionCount), 'Lerneinheiten'],
    [`${quotePercent(data.correct, data.answered)} %`, 'Richtig-Quote'],
    [`${data.learned}/${data.planned}`, 'Inhalte gelernt'],
  ];
  const gap = 8;
  const w = (CONTENT_W - gap * (items.length - 1)) / items.length;

  items.forEach(([value, label], i) => {
    const x = M + i * (w + gap);
    pdf.rect(x, flow.y, w, 48, BOX);
    pdf.text(value, x + w / 2, flow.y + 24, { size: 15, font: 'bold', align: 'center' });
    pdf.text(label, x + w / 2, flow.y + 38, { size: 7.5, gray: INK_2, align: 'center' });
  });
  flow.y += 48;
}

function status(pdf: Pdf, flow: Flow, data: ReportData): void {
  heading(pdf, flow, 'Lernstand');

  pdf.text(statusLabel(data.pace).text, M, flow.y, { size: 10.5, font: 'bold' });
  flow.y += 14;

  paragraph(
    pdf,
    flow,
    data.pace.hasDeadline
      ? `${daysLeftLabel(data.pace)} · Tagespensum: ${data.pace.dailyTarget} Lernpunkte · am Berichtstag erreicht: ${data.pace.todayPoints}`
      : `Freies Lernen · am Berichtstag erreicht: ${data.pace.todayPoints} Lernpunkte`,
    { size: 9, gray: INK_2 },
  );

  flow.y += 4;
  ensure(pdf, flow, 14);
  pdf.text(`Streak: ${data.streak} Tage (Rekord: ${data.bestStreak})`, M, flow.y, {
    size: 9,
    gray: INK_2,
  });
  flow.y += 18;

  // Die Note steht hier ungeschönt — anders als in der Lern-Ansicht, die bei
  // einer rechnerischen 6 nur den nächsten Meilenstein nennt.
  if (data.grade.target === null) return;
  ensure(pdf, flow, 44);
  pdf.text(
    data.grade.current !== null
      ? `Noten-Einschätzung: Note ${data.grade.current}`
      : 'Noten-Einschätzung: noch keine',
    M,
    flow.y,
    { size: 10.5, font: 'bold' },
  );
  flow.y += 14;
  for (const note of [...data.grade.notes, `${coverageLabel(data.grade)}.`]) {
    paragraph(pdf, flow, note, { size: 9, gray: INK_2 });
  }
}

function chapters(pdf: Pdf, flow: Flow, data: ReportData): void {
  heading(pdf, flow, 'Fortschritt pro Kapitel');

  for (const ch of data.chapters) {
    ensure(pdf, flow, 30);
    const name = chapterById(ch.id)?.short ?? ch.id;
    pdf.text(ch.active ? name : `${name} (nicht im Lernplan)`, M, flow.y, {
      size: 9.5,
      gray: ch.active ? INK : INK_3,
    });
    pdf.text(`${ch.learned}/${ch.planned} · ${Math.round(ch.mastery * 100)} %`, M + CONTENT_W, flow.y, {
      size: 9.5,
      gray: INK_2,
      align: 'right',
    });
    flow.y += 5;
    pdf.rect(M, flow.y, CONTENT_W, 5, TRACK);
    pdf.rect(M, flow.y, CONTENT_W * clamp01(ch.mastery), 5, ch.active ? FILL : INK_3);
    flow.y += 18;
  }
}

function week(pdf: Pdf, flow: Flow, data: ReportData): void {
  heading(pdf, flow, 'Lernminuten der letzten 7 Tage');
  ensure(pdf, flow, 82);

  const max = Math.max(1, ...data.week.map((d) => d.minutes));
  const colW = CONTENT_W / data.week.length;
  const barW = 26;
  const maxH = 46;
  const base = flow.y + maxH;

  data.week.forEach((day, i) => {
    const x = M + i * colW + (colW - barW) / 2;
    const h = Math.max(1.5, (day.minutes / max) * maxH);
    pdf.rect(x, base - h, barW, h, day.minutes === 0 ? TRACK : FILL);
    pdf.text(String(day.minutes), x + barW / 2, base - h - 4, {
      size: 7.5,
      gray: INK_2,
      align: 'center',
    });
    // Der Berichtstag wird fett gesetzt statt mit einem Sternchen markiert —
    // ein „*" ohne Legende wirft nur die Frage auf, was es bedeutet.
    const isReportDay = day.date === data.today;
    pdf.text(weekdayLabel(day.date), x + barW / 2, base + 12, {
      size: 8,
      gray: isReportDay ? INK : INK_2,
      font: isReportDay ? 'bold' : 'regular',
      align: 'center',
    });
  });
  flow.y = base + 24;
}

function sessions(pdf: Pdf, flow: Flow, data: ReportData): void {
  heading(pdf, flow, 'Letzte Lerneinheiten');

  if (data.sessions.length === 0) {
    pdf.text('Noch keine Lerneinheiten aufgezeichnet.', M, flow.y, { size: 9, gray: INK_2 });
    flow.y += 14;
    return;
  }

  const cols = { dauer: M + 300, fragen: M + 386, quote: M + CONTENT_W };
  const tableHead = (): void => {
    pdf.text('WANN', M, flow.y, { size: 7, gray: INK_3 });
    pdf.text('DAUER', cols.dauer, flow.y, { size: 7, gray: INK_3, align: 'right' });
    pdf.text('FRAGEN', cols.fragen, flow.y, { size: 7, gray: INK_3, align: 'right' });
    pdf.text('QUOTE', cols.quote, flow.y, { size: 7, gray: INK_3, align: 'right' });
    flow.y += 5;
  };

  tableHead();
  for (const s of data.sessions) {
    // Bricht die Tabelle um, bekommt die neue Seite ihren eigenen Kopf — sonst
    // stehen dort vier Zahlenspalten ohne Beschriftung.
    const before = flow.y;
    ensure(pdf, flow, 18);
    if (flow.y !== before) tableHead();

    pdf.hline(M, M + CONTENT_W, flow.y, TRACK, 0.5);
    flow.y += 12;
    pdf.text(`${fmtDate(s.start)} ${fmtTime(s.start)}`, M, flow.y, { size: 9 });
    pdf.text(`${s.minutes} min`, cols.dauer, flow.y, { size: 9, align: 'right' });
    pdf.text(String(s.answered), cols.fragen, flow.y, { size: 9, align: 'right' });
    pdf.text(`${quotePercent(s.correct, s.answered)} %`, cols.quote, flow.y, {
      size: 9,
      align: 'right',
    });
    flow.y += 4;
  }
  flow.y += 8;
}

/** Woher der Bericht kommt und was er nicht kann. */
function closing(pdf: Pdf, flow: Flow, data: ReportData): void {
  ensure(pdf, flow, 62);
  flow.y += 14;
  pdf.hline(M, M + CONTENT_W, flow.y, TRACK, 0.8);
  flow.y += 14;
  paragraph(
    pdf,
    flow,
    `Dieser Bericht wurde am ${fmtStamp(data.createdAt)} automatisch von der Geo-Quest-App auf dem ` +
      `Lerngerät erzeugt. Er ist eine Momentaufnahme und aktualisiert sich nicht — für den aktuellen ` +
      `Stand bitte einen neuen Bericht anfordern oder den Eltern-Bereich direkt in der App öffnen.`,
    { size: 7.5, gray: INK_2 },
  );
}

/** „Seite 1 von 3" auf jedem Blatt. Fehlt hinterher eine Seite, sieht man es. */
function footers(pdf: Pdf, data: ReportData): void {
  const total = pdf.pageCount();
  for (let page = 1; page <= total; page++) {
    pdf.gotoPage(page);
    pdf.hline(M, M + CONTENT_W, PAGE_H - 48, TRACK, 0.5);
    pdf.text(
      `Geo-Quest · Lernbericht ${data.name} · Stand ${fmtStamp(data.createdAt)}`,
      M,
      PAGE_H - 36,
      { size: 7.5, gray: INK_3 },
    );
    pdf.text(`Seite ${page} von ${total}`, M + CONTENT_W, PAGE_H - 36, {
      size: 7.5,
      gray: INK_3,
      align: 'right',
    });
  }
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/** PDF erzeugen und weiterreichen: Teilen-Dialog wo vorhanden, sonst Download.
 *
 *  `reportPdf()` läuft synchron — der Teilen-Dialog wird also noch innerhalb der
 *  Nutzergeste geöffnet. Nach einem `await` würde iOS ihn verweigern. */
export async function saveReportPdf(data: ReportData): Promise<'shared' | 'saved'> {
  const blob = reportPdf(data);
  const name = reportFileName(data);
  const file = new File([blob], name, { type: 'application/pdf' });

  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: `Lernbericht ${data.name}` });
      return 'shared';
    } catch (err) {
      // Abbruch ist eine Entscheidung, kein Fehler — dann NICHT auch noch
      // herunterladen. Alles andere heißt: Teilen ging nicht, Download muss her.
      if (err instanceof Error && err.name === 'AbortError') return 'shared';
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return 'saved';
}
