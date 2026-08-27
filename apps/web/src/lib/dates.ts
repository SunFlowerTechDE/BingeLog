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
