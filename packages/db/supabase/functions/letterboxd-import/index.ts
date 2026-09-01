/**
 * Import aus einem Letterboxd-Datenexport (M5).
 *
 * Der Nutzer laedt seinen **eigenen** Export in den Eimer `imports`. Es
 * gibt kein Scraping und keine Abfrage eines fremden Profils ueber
 * einen Benutzernamen — die Datei kommt von ihm, oder es passiert
 * nichts.
 *
 * Zwei Betriebsarten:
 *
 *   analyse  entpackt, liest, ordnet zu, schreibt `import_items` und
 *            beantwortet die Vorschau. **Aendert nichts am Konto.**
 *   run      arbeitet eine Scheibe der offenen Zeilen ab. Wird so oft
 *            gerufen, bis nichts mehr offen ist — deshalb ist ein
 *            abgebrochener Import kein verlorener.
 *
 * Sie liegt hier und nicht in der App, weil sie den Katalog schreibt:
 * das darf nur, wer den Service-Role-Key hat, und den haelt keine App
 * (M0 0.2).
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { BlobReader, TextWriter, ZipReader } from 'jsr:@zip-js/zip-js@2';

import { extractFilm, extractNamedEntity } from '../_shared/wikidata/extract.ts';
import { fetchEntities, findFilmIdsByTitle } from '../_shared/wikidata/api.ts';
import { createTvdbClient } from '../_shared/tvdb/client.ts';
import {
  favouriteUris,
  type ImportRow,
  isIgnoredPath,
  kindFor,
  merge,
  parseCsv,
  toRow,
} from './csv.ts';

/**
 * Wie viele Zeilen ein `run`-Aufruf abarbeitet.
 *
 * Klein genug, dass ein Aufruf nicht in die Zeitgrenze laeuft, und
 * gross genug, dass nicht jede Zeile eine eigene Runde kostet. Der
 * Fortschritt haengt nicht daran: der wird nach **jedem** Film
 * geschrieben, damit der Balken sich bewegt und nicht springt.
 */
const SLICE = 25;

/** Wie viele Titel auf einmal abgeglichen werden. */
const MATCH_CHUNK = 500;

interface Body {
  mode?: 'analyse' | 'run';
  batchId?: string;
}

interface ImportItem {
  id: string;
  ord: number | null;
  kind: 'watched' | 'diary' | 'watchlist' | 'like';
  status: string;
  raw_title: string;
  raw_year: number | null;
  rating: number | null;
  watched_on: string | null;
  review: string | null;
  has_spoilers: boolean;
  film_id: string | null;
}

type Admin = ReturnType<typeof createClient>;

