/**
 * Star display and star input.
 *
 * Ratings live as 1..10 in the database and show as 0,5 to 5,0 stars.
 * Half steps exist from the first migration on purpose: going from five
 * steps to ten later would silently change what every existing rating
 * meant (M3, Fallstricke).
 */

const STAR_PATH =
  'M12 2.6l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.4 6.2 20.5l1.1-6.5L2.6 9.4l6.5-.9z';

export function formatRating(rating: number): string {
  // German decimal comma, one place: 7 becomes "3,5".
  return (rating / 2).toFixed(1).replace('.', ',');
}

/** Read-only stars, for the community average and for other people's entries. */
export function Stars({
  rating,
  size = 16,
  label,
}: {
  rating: number;
  size?: number;
  label?: string;
}) {
  const filled = rating / 2;

  return (
    <span
      className="inline-flex items-center gap-0.5"
      role="img"
      aria-label={label ?? `${formatRating(rating)} von 5 Sternen`}
    >
      {[0, 1, 2, 3, 4].map((index) => {
        const portion = Math.max(0, Math.min(1, filled - index));
        const id = `star-${String(index)}-${String(Math.round(portion * 100))}`;
        return (
          <svg key={index} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
            <defs>
              <linearGradient id={id}>
                <stop offset={`${String(portion * 100)}%`} stopColor="currentColor" />
                <stop offset={`${String(portion * 100)}%`} stopColor="transparent" />
              </linearGradient>
            </defs>
            <path d={STAR_PATH} fill={`url(#${id})`} className="text-primary" />
            <path
              d={STAR_PATH}
              fill="none"
              stroke="currentColor"
              strokeWidth="1.2"
              className="text-muted-foreground opacity-40"
            />
          </svg>
        );
      })}
    </span>
  );
}
