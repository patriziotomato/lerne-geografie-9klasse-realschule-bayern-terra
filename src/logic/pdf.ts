/** Minimaler PDF-Schreiber — bewusst ohne Bibliothek.
 *
 *  Gebraucht wird nur, was ein Lernbericht braucht: Text in zwei Schnitten,
 *  Linien und gefüllte Rechtecke (Fortschrittsbalken). Dafür eine Abhängigkeit
 *  aufzunehmen, wäre in einer App ohne jede Laufzeit-Dependency der teuerste
 *  Weg — ein PDF mit den Standardschriften ist eine reine Textdatei.
 *
 *  Zwei Eigenheiten des Formats, die den Code prägen:
 *
 *  1. **Byte-Offsets.** Die xref-Tabelle am Ende nennt für jedes Objekt seine
 *     Position in Bytes. Deshalb wird das Dokument als „Binärstring" gebaut, in
 *     dem jedes Zeichen genau ein Byte ist (Code 0–255) — dann ist `length`
 *     zugleich der Offset. Alles, was in den String geht, muss vorher nach
 *     WinAnsi kodiert sein.
 *  2. **Ursprung unten links.** PDF zählt y von der Blattunterkante nach oben,
 *     Layoutcode denkt von oben nach unten. Diese Datei nimmt deshalb überall
 *     y „von oben" entgegen und dreht es erst beim Schreiben um.
 *
 *  Die Standardschriften (Helvetica) können nur WinAnsi — also Latin-1 plus ein
 *  paar Typografiezeichen. Emojis gibt es im PDF nicht; `winAnsi()` lässt sie
 *  weg, statt Ersatzkästchen zu drucken.
 */

/** A4 in Punkt (1/72 Zoll) */
export const PAGE_W = 595;
export const PAGE_H = 842;

export type PdfFont = 'regular' | 'bold';

export interface TextOptions {
  font?: PdfFont;
  size?: number;
  /** 0 = schwarz … 1 = weiß */
  gray?: number;
  /** Wogegen `x` ausgerichtet wird: linke Kante, rechte Kante oder Mitte */
  align?: 'left' | 'right' | 'center';
}

export interface Pdf {
  /** Text setzen. `y` ist die Grundlinie, gemessen von der Blattoberkante. */
  text(value: string, x: number, y: number, opts?: TextOptions): void;
  /** Gefülltes Rechteck. `y` ist die Oberkante. */
  rect(x: number, y: number, w: number, h: number, gray: number): void;
  /** Waagerechte Linie */
  hline(x1: number, x2: number, y: number, gray?: number, width?: number): void;
  /** Textbreite in Punkt — für Umbruch und Ausrichtung */
  widthOf(value: string, font?: PdfFont, size?: number): number;
  /** Text auf eine Breite umbrechen */
  wrap(value: string, maxWidth: number, font?: PdfFont, size?: number): string[];
  newPage(): void;
  pageCount(): number;
  /** Aktuelle Seitennummer (1-basiert) */
  page(): number;
  /** Auf eine schon geschriebene Seite zurückspringen. Gebraucht für die
   *  Fußzeile: „Seite 1 von 3" steht erst fest, wenn alles gesetzt ist. */
  gotoPage(page: number): void;
  blob(title: string): Blob;
}

// ---------------------------------------------------------------------------
// WinAnsi-Kodierung
// ---------------------------------------------------------------------------

/** Zeichen, die WinAnsi zwar kennt, Unicode aber anders nummeriert (0x80–0x9F). */
const WIN_ANSI_EXTRAS: Record<string, number> = {
  '€': 0x80,
  '‚': 0x82,
  ƒ: 0x83,
  '„': 0x84,
  '…': 0x85,
  '†': 0x86,
  '‡': 0x87,
  ˆ: 0x88,
  '‰': 0x89,
  Š: 0x8a,
  '‹': 0x8b,
  Œ: 0x8c,
  Ž: 0x8e,
  '‘': 0x91,
  '’': 0x92,
  '“': 0x93,
  '”': 0x94,
  '•': 0x95,
  '–': 0x96,
  '—': 0x97,
  '˜': 0x98,
  '™': 0x99,
  š: 0x9a,
  '›': 0x9b,
  œ: 0x9c,
  ž: 0x9e,
  Ÿ: 0x9f,
};

/** Unicode → WinAnsi-Bytes, als Binärstring. Nicht darstellbare Zeichen
 *  (Emojis, CJK, …) fallen weg — ein Ersatzkästchen wäre im Bericht störender
 *  als die Lücke. */
export function winAnsi(value: string): string {
  let out = '';
  for (const ch of value) {
    const code = ch.codePointAt(0)!;
    if (code === 0x0a || code === 0x0d) {
      out += ' ';
    } else if (code >= 0x20 && code <= 0x7e) {
      out += ch;
    } else if (code >= 0xa0 && code <= 0xff) {
      out += String.fromCharCode(code);
    } else {
      const mapped = WIN_ANSI_EXTRAS[ch];
      if (mapped !== undefined) out += String.fromCharCode(mapped);
    }
  }
  return out;
}

/** Sonderzeichen in PDF-Textliteralen maskieren */
function escapeLiteral(binary: string): string {
  return binary.replace(/[\\()]/g, (m) => `\\${m}`);
}

// ---------------------------------------------------------------------------
// Schriftbreiten (Adobe-Standardmetriken, 1/1000 em)
// ---------------------------------------------------------------------------

/** Breiten für ASCII 32–126. */
const W_REGULAR = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556,
  556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667,
  611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667,
  667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500,
  222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584,
];

