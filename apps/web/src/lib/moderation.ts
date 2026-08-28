import { createClient } from '@/lib/supabase/server';

/**
 * Darf der Aufrufer moderieren?
 *
 * Die Antwort kommt aus der Datenbank, nicht aus einer Liste im Code.
 * Sie wird nur benutzt, um Dinge **anzuzeigen** — der Schutz steht in
 * den Policies. Eine ausgeblendete Komponente ist kein Schutz (ADR-010).
 */
export async function isModerator(): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase.rpc('is_moderator');
  return data === true;
}
