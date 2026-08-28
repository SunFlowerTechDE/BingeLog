import { redirect } from 'next/navigation';
import type { Metadata } from 'next';

import { createClient } from '@/lib/supabase/server';
import { getViewer } from '@/lib/session';
import { SettingsForm } from './settings-form';

export const metadata: Metadata = { title: 'Profil bearbeiten' };

/**
 * M4 4.2 — Profil bearbeiten.
 *
 * Der Benutzername fehlt hier mit Absicht: er ist die Profiladresse und
 * steht unter allem, was jemand geschrieben hat. Ihn zu aendern laesst
 * fremde Links ins Leere laufen, und das ist eine eigene Entscheidung
 * mit eigenen Folgen — kein Feld unter anderen.
 */
export default async function SettingsPage() {
  const viewer = await getViewer();
  if (!viewer) redirect('/anmelden');
  if (!viewer.username) redirect('/willkommen');

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from('profiles')
    .select('username, display_name, bio, avatar_path, banner_path, watchlist_public')
    .eq('id', viewer.id)
    .maybeSingle();

  if (!profile) redirect('/willkommen');

  const { data: bild } = supabase.storage.from('avatars').getPublicUrl(profile.avatar_path ?? '');
  const { data: streifen } = supabase.storage
    .from('banners')
    .getPublicUrl(profile.banner_path ?? '');

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-8 px-5 py-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Profil bearbeiten</h1>
        <p className="text-muted-foreground text-sm">
          Dein Name bleibt @{profile.username}. Alles andere kannst du hier ändern.
        </p>
      </div>

      <SettingsForm
        username={profile.username}
        displayName={profile.display_name}
        bio={profile.bio}
        avatarUrl={profile.avatar_path ? bild.publicUrl : null}
        bannerUrl={profile.banner_path ? streifen.publicUrl : null}
        watchlistPublic={profile.watchlist_public}
      />
    </main>
  );
}
