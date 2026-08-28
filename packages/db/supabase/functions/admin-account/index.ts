/**
 * M4 4.7 — Eingriffe in ein fremdes Konto.
 *
 * Passwort zuruecksetzen, Benutzername aendern, E-Mail aendern, Konto
 * schliessen oder wieder oeffnen. Jeder dieser Schritte braucht die
 * Admin-API von Supabase und damit den Service-Role-Schluessel — und der
 * darf in `apps/web` nicht vorkommen (M0 0.2, der ESLint-Config bricht
 * den Build). Deshalb steht das hier.
 *
 * Drei Dinge passieren bei **jedem** Eingriff, in dieser Reihenfolge:
 *
 *   1. Pruefen, dass der Aufrufer moderieren darf — mit **seinem**
 *      Zugang, nicht mit dem Service-Role-Schluessel. Wer nur den
 *      anon-Schluessel hat, kommt hier nicht vorbei.
 *   2. Den Eingriff ausfuehren.
 *   3. Ihn ins Logbuch schreiben und den Nutzer benachrichtigen.
 *
 * Schritt 3 ist nicht optional. Scheitert die Mail, steht der Eingriff
 * trotzdem im Logbuch — mit `notified = false`, damit im Dashboard
 * sichtbar bleibt, dass eine Nachricht aussteht. Eine Aenderung
 * rueckgaengig zu machen, weil ein Mailserver nicht antwortet, waere
 * schlimmer als eine nachzuholende Mail.
 *
 * **Passwoerter werden hier nie gesetzt, nur zurueckgesetzt.** Die
 * Funktion loest die Zuruecksetz-Mail aus; das neue Passwort waehlt der
 * Nutzer. Ein Betreiber, der Passwoerter vergeben kann, kann sich als
 * seine Nutzer ausgeben, und kein Logbuch der Welt macht das wieder gut.
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';

type Aktion =
  | 'password_reset'
  | 'username_reset'
  | 'email_change'
  | 'account_closed'
  | 'account_restored'
  | 'note';

interface RequestBody {
  action?: Aktion;
  /** Das betroffene Profil. */
  username?: string;
  reason?: string;
  /** Nur bei username_reset und email_change. */
  value?: string;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Wie der Eingriff in der Mail heisst. Deutsch, geduzt, knapp. */
const BESCHREIBUNG: Record<Aktion, string> = {
  password_reset: 'Wir haben eine Mail zum Zurücksetzen deines Passworts ausgelöst.',
  username_reset: 'Wir haben deinen Benutzernamen geändert.',
  email_change: 'Wir haben die E-Mail-Adresse deines Kontos geändert.',
  account_closed: 'Wir haben dein Konto geschlossen.',
  account_restored: 'Wir haben dein Konto wieder geöffnet.',
  note: 'Wir haben einen Vermerk zu deinem Konto angelegt.',
};

/**
 * Die Farben der Seite, als Hex.
 *
 * Mailprogramme sind keine Browser: Outlook kennt kein Flexbox, Gmail
 * wirft `<style>` aus der Nachricht, und `oklch` versteht keines von
 * beiden. Deshalb Tabellen, Stile inline und Hex — dieselben Werte wie
 * in `docs/betrieb/mailvorlagen.md`, aus `globals.css` umgerechnet.
 *
 * Aendern sich die Tokens, aendert sich die Mail nicht mit. Das ist der
 * Preis dafuer, dass sie in Outlook 2016 aussieht wie gedacht.
 */
const FARBE = {
  grund: '#0c0d10',
  karte: '#14161a',
  rand: '#2b2e33',
  text: '#edeef1',
  gedaempft: '#95989f',
  leise: '#6f7279',
  akzent: '#efbc4b',
} as const;

const SCHRIFT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

