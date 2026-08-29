import { redirect } from 'next/navigation';
import type { Metadata } from 'next';

import { createClient } from '@/lib/supabase/server';
import { getViewer } from '@/lib/session';
import { SettingsForm } from './settings-form';
import { FavouriteEditor, type Favorit } from '@/components/favourite-editor';
import { BlockButton } from '@/components/block-button';
import { myBlocks } from '@/lib/block-actions';
import { Avatar } from '@/components/profile-parts';

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
  // Die vier Plaetze. Nach Platz sortiert, nicht nach Aufnahme: Platz
  // eins ist Platz eins.
  const { data: favRows } = await supabase
    .from('favourites')
    .select(
      'position, films(wikidata_id, title_de, title_original, release_year, poster_source, poster_url)',
    )
    .eq('user_id', viewer.id)
    .order('position');

  const favoriten = (
    (favRows ?? []) as unknown as { position: number; films: Favorit['film'] }[]
  ).map((f) => ({ position: f.position, film: f.films }));

  // Wen ich blockiert habe. Die Policy gibt diese Liste nur mir.
  const blockiert = await myBlocks();

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

      <div className="border-border border-t pt-8">
        <FavouriteEditor anfang={favoriten} />
      </div>

      <section className="border-border flex flex-col gap-4 border-t pt-8">
        <div className="flex flex-col gap-1">
          <h2 className="text-base font-semibold tracking-tight">Blockiert</h2>
          <p className="text-muted-foreground text-xs">
            Ihre Beiträge in Diskussionen siehst du nicht mehr. Sie erfahren davon nichts, und für
            alle anderen ändert sich nichts.
          </p>
        </div>

        {blockiert.length === 0 ? (
          <p className="text-muted-foreground text-sm">Niemand.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {blockiert.map((b) => (
              <li key={b.username} className="flex items-center gap-3">
                {b.avatar_path ? (
                  <img
                    src={
                      supabase.storage.from('avatars').getPublicUrl(b.avatar_path).data.publicUrl
                    }
                    alt=""
                    className="h-8 w-8 shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <Avatar name={b.username} size={32} />
                )}
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-medium">@{b.username}</span>
                  {b.display_name ? (
                    <span className="text-muted-foreground truncate text-xs">{b.display_name}</span>
                  ) : null}
                </span>
                <span className="ml-auto">
                  <BlockButton username={b.username} blockiert />
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
