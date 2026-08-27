'use client';

/**
 * What an action has to say for itself.
 *
 * Server actions here return `{ error }` rather than throwing, and for a
 * while nothing rendered it: tapping a popcorn, adding to the watchlist
 * or deleting an entry could fail and the page would simply not change.
 * Silence is the worst answer an interface can give, because it is
 * indistinguishable from success.
 */
export function ActionNote({ message, tone = 'error' }: { message?: string | undefined; tone?: 'error' | 'info' }) {
  if (!message) return null;

  return (
    <p
      role={tone === 'error' ? 'alert' : 'status'}
      className={`text-sm ${tone === 'error' ? 'text-destructive' : 'text-muted-foreground'}`}
    >
      {message}
    </p>
  );
}
