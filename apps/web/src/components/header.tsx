import Image from 'next/image';
import Link from 'next/link';
import type { Route } from 'next';

import { getViewer } from '@/lib/session';
import { signOut } from '@/lib/auth-actions';
import { createClient } from '@/lib/supabase/server';
import { Symbol, type Symbolart } from '@/components/icons';
import { HeaderSearch } from '@/components/header-search';
import { UserMenu } from '@/components/user-menu';
import { isModerator } from '@/lib/moderation';

/**
 * Die Kopfleiste in drei Zonen.
 *
 * Vorher stand alles in einer Reihe gleich laut nebeneinander: Tagebuch,
 * Watchlist, der eigene Name, Einstellungen, Abmelden. Fuenf Woerter,
 * kein Rang.
 *
 * Jetzt gibt es drei: **wohin man geht** in der Mitte, **was man sucht**
 * als Lupe, **wer man ist** rechts. Was man selten braucht —
 * Einstellungen, Abmelden — liegt hinter dem eigenen Namen, nicht neben
 * den Zielen.
 */
const ZIELE: { href: Route; label: string; art: Symbolart }[] = [
  { href: '/entdecken', label: 'Entdecken', art: 'kompass' },
  { href: '/watchlist', label: 'Watchlist', art: 'merken' },
  { href: '/tagebuch', label: 'Tagebuch', art: 'buch' },
];

export async function Header() {
  const viewer = await getViewer();

  let avatarUrl: string | null = null;
  if (viewer?.username) {
    const supabase = await createClient();
    const { data } = await supabase
      .from('profiles')
      .select('avatar_path')
      .eq('id', viewer.id)
      .maybeSingle();
    if (data?.avatar_path) {
      avatarUrl = supabase.storage.from('avatars').getPublicUrl(data.avatar_path).data.publicUrl;
    }
  }

  const angemeldet = Boolean(viewer?.username);
  const moderiert = angemeldet ? await isModerator() : false;

  return (
    <header className="border-border border-b">
      <nav className="relative mx-auto flex max-w-7xl items-center gap-4 px-5 py-3">
        {/* Die Bildmarke, dieselbe Datei wie in der App. Der Schriftzug
            bleibt gesetzt und ist nirgends eine Bilddatei — auch in der
            App setzt ihn SwiftUI. */}
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <Image
            src="/logo.png"
            alt=""
            width={26}
            height={26}
            priority
            className="h-[26px] w-[26px]"
          />
          <span className="text-primary text-base font-semibold tracking-tight">BingeLog</span>
        </Link>

        {/* Die Mitte gehoert den Zielen. Auf schmalen Schirmen bleiben
            die Symbole und die Woerter gehen — drei Symbole passen, drei
            Woerter nicht. */}
        {angemeldet ? (
          <div className="absolute left-1/2 flex -translate-x-1/2 items-center gap-1">
            {ZIELE.map((ziel) => (
              <Link
                key={ziel.href}
                href={ziel.href}
                className="text-muted-foreground hover:text-foreground hover:bg-card flex items-center gap-2 rounded-md px-3 py-1.5 text-sm"
              >
                <Symbol art={ziel.art} size={17} />
                <span className="hidden sm:inline">{ziel.label}</span>
              </Link>
            ))}
          </div>
        ) : null}

        <div className="ml-auto flex items-center gap-2 text-sm">
          <HeaderSearch />

          {viewer && !viewer.username ? (
            // Angemeldet, aber nie einen Namen gewaehlt. Hier "Anmelden"
            // zu zeigen ergab eine App, die angemeldet war und
            // abgemeldet aussah, ohne Weg heraus.
            <>
              <Link href="/willkommen" className="text-primary underline underline-offset-4">
                Namen wählen
              </Link>
              <form action={signOut}>
                <button type="submit" className="text-muted-foreground hover:text-foreground">
                  Abmelden
                </button>
              </form>
            </>
          ) : viewer?.username ? (
            <UserMenu
              username={viewer.username}
              avatarUrl={avatarUrl}
              moderiert={moderiert}
              abmelden={
                <form action={signOut}>
                  <button
                    type="submit"
                    role="menuitem"
                    className="hover:bg-background text-muted-foreground hover:text-foreground w-full rounded-md px-3 py-2 text-left text-sm"
                  >
                    Abmelden
                  </button>
                </form>
              }
            />
          ) : (
            <>
              <Link href="/anmelden" className="text-muted-foreground hover:text-foreground">
                Anmelden
              </Link>
              <Link
                href="/registrieren"
                className="bg-primary text-primary-foreground rounded-md px-3 py-1.5 font-medium"
              >
                Registrieren
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