/** Was in fremdem Text steht, wird nie Markup. */
function sicher(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function vorlage(name: string, aktion: Aktion, grund: string): string {
  // Ein vollstaendiges Dokument mit `charset`, nicht nur die Tabelle.
  //
  // Ueber die Brevo-API kommt der Zeichensatz aus dem Transport, und die
  // Umlaute kaemen wohl auch so an. "Wohl" ist bei einer Mail, die
  // jemandem eine Kontoschliessung mitteilt, keine gute Grundlage — und
  // wer sie weiterleitet oder als Datei speichert, verliert den
  // Transport-Header.
  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Änderung an deinem BingeLog-Konto</title>
</head>
<body style="margin:0;padding:0;background-color:${FARBE.grund};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${FARBE.grund};margin:0;padding:32px 12px;">
  <tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">
      <tr><td style="padding:0 0 24px 0;font-family:${SCHRIFT};font-size:20px;font-weight:700;letter-spacing:-0.01em;color:${FARBE.akzent};">BingeLog</td></tr>

      <tr><td style="background-color:${FARBE.karte};border:1px solid ${FARBE.rand};border-radius:8px;padding:32px;">
        <p style="margin:0 0 20px 0;font-family:${SCHRIFT};font-size:22px;font-weight:600;letter-spacing:-0.01em;line-height:1.3;color:${FARBE.text};">Änderung an deinem Konto</p>

        <p style="margin:0 0 12px 0;font-family:${SCHRIFT};font-size:15px;line-height:1.6;color:${FARBE.gedaempft};">Hallo ${sicher(name)},</p>

        <p style="margin:0 0 24px 0;font-family:${SCHRIFT};font-size:15px;line-height:1.6;color:${FARBE.text};">${BESCHREIBUNG[aktion]}</p>

        <!-- Die Begruendung abgesetzt und in Textfarbe: sie ist der
             Grund, warum diese Mail geschrieben wurde, und nicht das
             Kleingedruckte darunter. -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px 0;">
          <tr><td style="border-left:3px solid ${FARBE.akzent};padding:4px 0 4px 16px;">
            <p style="margin:0 0 6px 0;font-family:${SCHRIFT};font-size:12px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:${FARBE.gedaempft};">Begründung</p>
            <p style="margin:0;font-family:${SCHRIFT};font-size:15px;line-height:1.6;color:${FARBE.text};white-space:pre-line;">${sicher(grund)}</p>
          </td></tr>
        </table>

        <p style="margin:0;font-family:${SCHRIFT};font-size:13px;line-height:1.6;color:${FARBE.gedaempft};">Hältst du das für falsch, antworte einfach auf diese Mail. Wir schauen es uns noch einmal an.</p>
      </td></tr>

      <tr><td style="padding:20px 4px 0 4px;font-family:${SCHRIFT};font-size:12px;line-height:1.6;color:${FARBE.leise};">Filmtagebuch für den deutschsprachigen Raum · bingelog.eu</td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

/**
 * Die Benachrichtigung.
 *
 * Ueber die Brevo-API und nicht ueber SMTP: eine Edge Function haelt
 * keine Verbindung offen, und ein HTTP-Aufruf ist hier das kleinere
 * Werkzeug. Fehlt der Schluessel, meldet die Funktion das zurueck statt
 * still nichts zu tun.
 *
 * HTML **und** Text. Wer sein Programm auf Nur-Text stellt, bekommt sonst
 * eine leere Nachricht — und ausgerechnet diese Mail darf nicht leer
 * ankommen.
 */
async function benachrichtigen(
  an: string,
  name: string,
  aktion: Aktion,
  grund: string,
): Promise<boolean> {
  const key = Deno.env.get('BREVO_API_KEY');
  if (!key) return false;

  const text =
    `Hallo ${name},\n\n` +
    `${BESCHREIBUNG[aktion]}\n\n` +
    `Begründung:\n${grund}\n\n` +
    `Hältst du das für falsch, antworte einfach auf diese Mail. ` +
    `Wir schauen es uns noch einmal an.\n\n` +
    `BingeLog — Filmtagebuch für den deutschsprachigen Raum`;

  try {
    const antwort = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sender: { name: 'BingeLog', email: 'registrierung@bingelog.eu' },
        to: [{ email: an, name }],
        subject: 'Änderung an deinem BingeLog-Konto',
        htmlContent: vorlage(name, aktion, grund),
        textContent: text,
      }),
    });
    return antwort.ok;
  } catch {
    return false;
  }
}

