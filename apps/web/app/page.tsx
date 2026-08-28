import { Suspense } from 'react';

import { createClient } from '@/lib/supabase/server';
import { type TileFilm } from '@/components/film-tile';
import { SearchInput } from '@/components/search-input';
import { Discover } from '@/components/discover';
import { getViewer } from '@/lib/session';
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

  // M3 3.2: a search that finds nothing may reach past the catalog. The
  // list is handed to the same client component that offers to create the
  // film, so it stays mounted when the answer changes underneath it.
  return <LazySearch term={query} films={films} />;
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = q ?? '';

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

      <Suspense key={query} fallback={<p className="text-muted-foreground text-sm">Sucht…</p>}>
        <Results query={query} />
      </Suspense>
    </main>
  );
}
