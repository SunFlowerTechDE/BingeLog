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
