'use server';

import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';
import { getViewer } from '@/lib/session';

export interface DiscussionResult {
  error?: string;
  message?: string;
  id?: string;
}

const BODY_MAX = 2000;

/**
 * Einen Beitrag schreiben.
 *
 * Geprueft wird hier fast nichts: das Spoiler-Gate, die Aktivierung, die
 * Sperre und das Rate-Limit stehen alle in der Datenbank (ADR-010,
 * 20260826090300). Diese Funktion uebersetzt nur deren Antwort in einen
 * Satz, den man lesen kann.
 */
export async function postMessage(
  filmId: string,
  body: string,
  parentId: string | null,
): Promise<DiscussionResult> {
  const viewer = await getViewer();
  if (!viewer?.username) return { error: 'Melde dich an.' };

  const text = body.trim();
  if (text === '') return { error: 'Schreib etwas.' };
  if (text.length > BODY_MAX) {
    return { error: `Ein Beitrag darf höchstens ${String(BODY_MAX)} Zeichen haben.` };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('thread_messages')
    .insert({ film_id: filmId, user_id: viewer.id, body: text, parent_id: parentId })
    .select('id')
    .single();

  if (error) {
    // Das Rate-Limit ist ein Trigger und meldet sich mit eigenem Text.
    // Ihn durchzureichen waere ehrlicher als "Fehler", aber er ist
    // englisch und technisch — also uebersetzt statt weitergereicht.
    if (error.message.includes('rate limit') || error.code === 'P0001') {
      return { error: 'Zehn Beiträge in der Stunde reichen. Versuch es später noch einmal.' };
    }
    console.error('postMessage failed:', error.message);
    return { error: 'Das hat nicht geklappt.' };
  }

  revalidatePath(`/film/${filmId}`);
  return { message: 'Gepostet', id: data.id };
}

/** Einen eigenen Beitrag aendern. Die Markierung setzt ein Trigger. */
export async function editMessage(
  filmId: string,
  id: string,
  body: string,
): Promise<DiscussionResult> {
  const viewer = await getViewer();
  if (!viewer?.username) return { error: 'Melde dich an.' };

  const text = body.trim();
  if (text === '') return { error: 'Schreib etwas.' };
  if (text.length > BODY_MAX) {
    return { error: `Ein Beitrag darf höchstens ${String(BODY_MAX)} Zeichen haben.` };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('thread_messages')
    .update({ body: text, edited_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    console.error('editMessage failed:', error.message);
    return { error: 'Das hat nicht geklappt.' };
  }

  revalidatePath(`/film/${filmId}`);
  return { message: 'Geändert' };
}

/**
 * Einen eigenen Beitrag zuruecknehmen.
 *
 * Setzt `is_removed`, loescht die Zeile nicht. Wer meldet, was hier
 * stand, muss es spaeter noch finden koennen — eine Moderationsspur, die
 * sich selbst wegraeumt, ist keine.
 */
export async function removeMessage(filmId: string, id: string): Promise<DiscussionResult> {
  const viewer = await getViewer();
  if (!viewer?.username) return { error: 'Melde dich an.' };

  const supabase = await createClient();
  const { error } = await supabase
    .from('thread_messages')
    .update({ is_removed: true })
    .eq('id', id);

  if (error) {
    console.error('removeMessage failed:', error.message);
    return { error: 'Das hat nicht geklappt.' };
  }

  revalidatePath(`/film/${filmId}`);
  return { message: 'Zurückgenommen' };
}
