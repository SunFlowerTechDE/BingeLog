import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata, Route } from 'next';

import { createClient } from '@/lib/supabase/server';
import { getViewer } from '@/lib/session';
import { ListEditor, type Listeneintrag } from '@/components/list-editor';
import { ShareButton } from '@/components/share-button';

/**
 * Eine Binge-Liste (M4 4.3).
 *
 * Ob sie ueberhaupt geladen wird, entscheidet die Policy. Eine private
 * Liste kommt als leeres Ergebnis zurueck und endet hier im 404 — nicht
 * in "keine Berechtigung", was ihre Existenz verraten wuerde.
 */
const FELDER =
  'id, user_id, title, description, is_public, ' +
  'profiles(username), ' +
  'list_items(ord, note, films(wikidata_id, title_de, title_original, release_year, poster_source, poster_url))';

interface Liste {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  is_public: boolean;
  profiles: { username: string };
  list_items: {
    ord: number;
    note: string | null;
    films: Listeneintrag['film'];
  }[];
}

async function laden(id: string): Promise<Liste | null> {
  const supabase = await createClient();
  const { data } = await supabase.from('lists').select(FELDER).eq('id', id).maybeSingle();
  return (data as unknown as Liste | null) ?? null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const liste = await laden(id);
  return { title: liste ? liste.title : 'Liste nicht gefunden' };
}

export default async function ListPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const liste = await laden(id);
  if (!liste) notFound();

  const viewer = await getViewer();
  const eigenes = viewer?.id === liste.user_id;

  // Nach `ord` sortiert: die Reihenfolge ist Teil der Aussage.
  const eintraege: Listeneintrag[] = [...liste.list_items]
    .sort((a, b) => a.ord - b.ord)
    .map((e) => ({ film: e.films, note: e.note }));

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-5 py-8">
      <div className="flex flex-col gap-2">
        <Link
          href={`/@${liste.profiles.username}/listen` as Route}
          className="text-muted-foreground hover:text-foreground text-xs underline-offset-4 hover:underline"
        >
          ← Alle Listen von @{liste.profiles.username}
        </Link>

        <div className="flex flex-wrap items-start gap-3">
          <h1 className="text-3xl font-semibold tracking-tight">{liste.title}</h1>
          {eigenes && !liste.is_public ? (
            <span className="border-border text-muted-foreground mt-2 shrink-0 rounded-full border px-2 py-0.5 text-xs">
              Nur für dich
            </span>
          ) : null}
        </div>

        {liste.description ? (
          <p className="max-w-prose leading-relaxed">{liste.description}</p>
        ) : null}

        <p className="text-muted-foreground text-xs">
          {eintraege.length} Filme · von{' '}
          <Link href={`/@${liste.profiles.username}` as Route} className="hover:underline">
            @{liste.profiles.username}
          </Link>
        </p>

        {/* Weitergeben nur, was auch ankommt. Ein Teilen-Knopf an einer
            privaten Liste verschickt eine Adresse, hinter der fuer den
            Empfaenger nichts steht. */}
        {liste.is_public ? (
          <div className="pt-1">
            <ShareButton titel={`${liste.title} — BingeLog`} />
          </div>
        ) : null}
      </div>

      {eigenes ? (
        <ListEditor
          listId={liste.id}
          anfang={eintraege}
          titelJetzt={liste.title}
          beschreibungJetzt={liste.description}
          oeffentlichJetzt={liste.is_public}
        />
      ) : eintraege.length === 0 ? (
        <p className="text-muted-foreground text-sm">Die Liste ist noch leer.</p>
      ) : (
        <ol className="flex flex-col gap-4">
          {eintraege.map((eintrag, index) => (
            <li key={eintrag.film.wikidata_id} className="flex gap-4">
              <span className="text-muted-foreground w-6 shrink-0 pt-1 text-right text-sm tabular-nums">
                {index + 1}
              </span>
              <Link
                href={`/film/${eintrag.film.wikidata_id}` as Route}
                className="bg-card w-14 shrink-0 overflow-hidden rounded"
              >
                <img
                  src={
                    eintrag.film.poster_source === 'tvdb' && eintrag.film.poster_url
                      ? eintrag.film.poster_url
                      : `/poster/${eintrag.film.wikidata_id}`
                  }
                  alt=""
                  className="aspect-[2/3] w-full object-cover"
                />
              </Link>
              <div className="flex min-w-0 flex-col gap-1">
                <Link
                  href={`/film/${eintrag.film.wikidata_id}` as Route}
                  className="font-medium hover:underline"
                >
                  {eintrag.film.title_de ?? eintrag.film.title_original}
                  {eintrag.film.release_year ? (
                    <span className="text-muted-foreground font-normal">
                      {' '}
                      {eintrag.film.release_year}
                    </span>
                  ) : null}
                </Link>
                {eintrag.note ? (
                  <p className="text-muted-foreground text-sm leading-relaxed">{eintrag.note}</p>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      )}
    </main>
  );
}
