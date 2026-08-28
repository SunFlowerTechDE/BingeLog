'use server';

import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';
import { getViewer } from '@/lib/session';

export interface ProfileResult {
  error?: string;
  message?: string;
}

const BIO_MAX = 300;
const NAME_MAX = 40;

function feld(formData: FormData, name: string): string {
  const wert = formData.get(name);
  return typeof wert === 'string' ? wert : '';
}

/**
 * Anzeigename, Bio und die Sichtbarkeit der Watchlist.
 *
 * Der Benutzername steht hier nicht: er ist die Profiladresse und steht
 * unter allem, was jemand geschrieben hat. Ihn zu aendern hiesse, Links
 * anderer Leute ins Leere laufen zu lassen. Das ist eine eigene
 * Entscheidung mit eigenen Folgen, nicht ein Feld unter anderen.
 */
export async function saveProfile(
  _previous: ProfileResult,
  formData: FormData,
): Promise<ProfileResult> {
  const viewer = await getViewer();
  if (!viewer?.username) return { error: 'Melde dich an.' };

  const displayName = feld(formData, 'displayName').trim();
  const bio = feld(formData, 'bio').trim();

  if (displayName.length > NAME_MAX) {
    return { error: `Der Name darf höchstens ${String(NAME_MAX)} Zeichen haben.` };
  }
  if (bio.length > BIO_MAX) {
    return { error: `Die Beschreibung darf höchstens ${String(BIO_MAX)} Zeichen haben.` };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('profiles')
    .update({
      display_name: displayName === '' ? null : displayName,
      bio: bio === '' ? null : bio,
      watchlist_public: formData.get('watchlistPublic') !== null,
    })
    .eq('id', viewer.id);

  if (error) {
    console.error('saveProfile failed:', error.message);
    return { error: 'Das hat nicht geklappt.' };
  }

  revalidatePath(`/@${viewer.username}`);
  revalidatePath('/einstellungen');
  return { message: 'Gespeichert' };
}

/**
 * Ein zugeschnittenes Bild ablegen und den Pfad vermerken.
 *
 * Profilbild und Kopfbild sind derselbe Vorgang mit anderem Bucket,
 * anderer Spalte und anderer Grenze — eine Kopie waere zweimal derselbe
 * Fehler zu beheben.
 *
 * Neuer Zufallsname bei jedem Mal: dieselbe Adresse waere tagelang aus
 * Zwischenspeichern beantwortet, und wer sein Bild wechselt, saehe
 * weiter das alte und hielte das Hochladen fuer gescheitert.
 *
 * Das alte wird danach entfernt. Nicht davor: bricht das Hochladen ab,
 * steht sonst gar keins mehr da.
 */
async function bildAblegen(
  formData: FormData,
  bucket: 'avatars' | 'banners',
  spalte: 'avatar_path' | 'banner_path',
  grenze: number,
): Promise<ProfileResult> {
  const viewer = await getViewer();
  if (!viewer?.username) return { error: 'Melde dich an.' };

  const datei = formData.get('bild');
  if (!(datei instanceof File) || datei.size === 0) return { error: 'Kein Bild dabei.' };

  // Was der Browser liefern konnte: WebP, sonst JPEG. Andere Formate
  // nimmt der Bucket nicht, und die Endung soll zum Inhalt passen.
  const typ = datei.type === 'image/jpeg' ? 'image/jpeg' : 'image/webp';
  const endung = typ === 'image/jpeg' ? 'jpg' : 'webp';

  // Die Grenze steht auch am Bucket. Hier noch einmal, damit die Antwort
  // eine verstaendliche ist statt eines Speicherfehlers.
  if (datei.size > grenze) return { error: 'Das Bild ist zu groß.' };

  const supabase = await createClient();

  const { data: vorher } = await supabase
    .from('profiles')
    .select(spalte)
    .eq('id', viewer.id)
    .maybeSingle();

  const alt = (vorher as Record<string, string | null> | null)?.[spalte] ?? null;
  const pfad = `${viewer.id}/${crypto.randomUUID()}.${endung}`;

  const { error: hochladen } = await supabase.storage
    .from(bucket)
    .upload(pfad, datei, { contentType: typ });

  if (hochladen) {
    console.error(`${bucket} upload failed:`, hochladen.message);
    return { error: 'Das Bild ließ sich nicht speichern.' };
  }

  const { error: vermerken } = await supabase
    .from('profiles')
    // Ein berechneter Schluessel verliert seinen Typ, und die Tabelle
    // naehme dann jedes Feld an. Zwei Zweige, dafuer geprueft.
    .update(spalte === 'avatar_path' ? { avatar_path: pfad } : { banner_path: pfad })
    .eq('id', viewer.id);

  if (vermerken) {
    // Die Datei liegt, der Verweis fehlt: aufraeumen, sonst bleibt eine
    // Waise im Speicher, die niemand je findet.
    await supabase.storage.from(bucket).remove([pfad]);
    console.error(`${bucket} path not stored:`, vermerken.message);
    return { error: 'Das Bild ließ sich nicht speichern.' };
  }

  if (alt) await supabase.storage.from(bucket).remove([alt]);

  revalidatePath(`/@${viewer.username}`);
  revalidatePath('/einstellungen');
  return { message: 'Bild gespeichert' };
}

/** Das Bild wieder loeschen. */
async function bildEntfernen(
  bucket: 'avatars' | 'banners',
  spalte: 'avatar_path' | 'banner_path',
): Promise<ProfileResult> {
  const viewer = await getViewer();
  if (!viewer?.username) return { error: 'Melde dich an.' };

  const supabase = await createClient();

  const { data: vorher } = await supabase
    .from('profiles')
    .select(spalte)
    .eq('id', viewer.id)
    .maybeSingle();

  const { error } = await supabase
    .from('profiles')
    .update(spalte === 'avatar_path' ? { avatar_path: null } : { banner_path: null })
    .eq('id', viewer.id);

  if (error) {
    console.error(`${bucket} removal failed:`, error.message);
    return { error: 'Das hat nicht geklappt.' };
  }

  const alt = (vorher as Record<string, string | null> | null)?.[spalte] ?? null;
  if (alt) await supabase.storage.from(bucket).remove([alt]);

  revalidatePath(`/@${viewer.username}`);
  revalidatePath('/einstellungen');
  return { message: 'Bild entfernt' };
}

/** 512 Pixel im Quadrat, hoechstens 256 KB. */
export async function saveAvatar(formData: FormData): Promise<ProfileResult> {
  return bildAblegen(formData, 'avatars', 'avatar_path', 262144);
}

export async function removeAvatar(): Promise<ProfileResult> {
  return bildEntfernen('avatars', 'avatar_path');
}

/**
 * Der Streifen ueber dem Profil: 1600 Pixel breit, hoechstens 400 KB.
 *
 * Er steht ueber der Seite und wird als erstes geladen; was hier zu
 * schwer ist, verzoegert alles Uebrige.
 */
export async function saveBanner(formData: FormData): Promise<ProfileResult> {
  return bildAblegen(formData, 'banners', 'banner_path', 409600);
}

export async function removeBanner(): Promise<ProfileResult> {
  return bildEntfernen('banners', 'banner_path');
}
