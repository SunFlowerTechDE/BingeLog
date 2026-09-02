import Link from 'next/link';
import type { Route } from 'next';

import { formatRating, PopcornRating } from '@/components/popcorn';

export interface TopFilm {
  place: number;
  wikidata_id: string;
  title_de: string | null;
  title_original: string;
  release_year: number | null;
  poster_source: string | null;
  poster_url: string | null;
  ratings: number;
  /** Interne Skala 1 bis 10. */
  average: number | string | null;
}

/**
 * Top 10 in dieser Woche (19-web-nachziehen 4).
 *
 * Der Zeitraum ist die laufende Kalenderwoche, Montag 00:00 bis Sonntag
 * 23:59 in `Europe/Berlin` — **gezogen wird er in der Datenbank**, nicht
 * hier. Ein Client, der ihn selbst zöge, zöge ihn in seiner eigenen
 * Zeitzone.
 *
 * Gezählt werden nur öffentliche Bewertungen, damit die Liste für jeden
 * Leser dieselbe ist.
 */
export function WeeklyTop({ filme }: { filme: TopFilm[] }) {
  if (filme.length === 0) return null;

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-base font-semibold tracking-tight">Top 10 in dieser Woche</h2>
      <ul className="-mx-5 flex items-stretch gap-4 overflow-x-auto px-5 pb-2">
        {filme.map((film) => (
          <li key={film.wikidata_id} className="shrink-0">
            <RankedCard film={film} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function RankedCard({ film }: { film: TopFilm }) {
  const titel = film.title_de ?? film.title_original;
  const hatPlakat = film.poster_source === 'tvdb' && film.poster_url;

  // Gold nur für die ersten drei. Wenn jede Karte hervorgehoben ist, ist
  // keine hervorgehoben.
  const vorn = film.place <= 3;

  // `numeric` kommt als Zeichenkette an, nicht als Zahl — die erzeugten
  // Typen behaupten `number`, und das ist eine Schwäche der Typerzeugung.
  const schnitt = film.average === null ? null : Number(film.average);

  return (
    <Link
      href={`/film/${film.wikidata_id}` as Route}
      className="focus-visible:ring-ring group flex w-[140px] flex-col gap-2 rounded outline-none focus-visible:ring-2"
    >
      <div
        className={`overflow-hidden rounded-lg border-2 ${
          vorn ? 'border-primary' : 'border-border'
        }`}
      >
        <div className="bg-card aspect-[2/3]">
          {/* Ein einfaches img mit Absicht: next/image würde das Bild
              über unseren Ursprung spiegeln, und die Lizenzprüfung ist
              beim Verlinken geblieben (docs/legal/thetvdb-lizenz.md). */}
          <img
            src={hatPlakat ? (film.poster_url ?? '') : `/poster/${film.wikidata_id}`}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover"
          />
        </div>
      </div>

      <div className="flex items-baseline gap-2">
        <span
          className={`text-2xl font-bold tabular-nums leading-none ${
            vorn ? 'text-primary' : 'text-muted-foreground'
          }`}
        >
          {film.place}
        </span>
        <span className="line-clamp-2 text-[13px] font-medium leading-tight">{titel}</span>
      </div>

      {schnitt === null ? null : (
        <div className="flex items-center gap-1.5">
          <PopcornRating rating={schnitt} size={11} />
          <span className="text-muted-foreground text-[11px] tabular-nums">
            {formatRating(schnitt)} ·{' '}
            {film.ratings === 1 ? '1 Bewertung' : `${String(film.ratings)} Bewertungen`}
          </span>
        </div>
      )}
    </Link>
  );
}
