'use server';

import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';

/**
 * Einen Film weiterempfehlen (Entdecken-Konzept 5).
 *
 * **Empfohlen wird nur unter Freunden — beidseitiges Folgen.** Die Regel
 * steht in der Policy auf `recommendations`, nicht hier und nicht in der
 * Auswahlliste: eine Oberfläche, die nur Freunde anbietet, ist eine
 * Auswahl und keine Sperre.
 */

export interface Freund {
  id: string;
  username: string;
  avatar_path: string | null;
  already_sent: boolean;
}

export async function friendsForFilm(filmId: string): Promise<Freund[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('friends_for_recommendation', { film: filmId });

  if (error) {
    console.error('friends_for_recommendation failed:', error.message);
    return [];
  }
  return data;
}

export interface RecommendResult {
  sent?: number;
  error?: string;
}

/** Die Notiz ist auf 50 Zeichen begrenzt — sie steht unter einer Kachel. */
const NOTIZ_MAX = 50;

export async function recommendFilm(
  filmId: string,
  friendIds: string[],
  note: string,
): Promise<RecommendResult> {
  if (friendIds.length === 0) return { error: 'Wähl jemanden aus.' };

  const sauber = note.trim();
  if (sauber.length > NOTIZ_MAX) return { error: `Höchstens ${String(NOTIZ_MAX)} Zeichen.` };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Du bist nicht angemeldet.' };

  const { error } = await supabase.from('recommendations').upsert(
    friendIds.map((id) => ({
      from_user: user.id,
      to_user: id,
      film_id: filmId,
      note: sauber === '' ? null : sauber,
    })),
    { onConflict: 'from_user,to_user,film_id' },
  );

  if (error) {
    console.error('recommend failed:', error.message);
    // Die Policy lehnt ab, wenn kein beidseitiges Folgen besteht. Das
    // ist kein Fehler des Nutzers, sondern eine Regel — und sie so zu
    // benennen erklärt mehr als "ist fehlgeschlagen".
    return { error: 'Empfehlen geht nur unter Freunden, also wenn ihr euch gegenseitig folgt.' };
  }

  revalidatePath('/entdecken');
  return { sent: friendIds.length };
}
