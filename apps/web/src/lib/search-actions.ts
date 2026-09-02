'use server';

import { createClient } from '@/lib/supabase/server';

/**
 * M1 1.5 / M3 3.2 — fetching a film the catalog does not have.
 *
 * The write itself happens in the lazy-film edge function, which holds
 * the service role. This only asks it to, using the same anon key every
 * other request uses, so nothing privileged passes through the web app
 * (M0 0.2).
 */

/** Enough to draw the card while it is being announced. */
export interface CreatedFilm {
  wikidataId: string;
  title: string;
  releaseYear: number | null;
  director: string | null;
  /** Set when TheTVDB had one. The card is then shown, not built. */
  posterUrl: string | null;
}

export interface LazyResult {
  films?: CreatedFilm[];
  error?: string;
}

/**
 * Warum nichts angelegt wurde, auf Deutsch.
 *
 * Der Grund steht in der Antwort der Edge Function. Ihn hier zu
 * uebersetzen statt eine Meldung fuer alles zu nehmen, ist der
 * Unterschied zwischen "such anders" und "das Jahr passt nicht" — und
 * der zweite Fall ist der einzige, den der Suchende selbst beheben kann.
 */
/**
 * Warum nichts gefunden wurde, auf Deutsch — dieselben Faelle wie in der
 * App (`LazyFilmProblem`).
 *
 * **Die Datenquelle wird nirgends genannt.** Sie ist eine Entscheidung
 * von uns und keine, die der Suchende getroffen hat; ihn mit ihrem Namen
 * zu behelligen erklaert nichts und bindet uns an sie.
 */
const NICHT_ERREICHBAR =
  'Die Filmsuche ist gerade nicht erreichbar. Versuch es gleich noch einmal.';
const NICHTS_GEFUNDEN =
  'Kein passender Film gefunden. Prüf die Schreibweise oder such nach dem Originaltitel.';

const LAZY_MESSAGES: Record<string, string> = {
  rate_limited: 'Gerade zu viele Abfragen. Versuch es in einer Minute noch einmal.',
  wrong_year: 'Den Titel gibt es, aber nicht aus diesem Jahr. Lass das Jahr weg oder prüf es.',
  lookup_failed: NICHT_ERREICHBAR,
  not_a_film: NICHTS_GEFUNDEN,
  not_found: NICHTS_GEFUNDEN,
};

/** Ein Fund, der noch nicht im Katalog steht — zum Ansehen, nicht zum Anlegen. */
export interface Candidate {
  wikidataId: string;
  title: string;
  titleOriginal: string;
  releaseYear: number | null;
  runtimeMin: number | null;
  director: string | null;
  posterUrl: string | null;
}

export interface PreviewResult {
  candidates?: Candidate[];
  error?: string;
  /** Der Rohgrund, damit die Oberflaeche „Ohne Jahr suchen" anbieten kann. */
  reason?: string;
}

/**
 * Nachsehen, ohne zu schreiben (Suchkonzept, 19-web-nachziehen 10).
 *
 * Bisher schrieb der Knopf sofort — und bei „Halloween" wanderte der
 * erste von drei Filmen in den Katalog, den alle anderen mitlesen. Jetzt
 * wird erst gezeigt, was gefunden wurde, und der Suchende entscheidet.
 */
export async function previewMissingFilm(term: string, year?: number): Promise<PreviewResult> {
  const trimmed = term.trim();
  if (trimmed.length < 2) return { error: 'Gib mindestens zwei Zeichen ein.' };

  const supabase = await createClient();

  const response = await supabase.functions.invoke<{ candidates?: Candidate[]; reason?: string }>(
    'lazy-film',
    {
      body: {
        term: trimmed,
        mode: 'preview',
        ...(year === undefined ? {} : { year }),
      },
    },
  );

  const failure: unknown = response.error;
  if (failure !== null && failure !== undefined) {
    console.error(
      'lazy-film preview failed:',
      failure instanceof Error ? failure.message : JSON.stringify(failure),
    );
    return { error: NICHT_ERREICHBAR, reason: 'lookup_failed' };
  }

  const treffer = response.data?.candidates ?? [];
  if (treffer.length === 0) {
    const reason = response.data?.reason ?? 'not_found';
    return { error: LAZY_MESSAGES[reason] ?? NICHTS_GEFUNDEN, reason };
  }

  return { candidates: treffer };
}

