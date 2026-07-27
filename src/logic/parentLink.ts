import type { ReportData } from './report.ts';
import { REPORT_VERSION } from './report.ts';

/** Der Eltern-Link: ein kompletter Lernbericht in einer URL.
 *
 *  Die App liegt auf GitHub Pages und hat keinen Server. Ein Link, unter dem
 *  Eltern nachsehen können, kann seine Daten deshalb nur selbst mitbringen —
 *  er steckt vollständig im **Fragment** (`#/bericht/…`). Das ist kein Notbehelf,
 *  sondern hat eine angenehme Nebenwirkung: Fragmente werden nie an einen Server
 *  geschickt, tauchen also in keinem Log und in keinem Referer auf. Die Lerndaten
 *  gehen ausschließlich an die Person, die den Link bekommt.
 *
 *  Der Zufallscode steckt vorn im Token, Eltern tippen nichts ab. Was die
 *  Verschlüsselung dann noch leistet — und was nicht:
 *
 *  - **Manipulationen fallen auf.** Das GCM-Tag lässt einen editierten Link
 *    scheitern, statt still veränderte Zahlen anzuzeigen. Das ist der eigentliche
 *    Zweck: Der Bericht soll nicht heimlich schönbar sein.
 *  - **Die Hürde steigt.** Wer den Bericht fälschen will, muss PBKDF2 + AES-GCM
 *    nachbauen, statt JSON in der Adresszeile zu ändern.
 *  - **Vertraulich ist er nicht.** Wer den Link hat, sieht den Bericht — der
 *    Schlüssel reist ja mit. Er schützt gegen zufälliges Finden, nicht gegen
 *    Weiterleiten. Die Oberfläche sagt das auch so.
 *
 *  Absolute Echtheit kann keine rein clientseitige Lösung geben: Der Bericht
 *  entsteht auf dem Gerät des Kindes. Prüfbar bleibt vor allem das
 *  Erstellungsdatum — deshalb steht es in jeder Ansicht ganz oben.
 */

/** Bytes über einem echten ArrayBuffer. Seit TypeScript 5.7 ist `Uint8Array`
 *  generisch und meint ohne Argument `ArrayBufferLike` — darin steckt auch
 *  SharedArrayBuffer, den weder WebCrypto noch Blob annehmen. */
type Bytes = Uint8Array<ArrayBuffer>;

/** Ohne I/O/0/1 — die verwechselt man beim Vorlesen. */
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 8;

/** Aufbau des Umschlags: [version][salt][iv][ciphertext+tag] */
const ENVELOPE_VERSION = 1;
const SALT_BYTES = 16;
const IV_BYTES = 12;
const PBKDF2_ITERATIONS = 150_000;

/** Erstes Byte des Klartexts: ist die Nutzlast komprimiert? */
const PLAIN_RAW = 0;
const PLAIN_DEFLATE = 1;

export type ParentLinkReason =
  /** Gar kein Token in der Adresse */
  | 'empty'
  /** Unvollständig, verstümmelt oder nachträglich verändert */
  | 'unreadable'
  /** Der Browser kann das Packformat nicht auspacken (zu alt) */
  | 'unsupported'
  /** Von einer neueren App-Version erzeugt */
  | 'version';

export type ParentLinkResult =
  | { ok: true; data: ReportData }
  | { ok: false; reason: ParentLinkReason };

/** Bericht zu einem teilbaren Link machen. */
export async function createParentLink(data: ReportData): Promise<string> {
  const code = randomCode();
  const plain = await packPlaintext(JSON.stringify(data));

  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const header = Uint8Array.of(ENVELOPE_VERSION);
  const key = await deriveKey(code, salt);
  const cipher = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: header }, key, plain),
  );

  return linkUrl(code + toBase64Url(concat(header, salt, iv, cipher)));
}

/** Token aus der Adresse zurück in einen Bericht verwandeln.
 *  Liefert einen Grund statt zu werfen — die Eltern-Ansicht formuliert daraus
 *  eine Erklärung, und „kaputt" verdient eine andere als „zu neu". */