/**
 * Der Browser fragt vor einem Aufruf von einer anderen Adresse nach,
 * ob er darf.
 *
 * `lazy-film` braucht das nicht: die wird aus einer Server Action
 * gerufen, also vom Server aus, und da gibt es keinen Vorabflug. Diese
 * hier ruft die Seite direkt — der Fortschritt soll sich waehrend des
 * Imports bewegen, und dafuer muss der Browser selbst nachfragen
 * koennen.
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

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return json({ error: 'bad_request' }, 400);
  }

  const batchId = (body.batchId ?? '').trim();
  if (!/^[0-9a-f-]{36}$/i.test(batchId)) return json({ error: 'bad_request' }, 400);

  const admin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false } },
  );

  // Der Stapel muss dem Aufrufer gehoeren. Der Service-Role-Key umgeht
  // RLS, also wird die Zugehoerigkeit **hier** geprueft und nicht der
  // Policy ueberlassen — sonst koennte jeder jeden Import antreiben.
  const token = request.headers.get('Authorization')?.replace(/^Bearer /i, '') ?? '';
  const { data: caller } = await admin.auth.getUser(token);
  if (!caller.user) return json({ error: 'unauthorized' }, 401);

  const { data: batch } = await admin
    .from('import_batches')
    .select('id, user_id, status')
    .eq('id', batchId)
    .maybeSingle();

  if (!batch || batch.user_id !== caller.user.id) return json({ error: 'not_found' }, 404);

  const scope = { id: batch.id as string, user_id: batch.user_id as string };
  return body.mode === 'run' ? await run(admin, scope) : await analyse(admin, scope);
});

// --------------------------------------------------------------------
// Analysieren
// --------------------------------------------------------------------

async function analyse(admin: Admin, batch: { id: string; user_id: string }): Promise<Response> {
  await admin.from('import_batches').update({ status: 'analyzing' }).eq('id', batch.id);

  const path = `${batch.user_id}/${batch.id}.zip`;
  const { data: file, error: downloadError } = await admin.storage.from('imports').download(path);

  if (downloadError || !file) return await fail(admin, batch.id, 'upload_missing');

  let rows: ImportRow[];
  try {
    rows = await readZip(file);
  } catch (error) {
    console.error('zip failed:', String(error));
    return await fail(admin, batch.id, 'bad_zip');
  }

  if (rows.length === 0) return await fail(admin, batch.id, 'nothing_found');

  // Eine Anfrage je fuenfhundert Zeilen statt einer je Zeile. Bei 8000
  // Filmen ist das der Unterschied zwischen Minuten und Stunden.
  const matches = new Map<number, { film_id: string; certainty: string }>();

  for (let from = 0; from < rows.length; from += MATCH_CHUNK) {
    const slice = rows.slice(from, from + MATCH_CHUNK);
    const { data } = await admin.rpc('match_import_titles', {
      rows: slice.map((r) => ({ title: r.title, year: r.year })),
    });

    for (const hit of (data ?? []) as { idx: number; film_id: string; certainty: string }[]) {
      matches.set(from + hit.idx, { film_id: hit.film_id, certainty: hit.certainty });
    }
  }

  const items = rows.map((row, index) => {
    const hit = matches.get(index);
    return {
      batch_id: batch.id,
      kind: row.kind,
      // `ambiguous` heisst: mehrere gleich gute Treffer. Dann fragt die
      // App, statt zu raten — der falsche Film in einem fremden
      // Tagebuch ist schlimmer als eine Rueckfrage.
      status: hit ? (hit.certainty === 'ambiguous' ? 'needs_review' : 'matched') : 'pending',
      raw_title: row.title,
      raw_year: row.year,
      source_uri: row.uri,
      ord: row.ord ?? null,
      rating: row.rating,
      watched_on: row.watchedOn,
      review: row.review,
      // Der Export kennzeichnet Spoiler nicht. Rezensionen deshalb als
      // spoilerfrei anzunehmen waere eine Behauptung ueber fremde
      // Texte — also andersherum, und der Nutzer kann es aendern.
      has_spoilers: row.review !== null,
      film_id: hit && hit.certainty !== 'ambiguous' ? hit.film_id : null,
    };
  });

  for (let from = 0; from < items.length; from += 500) {
    const { error } = await admin.from('import_items').upsert(items.slice(from, from + 500), {
      onConflict: 'batch_id,kind,raw_title,raw_year,watched_on',
      ignoreDuplicates: true,
    });
    if (error) {
      console.error('items insert failed:', error.message);
      return await fail(admin, batch.id, 'write_failed');
    }
  }

  const known = new Set(items.filter((i) => i.film_id !== null).map((i) => i.film_id as string));
  const unknown = new Set(
    items.filter((i) => i.film_id === null).map((i) => `${i.raw_title}|${i.raw_year ?? ''}`),
  );

  await admin
    .from('import_batches')
    .update({
      status: 'ready',
      total_items: items.length,
      films_known: known.size,
      films_new: unknown.size,
    })
    .eq('id', batch.id);

  return json({
    status: 'ready',
    total: items.length,
    films_known: known.size,
    films_new: unknown.size,
    ratings: items.filter((i) => i.rating !== null).length,
    diary: items.filter((i) => i.kind === 'diary').length,
    reviews: items.filter((i) => i.review !== null).length,
    watchlist: items.filter((i) => i.kind === 'watchlist').length,
    needs_review: items.filter((i) => i.status === 'needs_review').length,
  });
}

/**
 * Entpacken und lesen.
 *
 * Nur Dateien, die auf `.csv` enden, und nur mit einem Pfad ohne `..`.
 * Hier wird nichts auf die Platte geschrieben, die Regel steht trotzdem
 * da — beim naechsten Umbau fehlte sie sonst.
 */
