import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';

/**
 * Der Link aus der Mail zum Zuruecksetzen landet hier.
 *
 * **Diese Seite hat gefehlt.** Die App schickte den Link seit jeher auf
 * `/auth/neues-passwort`, und dort war nichts — wer sein Passwort
 * vergessen hatte, bekam eine Fehlerseite und kam nicht mehr in sein
 * Konto. Gefunden am 02.09.2026.
 *
 * Derselbe Ablauf wie bei der Bestaetigung (`/auth/bestaetigen`): den
 * Token einloesen, damit eine Sitzung entsteht, und dann zum Formular.
 * Ohne Sitzung kann niemand ein Passwort setzen, und mit ihr gehoert
 * sie genau dem Konto, dessen Postfach den Link bekommen hat.
 */
export async function GET(request: Request): Promise<never> {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type');

  // Nur `recovery`. Ein Bestaetigungstoken ist etwas anderes und
  // gehoert nicht hierher.
  if (!tokenHash || type !== 'recovery') {
    redirect('/anmelden?fehler=link');
  }

  const supabase = await createClient();

  // Erst abmelden, wer gerade angemeldet ist — aus demselben Grund wie
  // bei der Bestaetigung: ein uebrig gebliebener Teil der alten Sitzung
  // setzt sich sonst gegen die neue durch (28.08.2026).
  await supabase.auth.signOut({ scope: 'local' });

  const { error } = await supabase.auth.verifyOtp({ type: 'recovery', token_hash: tokenHash });

  if (error) {
    console.error('recovery verifyOtp failed:', error.message);
    // Abgelaufen oder schon benutzt. Der Weg heraus ist ein neuer Link,
    // und die Meldung auf der Anmeldeseite sagt das.
    redirect('/anmelden?fehler=link');
  }

  redirect('/passwort-neu');
}
