import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';

/**
 * M3 3.1 — the link from the confirmation mail lands here.
 *
 * Email confirmation stays on. Without it anyone can sign up with someone
 * else's address, and that address then receives everything the account
 * generates. The cost is this extra step; the alternative is a mailbox
 * full of accounts its owner never made.
 */
/** Confirming a new address, and the change of an existing one. */
const ALLOWED_TYPES = ['signup', 'email', 'email_change'] as const;

export async function GET(request: Request): Promise<never> {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get('token_hash');

  // The type comes out of a URL, so it is checked against the kinds this
  // route is meant to handle rather than passed through. verifyOtp takes
  // a plain string, which means nothing else would catch a typo or a
  // value someone made up.
  const candidate = url.searchParams.get('type');
  const type = ALLOWED_TYPES.find((allowed) => allowed === candidate);

  if (!tokenHash || !type) {
    redirect('/anmelden?fehler=link');
  }

  const supabase = await createClient();

  // Erst abmelden, wer gerade angemeldet ist. Ein Bestätigungslink weist
  // den Besitz eines Postfachs nach — danach gehört die Sitzung diesem
  // Konto und keinem anderen. Ohne das bleibt eine vorhandene Sitzung
  // bestehen: Supabase legt grosse Sitzungen in mehreren Cookies ab, und
  // ein übrig gebliebener Teil des alten setzt sich gegen das neue durch.
  // Beobachtet am 28.08.2026 — bestätigt wurde das richtige Konto,
  // angemeldet blieb das alte, und auf dem Bildschirm sah beides nach
  // Erfolg aus.
  await supabase.auth.signOut({ scope: 'local' });

  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });

  if (error) {
    console.error('verifyOtp failed:', error.message);
    // Expired or already used. Signing in again is the way out, and the
    // message on that page says so.
    redirect('/anmelden?fehler=link');
  }

  // Confirmed and signed in. A brand-new account has no profile yet, so
  // /willkommen is where it belongs; someone re-confirming an existing
  // account is sent on from there.
  redirect('/willkommen');
}
