import Link from 'next/link';
import type { Metadata, Route } from 'next';

import { createClient } from '@/lib/supabase/server';
import { getViewer } from '@/lib/session';

export const metadata: Metadata = { title: 'Watchlist' };

interface Row {
  film_id: string;
  added_at: string;
  films: {
    title_de: string | null;
    title_original: string;
    release_year: number | null;
    poster_source: string | null;
    poster_url: string | null;
  } | null;
}

/**
 * M3 3.3 — the watchlist.
 *
 * Private by policy rather than by choice: the table has no read policy
 * for anyone but its owner. What someone has not seen yet says something
 * different from what they have (M0 0.4).
 */
export default async function WatchlistPage() {
  const viewer = await getViewer();
  if (!viewer) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from('watchlist')
    .select(
      'film_id, added_at, films(title_de, title_original, release_year, poster_source, poster_url)',
    )
    .order('added_at', { ascending: false });

  const rows = (data ?? []) as unknown as Row[];

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 px-5 py-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Watchlist</h1>
        <p className="text-muted-foreground text-sm">
          {rows.length === 0
            ? 'Noch nichts vorgemerkt.'
            : rows.length === 1
              ? '1 Film'
              : `${String(rows.length)} Filme`}
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          Auf einer Filmseite steht ein Knopf dafür.{' '}
          <Link href="/" className="text-foreground underline underline-offset-4">
            Zur Suche
          </Link>
        </p>
      ) : (
        <div className="flex flex-wrap gap-x-4 gap-y-6">
          {rows.map((row) => {
            const film = row.films;
            const title = film?.title_de ?? film?.title_original ?? row.film_id;
            const artwork =
              film?.poster_source === 'tvdb' && film.poster_url
                ? film.poster_url
                : `/poster/${row.film_id}`;

            return (
              <Link
                key={row.film_id}
                href={`/film/${row.film_id}` as Route}
                className="flex w-[120px] flex-col gap-1.5 sm:w-[140px]"
              >
                <div className="bg-card aspect-[2/3] overflow-hidden rounded">
                  {/* Linked, never mirrored (docs/legal/thetvdb-lizenz.md). */}
                  <img src={artwork} alt="" loading="lazy" className="h-full w-full object-cover" />
                </div>
                <span className="line-clamp-2 text-[13px] font-medium leading-tight">{title}</span>
                {film?.release_year ? (
                  <span className="text-muted-foreground text-[11px]">{film.release_year}</span>
                ) : null}
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}
