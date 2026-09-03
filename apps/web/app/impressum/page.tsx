import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Impressum',
  description: 'Anbieterkennzeichnung nach § 5 DDG.',
};

/**
 * Das Impressum (§ 5 DDG, M6).
 *
 * **Einzelunternehmen: verantwortlich ist die natürliche Person.**
 * „SunFlower Tech" ist eine Geschäftsbezeichnung, keine Firma im Sinne
 * des HGB — es gibt kein Registergericht und keine Registernummer, und
 * beides steht deshalb nicht hier. Eine Zeile „HRB —" wäre eine Angabe,
 * die es nicht gibt.
 *
 * Ebenso fehlt die Umsatzsteuer-Identifikationsnummer: als
 * Kleinunternehmer nach § 19 UStG gibt es keine. Auch das ist kein
 * Versehen.
 */
export default function ImpressumPage() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-8 px-5 py-10">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Impressum</h1>
        <p className="text-muted-foreground text-sm">Angaben nach § 5 DDG</p>
      </div>

      <Abschnitt titel="Anbieter">
        <p>
          Kevin Moutin, handelnd unter <strong>SunFlower Tech</strong>
          <br />
          Konrad-Adenauer-Str. 21
          <br />
          42651 Solingen
          <br />
          Deutschland
        </p>
      </Abschnitt>

      <Abschnitt titel="Kontakt">
        <p>
          <a
            href="mailto:datenschutz@bingelog.eu"
            className="text-foreground underline underline-offset-4"
          >
            datenschutz@bingelog.eu
          </a>
        </p>
      </Abschnitt>

      <Abschnitt titel="Umsatzsteuer">
        <p>
          Kleinunternehmer nach § 19 UStG. Es wird keine Umsatzsteuer ausgewiesen, und es besteht
          keine Umsatzsteuer-Identifikationsnummer.
        </p>
      </Abschnitt>

      <Abschnitt titel="Verantwortlich für den Inhalt">
        <p>Kevin Moutin, Anschrift wie oben.</p>
      </Abschnitt>

      <Abschnitt titel="Meldungen und Beschwerden">
        <p>
          Rechtswidrige Inhalte lassen sich direkt in BingeLog melden — auf der Filmseite, an einem
          Beitrag und auf jedem Profil. Ohne Konto geht das ebenfalls; du bekommst dann eine
          Empfangsbestätigung an die Adresse, die du angibst.
        </p>
        <p>
          Zusätzlich erreichst du uns unter der Adresse oben. Das ist zugleich die Kontaktstelle
          nach Art. 11 und 12 der Verordnung über digitale Dienste (DSA). Die Verfahrenssprache ist
          Deutsch.
        </p>
      </Abschnitt>

      <Abschnitt titel="Streitbeilegung">
        <p>
          Wir sind nicht bereit und nicht verpflichtet, an Streitbeilegungsverfahren vor einer
          Verbraucherschlichtungsstelle teilzunehmen.
        </p>
      </Abschnitt>

      <Abschnitt titel="Bilder und Daten">
        <p>
          Filmdaten stammen aus Wikidata und stehen unter{' '}
          <a
            href="https://creativecommons.org/publicdomain/zero/1.0/"
            rel="noreferrer"
            target="_blank"
            className="text-foreground underline underline-offset-4"
          >
            CC0
          </a>
          . Filmplakate stammen von{' '}
          <a
            href="https://www.thetvdb.com/"
            rel="noreferrer"
            target="_blank"
            className="text-foreground underline underline-offset-4"
          >
            TheTVDB
          </a>{' '}
          und werden von dort verlinkt, nicht gespiegelt. Wo es kein Plakat gibt, zeichnet BingeLog
          eine Karte selbst.
        </p>
      </Abschnitt>

      <p className="text-muted-foreground text-sm">
        <Link href="/datenschutz" className="underline underline-offset-4">
          Datenschutzerklärung
        </Link>
      </p>
    </main>
  );
}

function Abschnitt({ titel, children }: { titel: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-base font-semibold tracking-tight">{titel}</h2>
      <div className="text-muted-foreground flex flex-col gap-3 text-sm leading-relaxed">
        {children}
      </div>
    </section>
  );
}