async function readZip(file: Blob): Promise<ImportRow[]> {
  const reader = new ZipReader(new BlobReader(file));
  const out: ImportRow[] = [];
  let favourites: string[] = [];

  try {
    for (const entry of await reader.getEntries()) {
      const name = entry.filename;
      if (entry.directory) continue;
      // Ein Archiv kann Pfade enthalten, die aus seinem Ordner
      // hinausfuehren. Hier wird nichts auf die Platte geschrieben, die
      // Regel steht trotzdem da — beim naechsten Umbau fehlte sie sonst.
      if (name.includes('..') || name.startsWith('/')) continue;
      if (!name.toLowerCase().endsWith('.csv')) continue;
      // Was der Nutzer bei Letterboxd geloescht hat, bleibt geloescht.
      if (isIgnoredPath(name)) continue;
      if (!entry.getData) continue;

      const text = await entry.getData(new TextWriter());
      const records = parseCsv(text);
      if (records.length === 0) continue;

      if (name.toLowerCase().endsWith('profile.csv')) {
        favourites = favouriteUris(records);
        continue;
      }

      const kind = kindFor(name, Object.keys(records[0] ?? {}));
      if (!kind) continue;

      for (const record of records) {
        const row = toRow(kind, record);
        if (row) out.push(row);
      }
    }
  } finally {
    await reader.close();
  }

  const merged = merge(out);

  // Die Favoriten stehen in `profile.csv` als Adressen. Aufgeloest
  // werden sie ueber die Adressen der uebrigen Dateien — dort steht der
  // Titel dazu.
  const byUri = new Map(merged.filter((r) => r.uri).map((r) => [r.uri as string, r]));

  favourites.forEach((uri, index) => {
    const known = byUri.get(uri);
    if (!known) return;
    merged.push({
      kind: 'like',
      title: known.title,
      year: known.year,
      uri,
      rating: null,
      watchedOn: null,
      review: null,
      // Der Platz. Er steht in der Datei und ist Teil der Aussage.
      ord: index + 1,
    });
  });

  return merged;
}

// --------------------------------------------------------------------
// Ausfuehren
// --------------------------------------------------------------------

async function run(admin: Admin, batch: { id: string; user_id: string }): Promise<Response> {
  await admin
    .from('import_batches')
    .update({ status: 'importing', started_at: new Date().toISOString() })
    .eq('id', batch.id);

  const { data: open } = await admin
    .from('import_items')
    .select('*')
    .eq('batch_id', batch.id)
    .in('status', ['pending', 'matched', 'created'])
    .limit(SLICE);

  // Der Stand vor dieser Scheibe. Darauf wird nach jedem Film
  // aufgeschlagen, damit die Anzeige mitlaeuft statt zu springen.
  const before = await countByStatus(admin, batch.id);
  let processed = (before.imported ?? 0) + (before.failed ?? 0) + (before.needs_review ?? 0);
  let succeeded = before.imported ?? 0;
  let stumbled = before.failed ?? 0;

  for (const item of (open ?? []) as ImportItem[]) {
    let ok = true;
    try {
      ok = await handle(admin, batch, item);
    } catch (error) {
      // Ein einzelner Fehler haelt den Import nicht auf. Die Zeile
      // bleibt als fehlgeschlagen stehen, alles andere laeuft weiter.
      console.error('item failed:', String(error));
      await admin
        .from('import_items')
        .update({ status: 'failed', error_code: 'unexpected' })
        .eq('id', item.id);
      ok = false;
    }

    processed += 1;
    if (ok) succeeded += 1;
    else stumbled += 1;

    // Ein kleiner Schreibvorgang je Film. Er kostet wenig und ist der
    // Unterschied zwischen "es tut sich was" und einem Balken, der
    // minutenlang stillsteht und dann springt.
    await admin
      .from('import_batches')
      .update({
        processed_items: processed,
        successful_items: succeeded,
        failed_items: stumbled,
      })
      .eq('id', batch.id);
  }

  const counts = await countByStatus(admin, batch.id);
  const offen = (counts.pending ?? 0) + (counts.matched ?? 0) + (counts.created ?? 0);
  const done = offen === 0;

  await admin
    .from('import_batches')
    .update({
      status: done
        ? (counts.failed ?? 0) > 0 || (counts.needs_review ?? 0) > 0
          ? 'completed_with_errors'
          : 'completed'
        : 'importing',
      processed_items: (counts.imported ?? 0) + (counts.failed ?? 0) + (counts.needs_review ?? 0),
      successful_items: counts.imported ?? 0,
      failed_items: counts.failed ?? 0,
      completed_at: done ? new Date().toISOString() : null,
    })
    .eq('id', batch.id);

  // Die Datei wird nicht laenger aufbewahrt als noetig.
  if (done) {
    await admin.storage.from('imports').remove([`${batch.user_id}/${batch.id}.zip`]);
  }

  return json({
    done,
    remaining: offen,
    imported: counts.imported ?? 0,
    failed: counts.failed ?? 0,
    needs_review: counts.needs_review ?? 0,
  });
}

