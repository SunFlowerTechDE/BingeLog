'use server';

import { redirect } from 'next/navigation';
import type { Route } from 'next';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';

import { createClient } from '@/lib/supabase/server';
import { NAME_MUSTER, bereinigen, type Namenslage } from '@/lib/username';

/**
 * M3 3.1 — sign-up, sign-in and choosing a username.
 *
 * All of it runs on the server. The client never holds a token and never
 * decides whether something is allowed; it renders what comes back.
 */

export interface FormState {
  /** Says what to do, not what went wrong (02-product.md, Tonalität). */
  error?: string;
  message?: string;
}

/**
 * FormData.get returns a string or a File. Stringifying a File yields
 * '[object File]', which would sail through a length check and land in
 * the database, so anything that is not a string is treated as absent.
 */
function readField(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === 'string' ? value : '';
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MIN_PASSWORD_LENGTH = 8;

function readCredentials(formData: FormData): { email: string; password: string } | string {
  const email = readField(formData, 'email').trim().toLowerCase();
  const password = readField(formData, 'password');

  if (!EMAIL_PATTERN.test(email)) return 'Gib eine gültige E-Mail-Adresse ein.';
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Das Passwort braucht mindestens ${String(MIN_PASSWORD_LENGTH)} Zeichen.`;
  }

  return { email, password };
}

export async function signUp(_previous: FormState, formData: FormData): Promise<FormState> {
  const credentials = readCredentials(formData);
  if (typeof credentials === 'string') return { error: credentials };

  const supabase = await createClient();

  // Where the link in the confirmation mail should land. Derived from the
  // request rather than configured, so the same code works on localhost,
  // on a preview deployment and in production.
  const requestHeaders = await headers();
  const host = requestHeaders.get('host') ?? 'localhost:3000';
  const protocol = host.startsWith('localhost') ? 'http' : 'https';

  const { error } = await supabase.auth.signUp({
    ...credentials,
    options: { emailRedirectTo: `${protocol}://${host}/auth/bestaetigen` },
  });

  if (error) {
    // The user gets a message that does not say whether the address is
    // already registered — telling a stranger which addresses have
    // accounts answers a question nobody asked. The reason still has to
    // go somewhere, or a broken sign-up looks the same as a duplicate.
    console.error('signUp failed:', error.message);
    return { error: 'Das hat nicht geklappt. Versuch es noch einmal.' };
  }

  // No session yet: the account exists but is unconfirmed until the link
  // in the mail is followed.
  redirect(`/registrieren/pruefe-postfach?an=${encodeURIComponent(credentials.email)}`);
}

export async function signIn(_previous: FormState, formData: FormData): Promise<FormState> {
  const credentials = readCredentials(formData);
  if (typeof credentials === 'string') return { error: credentials };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(credentials);

  if (error) {
    console.error('signIn failed:', error.code ?? error.message);

    // Supabase only reports this when the password was right, so saying
    // it out loud tells the caller nothing they did not already know —
    // and leaving them with "wrong password" would send them looking for
    // a problem that is not there.
    if (error.code === 'email_not_confirmed') {
      return {
        error: 'Bestätige zuerst deine E-Mail-Adresse. Den Link findest du in deinem Postfach.',
      };
    }

    return { error: 'E-Mail oder Passwort stimmt nicht.' };
  }

  // Signing in is not the same as being set up. An account that never
  // finished choosing a name has no profile row, and sending it to the
  // home page produces an app that is logged in and looks logged out,
  // with nothing pointing the way out.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', user.id)
      .maybeSingle();

    if (!profile) redirect('/willkommen');
  }

  // The target comes from a query parameter, so it is a runtime string
  // that typedRoutes cannot know. The guard is what matters: a single
  // leading slash and no protocol-relative form, so it cannot become an
  // open redirect to another host.
  const target = readField(formData, 'weiter');
  const safe =
    target.startsWith('/') && !target.startsWith('//') ? (target as Route) : ('/' as Route);
  redirect(safe);
}

export async function signOut(): Promise<never> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath('/', 'layout');
  // Nicht auf die Startseite, sondern auf die Frage nach der bisherigen
  // Filmhistorie. Wer von woanders kommt, soll nicht bei null anfangen
  // muessen — und die Funktion ganz unten in den Einstellungen zu
  // verstecken hilft niemandem.
  redirect('/willkommen/import');
}

/**
 * Ein neues Passwort setzen.
 *
 * Nur mit Sitzung, und die entsteht ueber den Link aus der Mail. Wer
 * hier ankommt, hat den Besitz des Postfachs nachgewiesen.
 */
export async function setNewPassword(_previous: FormState, formData: FormData): Promise<FormState> {
  const password = readField(formData, 'password');
  const repeat = readField(formData, 'repeat');

  // Dieselbe Untergrenze wie bei der Registrierung. Sie steht hier noch
  // einmal, weil ein `minLength` im Formular eine Bequemlichkeit ist
  // und keine Regel.
  if (password.length < 8) {
    return { error: 'Das Passwort braucht mindestens acht Zeichen.' };
  }
  if (password !== repeat) {
    return { error: 'Die beiden Passwörter sind nicht gleich.' };
  }

  const supabase = await createClient();
  const { data: session } = await supabase.auth.getUser();
  if (!session.user) {
    return { error: 'Der Link ist abgelaufen. Fordere einen neuen an.' };
  }

  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    console.error('updateUser failed:', error.message);
    return { error: 'Das hat nicht geklappt. Versuch es noch einmal.' };
  }

  revalidatePath('/', 'layout');
  redirect('/');
}

