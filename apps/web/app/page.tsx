import { Suspense } from 'react';

import { createClient } from '@/lib/supabase/server';
import { FilmTile, type TileFilm } from '@/components/film-tile';
import { SearchInput } from '@/components/search-input';
import { LazySearch } from '@/components/lazy-search';

async function Results({ query }: { query: string }) {
  if (query.trim().length < 2) {
    return (
      <p className="text-muted-foreground text-sm">
        Tipp einen Titel. Ab zwei Zeichen wird gesucht.
      </p>
    );
  }

  const supabase = await createClient();

  // Ranking lives in the database, not here (M3 3.2, Fallstricke).
  const { data, error } = await supabase.rpc('search_films', {
    query,
    max_results: 40,
  });

  if (error) {
    console.error('search_films failed:', error.message);
    return <p className="text-destructive text-sm">Die Suche antwortet gerade nicht.</p>;
  }

  const films = data as unknown as TileFilm[];

  // M3 3.2: a search that finds nothing may reach past the catalog.
  if (films.length === 0) return <LazySearch term={query} />;

  return (
    <div className="flex flex-wrap gap-x-4 gap-y-6">
      {films.map((film) => (
        <FilmTile key={film.wikidata_id} film={film} />
      ))}
    </div>
  );
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = q ?? '';

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-7 px-5 py-8">
      <Suspense fallback={null}>
        <SearchInput />
      </Suspense>

      <Suspense key={query} fallback={<p className="text-muted-foreground text-sm">Sucht…</p>}>
        <Results query={query} />
      </Suspense>
    </main>
  );
}