async function handle(
  admin: Admin,
  batch: { id: string; user_id: string },
  item: ImportItem,
): Promise<boolean> {
  let filmId = item.film_id;

  // Beim Import ist das Aufnehmen kein einzelner Vorgang mit
  // Rueckfrage: der Nutzer hat mit "Import starten" einmal zugestimmt.
  // Bei 8000 Filmen waere alles andere sinnlos.
  if (!filmId) {
    const created = await adopt(admin, item);
    if (!created) {
      await admin
        .from('import_items')
        .update({
          status: 'failed',
          error_code: 'no_match',
          processed_at: new Date().toISOString(),
        })
        .eq('id', item.id);
      return false;
    }
    filmId = created;
    await admin
      .from('import_items')
      .update({ film_id: filmId, status: 'created' })
      .eq('id', item.id);
  }

  if (item.kind === 'watchlist') {
    await admin
      .from('watchlist')
      .upsert({ user_id: batch.user_id, film_id: filmId }, { onConflict: 'user_id,film_id' });
  } else if (item.kind === 'like') {
    // Ein Favorit, kein Tagebucheintrag. Vorhandenes hat Vorrang: wer
    // hier schon Plaetze belegt hat, behaelt sie.
    if (item.ord !== null && item.ord >= 1 && item.ord <= 10) {
      const { data: belegt } = await admin
        .from('favourites')
        .select('position')
        .eq('user_id', batch.user_id)
        .eq('position', item.ord)
        .maybeSingle();

      if (!belegt) {
        await admin
          .from('favourites')
          .upsert(
            { user_id: batch.user_id, film_id: filmId, position: item.ord },
            { onConflict: 'user_id,position' },
          );
      }
    }
  } else {
    await writeEntry(admin, batch, item, filmId);
  }

  await admin
    .from('import_items')
    .update({ status: 'imported', processed_at: new Date().toISOString() })
    .eq('id', item.id);

  return true;
}

/**
 * Einen Tagebucheintrag schreiben — oder eben nicht.
 *
 * **Vorhandenes hat Vorrang.** Wer die App schon benutzt hat, soll
 * seine Bewertung nicht durch eine aeltere aus Letterboxd ersetzt
 * bekommen. Ergaenzt wird nur, was fehlt.
 *
 * Und idempotent: derselbe Film am selben Tag ist derselbe Eintrag.
 * Ohne Datum zaehlt der Film — "irgendwann gesehen" gibt es einmal.
 */
async function writeEntry(
  admin: Admin,
  batch: { id: string; user_id: string },
  item: ImportItem,
  filmId: string,
): Promise<void> {
  const query = admin
    .from('diary_entries')
    .select('id, rating, review')
    .eq('user_id', batch.user_id)
    .eq('film_id', filmId);

  const { data: existing } = item.watched_on
    ? await query.eq('watched_on', item.watched_on).maybeSingle()
    : await query.is('watched_on', null).maybeSingle();

  if (existing) {
    const patch: Record<string, unknown> = {};
    if (existing.rating === null && item.rating !== null) patch.rating = item.rating;
    if (existing.review === null && item.review !== null) {
      patch.review = item.review;
      patch.has_spoilers = item.has_spoilers;
    }
    if (Object.keys(patch).length > 0) {
      await admin.from('diary_entries').update(patch).eq('id', existing.id);
    }
    return;
  }

  await admin.from('diary_entries').insert({
    user_id: batch.user_id,
    film_id: filmId,
    rating: item.rating,
    // Ohne Datum kein erfundenes Datum. Der Film gilt als gesehen, mehr
    // sagt die Datei nicht.
    watched_on: item.watched_on,
    review: item.review,
    has_spoilers: item.review === null ? false : item.has_spoilers,
    import_batch_id: batch.id,
  });
}

