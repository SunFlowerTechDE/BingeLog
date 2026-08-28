'use server';

import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';

export interface FilmAdminResult {
  error?: string;
  message?: string;
}

export interface FilmTreffer {
  wikidata_id: string;
  title_de: string | null;
  title_original: string;
  release_year: number | null;
  fsk: number | null;
}

/** Einen Film suchen. Dieselbe Funktion wie die Suche der Seite. */
export async function findFilm(term: string): Promise<FilmTreffer[]> {
  const sauber = term.trim();
  if (sauber.length < 2) return [];

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('search_films', { query: sauber, max_results: 10 });
  if (error) {
    console.error('findFilm failed:', error.message);
    return [];
  }

  const ids = data.map((f) => f.wikidata_id);
  const { data: fsks } = await supabase
    .from('films')
    .select('wikidata_id, fsk')
    .in('wikidata_id', ids);
  const fskNach = new Map((fsks ?? []).map((f) => [f.wikidata_id, f.fsk]));

  return data.map((f) => ({
    wikidata_id: f.wikidata_id,
    title_de: f.title_de,
    title_original: f.title_original,
    release_year: f.release_year,
    fsk: fskNach.get(f.wikidata_id) ?? null,
  }));
}

export interface FilmDetails {
  wikidata_id: string;
  title_de: string | null;
  title_original: string;
  title_en: string | null;
  release_year: number | null;
  runtime_min: number | null;
  synopsis_de: string | null;
  poster_url: string | null;
  poster_source: string | null;
  fsk: number | null;
  fsk_note: string | null;
  manual_fields: string[];
  edited_at: string | null;
}

export async function loadFilm(wikidataId: string): Promise<FilmDetails | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('films')
    // Als eine Zeichenkette und nicht zusammengesetzt: der Typgenerator
    // liest das Literal, und aus einer Verkettung liest er nichts.
    .select(
      'wikidata_id, title_de, title_original, title_en, release_year, runtime_min, synopsis_de, poster_url, poster_source, fsk, fsk_note, manual_fields, edited_at',
    )
    .eq('wikidata_id', wikidataId)
    .maybeSingle();

  return data;
}

/**
 * Eine Korrektur speichern.
 *
 * Die Arbeit macht die Edge Function `admin-film`: der Katalog wird
 * nicht aus `apps/web` geschrieben, und die Pruefung "catalog tables
 * carry SELECT policies only" soll gueltig bleiben.
 */
export async function saveFilm(
  wikidataId: string,
  changes: Record<string, string | number | null>,
  unlock: string[],
): Promise<FilmAdminResult> {
  const supabase = await createClient();
  const { data: sitzung } = await supabase.auth.getSession();
  const token = sitzung.session?.access_token;
  if (!token) return { error: 'Melde dich an.' };

  const basis = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';

  let antwort: Response;
  try {
    antwort = await fetch(`${basis}/functions/v1/admin-film`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ wikidataId, changes, unlock }),
    });
  } catch (e) {
    console.error('admin-film unreachable:', e);
    return { error: 'Die Funktion antwortet nicht.' };
  }

  const ergebnis = (await antwort.json()) as { error?: string };

  if (!antwort.ok) {
    const texte: Record<string, string> = {
      forbidden: 'Das darfst du nicht.',
      not_found: 'Diesen Film gibt es nicht.',
      bad_fsk: 'Das ist keine FSK-Stufe.',
      title_required: 'Der Originaltitel darf nicht leer sein.',
      nothing_to_do: 'Nichts geändert.',
    };
    return { error: texte[ergebnis.error ?? ''] ?? 'Das hat nicht geklappt.' };
  }

  revalidatePath(`/film/${wikidataId}`);
  revalidatePath('/moderation');
  return { message: 'Gespeichert' };
}
