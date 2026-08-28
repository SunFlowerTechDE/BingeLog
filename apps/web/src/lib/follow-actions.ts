'use server';

import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';
import { getViewer } from '@/lib/session';

export interface FollowResult {
  error?: string;
}

/**
 * Jemandem folgen oder das Folgen beenden.
 *
 * Einseitig, wie bei einem Abonnement: wer folgt, sieht die
 * oeffentlichen Eintraege. Erst wenn beide Seiten folgen, sind es
 * Freunde — und nur dann werden die Eintraege der Stufe "Nur fuer
 * Freunde" sichtbar. Diese Regel steht in `are_friends()` in der
 * Datenbank, nicht hier; hier wird nur eine Zeile geschrieben oder
 * geloescht.
 */
export async function follow(username: string): Promise<FollowResult> {
  const viewer = await getViewer();
  if (!viewer?.username) return { error: 'Melde dich an.' };

  const supabase = await createClient();

  const { data: target } = await supabase
    .from('profiles')
    .select('id')
    .eq('username', username)
    .maybeSingle();

  if (!target) return { error: 'Das Profil gibt es nicht mehr.' };
  if (target.id === viewer.id) return { error: 'Dir selbst kannst du nicht folgen.' };

  const { error } = await supabase
    .from('follows')
    .insert({ follower_id: viewer.id, followee_id: target.id });

  // 23505 ist der Primaerschluessel: es steht schon da. Aus Sicht der
  // handelnden Person ist das kein Fehler, sondern der Zielzustand.
  if (error && error.code !== '23505') {
    console.error('follow failed:', error.message);
    return { error: 'Das hat nicht geklappt.' };
  }

  revalidatePath(`/@${username}`);
  return {};
}

export async function unfollow(username: string): Promise<FollowResult> {
  const viewer = await getViewer();
  if (!viewer?.username) return { error: 'Melde dich an.' };

  const supabase = await createClient();

  const { data: target } = await supabase
    .from('profiles')
    .select('id')
    .eq('username', username)
    .maybeSingle();

  if (!target) return { error: 'Das Profil gibt es nicht mehr.' };

  const { error } = await supabase
    .from('follows')
    .delete()
    .eq('follower_id', viewer.id)
    .eq('followee_id', target.id);

  if (error) {
    console.error('unfollow failed:', error.message);
    return { error: 'Das hat nicht geklappt.' };
  }

  revalidatePath(`/@${username}`);
  return {};
}
