import Link from 'next/link';

import { getViewer } from '@/lib/session';
import { signOut } from '@/lib/auth-actions';

export async function Header() {
  const viewer = await getViewer();

  return (
    <header className="border-border border-b">
      <nav className="mx-auto flex max-w-5xl items-center gap-5 px-5 py-3.5">
        <Link href="/" className="text-base font-semibold tracking-tight">
          BingeLog
        </Link>

        <div className="ml-auto flex items-center gap-4 text-sm">
          {viewer && !viewer.username ? (
            // Signed in but never finished choosing a name. Showing
            // "Anmelden" here produced an app that was logged in and
            // looked logged out, with nothing pointing the way out.
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
            <>
              <Link href="/tagebuch" className="text-muted-foreground hover:text-foreground">
                Tagebuch
              </Link>
              <Link href="/watchlist" className="text-muted-foreground hover:text-foreground">
                Watchlist
              </Link>
              {/* Profilseiten kommen mit M4. Bis dahin steht der Name da,
                  ohne ins Leere zu führen. */}
              <span className="text-muted-foreground">{viewer.username}</span>
              <form action={signOut}>
                <button type="submit" className="text-muted-foreground hover:text-foreground">
                  Abmelden
                </button>
              </form>
            </>
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
