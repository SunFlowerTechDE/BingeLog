/**
 * M4 4.7 — einen Film von Hand korrigieren.
 *
 * Der Katalog wird nicht aus `apps/web` geschrieben. Die Pruefung
 * "catalog tables carry SELECT policies only" in `scripts/verify.ts`
 * haelt das fest, und sie soll gueltig bleiben: eine Update-Policy auf
 * `films` waere eine Tuer, die danach immer offen steht. Also derselbe
 * Weg wie bei `lazy-film` und `admin-account`.
 *
 * Jedes geaenderte Feld landet zusaetzlich in `manual_fields`. Der
 * Wikidata-Import laesst genau diese Felder danach stehen — ohne das
 * waere jede Korrektur beim naechsten Lauf still wieder weg
 * (Migration 20260828390000).
 *
 * Zuruecksetzen geht ueber `unlock`: dann faellt das Feld aus
 * `manual_fields` heraus und folgt beim naechsten Import wieder der
 * Quelle.
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';

/** Was ein Mensch aendern darf. Alles andere gehoert der Pipeline. */
const FELDER = [
  'title_de',
  'title_original',
  'title_en',
  'release_year',
  'runtime_min',
  'synopsis_de',
  'fsk',
  'fsk_note',
  'poster_url',
] as const;

type Feld = (typeof FELDER)[number];

interface RequestBody {
  wikidataId?: string;
  /** Nur die Felder, die sich aendern sollen. */
  changes?: Partial<Record<Feld, string | number | null>>;
  /** Felder, die wieder der Quelle folgen sollen. */
  unlock?: Feld[];
  /** Die Diskussion schliessen oder wieder oeffnen. */
  thread?: { locked: boolean; reason?: string };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const FSK_STUFEN = [0, 6, 12, 16, 18];

Deno.serve(async (request: Request) => {
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  const authorization = request.headers.get('Authorization') ?? '';
  if (authorization === '') return json({ error: 'unauthorized' }, 401);

  // Mit dem Zugang des Aufrufers gefragt, nicht mit dem
  // Service-Role-Schluessel: sonst waere die Antwort bedeutungslos.
  const alsAufrufer = createClient(url, anonKey, {
    global: { headers: { Authorization: authorization } },
  });
  const { data: darf } = await alsAufrufer.rpc('is_moderator');
  if (darf !== true) return json({ error: 'forbidden' }, 403);

  const wer = (await alsAufrufer.auth.getUser()).data.user?.id ?? null;

  let body: RequestBody;
  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return json({ error: 'bad_request' }, 400);
  }

  const id = (body.wikidataId ?? '').trim();
  if (id === '') return json({ error: 'bad_request' }, 400);

  const admin = createClient(url, serviceKey);

  const { data: film } = await admin
    .from('films')
    .select('wikidata_id, manual_fields')
    .eq('wikidata_id', id)
    .maybeSingle();

  if (!film) return json({ error: 'not_found' }, 404);

  const aenderungen: Record<string, unknown> = {};
  const gesetzt: string[] = [];

  for (const [feld, wert] of Object.entries(body.changes ?? {})) {
    if (!FELDER.includes(feld as Feld)) return json({ error: 'unknown_field', field: feld }, 400);

    if (feld === 'fsk') {
      // `null` heisst "unbekannt" und ist erlaubt. Eine Zahl, die keine
      // Stufe ist, nicht — eine erfundene Altersfreigabe waere schlimmer
      // als gar keine.
      if (wert !== null && !FSK_STUFEN.includes(Number(wert))) {
        return json({ error: 'bad_fsk' }, 400);
      }
      aenderungen.fsk = wert === null ? null : Number(wert);
    } else if (feld === 'release_year' || feld === 'runtime_min') {
      aenderungen[feld] = wert === null || wert === '' ? null : Number(wert);
    } else {
      const text = typeof wert === 'string' ? wert.trim() : '';
      aenderungen[feld] = text === '' ? null : text;
    }

    // `title_original` ist `not null`: leeren waere ein Film ohne Namen.
    if (feld === 'title_original' && aenderungen[feld] === null) {
      return json({ error: 'title_required' }, 400);
    }

    gesetzt.push(feld);
  }

  // --- Die Diskussion schliessen oder oeffnen ---------------------
  //
  // Das trifft einen **Ort**, nicht eine Aeusserung und nicht eine
  // Person: geschlossen kann niemand mehr schreiben, auch die
  // dreissig Unbeteiligten nicht. Deshalb ist der Grund Pflicht — wer
  // eine geschlossene Tuer sieht, soll wissen warum, sonst wirkt es
  // wie ein Fehler.
  if (body.thread) {
    const grund = (body.thread.reason ?? '').trim();
    if (body.thread.locked && grund.length < 3) {
      return json({ error: 'lock_reason_required' }, 400);
    }

    const { error } = await admin
      .from('film_threads')
      .update(
        body.thread.locked
          ? {
              is_locked: true,
              locked_at: new Date().toISOString(),
              locked_by: wer,
              locked_reason: grund,
            }
          : { is_locked: false, locked_at: null, locked_by: null, locked_reason: null },
      )
      .eq('film_id', id);

    if (error) return json({ error: 'lock_failed', detail: error.message }, 500);
  }

  if (gesetzt.length === 0 && (body.unlock ?? []).length === 0 && !body.thread) {
    return json({ error: 'nothing_to_do' }, 400);
  }

  if (gesetzt.length === 0 && (body.unlock ?? []).length === 0) {
    return json({ ok: true, manual_fields: film.manual_fields ?? [] });
  }

  // fsk und fsk_note kennt die Pipeline nicht — sie zu sperren waere
  // eine Sperre gegen niemanden.
  const sperrbar = gesetzt.filter((f) => f !== 'fsk' && f !== 'fsk_note' && f !== 'poster_url');

  const vorher: string[] = film.manual_fields ?? [];
  const entsperrt = new Set(body.unlock ?? []);
  const nachher = [...new Set([...vorher.filter((f) => !entsperrt.has(f as Feld)), ...sperrbar])];

  const { error } = await admin
    .from('films')
    .update({
      ...aenderungen,
      manual_fields: nachher,
      edited_at: new Date().toISOString(),
      edited_by: wer,
    })
    .eq('wikidata_id', id);

  if (error) return json({ error: 'update_failed', detail: error.message }, 500);

  return json({ ok: true, manual_fields: nachher });
});
