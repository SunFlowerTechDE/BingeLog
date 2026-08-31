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
const LAZY_MESSAGES: Record<string, string> = {
  rate_limited: 'Gerade zu viele Abfragen. Versuch es in einer Minute noch einmal.',
  wrong_year:
    'Bei Wikidata gibt es den Titel, aber nicht aus diesem Jahr. ' +
    'Lass das Jahr weg oder prüf es.',
};

export async function fetchMissingFilm(term: string, year?: number): Promise<LazyResult> {
  const trimmed = term.trim();
  if (trimmed.length < 2) return { error: 'Gib mindestens zwei Zeichen ein.' };

  const supabase = await createClient();

  const response = await supabase.functions.invoke<{ created?: string[]; reason?: string }>(
    'lazy-film',
    // Das Jahr grenzt ein, welcher der bis zu fuenf Wikidata-Treffer
    // gemeint ist. Ohne Angabe bleibt es wie bisher.
    { body: year === undefined ? { term: trimmed } : { term: trimmed, year } },
  );

  // invoke types its error loosely; narrow it rather than trust it.
  const failure: unknown = response.error;
  if (failure !== null && failure !== undefined) {
    console.error(
      'lazy-film failed:',
      failure instanceof Error ? failure.message : JSON.stringify(failure),
    );
    // Wikidata being slow or the limit being reached are both ordinary,
    // and both leave the search exactly as it was.
    return { error: 'Wikidata antwortet gerade nicht. Versuch es gleich noch einmal.' };
  }

  const data = response.data;

  if ((data?.created?.length ?? 0) === 0) {
    return {
      error:
        LAZY_MESSAGES[data?.reason ?? ''] ??
        'Auch bei Wikidata nichts gefunden. Prüf die Schreibweise oder such nach dem Originaltitel.',
    };
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
