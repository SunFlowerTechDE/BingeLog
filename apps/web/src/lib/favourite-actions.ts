'use server';

import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';
import { getViewer } from '@/lib/session';

export interface FilmTreffer {
  wikidata_id: string;
  title_de: string | null;
  title_original: string;
  release_year: number | null;
  poster_source: string | null;
  poster_url: string | null;
}

/**
 * Die Suche im Favoriten-Bereich.
 *
 * Sie geht ueber den ganzen Katalog, nicht ueber das eigene Tagebuch.
 * Einen Lieblingsfilm hat man oft, lange bevor man ihn hier eintraegt —
 * und vier Plaetze, die erst nach dem zwanzigsten Eintrag befuellbar
 * sind, bleiben leer.
 *
 * Dieselbe Funktion wie die Suche auf der Startseite, also dieselbe
 * Tippfehlertoleranz und dieselbe Rangfolge. Zwei Suchen mit
 * verschiedenen Ergebnissen fuer dieselbe Eingabe waeren ein Fehler,
 * den niemand meldet und jeder merkt.
 */
export async function searchForFavourite(term: string): Promise<FilmTreffer[]> {
  const trimmed = term.trim();
  // Unter zwei Zeichen trifft jede Anfrage den halben Katalog.
  if (trimmed.length < 2) return [];

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('search_films', {
    query: trimmed,
    max_results: 8,
  });

  if (error) {
    console.error('searchForFavourite failed:', error.message);
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

export interface FavouriteResult {
  error?: string;
  message?: string;
}

const PLAETZE = 4;

/**
 * Einen Film auf den naechsten freien Platz legen.
 *
 * Der Platz wird hier bestimmt und nicht im Browser: zwei offene Fenster
 * wuerden sonst beide "Platz drei" ausrechnen, und der zweite Versuch
 * liefe in den Primaerschluessel.
 */
export async function addFavourite(wikidataId: string): Promise<FavouriteResult> {
  const viewer = await getViewer();
  if (!viewer?.username) return { error: 'Melde dich an.' };

  const supabase = await createClient();

  const { data: belegt } = await supabase
    .from('favourites')
    .select('position, film_id')
    .eq('user_id', viewer.id);

  const genommen = belegt ?? [];
  if (genommen.some((f) => f.film_id === wikidataId)) {
    return { error: 'Der Film steht schon dabei.' };
  }

  const frei = Array.from({ length: PLAETZE }, (_, i) => i + 1).find(
    (p) => !genommen.some((f) => f.position === p),
  );
  if (frei === undefined) {
    return { error: 'Alle vier Plätze sind belegt. Nimm erst einen heraus.' };
  }

  const { error } = await supabase
    .from('favourites')
    .insert({ user_id: viewer.id, film_id: wikidataId, position: frei });

  if (error) {
    console.error('addFavourite failed:', error.message);
    return { error: 'Das hat nicht geklappt.' };
  }

  revalidatePath(`/@${viewer.username}`);
  revalidatePath('/einstellungen');
  return { message: 'Hinzugefügt' };
}

/** Einen Platz raeumen. Die anderen ruecken nicht nach — Platz eins
    bleibt Platz eins, bis jemand ihn selbst neu besetzt. */
export async function removeFavourite(position: number): Promise<FavouriteResult> {
  const viewer = await getViewer();
  if (!viewer?.username) return { error: 'Melde dich an.' };

  const supabase = await createClient();
  const { error } = await supabase
    .from('favourites')
    .delete()
    .eq('user_id', viewer.id)
    .eq('position', position);

  if (error) {
    console.error('removeFavourite failed:', error.message);
    return { error: 'Das hat nicht geklappt.' };
  }

  revalidatePath(`/@${viewer.username}`);
  revalidatePath('/einstellungen');
  return { message: 'Entfernt' };
}

/**
 * Zwei Plaetze tauschen.
 *
 * Tauschen und nicht verschieben: der Primaerschluessel steht auf
 * (user_id, position), und ein Verschieben muesste alle dazwischen
 * anfassen. Fuer vier Plaetze ist der Tausch das, was der Nutzer
 * ohnehin meint, wenn er einen Film nach vorn holt.
 *
 * In einer Transaktion ueber eine Datenbankfunktion, weil zwei einzelne
 * Updates auf halbem Weg den Schluessel verletzen wuerden.
 */
export async function swapFavourites(a: number, b: number): Promise<FavouriteResult> {
  const viewer = await getViewer();
  if (!viewer?.username) return { error: 'Melde dich an.' };

  const supabase = await createClient();
  const { error } = await supabase.rpc('swap_favourites', { a, b });

  if (error) {
    console.error('swapFavourites failed:', error.message);
    return { error: 'Das hat nicht geklappt.' };
  }

  revalidatePath(`/@${viewer.username}`);
  revalidatePath('/einstellungen');
  return { message: 'Verschoben' };
}
