import Link from 'next/link';
import type { Route } from 'next';

export interface TileFilm {
  wikidata_id: string;
  title_de: string | null;
  title_original: string;
  release_year: number | null;
  poster_source: string | null;
  poster_url: string | null;
  director: string | null;
}

/**
 * Was der Leser mit dem Film schon zu tun hatte.
 *
 * Auf der Trefferliste erspart das ein Aufschlagen, um zu sehen, ob man
 * ihn laengst eingetragen hat (Suchkonzept, 19-web-nachziehen 10).
 */
export interface TileMark {
  seen?: boolean;
  onWatchlist?: boolean;
}

/**
 * One tile in the grid. Reference width is 120 to 150 px, which is the
 * size the whole visual system is designed around (02-product.md).
 *
 * A generated card and a real poster are both complete states, not one
 * standing in for the other (ADR-004), so they get the same frame and the
 * same treatment.
 */
export function FilmTile({ film, mark }: { film: TileFilm; mark?: TileMark | undefined }) {
  const title = film.title_de ?? film.title_original;
  const hasArtwork = film.poster_source === 'tvdb' && film.poster_url;

  return (
    <Link
      href={`/film/${film.wikidata_id}` as Route}
      className="focus-visible:ring-ring group flex w-[120px] flex-col gap-1.5 rounded outline-none focus-visible:ring-2 sm:w-[140px]"
    >
      <div className="bg-card relative aspect-[2/3] overflow-hidden rounded">
        {hasArtwork ? (
          // A plain img on purpose: next/image would proxy and cache the
          // artwork on our origin, and the licence check settled on linking
          // rather than mirroring (docs/legal/thetvdb-lizenz.md).
          <img
            src={film.poster_url ?? ''}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <img
            src={`/poster/${film.wikidata_id}`}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover"
          />
        )}
        {/* Nur eine Marke. "Gesehen" ist die staerkere Aussage: was man
            gesehen hat, steht nicht mehr auf der Merkliste. */}
        {mark?.seen === true || mark?.onWatchlist === true ? (
          <span className="absolute left-1.5 top-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm">
            {mark.seen === true ? 'Gesehen' : 'In Watchlist'}
          </span>
        ) : null}
      </div>

      <div className="flex flex-col gap-0.5">
        <span className="line-clamp-2 text-[13px] font-medium leading-tight">{title}</span>
        <span className="text-muted-foreground text-[11px]">
          {/* The year always sits next to the title, and the director joins
              it when several films share one (M3 3.2). */}
          {film.release_year ?? '—'}
          {film.director ? ` · ${film.director}` : ''}
        </span>
      </div>
    </Link>
  );
}