const W_BOLD = [
  278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556,
  556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611, 975, 722, 722, 722, 722, 667,
  611, 778, 722, 278, 556, 722, 611, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667,
  667, 611, 333, 278, 333, 584, 556, 333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556,
  278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584,
];

/** Grundbuchstabe je Zeichen von 0xC0 bis 0xFF. Akzentbuchstaben sind in
 *  Helvetica genau so breit wie ihr Grundbuchstabe — der Akzent sitzt über der
 *  Zeichenbreite. „ß" fällt hier auf „s" zurück, das ist die einzige echte
 *  Näherung und liegt rund 10 Punkt daneben (bei 1000 Einheiten je Geviert). */
const ACCENT_BASE = 'AAAAAAACEEEEIIIIDNOOOOO*OUUUUYPsaaaaaaaceeeeiiiidnooooo/ouuuuypy';

function charWidth(code: number, table: number[]): number {
  if (code >= 32 && code <= 126) return table[code - 32];
  if (code >= 0xc0 && code <= 0xff) {
    const base = ACCENT_BASE.charCodeAt(code - 0xc0);
    return table[base - 32] ?? table[0];
  }
  // Alles Übrige (geschütztes Leerzeichen, Typografiezeichen, Symbole) ist für
  // Umbruch und Ausrichtung selten genug, dass eine Leerzeichenbreite reicht.
  return table[0];
}

// ---------------------------------------------------------------------------
// Dokument
// ---------------------------------------------------------------------------

interface Page {
  ops: string[];
}

export function createPdf(): Pdf {
  const pages: Page[] = [{ ops: [] }];
  let current = 0;

  const ops = () => pages[current].ops;
  const num = (n: number) => (Math.round(n * 100) / 100).toString();

  function widthOf(value: string, font: PdfFont = 'regular', size = 10): number {
    const table = font === 'bold' ? W_BOLD : W_REGULAR;
    const binary = winAnsi(value);
    let sum = 0;
    for (let i = 0; i < binary.length; i++) sum += charWidth(binary.charCodeAt(i), table);
    return (sum / 1000) * size;
  }

  return {
    widthOf,

    text(value, x, y, opts = {}) {
      const { font = 'regular', size = 10, gray = 0, align = 'left' } = opts;
      const binary = winAnsi(value);
      if (binary.length === 0) return;
      const w = widthOf(value, font, size);
      const left = align === 'right' ? x - w : align === 'center' ? x - w / 2 : x;
      ops().push(
        `BT ${num(gray)} g /${font === 'bold' ? 'F2' : 'F1'} ${num(size)} Tf ` +
          `1 0 0 1 ${num(left)} ${num(PAGE_H - y)} Tm (${escapeLiteral(binary)}) Tj ET`,
      );
    },

    rect(x, y, w, h, gray) {
      if (w <= 0 || h <= 0) return;
      ops().push(`${num(gray)} g ${num(x)} ${num(PAGE_H - y - h)} ${num(w)} ${num(h)} re f`);
    },

    hline(x1, x2, y, gray = 0.75, width = 0.6) {
      ops().push(
        `${num(gray)} G ${num(width)} w ${num(x1)} ${num(PAGE_H - y)} m ${num(x2)} ${num(PAGE_H - y)} l S`,
      );
    },

    wrap(value, maxWidth, font = 'regular', size = 10) {
      const words = value.split(/\s+/).filter(Boolean);
      const lines: string[] = [];
      let line = '';
      for (const word of words) {
        const candidate = line ? `${line} ${word}` : word;
        if (line && widthOf(candidate, font, size) > maxWidth) {
          lines.push(line);
          line = word;
        } else {
          line = candidate;
        }
      }
      if (line) lines.push(line);
      return lines;
    },

    newPage() {
      pages.push({ ops: [] });
      current = pages.length - 1;
    },

    pageCount: () => pages.length,
    page: () => current + 1,

    gotoPage(page) {
      current = Math.min(pages.length, Math.max(1, page)) - 1;
    },

    blob(title) {
      return new Blob([serialize(pages, title)], { type: 'application/pdf' });
    },
  };
}

/** Objekte zusammensetzen und die xref-Tabelle mit echten Byte-Offsets bauen. */
function serialize(pages: Page[], title: string): Uint8Array<ArrayBuffer> {
  const objects: string[] = [];
  const add = (body: string): number => {
    objects.push(body);
    return objects.length; // 1-basierte Objektnummer
  };

  // Feste Nummern zuerst reservieren, damit /Pages seine Kinder benennen kann.
  const catalogId = add('');
  const pagesId = add('');
  const fontRegular = add(
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
  );
  const fontBold = add(
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
  );

  const pageIds: number[] = [];
  for (const page of pages) {
    const content = page.ops.join('\n');
    const contentId = add(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
    pageIds.push(
      add(
        `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] ` +
          `/Resources << /Font << /F1 ${fontRegular} 0 R /F2 ${fontBold} 0 R >> >> ` +
          `/Contents ${contentId} 0 R >>`,
      ),
    );
  }

  const infoId = add(
    `<< /Title (${escapeLiteral(winAnsi(title))}) /Producer (Geo-Quest) /Creator (Geo-Quest) >>`,
  );

  objects[catalogId - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
  objects[pagesId - 1] =
    `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`;

  let out = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });

  const xrefAt = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) out += `${String(off).padStart(10, '0')} 00000 n \n`;
  out +=
    `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R /Info ${infoId} 0 R >>\n` +
    `startxref\n${xrefAt}\n%%EOF\n`;

  // Der Binärstring enthält per Konstruktion nur Codes 0–255.
  const bytes = new Uint8Array(out.length);
  for (let i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 0xff;
  return bytes;
}
