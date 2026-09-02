'use server';

import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';

/**
 * Das eigene Konto löschen (Art. 17 DSGVO, M6).
 *
 * Die Löschung selbst passiert in der Edge Function `delete-account`:
 * ein Konto lässt sich nur mit dem Service-Role-Key entfernen, und der
 * darf in `apps/web` nie liegen (M0 0.2). Hier wird nur gefragt, mit
 * demselben anonymen Schlüssel wie bei jeder anderen Anfrage.
 *
 * **Die Nutzer-ID wird nicht mitgeschickt.** Die Function nimmt sie aus
 * dem Token — ein Feld dafür gäbe es gar nicht, und genau deshalb kann
 * damit niemand ein fremdes Konto löschen.
 */

export interface DeleteResult {
  error?: string;
}

export async function deleteOwnAccount(
  _previous: DeleteResult,
  formData: FormData,
): Promise<DeleteResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Du bist nicht angemeldet.' };

  const { data: profile } = await supabase
    .from('profiles')
    .select('username')
    .eq('id', user.id)
    .maybeSingle();

  // Den eigenen Namen abtippen, nicht nur einen Knopf drücken. Das ist
  // der einzige Schritt in der App, den niemand rückgängig machen kann.
  const bestaetigung = (formData.get('bestaetigung') as string | null)?.trim() ?? '';
  if (profile?.username !== undefined && bestaetigung !== profile.username) {
    return { error: `Tipp deinen Benutzernamen genau so ein: ${profile.username}` };
  }

  const antwort = await supabase.functions.invoke('delete-account', { body: {} });

  // `invoke` typisiert seinen Fehler lose. Eingrenzen statt vertrauen —
  // dieselbe Behandlung wie bei `lazy-film`.
  const fehler: unknown = antwort.error;
  if (fehler !== null && fehler !== undefined) {
    console.error(
      'delete-account failed:',
      fehler instanceof Error ? fehler.message : JSON.stringify(fehler),
    );
    return { error: 'Das hat nicht geklappt. Versuch es noch einmal oder schreib uns.' };
  }

  // Das Konto ist weg, die Sitzungs-Cookies sind es noch nicht. Ohne das
  // hier bliebe ein angemeldeter Browser ohne Konto zurück, und jede
  // Seite antwortete mit einem Fehler statt mit der Startseite.
  await supabase.auth.signOut({ scope: 'local' });

  redirect('/?geloescht=1');
}
