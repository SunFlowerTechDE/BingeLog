import { Suspense } from 'react';
import Link from 'next/link';
import type { Route } from 'next';

import { createClient } from '@/lib/supabase/server';
import { type TileFilm, type TileMark } from '@/components/film-tile';
import { SearchInput } from '@/components/search-input';
import { SearchHistory } from '@/components/search-history';
import { Discover } from '@/components/discover';
import { getViewer } from '@/lib/session';
import { LazySearch } from '@/components/lazy-search';

async function Results({ query, year }: { query: string; year: number | null }) {
  if (query.trim().length < 2) {
    return (
      <p className="text-muted-foreground text-sm">
        Tipp einen Titel. Ab zwei Zeichen wird gesucht.
      </p>
    );
  }

  const supabase = await createClient();

  // Ranking lives in the database, not here (M3 3.2, Fallstricke).
  // Das Jahr **filtert**, es gewichtet nicht: es ist eine Angabe, die
  // der Suchende gemacht hat, kein Hinweis.
  const { data, error } = await supabase.rpc('search_films', {
    query,
    max_results: 40,
    ...(year === null ? {} : { in_year: year }),
  });

  if (error) {
    console.error('search_films failed:', error.message);
    return <p className="text-destructive text-sm">Die Suche antwortet gerade nicht.</p>;
  }

  const films = data as unknown as TileFilm[];

  // Zwei Abfragen fuer die ganze Trefferliste, nicht zwei je Zeile —
  // dieselbe Aufteilung wie in der App. Ohne Anmeldung entfaellt beides.
  const marks: Record<string, TileMark> = {};
  const ids = films.map((f) => f.wikidata_id);
  const viewer = await getViewer();

  if (viewer && ids.length > 0) {
    const [{ data: gesehen }, { data: gemerkt }] = await Promise.all([
      supabase.from('diary_entries').select('film_id').eq('user_id', viewer.id).in('film_id', ids),
      supabase.from('watchlist').select('film_id').eq('user_id', viewer.id).in('film_id', ids),
    ]);
    for (const row of gesehen ?? []) marks[row.film_id] = { ...marks[row.film_id], seen: true };
    for (const row of gemerkt ?? []) {
      marks[row.film_id] = { ...marks[row.film_id], onWatchlist: true };
    }
  }

  // Findet die Suche mit Jahr nichts, sagt sie das ausdruecklich —
  // sonst sieht es aus, als gaebe es den Film ueberhaupt nicht.
  const ohneJahr = new URLSearchParams({ q: query }).toString();

  return (
    <>
      {year !== null && films.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          Nichts gefunden. Ohne das Jahr gibt es vielleicht Treffer.{' '}
          <Link
            href={`/?${ohneJahr}` as Route}
            className="text-foreground underline underline-offset-4"
          >
            Ohne Jahr suchen
          </Link>
        </p>
      ) : null}

      {/* M3 3.2: a search that finds nothing may reach past the catalog.
          The list is handed to the same client component that offers to
          create the film, so it stays mounted when the answer changes
          underneath it. */}
      <LazySearch term={query} films={films} year={year} marks={marks} />
    </>
  );
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; j?: string }>;
}) {
  const { q, j } = await searchParams;
  const query = q ?? '';

  // Vier Ziffern oder nichts. Ein angefangenes Jahr filtert nicht — es
  // wuerde beim Tippen von "1999" kurz nach 199 suchen und die Liste
  // leeren.
  const year = j !== undefined && /^\d{4}$/.test(j) ? Number(j) : null;

  // Angemeldet ist die Startseite die Entdecken-Seite. Die Suche sitzt
  // seit dem Umbau der Kopfleiste in der Lupe; ein zweites grosses Feld
  // hier waere derselbe Weg noch einmal.
  //
  // Ausser es wird gesucht: `?q=` gehoert weiter hierher, damit eine
  // geteilte Trefferadresse bei jedem dasselbe zeigt — angemeldet oder
  // nicht.
  if (query === '') {
    const viewer = await getViewer();
    if (viewer?.username) return <Discover />;
  }

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-7 px-5 py-8">
      <Suspense fallback={null}>
        <SearchInput />
      </Suspense>

      <SearchHistory term={query} />

      <Suspense
        key={`${query}|${String(year)}`}
        fallback={<p className="text-muted-foreground text-sm">Sucht…</p>}
      >
        <Results query={query} year={year} />
      </Suspense>
    </main>
  );
}
