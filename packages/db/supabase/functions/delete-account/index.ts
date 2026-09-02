/**
 * M6 — das eigene Konto loeschen (Art. 17 DSGVO).
 *
 * Sie liegt hier und nicht in `apps/web`, weil ein Konto nur mit dem
 * Service-Role-Key zu loeschen ist und der dort nie liegen darf
 * (M0 0.2). Eine Edge Function bekommt ihn aus der Umgebung von
 * Supabase; er landet nie im Repository.
 *
 * **Geloescht wird immer nur der Aufrufer selbst.** Die Nutzer-ID kommt
 * aus dem Token, nie aus dem Rumpf der Anfrage. Ein Feld `userId` gibt
 * es nicht — sonst waere diese Funktion ein Knopf, mit dem jeder jedes
 * Konto loeschen kann, und der Service-Role-Key umgeht jede Policy.
 *
 * Zwei Schritte, in dieser Reihenfolge:
 *
 *   1. Der Objektspeicher. **Er kaskadiert nicht.** Faellt das Konto
 *      zuerst, bleiben Profilbild, Kopfbild und Importdatei liegen, und
 *      niemand kann sie danach noch zuordnen.
 *   2. Das Konto. Die Fremdschluessel raeumen Tagebuch, Watchlist,
 *      Listen, Favoriten, Folgen, Blockaden, Empfehlungen, Beitraege,
 *      Geschmacksstimmen und Importe mit.
 *
 * Was bleibt: Meldungen und Moderationseintraege, beide ohne den Namen
 * daran. Der DSA verlangt die Spur, und eine Meldung, die mit dem
 * gemeldeten Konto verschwindet, waere keine. Bilder an Meldungen liegen
 * unter der Melde-ID und gehoeren dorthin, nicht zum Konto.
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

/** Die Ordner, die einem Konto gehoeren. Je Bucket ein Praefix. */
const OWNED_FOLDERS = ['avatars', 'banners', 'imports'] as const;

/**
 * Alles unter `<bucket>/<userId>/` wegraeumen.
 *
 * Zuerst auflisten, dann loeschen: `remove` nimmt Pfade, keinen Ordner.
 * Fehlschlaege werden gemeldet und halten die Loeschung nicht auf — ein
 * Konto, das wegen einer liegengebliebenen Datei bestehen bleibt, waere
 * das schlechtere Ergebnis.
 */
async function clearFolder(
  admin: ReturnType<typeof createClient>,
  bucket: string,
  userId: string,
): Promise<number> {
  const { data, error } = await admin.storage.from(bucket).list(userId, { limit: 1000 });

  if (error) {
    console.error(`list ${bucket}/${userId} failed:`, error.message);
    return 0;
  }
  if (!data || data.length === 0) return 0;

  const paths = data.map((entry) => `${userId}/${entry.name}`);
  const { error: removeError } = await admin.storage.from(bucket).remove(paths);

  if (removeError) {
    console.error(`remove from ${bucket} failed:`, removeError.message);
    return 0;
  }
  return paths.length;
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

  const token = (request.headers.get('Authorization') ?? '').replace(/^Bearer /i, '');
  if (token === '') return json({ error: 'not_signed_in' }, 401);

  // Wer ruft? Mit dem **Token des Aufrufers**, nicht mit dem
  // Service-Role-Key: der wuerde jede Frage mit "ja" beantworten.
  const asCaller = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: caller, error: authError } = await asCaller.auth.getUser();
  const userId = caller.user?.id;

  if (authError || userId === undefined) {
    return json({ error: 'not_signed_in' }, 401);
  }

  // Der Service-Role-Key erst ab hier, und nur fuer diese eine ID.
  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let removedFiles = 0;
  for (const bucket of OWNED_FOLDERS) {
    removedFiles += await clearFolder(admin, bucket, userId);
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(userId);

  if (deleteError) {
    console.error('deleteUser failed:', deleteError.message);
    return json({ error: 'delete_failed' }, 500);
  }

  return json({ deleted: true, removedFiles });
});