Deno.serve(async (request: Request) => {
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  const authorization = request.headers.get('Authorization') ?? '';
  if (authorization === '') return json({ error: 'unauthorized' }, 401);

  // Schritt 1: Wer ruft, und darf er?
  //
  // Mit dem Zugang des Aufrufers, damit `is_moderator()` sein
  // auth.uid() sieht. Mit dem Service-Role-Schluessel gefragt waere die
  // Antwort bedeutungslos.
  const alsAufrufer = createClient(url, anonKey, {
    global: { headers: { Authorization: authorization } },
  });

  const { data: darf } = await alsAufrufer.rpc('is_moderator');
  if (darf !== true) return json({ error: 'forbidden' }, 403);

  const { data: aufruferProfil } = await alsAufrufer
    .from('profiles')
    .select('id, username')
    .eq('id', (await alsAufrufer.auth.getUser()).data.user?.id ?? '')
    .maybeSingle();

  let body: RequestBody;
  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return json({ error: 'bad_request' }, 400);
  }

  const aktion = body.action;
  const username = (body.username ?? '').trim().toLowerCase();
  const grund = (body.reason ?? '').trim();
  const wert = (body.value ?? '').trim();

  if (!aktion || username === '') return json({ error: 'bad_request' }, 400);
  if (grund.length < 3) return json({ error: 'reason_required' }, 400);

  const admin = createClient(url, serviceKey);

  const { data: ziel } = await admin
    .from('profiles')
    .select('id, username')
    .eq('username', username)
    .maybeSingle();

  if (!ziel) return json({ error: 'not_found' }, 404);

  // Sich selbst greift man nicht an. Das ist keine Sicherheitsmassnahme
  // — man kann sein eigenes Konto ohnehin aendern — sondern haelt das
  // Logbuch sauber.
  if (ziel.id === aufruferProfil?.id) return json({ error: 'not_yourself' }, 400);

  const { data: zielKonto } = await admin.auth.admin.getUserById(ziel.id);
  const zielMail = zielKonto.user?.email ?? '';

  const details: Record<string, unknown> = {};
  let neueMail = zielMail;

  // Schritt 2: der Eingriff.
  switch (aktion) {
    case 'password_reset': {
      // Nur ausloesen, nie setzen.
      const { error } = await admin.auth.resetPasswordForEmail(zielMail, {
        redirectTo: 'https://bingelog.eu/auth/neues-passwort',
      });
      if (error) return json({ error: 'action_failed', detail: error.message }, 500);
      break;
    }

    case 'username_reset': {
      if (!/^[a-z0-9_]{3,20}$/.test(wert)) return json({ error: 'bad_username' }, 400);
      const { error } = await admin.from('profiles').update({ username: wert }).eq('id', ziel.id);
      if (error) return json({ error: 'action_failed', detail: error.message }, 500);
      details.from = ziel.username;
      details.to = wert;
      break;
    }

    case 'email_change': {
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(wert)) return json({ error: 'bad_email' }, 400);
      const { error } = await admin.auth.admin.updateUserById(ziel.id, {
        email: wert,
        email_confirm: true,
      });
      if (error) return json({ error: 'action_failed', detail: error.message }, 500);
      details.from = zielMail;
      details.to = wert;
      // Die Nachricht geht an **beide** Adressen: die alte erfaehrt, dass
      // sie es nicht mehr ist, die neue, dass sie es jetzt ist. Nur die
      // neue zu benachrichtigen waere der Weg, ein Konto lautlos zu
      // uebernehmen.
      neueMail = wert;
      break;
    }

    case 'account_closed': {
      const { error } = await admin.auth.admin.updateUserById(ziel.id, {
        // Hundert Jahre. Supabase kennt kein "fuer immer", und ein
        // Ablaufdatum, das niemand erlebt, ist nah genug dran.
        ban_duration: '876000h',
      });
      if (error) return json({ error: 'action_failed', detail: error.message }, 500);
      await admin
        .from('profiles')
        .update({ closed_at: new Date().toISOString(), closed_reason: grund })
        .eq('id', ziel.id);
      break;
    }

    case 'account_restored': {
      const { error } = await admin.auth.admin.updateUserById(ziel.id, { ban_duration: 'none' });
      if (error) return json({ error: 'action_failed', detail: error.message }, 500);
      await admin
        .from('profiles')
        .update({ closed_at: null, closed_reason: null })
        .eq('id', ziel.id);
      break;
    }

    case 'note':
      break;
  }

  // Schritt 3: Logbuch und Benachrichtigung.
  const name = aktion === 'username_reset' ? wert : ziel.username;
  let benachrichtigt = false;
  if (zielMail !== '') {
    benachrichtigt = await benachrichtigen(zielMail, name, aktion, grund);
    if (neueMail !== zielMail) {
      const auchNeu = await benachrichtigen(neueMail, name, aktion, grund);
      benachrichtigt = benachrichtigt && auchNeu;
    }
  }

  const { error: logbuch } = await admin.from('account_actions').insert({
    target_id: ziel.id,
    target_name: ziel.username,
    actor_id: aufruferProfil?.id ?? null,
    actor_name: aufruferProfil?.username ?? 'unbekannt',
    action: aktion,
    reason: grund,
    details: Object.keys(details).length > 0 ? details : null,
    notified: benachrichtigt,
  });

  if (logbuch) {
    // Der Eingriff ist passiert, die Zeile fehlt. Das ist der eine Fall,
    // der laut werden muss: eine Aenderung ohne Spur.
    console.error('account action not logged:', logbuch.message);
    return json({ error: 'not_logged', detail: logbuch.message }, 500);
  }

  return json({ ok: true, notified: benachrichtigt });
});
