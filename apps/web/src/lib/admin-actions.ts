'use server';

import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';

export interface AdminResult {
  error?: string;
  message?: string;
}

export interface Kontotreffer {
  username: string;
  display_name: string | null;
  created_at: string;
  closed_at: string | null;
  eintraege: number;
}

/** Ein Konto suchen. Nur Moderatoren — die Policy entscheidet das. */
export async function findAccount(term: string): Promise<Kontotreffer[]> {
  const sauber = term.trim().replace(/^@/, '');
  if (sauber.length < 2) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('username, display_name, created_at, closed_at, diary_entries(count)')
    .ilike('username', `%${sauber}%`)
    .limit(10);

  if (error) {
    console.error('findAccount failed:', error.message);
    return [];
  }

  return (
    data as unknown as {
      username: string;
      display_name: string | null;
      created_at: string;
      closed_at: string | null;
      diary_entries: { count: number }[];
    }[]
  ).map((p) => ({
    username: p.username,
    display_name: p.display_name,
    created_at: p.created_at,
    closed_at: p.closed_at,
    eintraege: p.diary_entries[0]?.count ?? 0,
  }));
}

/**
 * Einen Eingriff ausloesen.
 *
 * Die eigentliche Arbeit macht die Edge Function `admin-account`: sie
 * braucht den Service-Role-Schluessel, und der darf hier nicht
 * vorkommen (M0 0.2). Diese Funktion reicht die Sitzung des Aufrufers
 * durch — die Function prueft damit selbst, ob er moderieren darf.
 */
export async function actOnAccount(
  action:
    | 'password_reset'
    | 'username_reset'
    | 'email_change'
    | 'account_closed'
    | 'account_restored'
    | 'note',
  username: string,
  reason: string,
  value?: string,
): Promise<AdminResult> {
  if (reason.trim().length < 3) {
    return { error: 'Schreib eine Begründung. Der Nutzer bekommt sie per Mail.' };
  }

  const supabase = await createClient();
  const { data: sitzung } = await supabase.auth.getSession();
  const token = sitzung.session?.access_token;
  if (!token) return { error: 'Melde dich an.' };

  const basis = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';

  let antwort: Response;
  try {
    antwort = await fetch(`${basis}/functions/v1/admin-account`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, username, reason: reason.trim(), value }),
    });
  } catch (e) {
    console.error('admin-account unreachable:', e);
    return { error: 'Die Funktion antwortet nicht.' };
  }

  const ergebnis = (await antwort.json()) as { error?: string; notified?: boolean };

  if (!antwort.ok) {
    const texte: Record<string, string> = {
      forbidden: 'Das darfst du nicht.',
      not_found: 'Kein Konto mit diesem Namen.',
      not_yourself: 'Am eigenen Konto greifst du hier nicht ein.',
      bad_username: 'Der Name passt nicht: drei bis zwanzig Zeichen, a–z, 0–9 und _.',
      bad_email: 'Die Adresse sieht nicht wie eine Adresse aus.',
      reason_required: 'Schreib eine Begründung.',
      // Der eine Fall, der laut sein muss: der Eingriff ist passiert,
      // die Zeile im Logbuch fehlt.
      not_logged: 'Der Eingriff lief, aber das Logbuch hat ihn nicht aufgenommen. Sag Bescheid.',
    };
    return { error: texte[ergebnis.error ?? ''] ?? 'Das hat nicht geklappt.' };
  }

  revalidatePath('/moderation');
  return {
    message: ergebnis.notified
      ? 'Erledigt. Der Nutzer wurde benachrichtigt.'
      : 'Erledigt — aber die Benachrichtigung ging nicht raus. Steht so im Logbuch.',
  };
}
