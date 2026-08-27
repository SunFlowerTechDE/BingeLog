/**
 * The rating unit: buckets of popcorn, not stars.
 *
 * Ratings live as 1..10 in the database and show as 0,5 to 5,0 buckets.
 * Half steps exist from the first migration on purpose — going from five
 * steps to ten later would silently change what every existing rating
 * meant (M3, Fallstricke).
 *
 * Two images do the work. The filled one is drawn as it is; the empty one
 * is a black line drawing on transparency, which would vanish against the
 * dark theme, so it is used as a mask and takes its colour from the
 * stylesheet instead of from the file.
 *
 * Do not render these below about 18 px. A star is a silhouette and
 * survives any size; a bucket of popcorn is a drawing with stripes and a
 * ragged top, and at 13 px the five of them turn into one orange smear
 * with no readable half. Checked by rendering every step at 48, 20 and
 * 13 px and looking at them.
 */

/** Below this the drawing stops being readable. */
export const MIN_BUCKET_SIZE = 18;

const FILLED = '/popcorn-on.png';
const OUTLINE = '/popcorn-off.png';

export function formatRating(rating: number): string {
  // German decimal comma, one place: 7 becomes "3,5".
  return (rating / 2).toFixed(1).replace('.', ',');
}

/** One bucket, filled from the left by `portion` (0 to 1). */
export function Bucket({ portion, size }: { portion: number; size: number }) {
  const clamped = Math.max(0, Math.min(1, portion));

  return (
    <span
      className="relative inline-block shrink-0"
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <span
        className="bg-muted-foreground/70 absolute inset-0"
        style={{
          maskImage: `url(${OUTLINE})`,
          maskSize: 'contain',
          maskRepeat: 'no-repeat',
          maskPosition: 'center',
          WebkitMaskImage: `url(${OUTLINE})`,
          WebkitMaskSize: 'contain',
          WebkitMaskRepeat: 'no-repeat',
          WebkitMaskPosition: 'center',
        }}
      />

      {clamped > 0 ? (
        // Clipped rather than faded: a half rating shows half a bucket.
        <span
          className="absolute inset-y-0 left-0 overflow-hidden"
          style={{ width: `${String(clamped * 100)}%` }}
        >
          <img
            src={FILLED}
            alt=""
            width={size}
            height={size}
            className="max-w-none"
            style={{ width: size, height: size }}
          />
        </span>
      ) : null}
    </span>
  );
}

/** Read-only rating, for the community verdict and other people's entries. */
export function PopcornRating({
  rating,
  size = 20,
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
      aria-label={label ?? `${formatRating(rating)} von 5 Popcorn`}
    >
      {[0, 1, 2, 3, 4].map((index) => (
        <Bucket key={index} portion={filled - index} size={size} />
      ))}
    </span>
  );
}
