'use server';

import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';
import { getViewer } from '@/lib/session';

export interface ListResult {
  error?: string;
  message?: string;
  /** Nur beim Anlegen: wohin es weitergeht. */
  id?: string;
}

const TITEL_MAX = 80;
const BESCHREIBUNG_MAX = 500;
const NOTIZ_MAX = 300;

function feld(formData: FormData, name: string): string {
  const wert = formData.get(name);
  return typeof wert === 'string' ? wert : '';
}

/** Eine neue Binge-Liste anlegen. */
export async function createList(_previous: ListResult, formData: FormData): Promise<ListResult> {
  const viewer = await getViewer();
  if (!viewer?.username) return { error: 'Melde dich an.' };

  const title = feld(formData, 'title').trim();
  const description = feld(formData, 'description').trim();

  if (title === '') return { error: 'Gib der Liste einen Namen.' };
  if (title.length > TITEL_MAX) {
    return { error: `Der Name darf höchstens ${String(TITEL_MAX)} Zeichen haben.` };
  }
  if (description.length > BESCHREIBUNG_MAX) {
    return { error: `Die Beschreibung darf höchstens ${String(BESCHREIBUNG_MAX)} Zeichen haben.` };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('lists')
    .insert({
      user_id: viewer.id,
      title,
      description: description === '' ? null : description,
      is_public: formData.get('isPublic') !== null,
    })
    .select('id')
    .single();

  if (error) {
    console.error('createList failed:', error.message);
    return { error: 'Das hat nicht geklappt.' };
  }

  revalidatePath(`/@${viewer.username}/listen`);
  return { message: 'Angelegt', id: data.id };
}

/** Namen, Beschreibung und Sichtbarkeit aendern. */
export async function updateList(_previous: ListResult, formData: FormData): Promise<ListResult> {
  const viewer = await getViewer();
  if (!viewer?.username) return { error: 'Melde dich an.' };

  const id = feld(formData, 'id');
  const title = feld(formData, 'title').trim();
  const description = feld(formData, 'description').trim();

  if (title === '') return { error: 'Gib der Liste einen Namen.' };
  if (title.length > TITEL_MAX) {
    return { error: `Der Name darf höchstens ${String(TITEL_MAX)} Zeichen haben.` };
  }
  if (description.length > BESCHREIBUNG_MAX) {
    return { error: `Die Beschreibung darf höchstens ${String(BESCHREIBUNG_MAX)} Zeichen haben.` };
  }

  const supabase = await createClient();
  // Kein Filter auf user_id: die Policy entscheidet das, und ein zweites
  // Urteil hier koennte vom ersten abweichen (M0 0.4).
  const { error } = await supabase
    .from('lists')
    .update({
      title,
      description: description === '' ? null : description,
      is_public: formData.get('isPublic') !== null,
    })
    .eq('id', id);

  if (error) {
    console.error('updateList failed:', error.message);
    return { error: 'Das hat nicht geklappt.' };
  }

  revalidatePath(`/listen/${id}`);
  revalidatePath(`/@${viewer.username}/listen`);
  return { message: 'Gespeichert' };
}

export async function deleteList(id: string): Promise<ListResult> {
  const viewer = await getViewer();
  if (!viewer?.username) return { error: 'Melde dich an.' };

  const supabase = await createClient();
  const { error } = await supabase.from('lists').delete().eq('id', id);

  if (error) {
    console.error('deleteList failed:', error.message);
    return { error: 'Das hat nicht geklappt.' };
  }

  revalidatePath(`/@${viewer.username}/listen`);
  return { message: 'Gelöscht' };
}

/**
 * Einen Film hinten anhaengen.
 *
 * Die Position wird hier bestimmt und nicht im Browser: zwei offene
 * Fenster wuerden sonst beide dieselbe Zahl ausrechnen.
 */
export async function addToList(listId: string, wikidataId: string): Promise<ListResult> {
  const viewer = await getViewer();
  if (!viewer?.username) return { error: 'Melde dich an.' };

  const supabase = await createClient();

  const { data: letzte } = await supabase
    .from('list_items')
    .select('ord')
    .eq('list_id', listId)
    .order('ord', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase
    .from('list_items')
    .insert({ list_id: listId, film_id: wikidataId, ord: (letzte?.ord ?? 0) + 1 });

  if (error) {
    // Der Primaerschluessel (list_id, film_id) faengt das Doppelte ab.
    // Die Meldung soll sagen, was los ist, und nicht "Fehler".
    if (error.code === '23505') return { error: 'Der Film steht schon in der Liste.' };
    console.error('addToList failed:', error.message);
    return { error: 'Das hat nicht geklappt.' };
  }

  revalidatePath(`/listen/${listId}`);
  return { message: 'Hinzugefügt' };
}

export async function removeFromList(listId: string, wikidataId: string): Promise<ListResult> {
  const viewer = await getViewer();
  if (!viewer?.username) return { error: 'Melde dich an.' };

  const supabase = await createClient();
  const { error } = await supabase
    .from('list_items')
    .delete()
    .eq('list_id', listId)
    .eq('film_id', wikidataId);

  if (error) {
    console.error('removeFromList failed:', error.message);
    return { error: 'Das hat nicht geklappt.' };
  }

  revalidatePath(`/listen/${listId}`);
  return { message: 'Entfernt' };
}

/** Die Notiz zu einem Eintrag. Oft der eigentliche Inhalt der Liste. */
export async function noteOnItem(
  listId: string,
  wikidataId: string,
  note: string,
): Promise<ListResult> {
  const viewer = await getViewer();
  if (!viewer?.username) return { error: 'Melde dich an.' };

  const trimmed = note.trim();
  if (trimmed.length > NOTIZ_MAX) {
    return { error: `Die Notiz darf höchstens ${String(NOTIZ_MAX)} Zeichen haben.` };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('list_items')
    .update({ note: trimmed === '' ? null : trimmed })
    .eq('list_id', listId)
    .eq('film_id', wikidataId);

  if (error) {
    console.error('noteOnItem failed:', error.message);
    return { error: 'Das hat nicht geklappt.' };
  }

  revalidatePath(`/listen/${listId}`);
  return { message: 'Notiz gespeichert' };
}

/**
 * Zwei Eintraege tauschen.
 *
 * `ord` traegt bewusst keine eindeutige Bedingung — anders als bei den
 * Favoriten braucht es hier also keinen aufgeschobenen Schluessel, zwei
 * Updates genuegen.
 */
export async function swapInList(
  listId: string,
  filmA: string,
  filmB: string,
): Promise<ListResult> {
  const viewer = await getViewer();
  if (!viewer?.username) return { error: 'Melde dich an.' };

  const supabase = await createClient();
  const { data: beide } = await supabase
    .from('list_items')
    .select('film_id, ord')
    .eq('list_id', listId)
    .in('film_id', [filmA, filmB]);

  const a = beide?.find((r) => r.film_id === filmA);
  const b = beide?.find((r) => r.film_id === filmB);
  if (!a || !b) return { error: 'Das hat nicht geklappt.' };

  const [erste, zweite] = await Promise.all([
    supabase.from('list_items').update({ ord: b.ord }).eq('list_id', listId).eq('film_id', filmA),
    supabase.from('list_items').update({ ord: a.ord }).eq('list_id', listId).eq('film_id', filmB),
  ]);

  if (erste.error ?? zweite.error) {
    console.error('swapInList failed:', (erste.error ?? zweite.error)?.message);
    return { error: 'Das hat nicht geklappt.' };
  }

  revalidatePath(`/listen/${listId}`);
  return { message: 'Verschoben' };
}
