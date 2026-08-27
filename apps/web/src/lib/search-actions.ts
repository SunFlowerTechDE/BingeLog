'use server';

import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';

/**
 * M1 1.5 / M3 3.2 — fetching a film the catalog does not have.
 *
 * The write itself happens in the lazy-film edge function, which holds
 * the service role. This only asks it to, using the same anon key every
 * other request uses, so nothing privileged passes through the web app
 * (M0 0.2).
 */

export interface LazyResult {
  created?: number;
  error?: string;
}

export async function fetchMissingFilm(term: string): Promise<LazyResult> {
  const trimmed = term.trim();
  if (trimmed.length < 2) return { error: 'Gib mindestens zwei Zeichen ein.' };

  const supabase = await createClient();

  const response = await supabase.functions.invoke<{ created?: string[]; reason?: string }>(
    'lazy-film',
    { body: { term: trimmed } },
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

  const created = data?.created?.length ?? 0;

  if (created === 0) {
    return {
      error:
        data?.reason === 'rate_limited'
          ? 'Gerade zu viele Abfragen. Versuch es in einer Minute noch einmal.'
          : 'Auch bei Wikidata nichts gefunden. Prüf die Schreibweise oder such nach dem Originaltitel.',
    };
  }

  revalidatePath('/');
  return { created };
}
