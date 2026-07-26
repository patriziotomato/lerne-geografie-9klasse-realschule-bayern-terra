import { state } from '../store.ts';

/** Erzeugt eine .ics-Datei mit täglich wiederkehrenden Lernterminen bis zur
 *  Deadline — so erinnert der Handy-Kalender zuverlässig, auch ohne Server. */
export function buildIcs(): string {
  const p = state.profile;
  if (!p || p.studyTimes.length === 0) return '';

  // Mit Lernziel enden die Termine dort; ohne laufen sie unbegrenzt weiter.
  const rrule = p.deadline
    ? `RRULE:FREQ=DAILY;UNTIL=${p.deadline.replace(/-/g, '')}T235959`
    : 'RRULE:FREQ=DAILY';
  const today = new Date();
  const stamp = formatLocal(today);

  const events = p.studyTimes.map((t, i) => {
    const [h, m] = t.split(':').map(Number);
    const start = new Date(today);
    start.setHours(h, m, 0, 0);
    if (start.getTime() < Date.now()) start.setDate(start.getDate() + 1);
    const end = new Date(start.getTime() + 20 * 60000);
    return [
      'BEGIN:VEVENT',
      `UID:geoquest-${i}-${t.replace(':', '')}@geoquest.local`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${formatLocal(start)}`,
      `DTEND:${formatLocal(end)}`,
      rrule,
      'SUMMARY:🌍 Geo lernen (Geo-Quest)',
      'DESCRIPTION:10 Fragen Geografie — dein Streak wartet!',
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      'DESCRIPTION:Zeit zum Geo-Lernen! 🌍',
      'TRIGGER:PT0M',
      'END:VALARM',
      'END:VEVENT',
    ].join('\r\n');
  });

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//GeoQuest//Lernplan//DE',
    'CALSCALE:GREGORIAN',
    ...events,
    'END:VCALENDAR',
  ].join('\r\n');
}

function formatLocal(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}T${p(d.getHours())}${p(d.getMinutes())}00`;
}

export function downloadIcs(): void {
  const content = buildIcs();
  if (!content) return;
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'geo-lernplan.ics';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
