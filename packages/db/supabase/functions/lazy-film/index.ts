/**
 * M1 1.5 — creating a missing film on demand.
 *
 * The catalog holds what has been imported. When someone searches for a
 * film that is not in it, this pulls that one film from Wikidata and
 * writes it, so the second attempt finds it.
 *
 * It lives here rather than in the web app because writing the catalog
 * needs the service role, and apps/web must never hold that key (M0 0.2).
 * An edge function gets it from Supabase's own environment, so it never
 * enters the repository.
 *
 * The extraction under _shared is a generated copy of
 * packages/pipeline/src/wikidata, synced before every deploy. Supabase
 * will not follow an import out of supabase/functions, and keeping a
 * second edited extractor would mean two readings of the same entity
 * with tests covering only one of them.
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';

import { extractFilm, extractNamedEntity } from '../_shared/wikidata/extract.ts';
import { fetchEntities, findFilmIdByImdbId, findFilmIdsByTitle } from '../_shared/wikidata/api.ts';
import { createTvdbClient } from '../_shared/tvdb/client.ts';

/** Enough to answer one search; more would be stockpiling on a whim. */
const MAX_CANDIDATES = 5;

interface RequestBody {
  term?: string;
  imdbId?: string;
  /** Optional. Narrows the candidates to one release year. */
  year?: number;
  /**
   * 'preview' looks without writing and answers with the candidates it
   * found. Anything else keeps the old behaviour and writes.
   *
   * The split exists because the concept asks for a card to check
   * before the film joins the catalogue, and because a title like
   * "Halloween" is several films — taking the first hit is a guess
   * everyone else then reads.
   */
  mode?: 'preview';
  /**
   * Adopt exactly this one. Set by the app after the user picked from
   * the preview; no title search happens then.
   */
  wikidataId?: string;
}

/** What a preview answers with. */
interface Candidate {
  wikidataId: string;
  title: string;
  titleOriginal: string;
  releaseYear: number | null;
  runtimeMin: number | null;
  director: string | null;
  posterUrl: string | null;
}

