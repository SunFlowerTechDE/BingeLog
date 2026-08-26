import { renderPosterSVG } from '@binge-log/poster';

import { createClient } from '@/lib/supabase/server';

/**
 * Shapes of the two rows this route reads. They are written out here
 * rather than inferred because the generated Supabase types are still a
 * placeholder; once `pnpm db:types` has run they come from the schema.
 */
interface FilmRow {
  wikidata_id: string;
  title_de: string | null;
  title_original: string;
  release_year: number | null;
  updated_at: string;
}

interface DirectorCredit {
  person_id: string;
}

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

  const { data, error } = await supabase
    .from('films')
    .select('wikidata_id, title_de, title_original, release_year, updated_at')
    .eq('wikidata_id', wikidataId)
    .maybeSingle();

  if (error || !data) {
    return new Response('Not found', { status: 404 });
  }

  const film: FilmRow = data;

  // Two queries rather than an embedded join: PostgREST can resolve the
  // relationship, but expressing it in TypeScript needs the generated
  // schema, and the card is cached anyway.
  const { data: credit } = await supabase
    .from('film_credits')
    .select('person_id')
    .eq('film_id', wikidataId)
    .eq('role', 'director')
    .order('ord', { ascending: true })
    .limit(1)
    .maybeSingle();

  const directorCredit: DirectorCredit | null = credit;
  let director: string | null = null;

  if (directorCredit) {
    const { data: person } = await supabase
      .from('people')
      .select('name')
      .eq('wikidata_id', directorCredit.person_id)
      .maybeSingle();
    const personRow: { name: string } | null = person;
    director = personRow?.name ?? null;
  }

  const svg = renderPosterSVG({
    wikidataId: film.wikidata_id,
    title: film.title_de ?? film.title_original,
    releaseYear: film.release_year,
    director,
  });

  // `immutable` is only honest when the URL changes with the content, so
  // it is granted to requests that carry the film's version and withheld
  // from those that do not. The app links with ?v=<updated_at>; a bare
  // URL still works, it just revalidates.
  const version = new URL(request.url).searchParams.get('v');
  const isVersioned = version === String(Date.parse(film.updated_at));

  return new Response(svg, {
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': isVersioned
        ? 'public, max-age=31536000, immutable'
        : 'public, max-age=3600, stale-while-revalidate=86400',
      ETag: `"${film.wikidata_id}-${String(Date.parse(film.updated_at))}"`,
    },
  });
}