export async function readParentLink(token: string): Promise<ParentLinkResult> {
  const clean = (token ?? '').trim().replace(/\s+/g, '');
  if (clean.length === 0) return { ok: false, reason: 'empty' };
  if (clean.length <= CODE_LENGTH) return { ok: false, reason: 'unreadable' };

  const code = clean.slice(0, CODE_LENGTH);
  const envelope = fromBase64Url(clean.slice(CODE_LENGTH));
  if (!envelope || envelope.length <= 1 + SALT_BYTES + IV_BYTES) {
    return { ok: false, reason: 'unreadable' };
  }
  if (envelope[0] !== ENVELOPE_VERSION) return { ok: false, reason: 'version' };

  const salt = envelope.subarray(1, 1 + SALT_BYTES);
  const iv = envelope.subarray(1 + SALT_BYTES, 1 + SALT_BYTES + IV_BYTES);
  const cipher = envelope.subarray(1 + SALT_BYTES + IV_BYTES);

  let plain: Bytes;
  try {
    const key = await deriveKey(code, salt);
    plain = new Uint8Array(
      await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv, additionalData: envelope.subarray(0, 1) },
        key,
        cipher,
      ),
    );
  } catch {
    // Falscher Code, abgeschnittener Link oder nachträglich verändert — von außen
    // nicht unterscheidbar, und für die Anzeige auch nicht nötig.
    return { ok: false, reason: 'unreadable' };
  }

  const unpacked = await unpackPlaintext(plain);
  if (!unpacked.ok) return { ok: false, reason: unpacked.reason };

  let data: ReportData;
  try {
    data = JSON.parse(unpacked.json) as ReportData;
  } catch {
    return { ok: false, reason: 'unreadable' };
  }
  // Grundgerüst prüfen, bevor die Ansicht darauf zugreift: Ein Bericht ohne
  // Stichtag hätte genau die Angabe nicht, für die es ihn gibt.
  if (
    typeof data?.v !== 'number' ||
    typeof data?.createdAt !== 'string' ||
    typeof data?.today !== 'string' ||
    typeof data?.name !== 'string' ||
    !Array.isArray(data?.chapters)
  ) {
    return { ok: false, reason: 'unreadable' };
  }
  if (data.v > REPORT_VERSION) return { ok: false, reason: 'version' };
  return { ok: true, data };
}

/** Adresse des Berichts — mit dem Basispfad, unter dem die App wirklich liegt
 *  (lokal „/", auf GitHub Pages „/<repo>/"). */
function linkUrl(token: string): string {
  const base = new URL(import.meta.env.BASE_URL, location.href);
  return `${base.origin}${base.pathname}#/bericht/${token}`;
}

function randomCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(CODE_LENGTH));
  // 256 ist ein Vielfaches von 32 — Modulo verzerrt hier also nichts.
  return [...bytes].map((b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
}

async function deriveKey(code: string, salt: Bytes): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(code),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

// ---------------------------------------------------------------------------
// Nutzlast: erst packen, dann verschlüsseln
// ---------------------------------------------------------------------------

/** Kompression ist hier kein Feinschliff, sondern der Unterschied zwischen
 *  „teilbar" und „unhandlich": Ein Bericht mit 20 Lerneinheiten sind rund
 *  2,8 kB JSON — deflate macht daraus knapp 0,7 kB und damit einen Link von
 *  ~1070 statt ~3940 Zeichen. Fehlt CompressionStream, funktioniert der Link
 *  trotzdem, er wird nur länger. */
async function packPlaintext(json: string): Promise<Bytes> {
  const raw = new TextEncoder().encode(json);
  const packed = await deflate(raw);
  return packed
    ? concat(Uint8Array.of(PLAIN_DEFLATE), packed)
    : concat(Uint8Array.of(PLAIN_RAW), raw);
}

/** An dieser Stelle hat AES-GCM den Klartext bereits als echt bestätigt. Ein
 *  Fehler heißt hier deshalb nicht „kaputt", sondern „dieser Browser kann das
 *  nicht auspacken" — und das ist ein realistischer Fall: Der Link entsteht auf
 *  einem aktuellen Lerngerät, geöffnet wird er womöglich auf einem älteren
 *  Elterngerät. „Bericht beschädigt" wäre dort schlicht die falsche Auskunft. */
async function unpackPlaintext(
  plain: Bytes,
): Promise<{ ok: true; json: string } | { ok: false; reason: ParentLinkReason }> {
  const flag = plain[0];
  const body = plain.subarray(1);
  if (flag === PLAIN_RAW) return { ok: true, json: new TextDecoder().decode(body) };
  if (flag !== PLAIN_DEFLATE) return { ok: false, reason: 'unreadable' };
  if (typeof DecompressionStream === 'undefined') return { ok: false, reason: 'unsupported' };
  const raw = await inflate(body);
  return raw ? { ok: true, json: new TextDecoder().decode(raw) } : { ok: false, reason: 'unsupported' };
}

async function deflate(bytes: Bytes): Promise<Bytes | null> {
  if (typeof CompressionStream === 'undefined') return null;
  try {
    return await drain(new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw')));
  } catch {
    return null;
  }
}

async function inflate(bytes: Bytes): Promise<Bytes | null> {
  if (typeof DecompressionStream === 'undefined') return null;
  try {
    return await drain(
      new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw')),
    );
  } catch {
    return null;
  }
}

async function drain(stream: ReadableStream): Promise<Bytes> {
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

// ---------------------------------------------------------------------------
// Bytes ⇄ Text
// ---------------------------------------------------------------------------

function concat(...parts: Bytes[]): Bytes {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

/** base64url ohne Polsterung — „+/=" sind in einer URL entweder unzulässig
 *  oder werden von Messengern gern abgeschnitten. */
function toBase64Url(bytes: Bytes): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

function fromBase64Url(value: string): Bytes | null {
  const padded = value.replaceAll('-', '+').replaceAll('_', '/');
  try {
    const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}