/**
 * Genau diesen einen aufnehmen — den, den der Suchende gewaehlt hat.
 *
 * Ohne Titelsuche: die ist beim Vorschauschritt schon gelaufen, und ein
 * zweites Mal koennte sie etwas anderes finden.
 */
export async function adoptFilm(wikidataId: string): Promise<LazyResult> {
  return await createFilm({ wikidataId });
}

export async function fetchMissingFilm(term: string, year?: number): Promise<LazyResult> {
  const trimmed = term.trim();
  if (trimmed.length < 2) return { error: 'Gib mindestens zwei Zeichen ein.' };

  // Das Jahr grenzt ein, welcher der bis zu fuenf Treffer gemeint ist.
  // Ohne Angabe bleibt es wie bisher.
  return await createFilm(year === undefined ? { term: trimmed } : { term: trimmed, year });
}

async function createFilm(body: Record<string, unknown>): Promise<LazyResult> {
  const supabase = await createClient();

  const response = await supabase.functions.invoke<{ created?: string[]; reason?: string }>(
    'lazy-film',
    { body },
  );

  // invoke types its error loosely; narrow it rather than trust it.
  const failure: unknown = response.error;
  if (failure !== null && failure !== undefined) {
    console.error(
      'lazy-film failed:',
      failure instanceof Error ? failure.message : JSON.stringify(failure),
    );
    // Eine langsame Quelle und ein erreichtes Limit sind beide gewoehnlich
    // und lassen die Suche, wie sie war. **Die Quelle wird nicht
    // genannt** — sie ist unsere Entscheidung, nicht seine.
    return { error: NICHT_ERREICHBAR };
  }

  const data = response.data;

  if ((data?.created?.length ?? 0) === 0) {
    const reason = data?.reason ?? 'not_found';
    return { error: LAZY_MESSAGES[reason] ?? NICHTS_GEFUNDEN };
  }

  // The client draws the card while it announces the find, so it needs
  // the same fields the poster route reads — and it needs them from here
  // rather than from a second request, because the point is that the
  // card appears the moment the film exists.
  const ids = data?.created ?? [];

  const { data: rows } = await supabase
    .from('films')
    .select('wikidata_id, title_de, title_original, release_year, poster_source, poster_url')
    .in('wikidata_id', ids);

  const { data: credits } = await supabase
    .from('film_credits')
    .select('film_id, person_id, ord, people(name)')
    .in('film_id', ids)
    .eq('role', 'director')
    .order('ord', { ascending: true });

  const directorFor = new Map<string, string>();
  for (const credit of (credits ?? []) as unknown as {
    film_id: string;
    people: { name: string } | null;
  }[]) {
    if (credit.people?.name && !directorFor.has(credit.film_id)) {
      directorFor.set(credit.film_id, credit.people.name);
    }
  }

  const films: CreatedFilm[] = (rows ?? []).map((row) => ({
    wikidataId: row.wikidata_id,
    title: row.title_de ?? row.title_original,
    releaseYear: row.release_year,
    director: directorFor.get(row.wikidata_id) ?? null,
    posterUrl: row.poster_source === 'tvdb' ? row.poster_url : null,
  }));

  // Deliberately no revalidatePath here. Refreshing the route would
  // re-render the search, find results, and unmount the very component
  // that is about to show the card being built. The client refreshes
  // once the animation is done.
  return { films };
}
