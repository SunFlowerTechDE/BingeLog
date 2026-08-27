/**
 * Formatting for `date` columns.
 *
 * PostgREST hands a `date` back as 'YYYY-MM-DD'. Passing that to
 * `new Date()` parses it as midnight UTC and then renders it in the
 * viewer's zone, which west of Greenwich shows the day before. The date
 * a film was watched on has no time and no zone, so it is taken apart
 * rather than parsed.
 */

const MONTHS = [
  'Januar',
  'Februar',
  'März',
  'April',
  'Mai',
  'Juni',
  'Juli',
  'August',
  'September',
  'Oktober',
  'November',
  'Dezember',
];

export function formatWatchedOn(value: string | null): string | null {
  if (!value) return null;

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const [, year, month, day] = match;
  const monthName = MONTHS[Number(month) - 1];
  if (!monthName) return null;

  return `${String(Number(day))}. ${monthName} ${String(year)}`;
}

/**
 * Wie lange eine Rezension her ist, grob.
 *
 * `created_at` ist ein Zeitstempel mit Zone, anders als `watched_on` —
 * hier ist Parsen richtig. Auf den Tag genau gerundet: "vor 3 Stunden"
 * suggeriert eine Genauigkeit, die niemanden interessiert, und bei einer
 * Rezension zaehlt nur, ob sie frisch ist oder alt.
 */
export function formatAge(value: string, now = new Date()): string {
  const then = new Date(value);
  const minutes = Math.floor((now.getTime() - then.getTime()) / 60000);

  if (minutes < 60) return 'gerade eben';

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours === 1 ? 'vor 1 Stunde' : `vor ${String(hours)} Stunden`;

  const days = Math.floor(hours / 24);
  if (days === 1) return 'gestern';
  if (days < 7) return `vor ${String(days)} Tagen`;

  const weeks = Math.floor(days / 7);
  if (weeks < 5) return weeks === 1 ? 'vor 1 Woche' : `vor ${String(weeks)} Wochen`;

  const months = Math.floor(days / 30);
  if (months < 12) return months === 1 ? 'vor 1 Monat' : `vor ${String(months)} Monaten`;

  const years = Math.floor(days / 365);
  return years === 1 ? 'vor 1 Jahr' : `vor ${String(years)} Jahren`;
}
