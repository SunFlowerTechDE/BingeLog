'use server';

import { createClient } from '@/lib/supabase/server';

export interface FilmTreffer {
  wikidata_id: string;
  title_de: string | null;
  title_original: string;
  release_year: number | null;
  poster_source: string | null;
  poster_url: string | null;
}

/**
 * Die Suche im Katalog.
 *
 * Sie geht ueber den ganzen Katalog, nicht ueber das eigene Tagebuch.
 * Einen Lieblingsfilm hat man oft, lange bevor man ihn hier eintraegt,
 * und in eine Liste gehoert manchmal ein Film, den man nie gesehen hat.
 *
 * Dieselbe Funktion wie die Suche auf der Startseite, also dieselbe
 * Tippfehlertoleranz und dieselbe Rangfolge. Zwei Suchen mit
 * verschiedenen Ergebnissen fuer dieselbe Eingabe waeren ein Fehler,
 * den niemand meldet und jeder merkt.
 */
export async function searchCatalogue(term: string): Promise<FilmTreffer[]> {
  const trimmed = term.trim();
  // Unter zwei Zeichen trifft jede Anfrage den halben Katalog.
  if (trimmed.length < 2) return [];

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('search_films', {
    query: trimmed,
    max_results: 8,
  });

  if (error) {
    console.error('searchCatalogue failed:', error.message);
    return [];
  }

  return data.map((f) => ({
    wikidata_id: f.wikidata_id,
    title_de: f.title_de,
    title_original: f.title_original,
    release_year: f.release_year,
    poster_source: f.poster_source,
    poster_url: f.poster_url,
  }));
}