/**
 * Der Browser fragt vor einem Aufruf von einer anderen Adresse nach, ob
 * er darf.
 *
 * Lange nicht noetig: das Web rief diese Funktion nur aus einer Server
 * Action, und von Server zu Server gibt es keinen Vorabflug. Seit die
 * Seite "Nicht erkannt" sie direkt ruft, schon.
 */
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  let body: RequestBody;
  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return json({ error: 'bad_request' }, 400);
  }

  const term = (body.term ?? '').trim();
  const imdbId = (body.imdbId ?? '').trim();
  const wanted = (body.wikidataId ?? '').trim();
  const isPreview = body.mode === 'preview';

  // Four digits or nothing, same rule the clients apply to the field.
  // A year outside that is not a narrower search, it is a typo.
  const year =
    typeof body.year === 'number' && Number.isInteger(body.year) && body.year >= 1000
      ? body.year
      : null;
  if (term.length < 2 && imdbId === '' && wanted === '') {
    return json({ error: 'term_too_short' }, 400);
  }
  if (wanted !== '' && !/^Q\d+$/.test(wanted)) return json({ error: 'bad_request' }, 400);

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false } },
  );

  // Claiming and counting happen in one statement in the database,
  // because several of these can be running at once and none of them can
  // see the others.
  const { data: allowed, error: claimError } = await supabase.rpc('claim_lazy_creation', {
    search_term: term || imdbId || wanted,
  });

  if (claimError) {
    console.error('claim failed:', claimError.message);
    return json({ error: 'unavailable' }, 503);
  }
  if (!allowed) return json({ error: 'rate_limited' }, 429);

  // --- find candidates -----------------------------------------------

  let candidates: string[];
  try {
    // Eine gewaehlte Id ueberspringt die Titelsuche: der Nutzer hat
    // sich in der Vorschau bereits entschieden, und ein zweiter Lauf
    // koennte etwas anderes finden.
    candidates = wanted
      ? [wanted]
      : imdbId
        ? [await findFilmIdByImdbId(imdbId)].filter((id): id is string => id !== null)
        : await findFilmIdsByTitle(term, { limit: MAX_CANDIDATES });
  } catch (error) {
    // Wikidata being slow or down is not this app's failure. The search
    // that triggered this already showed its own empty result.
    console.error('lookup failed:', String(error));
    return json({ created: [], reason: 'lookup_failed' });
  }

  if (candidates.length === 0) return json({ created: [], reason: 'not_found' });

  // --- extract ---------------------------------------------------------

  const entities = await fetchEntities(candidates);
  const all = entities.map((entity) => extractFilm(entity)).filter((e) => e !== null);

  if (all.length === 0) return json({ created: [], reason: 'not_a_film' });

  // A title search at Wikidata answers with up to five films, and for a
  // title like "Solaris" they are different films. The year says which
  // one was meant, so the others are not written at all — creating four
  // films nobody asked for is not a service, it is noise in a catalog
  // that everyone else reads too.
  //
  // A film Wikidata has no year for does not match a given year. Unknown
  // is not 1972 — the same rule the search itself applies.
  const extracted = year === null ? all : all.filter((e) => e.film.releaseYear === year);

  if (extracted.length === 0) return json({ created: [], reason: 'wrong_year' });

  // --- preview ---------------------------------------------------------
  //
  // Ab hier wird geschrieben. Eine Vorschau tut das nicht: sie
  // beantwortet nur, was da draussen zu finden waere, damit der Nutzer
  // pruefen kann, ob es der richtige Film ist. Erst sein zweiter Tipp
  // legt an.
  if (isPreview) {
    const tvdbKey = Deno.env.get('TVDB_API_KEY');
    const tvdb = tvdbKey
      ? createTvdbClient({ apiKey: tvdbKey, pin: Deno.env.get('TVDB_PIN') ?? undefined })
      : null;

    // Die Regienamen in **einer** Abfrage, nicht in einer je Kandidat.
    const directorIds = [
      ...new Set(
        extracted
          .map((e) => e.credits.find((c) => c.role === 'director')?.personId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const directorNames = new Map<string, string>();
    if (directorIds.length > 0) {
      for (const entity of await fetchEntities(directorIds)) {
        const named = extractNamedEntity(entity);
        if (named) directorNames.set(named.wikidataId, named.name);
      }
    }

    const shown: Candidate[] = [];
    for (const entry of extracted) {
      let posterUrl: string | null = null;
      // Das Plakat gehoert in die Pruefkarte — daran erkennt man einen
      // Film schneller als an einer Jahreszahl. Ein Fehlschlag ist kein
      // Grund, die Vorschau ausfallen zu lassen.
      if (tvdb && entry.film.imdbId) {
        try {
          posterUrl = (await tvdb.findByImdbId(entry.film.imdbId))?.posterUrl ?? null;
        } catch (error) {
          console.error(`preview artwork failed for ${entry.film.imdbId}:`, String(error));
        }
      }

      const directorId = entry.credits.find((c) => c.role === 'director')?.personId;

      shown.push({
        wikidataId: entry.film.wikidataId,
        title: entry.film.titleDe ?? entry.film.titleOriginal,
        titleOriginal: entry.film.titleOriginal,
        releaseYear: entry.film.releaseYear,
        runtimeMin: entry.film.runtimeMin,
        director: directorId ? (directorNames.get(directorId) ?? null) : null,
        posterUrl,
      });
    }

    return json({ candidates: shown });
  }

  // --- write -----------------------------------------------------------
  //
  // Films first, then the people and genres they point at, then the links
  // between them: credits carry foreign keys to all three.

  const films = extracted.map((e) => ({
    wikidata_id: e.film.wikidataId,
    imdb_id: e.film.imdbId,
    title_original: e.film.titleOriginal,
    title_de: e.film.titleDe,
    title_en: e.film.titleEn,
    release_year: e.film.releaseYear,
    runtime_min: e.film.runtimeMin,
    sitelink_count: e.film.sitelinkCount,
  }));

  // onConflict on the id alone: poster_source, poster_url and tvdb_id are
  // left out of the payload entirely, so a film that already has artwork
  // keeps it.
  const { error: filmError } = await supabase
    .from('films')
    .upsert(films, { onConflict: 'wikidata_id' });

  if (filmError) {
    console.error('film upsert failed:', filmError.message);
    return json({ error: 'write_failed' }, 500);
  }

  const credits = extracted.flatMap((e) => e.credits);
  const genreLinks = extracted.flatMap((e) => e.genres);
  const referenced = [
    ...new Set([...credits.map((c) => c.personId), ...genreLinks.map((g) => g.genreId)]),
  ];

  if (referenced.length > 0) {
    const named = (await fetchEntities(referenced))
      .map((entity) => extractNamedEntity(entity))
      .filter((entity) => entity !== null);

    const genreIds = new Set(genreLinks.map((g) => g.genreId));

    const people = named
      .filter((entity) => !genreIds.has(entity.wikidataId))
      .map((entity) => ({
        wikidata_id: entity.wikidataId,
        name: entity.name,
        sitelink_count: entity.sitelinkCount,
      }));

    const genres = named
      .filter((entity) => genreIds.has(entity.wikidataId))
      .map((entity) => ({
        wikidata_id: entity.wikidataId,
        label_de: entity.nameDe,
        label_en: entity.nameEn,
      }));

    if (people.length > 0) {
      await supabase.from('people').upsert(people, { onConflict: 'wikidata_id' });
    }
    if (genres.length > 0) {
      await supabase.from('genres').upsert(genres, { onConflict: 'wikidata_id' });
    }
  }

  if (credits.length > 0) {
    await supabase.from('film_credits').upsert(
      credits.map((c) => ({ film_id: c.filmId, person_id: c.personId, role: c.role, ord: c.ord })),
      { onConflict: 'film_id,person_id,role' },
    );
  }

  if (genreLinks.length > 0) {
    await supabase.from('film_genres').upsert(
      genreLinks.map((g) => ({ film_id: g.filmId, genre_id: g.genreId })),
      { onConflict: 'film_id,genre_id' },
    );
  }

  // --- artwork ---------------------------------------------------------
  //
  // M2 2.2 asks for the lookup to be triggered as the film is created,
  // and leaving it to the next batch was visibly wrong: a film fetched on
  // demand showed its procedural card while TheTVDB had a poster for it.
  //
  // Matching is by IMDb id and nothing else (ADR-003). A failure here
  // leaves poster_source null, which is exactly the state the batch picks
  // up, so nothing is lost.
  const tvdbKey = Deno.env.get('TVDB_API_KEY');

  if (tvdbKey) {
    const tvdb = createTvdbClient({ apiKey: tvdbKey, pin: Deno.env.get('TVDB_PIN') ?? undefined });

    // A film the catalog already carries artwork for is not asked about
    // again. The upsert above keeps the stored poster either way, so a
    // second lookup could only produce the same answer at TheTVDB's cost.
    const { data: existing } = await supabase
      .from('films')
      .select('wikidata_id')
      .eq('poster_source', 'tvdb')
      .in(
        'wikidata_id',
        extracted.map((e) => e.film.wikidataId),
      );

    const settled = new Set((existing ?? []).map((row) => row.wikidata_id));

    for (const entry of extracted) {
      if (settled.has(entry.film.wikidataId)) continue;

      if (!entry.film.imdbId) {
        // No id means no bridge, ever. The procedural card is the answer,
        // not a waiting room.
        await supabase
          .from('films')
          .update({ poster_source: 'generated' })
          .eq('wikidata_id', entry.film.wikidataId);
        continue;
      }

      try {
        const match = await tvdb.findByImdbId(entry.film.imdbId);
        await supabase
          .from('films')
          .update(
            match
              ? { tvdb_id: match.tvdbId, poster_url: match.posterUrl, poster_source: 'tvdb' }
              : { poster_source: 'generated' },
          )
          .eq('wikidata_id', entry.film.wikidataId);
      } catch (error) {
        console.error(`artwork lookup failed for ${entry.film.imdbId}:`, String(error));
      }
    }
  }

  const created = extracted.map((e) => e.film.wikidataId);

  await supabase
    .from('lazy_creation_attempts')
    .update({ found: created.length })
    .eq('term', term || imdbId || wanted)
    .order('created_at', { ascending: false })
    .limit(1);

  return json({ created });
});
