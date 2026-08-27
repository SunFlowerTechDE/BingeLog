'use server';

import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';
import { FACET_KINDS } from '@binge-log/db';

/**
 * M3 3.4 — logging a film.
 *
 * The shortest path is one tap on a star, which is why rateFilm exists
 * separately from saveEntry. Everything else — date, review, rewatch,
 * private, facets — extends an act that is already complete without them
 * (02-product.md, Kernloop).
 *
 * All of it runs on the server. The client sends what the user did, not
 * what it concluded.
 *
 * Every export in a 'use server' file has to be an async server action —
 * a plain helper exported from here fails the build, and neither the type
 * checker nor the linter catches it.
 */

export interface EntryResult {
  error?: string;
}

const RATING_MIN = 1;
const RATING_MAX = 10;

function readField(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === 'string' ? value : '';
}

async function requireViewer() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

/**
 * The two-tap path: sets the rating on the viewer's latest entry for this
 * film, or creates one if there is none.
 *
 * It updates rather than appends because tapping a different star is a
 * correction, not a second viewing. Logging a rewatch is a deliberate
 * separate action.
 */
export async function rateFilm(filmId: string, rating: number): Promise<EntryResult> {
  if (!Number.isInteger(rating) || rating < RATING_MIN || rating > RATING_MAX) {
    return { error: 'Diese Bewertung gibt es nicht.' };
  }

  const { supabase, user } = await requireViewer();
  if (!user) return { error: 'Melde dich an, um zu bewerten.' };

  const { data: latest } = await supabase
    .from('diary_entries')
    .select('id')
    .eq('user_id', user.id)
    .eq('film_id', filmId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = latest
    ? await supabase.from('diary_entries').update({ rating }).eq('id', latest.id)
    : await supabase.from('diary_entries').insert({ user_id: user.id, film_id: filmId, rating });

  if (error) {
    console.error('rateFilm failed:', error.message);
    return { error: 'Das hat nicht geklappt. Versuch es noch einmal.' };
  }

  revalidatePath(`/film/${filmId}`);
  return {};
}

/** Removes the viewer's latest entry for a film. */
export async function unrateFilm(filmId: string): Promise<EntryResult> {
  const { supabase, user } = await requireViewer();
  if (!user) return { error: 'Melde dich an.' };

  const { data: latest } = await supabase
    .from('diary_entries')
    .select('id')
    .eq('user_id', user.id)
    .eq('film_id', filmId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!latest) return {};

  const { error } = await supabase.from('diary_entries').delete().eq('id', latest.id);
  if (error) {
    console.error('unrateFilm failed:', error.message);
    return { error: 'Das hat nicht geklappt.' };
  }

  revalidatePath(`/film/${filmId}`);
  return {};
}

/**
 * The full form. Creates a new entry or updates an existing one, and
 * replaces that entry's facet ratings with whatever was submitted.
 */
export async function saveEntry(_previous: EntryResult, formData: FormData): Promise<EntryResult> {
  const { supabase, user } = await requireViewer();
  if (!user) return { error: 'Melde dich an, um einzutragen.' };

  const filmId = readField(formData, 'filmId');
  const entryId = readField(formData, 'entryId');
  const ratingRaw = Number(readField(formData, 'rating'));

  if (!Number.isInteger(ratingRaw) || ratingRaw < RATING_MIN || ratingRaw > RATING_MAX) {
    // The star rating is the one required part (ADR-009).
    return { error: 'Gib eine Sternebewertung ab.' };
  }

  const watchedOn = readField(formData, 'watchedOn');
  const review = readField(formData, 'review').trim();

  const values = {
    rating: ratingRaw,
    watched_on: watchedOn === '' ? null : watchedOn,
    review: review === '' ? null : review,
    is_rewatch: formData.get('isRewatch') !== null,
    is_private: formData.get('isPrivate') !== null,
  };

  const { data: saved, error } = entryId
    ? await supabase
        .from('diary_entries')
        .update(values)
        .eq('id', entryId)
        .select('id')
        .maybeSingle()
    : await supabase
        .from('diary_entries')
        .insert({ ...values, user_id: user.id, film_id: filmId })
        .select('id')
        .maybeSingle();

  if (error || !saved) {
    console.error('saveEntry failed:', error?.message ?? 'no row returned');
    return { error: 'Das hat nicht geklappt. Versuch es noch einmal.' };
  }

  const facets = FACET_KINDS.map((facet) => ({
    facet,
    score: Number(readField(formData, `facet.${facet}`)),
  })).filter((entry) => Number.isInteger(entry.score) && entry.score >= 1 && entry.score <= 10);

  // Replace rather than merge: an unset facet means the user cleared it,
  // and a partial set is a valid answer (ADR-009).
  await supabase.from('entry_facet_ratings').delete().eq('entry_id', saved.id);

  if (facets.length > 0) {
    const { error: facetError } = await supabase
      .from('entry_facet_ratings')
      .insert(facets.map((entry) => ({ entry_id: saved.id, ...entry })));

    if (facetError) console.error('facet insert failed:', facetError.message);
  }

  revalidatePath(`/film/${filmId}`);
  revalidatePath('/tagebuch');
  return {};
}

export async function deleteEntry(entryId: string, filmId: string): Promise<EntryResult> {
  const { supabase, user } = await requireViewer();
  if (!user) return { error: 'Melde dich an.' };

  // No ownership check here on purpose: RLS decides, and a check in this
  // file would be a second opinion that can drift from the first.
  const { error } = await supabase.from('diary_entries').delete().eq('id', entryId);

  if (error) {
    console.error('deleteEntry failed:', error.message);
    return { error: 'Das hat nicht geklappt.' };
  }

  revalidatePath(`/film/${filmId}`);
  revalidatePath('/tagebuch');
  return {};
}

/** Adds a further viewing without touching the previous one. */
export async function logRewatch(filmId: string, rating: number): Promise<EntryResult> {
  const { supabase, user } = await requireViewer();
  if (!user) return { error: 'Melde dich an.' };

  const { error } = await supabase.from('diary_entries').insert({
    user_id: user.id,
    film_id: filmId,
    rating,
    is_rewatch: true,
  });

  if (error) {
    console.error('logRewatch failed:', error.message);
    return { error: 'Das hat nicht geklappt.' };
  }

  revalidatePath(`/film/${filmId}`);
  revalidatePath('/tagebuch');
  return {};
}

/**
 * M3 3.3 — the watchlist.
 *
 * Unlike the diary, it is private by default and by policy: what someone
 * has not seen yet is a different kind of statement from what they have
 * (M0 0.4). The table has no read policy for anyone but its owner, so
 * nothing here needs to enforce that a second time.
 */
export async function toggleWatchlist(filmId: string): Promise<EntryResult> {
  const { supabase, user } = await requireViewer();
  if (!user) return { error: 'Melde dich an, um Filme vorzumerken.' };

  const { data: existing } = await supabase
    .from('watchlist')
    .select('film_id')
    .eq('user_id', user.id)
    .eq('film_id', filmId)
    .maybeSingle();

  const { error } = existing
    ? await supabase.from('watchlist').delete().eq('user_id', user.id).eq('film_id', filmId)
    : await supabase.from('watchlist').insert({ user_id: user.id, film_id: filmId });

  if (error) {
    console.error('toggleWatchlist failed:', error.message);
    return { error: 'Das hat nicht geklappt. Versuch es noch einmal.' };
  }

  revalidatePath(`/film/${filmId}`);
  revalidatePath('/watchlist');
  return {};
}
