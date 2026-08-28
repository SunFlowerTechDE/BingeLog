import { PopcornRating, formatRating } from '@/components/popcorn';

/**
 * Vorlaeufiges Profilbild: die Initialen auf gefaerbtem Grund.
 *
 * Kein Platzhalterbild eines fremden Gesichts und keine graue Silhouette
 * — beides sieht aus, als waere etwas kaputt. Initialen sehen aus wie
 * eine Entscheidung, und die Farbe kommt aus dem Namen, damit dieselbe
 * Person immer denselben Kreis hat.
 *
 * Echte Bilder kommen spaeter; dann ersetzt ein <img> den Inhalt und
 * sonst nichts.
 */
const GRUENDE = [
  ['#3b2f1e', '#efbc4b'],
  ['#1e2c33', '#7fd4e8'],
  ['#2c1e33', '#c89bef'],
  ['#1e331e', '#8fdb8f'],
  ['#331e22', '#ef8b9b'],
  ['#33291e', '#e8b07f'],
] as const;

export function Avatar({ name, size = 96 }: { name: string; size?: number }) {
  let summe = 0;
  for (const zeichen of name) summe = (summe + (zeichen.codePointAt(0) ?? 0)) % 997;
  const paar = GRUENDE[summe % GRUENDE.length] ?? GRUENDE[0];

  // Zwei Zeichen: mehr wird bei kurzen Kreisen unleserlich.
  const initialen = name
    .replace(/[^a-z0-9]/gi, '')
    .slice(0, 2)
    .toUpperCase();

  return (
    <span
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        backgroundColor: paar[0],
        color: paar[1],
        fontSize: Math.round(size * 0.36),
      }}
      className="flex shrink-0 select-none items-center justify-center rounded-full font-semibold tracking-tight"
    >
      {initialen}
    </span>
  );
}

/** Eine der vier Zahlen oben. */
export function StatCard({
  label,
  value,
  note,
  rating,
}: {
  label: string;
  value: string;
  note?: string;
  rating?: number;
}) {
  return (
    <div className="border-border bg-card/40 flex flex-col gap-1 rounded-lg border p-4">
      <span className="text-muted-foreground text-xs">{label}</span>
      {rating === undefined ? (
        <span className="text-2xl font-semibold tabular-nums">{value}</span>
      ) : (
        <span className="flex items-center gap-2">
          <PopcornRating rating={rating} size={16} />
          <span className="text-2xl font-semibold tabular-nums">{formatRating(rating)}</span>
        </span>
      )}
      {note ? <span className="text-muted-foreground text-xs">{note}</span> : null}
    </div>
  );
}
