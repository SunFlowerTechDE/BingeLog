import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

import { createClient } from '@/lib/supabase/server';
import { FilmTile, type TileFilm } from '@/components/film-tile';

/**
 * Alle Filme eines Genres.
 *
 * Das Ziel der Kacheln auf Entdecken. Sortiert nach Bekanntheit, weil
 * eine alphabetische Liste bei achtzig Filmdramen niemandem hilft.
 */
async function laden(id: string) {
  const supabase = await createClient();

  const [{ data: genre }, { data: rows }] = await Promise.all([
    supabase.from('genres').select('label_de, label_en').eq('wikidata_id', id).maybeSingle(),
    supabase
      .from('film_genres')
      .select(
        'films(wikidata_id, title_de, title_original, release_year, poster_source, poster_url, sitelink_count)',
      )
      .eq('genre_id', id)
      .limit(120),
  ]);

  if (!genre) return null;

  const filme = (rows ?? [])
    .map((r) => (r as unknown as { films: TileFilm & { sitelink_count: number } }).films)
    .sort((a, b) => b.sitelink_count - a.sitelink_count)
    .map((f) => ({ ...f, director: null }));

  return { label: genre.label_de ?? genre.label_en ?? 'Genre', filme };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const daten = await laden(id);
  return { title: daten ? daten.label : 'Genre nicht gefunden' };
}

export default async function GenrePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const daten = await laden(id);
  if (!daten) notFound();

  return (
    <main className="mx-auto flex max-w-7xl flex-col gap-6 px-5 py-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{daten.label}</h1>
        <p className="text-muted-foreground text-sm tabular-nums">
          {daten.filme.length} Filme im Katalog
        </p>
      </div>

      <ul className="flex flex-wrap gap-4">
        {daten.filme.map((film) => (
          <li key={film.wikidata_id}>
            <FilmTile film={film} />
          </li>
        ))}
      </ul>
    </main>
  );
}
