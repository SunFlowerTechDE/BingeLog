/**
 * The rating unit: buckets of popcorn, not stars.
 *
 * Ratings live as 1..10 in the database and show as 0,5 to 5,0 buckets.
 * Half steps exist from the first migration on purpose — going from five
 * steps to ten later would silently change what every existing rating
 * meant (M3, Fallstricke).
 *
 * Each bucket is in one of three drawn states, which maps exactly onto
 * the two half-units it can hold:
 *
 *   empty  outline only
 *   half   the bag, striped, with nothing in it
 *   full   the bag with popcorn
 *
 * An earlier version clipped the full drawing at 50 % to make a half.
 * Rendered at 48, 20 and 13 px and looked at, that failed: a bucket is a
 * drawing with stripes and a ragged top, not a silhouette, and half of
 * one does not read as half of anything. Three drawn states carry the
 * difference on colour instead — yellow on top or not — which survives
 * much smaller sizes.
 *
 * The empty state is a black line drawing on transparency and would
 * vanish against the dark theme, so it is used as a CSS mask: the file
 * gives the shape, the stylesheet gives the colour.
 */

const FULL = '/popcorn-on.png';
const HALF = '/popcorn-half.png';
const OUTLINE = '/popcorn-off.png';

/** Below this the three states stop being told apart. */
export const MIN_BUCKET_SIZE = 18;

export function formatRating(rating: number): string {
  // German decimal comma, one place: 7 becomes "3,5".
  return (rating / 2).toFixed(1).replace('.', ',');
}

/** How many half-units of a bucket are filled. */
export type BucketFill = 0 | 1 | 2;

export function fillFor(rating: number, index: number): BucketFill {
  const halves = rating - index * 2;
  return halves >= 2 ? 2 : halves === 1 ? 1 : 0;
}

export function Bucket({ fill, size }: { fill: BucketFill; size: number }) {
  if (fill === 0) {
    return (
      <span
        aria-hidden="true"
        className="bg-muted-foreground/70 inline-block shrink-0"
        style={{
          width: size,
          height: size,
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
    );
  }

  return (
    <img
      aria-hidden="true"
      src={fill === 2 ? FULL : HALF}
      alt=""
      width={size}
      height={size}
      className="inline-block shrink-0 object-contain"
      style={{ width: size, height: size }}
    />
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
  return (
    <span
      className="inline-flex items-center gap-0.5"
      role="img"
      aria-label={label ?? `${formatRating(rating)} von 5 Popcorn`}
    >
      {[0, 1, 2, 3, 4].map((index) => (
        <Bucket key={index} fill={fillFor(rating, index)} size={size} />
      ))}
    </span>
  );
}
