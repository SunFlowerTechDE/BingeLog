'use server';

import { createClient } from '@/lib/supabase/server';
import { getViewer } from '@/lib/session';

export interface ReportResult {
  error?: string;
  message?: string;
  /** Fuer die Bilder: sie kommen erst nach der Meldung. */
  id?: string;
}

/**
 * Das Turnstile-Token gegen Cloudflare pruefen.
 *
 * **Schlaegt fehl, wenn das Secret fehlt.** Ein Captcha, das ohne
 * Schluessel stillschweigend durchwinkt, ist schlimmer als keins: es
 * sieht nach Schutz aus und ist keiner. Lieber steht das Melden ohne
 * Konto still, und im Log steht warum.
 */
async function captchaGeprueft(token: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET;
  if (!secret) {
    console.error('TURNSTILE_SECRET is not set — anonymous reports are refused.');
    return false;
  }
  if (token === '') return false;

  try {
    const antwort = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret, response: token }),
    });
    const ergebnis = (await antwort.json()) as { success?: boolean };
    return ergebnis.success === true;
  } catch (e) {
    // Netzfehler heisst nicht "durchlassen". Cloudflare ist selten weg,
    // und wenn doch, ist eine ausgefallene Meldung das kleinere Uebel.
    console.error('turnstile unreachable:', e);
    return false;
  }
}

/**
 * Eine Meldung aufnehmen (M4 4.7, DSA Art. 16).
 *
 * Auch ohne Konto. Dann tritt die Adresse an die Stelle des Kontos —
 * nicht als Formalie, sondern weil Artikel 16 Abs. 4 eine
 * Empfangsbestaetigung verlangt und die irgendwohin muss.
 *
 * Geprueft wird hier das Formular. Wer melden darf, wie oft, und wer die
 * Meldung spaeter liest, steht in der Datenbank.
 */
export async function fileReport(formData: FormData): Promise<ReportResult> {
  const feld = (name: string) => {
    const wert = formData.get(name);
    return typeof wert === 'string' ? wert.trim() : '';
  };

  const targetKind = feld('targetKind');
  const targetId = feld('targetId');
  const reason = feld('reason');
  const body = feld('body');
  const email = feld('email');

  if (reason === '') return { error: 'Wähle einen Grund.' };
  if (body.length > 2000) return { error: 'Die Beschreibung ist zu lang.' };

  const viewer = await getViewer();

  // Ohne Konto braucht es eine Adresse — sonst kann die Entscheidung
  // niemanden erreichen.
  if (!viewer && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { error: 'Gib eine E-Mail-Adresse an, damit wir dir antworten können.' };
  }

  // Das Captcha, **vor** allem anderen.
  //
  // Vor dem Rate-Limit in der Datenbank: eine abgewiesene Maschine soll
  // gar nicht erst in die Zaehlung kommen, sonst sperrt sie mit zehn
  // Versuchen die Stunde fuer eine echte Meldung von derselben Adresse.
  //
  // Nur fuer Abgemeldete. Angemeldet haengt jede Meldung an einem Konto,
  // das man schliessen kann; ein Captcha davor waere eine Huerde ohne
  // Gegenwert.
  if (!viewer) {
    const geprueft = await captchaGeprueft(feld('cf-turnstile-response'));
    if (!geprueft) {
      return {
        error: 'Die Prüfung ist nicht durchgegangen. Lad die Seite neu und versuch es noch einmal.',
      };
    }
  }

  const supabase = await createClient();

  // Die Kennung wird hier vergeben und nicht von der Datenbank
  // zurueckgelesen.
  //
  // `insert(...).select()` haengt ein `returning` an, und **das
  // scheitert fuer Anonyme**: Meldungen darf nur die Moderation lesen,
  // also auch nicht der Melder selbst die eigene, gerade geschriebene
  // Zeile. Postgres meldet das als "new row violates row-level security
  // policy", was auf die falsche Faehrte fuehrt — die Zeile war in
  // Ordnung, das Zurueklesen nicht.
  const id = crypto.randomUUID();

  const { error } = await supabase.from('reports').insert({
    id,
    target_kind: targetKind as 'message' | 'review' | 'profile' | 'list' | 'other',
    target_id: targetId,
    reason: reason as
      'spoiler' | 'harassment' | 'hate' | 'sexual' | 'violence' | 'spam' | 'illegal' | 'other',
    body: body === '' ? null : body,
    reporter_id: viewer?.id ?? null,
    reporter_email: viewer ? null : email,
  });

  if (error) {
    if (error.code === 'P0001' || error.message.includes('rate limit')) {
      return { error: 'Zehn Meldungen in der Stunde reichen. Versuch es später noch einmal.' };
    }
    console.error('fileReport failed:', error.message);
    return { error: 'Das hat nicht geklappt.' };
  }

  return { message: 'Danke. Wir schauen uns das an.', id };
}

/**
 * Ein Bild an eine Meldung haengen.
 *
 * Der Bucket ist **nicht oeffentlich**, anders als Avatare und Banner:
 * ein Bildschirmausschnitt enthaelt oft genau das, was gemeldet wurde.
 * Lesen duerfen ihn nur Moderatoren.
 *
 * Das Fenster ist eng — eine Viertelstunde nach der Meldung nimmt sie
 * nichts mehr an, sonst waere jede je erstellte Meldung ein dauerhafter
 * Uploadplatz (`report_accepts_uploads`).
 */
export async function attachReportImage(
  reportId: string,
  formData: FormData,
): Promise<ReportResult> {
  const datei = formData.get('bild');
  if (!(datei instanceof File) || datei.size === 0) return { error: 'Kein Bild dabei.' };
  if (datei.size > 2097152)
    return { error: 'Das Bild ist zu groß. Zwei Megabyte sind das Maximum.' };

  const endung = datei.type === 'image/png' ? 'png' : datei.type === 'image/jpeg' ? 'jpg' : 'webp';
  const pfad = `${reportId}/${crypto.randomUUID()}.${endung}`;

  const supabase = await createClient();
  const { error: hochladen } = await supabase.storage
    .from('reports')
    .upload(pfad, datei, { contentType: datei.type });

  if (hochladen) {
    console.error('report image upload failed:', hochladen.message);
    return { error: 'Das Bild ließ sich nicht anhängen.' };
  }

  const { error } = await supabase
    .from('report_images')
    .insert({ report_id: reportId, path: pfad });
  if (error) {
    await supabase.storage.from('reports').remove([pfad]);
    console.error('report image not recorded:', error.message);
    return { error: 'Das Bild ließ sich nicht anhängen.' };
  }

  return { message: 'Bild angehängt' };
}
