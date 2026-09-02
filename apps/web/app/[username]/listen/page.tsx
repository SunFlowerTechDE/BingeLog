import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata, Route } from 'next';

import { createClient } from '@/lib/supabase/server';
import { getViewer } from '@/lib/session';
import { ListCreateForm } from '@/components/list-create-form';

/**
 * Die Binge-Listen eines Profils (M4 4.3).
 *
 * Welche Listen hier stehen, entscheidet die Policy: oeffentliche fuer
 * alle, private nur fuer den Besitzer. Diese Seite filtert nicht nach
 * Sichtbarkeit — ein zweites Urteil koennte vom ersten abweichen.
 */
function nameAus(segment: string): string | null {
  const decoded = decodeURIComponent(segment);
  if (!decoded.startsWith('@')) return null;
  const name = decoded.slice(1).toLowerCase();
  return /^[a-z0-9_]{3,20}$/.test(name) ? name : null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  const name = nameAus(username);
  return { title: name ? `Listen von @${name}` : 'Nicht gefunden' };
}

export default async function ListsPage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const name = nameAus(username);
  if (!name) notFound();

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, username')
    .eq('username', name)
    .maybeSingle();

  if (!profile) notFound();

  const viewer = await getViewer();
  const eigenes = viewer?.id === profile.id;

  // `lists_of` liefert Zahl **und** drei Plakate in einer Antwort. Vorher
  // holte die Seite die Anzahl ueber eine eingebettete Zaehlung und die
  // Plakate gar nicht — eine Liste ohne Bild sieht aus wie eine leere.
  const { data: rows } = await supabase.rpc('lists_of', { profile: profile.id });

  const listen = (rows ?? []) as unknown as {
    id: string;
    title: string;
    description: string | null;
    is_public: boolean;
    films: number;
    posters: string[];
  }[];

  // `/poster/…` liefert **immer** die prozedurale Karte. Wo es ein
  // echtes Plakat gibt, gehoert das dorthin — also einmal nachsehen,
  // fuer alle Vorschauen zusammen und nicht je Liste.
  const vorschauIDs = [...new Set(listen.flatMap((l) => l.posters.slice(0, 3)))];
  const plakate = new Map<string, string>();

  if (vorschauIDs.length > 0) {
    const { data: filme } = await supabase
      .from('films')
      .select('wikidata_id, poster_source, poster_url')
      .in('wikidata_id', vorschauIDs);

    for (const film of filme ?? []) {
      if (film.poster_source === 'tvdb' && film.poster_url !== null) {
        plakate.set(film.wikidata_id, film.poster_url);
      }
    }
  }

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 px-5 py-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Binge-Listen</h1>
        <p className="text-muted-foreground text-sm">
          {eigenes ? (
            'Deine Sammlungen. Jede kann öffentlich oder nur für dich sein.'
          ) : (
            <>
              Sammlungen von{' '}
              <Link href={`/@${profile.username}` as Route} className="hover:underline">
                @{profile.username}
              </Link>
            </>
          )}
        </p>
      </div>

      {eigenes ? <ListCreateForm /> : null}

      {listen.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          {eigenes
            ? 'Noch keine Liste. Leg eine an — ein Name genügt.'
            : 'Hier ist nichts zu sehen.'}
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {listen.map((liste) => (
            <li key={liste.id}>
              <Link
                href={`/listen/${liste.id}` as Route}
                className="border-border bg-card/40 hover:bg-card flex h-full flex-col gap-2 rounded-lg border p-5"
              >
                <div className="flex items-start gap-3">
                  <h2 className="font-medium">{liste.title}</h2>
                  {/* Der Hinweis steht nur beim Besitzer: fuer andere
                      gibt es keine privaten Listen zu sehen, und "privat"
                      auf einer sichtbaren Liste waere Unsinn. */}
                  {eigenes && !liste.is_public ? (
                    <span className="border-border text-muted-foreground ml-auto shrink-0 rounded-full border px-2 py-0.5 text-xs">
                      Nur für dich
                    </span>
                  ) : null}
                </div>
                {liste.description ? (
                  <p className="text-muted-foreground line-clamp-2 text-sm leading-relaxed">
                    {liste.description}
                  </p>
                ) : null}
                {/* Drei Plakate als Vorschau. Eine Liste, die man nur
                    am Namen erkennt, sieht aus wie eine leere. */}
                {liste.posters.length > 0 ? (
                  <span className="mt-auto flex gap-1.5 pt-2">
                    {liste.posters.slice(0, 3).map((filmId) => (
                      <span
                        key={filmId}
                        className="bg-card h-16 w-11 shrink-0 overflow-hidden rounded"
                      >
                        {/* Verlinkt, nie gespiegelt
                            (docs/legal/thetvdb-lizenz.md). */}
                        <img
                          src={plakate.get(filmId) ?? `/poster/${filmId}`}
                          alt=""
                          loading="lazy"
                          className="h-full w-full object-cover"
                        />
                      </span>
                    ))}
                  </span>
                ) : null}

                <span
                  className={`text-muted-foreground text-xs tabular-nums ${
                    liste.posters.length > 0 ? 'pt-1' : 'mt-auto pt-2'
                  }`}
                >
                  {liste.films === 1 ? '1 Film' : `${String(liste.films)} Filme`}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