/**
 * Einen Link zum Zuruecksetzen anfordern.
 *
 * **Die Antwort ist immer dieselbe**, ob es die Adresse gibt oder
 * nicht. Sonst waere das Formular eine Auskunft darueber, wer hier ein
 * Konto hat.
 */
export async function requestPasswordReset(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const email = readField(formData, 'email').trim();

  if (!email.includes('@')) {
    return { error: 'Gib deine Mailadresse ein.' };
  }

  // Die eigene Adresse aus dem Kopf der Anfrage, nicht fest verdrahtet:
  // sonst zeigte der Link von der Testumgebung auf die Produktivseite,
  // und man setzte das Passwort woanders.
  const headerList = await headers();
  const origin = headerList.get('origin') ?? `https://${headerList.get('host') ?? 'bingelog.eu'}`;

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/neues-passwort`,
  });

  if (error) console.error('resetPasswordForEmail failed:', error.message);

  return { message: 'Wenn es die Adresse gibt, ist die Mail unterwegs.' };
}

export async function chooseUsername(_previous: FormState, formData: FormData): Promise<FormState> {
  const username = readField(formData, 'username').trim().toLowerCase();

  if (!/^[a-z0-9_]{3,20}$/.test(username)) {
    return {
      error: 'Drei bis zwanzig Zeichen, nur Kleinbuchstaben, Ziffern und Unterstrich.',
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/anmelden');

  const { error } = await supabase.from('profiles').insert({ id: user.id, username });

  if (error) {
    // Taken and reserved are one answer on purpose. The user's next move
    // is the same either way, and distinguishing them would confirm which
    // names have accounts behind them.
    if (error.message.includes('username_reserved') || error.code === '23505') {
      return { error: 'Der Name ist nicht frei. Nimm einen anderen.' };
    }

    console.error('chooseUsername failed:', error.message);
    return { error: 'Das hat nicht geklappt. Versuch es noch einmal.' };
  }

  revalidatePath('/', 'layout');
  // Nicht auf die Startseite, sondern auf die Frage nach der bisherigen
  // Filmhistorie. Wer von woanders kommt, soll nicht bei null anfangen
  // muessen — und die Funktion ganz unten in den Einstellungen zu
  // verstecken hilft niemandem.
  redirect('/willkommen/import');
}

/**
 * Sends the confirmation mail again.
 *
 * The first one expires, gets lost, or arrives while the site it points
 * at is unreachable. Without this the only way forward is a second
 * account, which is worse for everyone.
 */
export async function resendConfirmation(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const email = readField(formData, 'email').trim().toLowerCase();
  if (!EMAIL_PATTERN.test(email)) return { error: 'Gib eine gültige E-Mail-Adresse ein.' };

  const supabase = await createClient();
  const requestHeaders = await headers();
  const host = requestHeaders.get('host') ?? 'localhost:3000';
  const protocol = host.startsWith('localhost') ? 'http' : 'https';

  const { error } = await supabase.auth.resend({
    type: 'signup',
    email,
    options: { emailRedirectTo: `${protocol}://${host}/auth/bestaetigen` },
  });

  if (error) {
    console.error('resendConfirmation failed:', error.message);
    // Deliberately the same answer either way: whether an address is
    // registered is not something a stranger gets to find out.
    return { message: 'Wenn es ein Konto dazu gibt, ist die Mail unterwegs.' };
  }

  return { message: 'Die Mail ist unterwegs. Sieh auch im Spam-Ordner nach.' };
}

/**
 * Ist dieser Name noch zu haben?
 *
 * Waehrend des Tippens gefragt, nicht erst beim Absenden. Einen Namen zu
 * waehlen, ihn wegzuschicken und dann „schon vergeben" zu lesen, ist ein
 * vermeidbarer Umweg — und beim Benutzernamen ein besonders aergerlicher,
 * weil man sich einen ausgedacht hat.
 *
 * Die Antwort ist ein Hinweis, keine Zusage: zwischen Pruefung und
 * Absenden kann jemand schneller sein. Die Eindeutigkeit steht in der
 * Datenbank, hier steht nur die Hoeflichkeit.
 */
export async function checkUsername(eingabe: string): Promise<Namenslage> {
  const name = bereinigen(eingabe);
  if (name === '') return { lage: 'leer' };
  if (!NAME_MUSTER.test(name)) return { lage: 'zu_kurz' };

  const supabase = await createClient();

  const [{ data: reserviert }, { data: vergeben }] = await Promise.all([
    supabase.from('reserved_usernames').select('reason').eq('username', name).maybeSingle(),
    supabase.from('profiles').select('username').eq('username', name).maybeSingle(),
  ]);

  if (reserviert) return { lage: 'reserviert', grund: reserviert.reason };
  if (vergeben) return { lage: 'vergeben' };
  return { lage: 'frei' };
}
