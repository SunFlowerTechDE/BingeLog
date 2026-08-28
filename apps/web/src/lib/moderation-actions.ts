'use server';

import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';
import { getViewer } from '@/lib/session';

export interface ModerationResult {
  error?: string;
  message?: string;
}

/**
 * Eine Meldung entscheiden (DSA Art. 17).
 *
 * Die Begruendung ist Pflicht und kein Textfeld zum Ignorieren:
 * "begruendet" heisst aufschreiben, nicht denken. Sie geht spaeter an
 * beide Seiten, den Melder und den Gemeldeten.
 *
 * Ob der Aufrufer das darf, entscheidet die Policy. Diese Funktion
 * fragt nicht nach — sie bekaeme null Zeilen.
 */
export async function decideReport(
  id: string,
  status: 'resolved' | 'rejected' | 'in_progress',
  decision: string,
): Promise<ModerationResult> {
  const viewer = await getViewer();
  if (!viewer?.username) return { error: 'Melde dich an.' };

  const text = decision.trim();
  if (status !== 'in_progress' && text === '') {
    return { error: 'Schreib eine Begründung. Sie geht an beide Seiten.' };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('reports')
    .update({
      status,
      decision: text === '' ? null : text,
      decided_at: status === 'in_progress' ? null : new Date().toISOString(),
      decided_by: status === 'in_progress' ? null : viewer.id,
    })
    .eq('id', id);

  if (error) {
    console.error('decideReport failed:', error.message);
    return { error: 'Das hat nicht geklappt.' };
  }

  revalidatePath('/moderation');
  return { message: 'Entschieden' };
}

/**
 * Einen gemeldeten Beitrag entfernen.
 *
 * Setzt `is_removed`, loescht nicht. Was gemeldet wurde, muss auffindbar
 * bleiben — sonst ist die Spur lueckenhaft, und genau danach wird im
 * Streitfall gefragt.
 */
export async function removeReportedMessage(id: string): Promise<ModerationResult> {
  const viewer = await getViewer();
  if (!viewer?.username) return { error: 'Melde dich an.' };

  const supabase = await createClient();
  const { error } = await supabase
    .from('thread_messages')
    .update({ is_removed: true })
    .eq('id', id);

  if (error) {
    console.error('removeReportedMessage failed:', error.message);
    return { error: 'Das hat nicht geklappt.' };
  }

  revalidatePath('/moderation');
  return { message: 'Beitrag entfernt' };
}
