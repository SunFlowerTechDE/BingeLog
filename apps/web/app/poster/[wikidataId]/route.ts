import { posterVersion, renderPosterSVG } from '@binge-log/poster';

import { createClient } from '@/lib/supabase/server';

/**
 * M2 2.1 — serves the procedural card.
 *
 * The card is rendered here rather than in each client so that the same
 * film looks identical on web, iOS and Android (ADR-012). Clients cache
 * the SVG as a file; they do not reimplement it.
 *
 * The film is read through the anon key like any other request, so this
 * route exposes nothing the catalog does not already expose.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ wikidataId: string }> },
): Promise<Response> {
  const { wikidataId } = await params;

  if (!/^Q\d+$/.test(wikidataId)) {
    return new Response('Not found', { status: 404 });
  }

  const supabase = await createClient();

  const { data: film, error } = await supabase
    .from('films')
    .select('wikidata_id, title_de, title_original, release_year, updated_at')
    .eq('wikidata_id', wikidataId)
    .maybeSingle();

  if (error || !film) {
    return new Response('Not found', { status: 404 });
  }

  // Two queries rather than one embedded join. The join would work, but
  // the card is cached for a year and the director is one small lookup,
  // so the simpler shape wins over the saved round trip.
  const { data: credit } = await supabase
    .from('film_credits')
    .select('person_id')
    .eq('film_id', wikidataId)
    .eq('role', 'director')
    .order('ord', { ascending: true })
    .limit(1)
    .maybeSingle();

  let director: string | null = null;

  if (credit) {
    const { data: person } = await supabase
      .from('people')
      .select('name')
      .eq('wikidata_id', credit.person_id)
      .maybeSingle();
    director = person?.name ?? null;
  }

  const svg = renderPosterSVG({
    wikidataId: film.wikidata_id,
    title: film.title_de ?? film.title_original,
    releaseYear: film.release_year,
    director,
  });

  // `immutable` is only honest when the URL changes with the content, so
  // it is granted to requests that carry the film's version and withheld
  // from those that do not. The app links with ?v=posterVersion(updated_at);
  // a bare URL still works, it just revalidates.
  const version = posterVersion(film.updated_at);
  const isVersioned = new URL(request.url).searchParams.get('v') === version;

  return new Response(svg, {
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': isVersioned
        ? 'public, max-age=31536000, immutable'
        : 'public, max-age=3600, stale-while-revalidate=86400',
      ETag: `"${film.wikidata_id}-${version}"`,
    },
  });
}
