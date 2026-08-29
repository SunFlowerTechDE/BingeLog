'use server';

import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';
import { getViewer } from '@/lib/session';

export interface BlockResult {
  error?: string;
  message?: string;
}

/**
 * Jemanden blockieren (M4 4.5).
 *
 * **Einseitig und still.** Der Blockierte erfaehrt es nicht, und fuer
 * alle anderen aendert sich nichts. Das ist keine Strafe, sondern
 * Selbstschutz — und es nimmt der Moderation Meldungen ab, die keine
 * sind: "der Typ nervt mich" ist kein Verstoss, aber ein echtes
 * Beduerfnis.
 *
 * Wirksam wird es per Policy, nicht in der Anzeige: ein ausgeblendeter
 * Beitrag steht weiter im Quelltext.
 */
export async function blockUser(username: string): Promise<BlockResult> {
  const viewer = await getViewer();
  if (!viewer?.username) return { error: 'Melde dich an.' };

  const supabase = await createClient();
  const { data: ziel } = await supabase
    .from('profiles')
    .select('id')
    .eq('username', username)
    .maybeSingle();

  if (!ziel) return { error: 'Dieses Profil gibt es nicht.' };
  if (ziel.id === viewer.id) return { error: 'Dich selbst kannst du nicht blockieren.' };

  const { error } = await supabase
    .from('blocks')
    .insert({ blocker_id: viewer.id, blocked_id: ziel.id });

  // Schon blockiert ist kein Fehler, sondern der gewuenschte Zustand.
  if (error && error.code !== '23505') {
    console.error('blockUser failed:', error.message);
    return { error: 'Das hat nicht geklappt.' };
  }

  revalidatePath(`/@${username}`);
  return { message: `@${username} blockiert` };
}

export async function unblockUser(username: string): Promise<BlockResult> {
  const viewer = await getViewer();
  if (!viewer?.username) return { error: 'Melde dich an.' };

  const supabase = await createClient();
  const { data: ziel } = await supabase
    .from('profiles')
    .select('id')
    .eq('username', username)
    .maybeSingle();

  if (!ziel) return { error: 'Dieses Profil gibt es nicht.' };

  const { error } = await supabase
    .from('blocks')
    .delete()
    .eq('blocker_id', viewer.id)
    .eq('blocked_id', ziel.id);

  if (error) {
    console.error('unblockUser failed:', error.message);
    return { error: 'Das hat nicht geklappt.' };
  }

  revalidatePath(`/@${username}`);
  return { message: `@${username} nicht mehr blockiert` };
}

export interface Blockiert {
  username: string;
  display_name: string | null;
  avatar_path: string | null;
  created_at: string;
}

/** Wen ich blockiert habe. Nur ich sehe diese Liste. */
export async function myBlocks(): Promise<Blockiert[]> {
  const viewer = await getViewer();
  if (!viewer?.username) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('blocks')
    .select('created_at, profiles!blocks_blocked_id_fkey(username, display_name, avatar_path)')
    .eq('blocker_id', viewer.id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('myBlocks failed:', error.message);
    return [];
  }

  return (
    data as unknown as {
      created_at: string;
      profiles: { username: string; display_name: string | null; avatar_path: string | null };
    }[]
  ).map((b) => ({
    username: b.profiles.username,
    display_name: b.profiles.display_name,
    avatar_path: b.profiles.avatar_path,
    created_at: b.created_at,
  }));
}