/** Einen fehlenden Film aufnehmen. Gibt die Wikidata-Id zurueck. */
async function adopt(admin: Admin, item: ImportItem): Promise<string | null> {
  let candidates: string[];
  try {
    candidates = await findFilmIdsByTitle(item.raw_title, { limit: 5 });
  } catch (error) {
    console.error('lookup failed:', String(error));
    return null;
  }
  if (candidates.length === 0) return null;

  const extracted = (await fetchEntities(candidates))
    .map((entity) => extractFilm(entity))
    .filter((e) => e !== null);
  if (extracted.length === 0) return null;

  // Das Jahr entscheidet, welcher gemeint ist — dieselbe Regel wie in
  // der Suche. Ohne Jahr der bekannteste.
  const chosen =
    item.raw_year === null
      ? [...extracted].sort((a, b) => b.film.sitelinkCount - a.film.sitelinkCount)[0]
      : extracted.find((e) => e.film.releaseYear === item.raw_year);

  if (!chosen) return null;

  const { error } = await admin.from('films').upsert(
    {
      wikidata_id: chosen.film.wikidataId,
      imdb_id: chosen.film.imdbId,
      title_original: chosen.film.titleOriginal,
      title_de: chosen.film.titleDe,
      title_en: chosen.film.titleEn,
      release_year: chosen.film.releaseYear,
      runtime_min: chosen.film.runtimeMin,
      sitelink_count: chosen.film.sitelinkCount,
    },
    { onConflict: 'wikidata_id' },
  );
  if (error) {
    console.error('film upsert failed:', error.message);
    return null;
  }

  // Genres und Mitwirkende: dieselben Schritte wie in `lazy-film`. Ein
  // Fehler hier laesst den Film stehen — er ist im Katalog, nur mit
  // weniger daran.
  const referenced = [
    ...new Set([...chosen.credits.map((c) => c.personId), ...chosen.genres.map((g) => g.genreId)]),
  ];

  if (referenced.length > 0) {
    const named = (await fetchEntities(referenced))
      .map((entity) => extractNamedEntity(entity))
      .filter((entity) => entity !== null);
    const genreIds = new Set(chosen.genres.map((g) => g.genreId));

    const people = named
      .filter((e) => !genreIds.has(e.wikidataId))
      .map((e) => ({ wikidata_id: e.wikidataId, name: e.name, sitelink_count: e.sitelinkCount }));
    const genres = named
      .filter((e) => genreIds.has(e.wikidataId))
      .map((e) => ({ wikidata_id: e.wikidataId, label_de: e.nameDe, label_en: e.nameEn }));

    if (people.length > 0) await admin.from('people').upsert(people, { onConflict: 'wikidata_id' });
    if (genres.length > 0) await admin.from('genres').upsert(genres, { onConflict: 'wikidata_id' });
  }

  if (chosen.credits.length > 0) {
    await admin.from('film_credits').upsert(
      chosen.credits.map((c) => ({
        film_id: c.filmId,
        person_id: c.personId,
        role: c.role,
        ord: c.ord,
      })),
      { onConflict: 'film_id,person_id,role' },
    );
  }
  if (chosen.genres.length > 0) {
    await admin.from('film_genres').upsert(
      chosen.genres.map((g) => ({ film_id: g.filmId, genre_id: g.genreId })),
      { onConflict: 'film_id,genre_id' },
    );
  }

  // Plakat ueber die IMDb-Id und nichts anderes (ADR-003).
  const tvdbKey = Deno.env.get('TVDB_API_KEY');
  if (tvdbKey && chosen.film.imdbId) {
    try {
      const tvdb = createTvdbClient({
        apiKey: tvdbKey,
        pin: Deno.env.get('TVDB_PIN') ?? undefined,
      });
      const match = await tvdb.findByImdbId(chosen.film.imdbId);
      await admin
        .from('films')
        .update(
          match
            ? { tvdb_id: match.tvdbId, poster_url: match.posterUrl, poster_source: 'tvdb' }
            : { poster_source: 'generated' },
        )
        .eq('wikidata_id', chosen.film.wikidataId);
    } catch (error) {
      console.error('artwork failed:', String(error));
    }
  }

  return chosen.film.wikidataId;
}

async function countByStatus(admin: Admin, batchId: string): Promise<Record<string, number>> {
  const { data } = await admin.from('import_items').select('status').eq('batch_id', batchId);
  const out: Record<string, number> = {};
  for (const row of (data ?? []) as { status: string }[]) {
    out[row.status] = (out[row.status] ?? 0) + 1;
  }
  return out;
}

async function fail(admin: Admin, batchId: string, code: string): Promise<Response> {
  await admin.from('import_batches').update({ status: 'failed', error: code }).eq('id', batchId);
  return json({ error: code }, 422);
}
