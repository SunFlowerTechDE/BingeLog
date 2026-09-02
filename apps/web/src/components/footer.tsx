import Link from 'next/link';

/**
 * Die Fußzeile.
 *
 * Sie trägt genau das, was auf jede Seite gehört und sonst nirgends
 * steht. Die Nutzungsbedingungen fehlen noch (M6) und werden deshalb
 * auch nicht als Link behauptet — ein Link ins Leere ist schlechter als
 * keiner.
 */
export function Footer() {
  return (
    <footer className="border-border mt-10 border-t">
      <div className="text-muted-foreground mx-auto flex max-w-7xl flex-wrap items-center gap-x-5 gap-y-2 px-5 py-6 text-xs">
        <span>BingeLog</span>
        <Link href="/datenschutz" className="hover:text-foreground underline underline-offset-4">
          Datenschutz
        </Link>
      </div>
    </footer>
  );
}
