import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Nutzungsbedingungen',
  description: 'Die Regeln für BingeLog: Konto, eigene Inhalte, Moderation, Haftung.',
};

/**
 * Die Nutzungsbedingungen (M6).
 *
 * Wie die Datenschutzerklärung: geschrieben nach dem, was das Produkt
 * tut, nicht nach einer Vorlage. Die Belege stehen in
 * `docs/legal/nutzungsbedingungen.md`.
 *
 * **Ein Abschnitt trägt schwerer als die anderen:** § 5 gibt der
 * Entscheidung eine vertragliche Grundlage, dass Bewertungen und
 * Rezensionen die Kontolöschung überleben. Ohne ihn wäre die
 * entsprechende Zusage in der Datenschutzerklärung eine Behauptung ohne
 * Boden.
 */
export default function NutzungsbedingungenPage() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-8 px-5 py-10">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Nutzungsbedingungen</h1>
        <p className="text-muted-foreground text-sm">Stand: 3. September 2026</p>
      </div>

      <Abschnitt nummer="1" titel="Worum es geht">
        <p>
          BingeLog ist ein Filmtagebuch: du trägst ein, was du gesehen hast, bewertest es, schreibst
          dazu und redest mit anderen darüber. Anbieter ist Kevin Moutin, handelnd unter SunFlower
          Tech, Konrad-Adenauer-Str. 21, 42651 Solingen — die vollständigen Angaben stehen im{' '}
          <Link href="/impressum" className="text-foreground underline underline-offset-4">
            Impressum
          </Link>
          .
        </p>
        <p>
          <strong>BingeLog zeigt keine Filme.</strong> Es gibt hier nichts zu streamen und nichts
          herunterzuladen. Was du findest, sind Angaben über Filme und das, was Leute darüber
          schreiben.
        </p>
        <p>Die Nutzung ist kostenlos. Es gibt keine Werbung und keinen Weiterverkauf von Daten.</p>
      </Abschnitt>

      <Abschnitt nummer="2" titel="Dein Konto">
        <p>
          Für ein Konto brauchst du eine E-Mail-Adresse, die dir gehört, und musst sie bestätigen.
          Ein Konto gehört einer Person; gib die Zugangsdaten nicht weiter.
        </p>
        <p>
          <strong>Mindestalter 16 Jahre.</strong> Jünger geht nicht, weil die Verarbeitung deiner
          Daten in Deutschland ab 16 ohne Zustimmung der Eltern zulässig ist (Art. 8 DSGVO).
        </p>
        <p>
          Der Benutzername ist öffentlich. Namen, die andere täuschen oder eine fremde Person
          vorspiegeln, dürfen wir ändern — du erfährst dann, warum.
        </p>
      </Abschnitt>

      <Abschnitt nummer="3" titel="Was du einträgst">
        <p>
          Bewertungen, Rezensionen, Listen und Diskussionsbeiträge kommen von dir. Du entscheidest
          bei jedem Tagebucheintrag, wer ihn sehen darf: öffentlich, nur Freunde, oder nur du.
        </p>
        <p>
          Du bleibst der Urheber. Was du schreibst, gehört dir, und du darfst es überall sonst
          ebenfalls verwenden.
        </p>
      </Abschnitt>

      <Abschnitt nummer="4" titel="Was du nicht einträgst">
        <p>Nicht in Ordnung sind insbesondere:</p>
        <ul className="ml-5 list-disc space-y-1.5">
          <li>rechtswidrige Inhalte, Beleidigungen, Bedrohungen, Hetze</li>
          <li>Inhalte, an denen du keine Rechte hast</li>
          <li>fremde persönliche Daten ohne Einwilligung</li>
          <li>Werbung, Spam und automatisiert erzeugte Beiträge</li>
          <li>Versuche, die Bewertungen oder die Wochenliste zu manipulieren</li>
        </ul>
        <p>
          <strong>Spoiler sind erlaubt</strong> — markier sie beim Schreiben. Die Marke verdeckt den
          Text, bis jemand tippt. Sie ist eine Bitte an andere Leser, kein technischer Schutz: wer
          die Seite ansieht, hat den Text bereits geladen.
        </p>
      </Abschnitt>

      <Abschnitt nummer="5" titel="Wenn du dein Konto löschst">
        <p>
          Du kannst dein Konto jederzeit in den Einstellungen löschen. Damit sind weg: dein Name,
          deine Bilder, deine Beschreibung, Watchlist, Listen, Favoriten, wem du folgst, Blockaden,
          Empfehlungen und hochgeladene Dateien.
        </p>
        <p>
          <strong>
            Deine Bewertungen, Rezensionen und Diskussionsbeiträge bleiben stehen — ohne deinen
            Namen.
          </strong>{' '}
          Statt seiner steht dort „Konto gelöscht". Dafür räumst du uns mit dem Eintragen ein
          einfaches, unentgeltliches und zeitlich unbefristetes Recht ein, diese Beiträge in
          BingeLog anzuzeigen; dieses Recht überdauert dein Konto.
        </p>
        <p>
          Der Grund steht offen da: eine Bewertung ist eine Aussage über einen Film, und der Film
          bleibt. Ein Durchschnitt, der bei jeder Kontolöschung springt, sagt nichts mehr aus, und
          ein Gespräch, aus dem eine Seite spurlos verschwindet, ist keins mehr.
        </p>
        <p>
          <strong>Willst du das nicht</strong>, lösch die betreffenden Einträge und Beiträge vor dem
          Konto — dann sind sie weg. Oder schreib an{' '}
          <a
            href="mailto:datenschutz@bingelog.eu"
            className="text-foreground underline underline-offset-4"
          >
            datenschutz@bingelog.eu
          </a>
          , und wir entfernen sie. Deine Rechte aus der DSGVO bleiben davon unberührt; was das
          bedeutet, steht in der{' '}
          <Link href="/datenschutz" className="text-foreground underline underline-offset-4">
            Datenschutzerklärung
          </Link>
          .
        </p>
      </Abschnitt>

      <Abschnitt nummer="6" titel="Melden und Moderation">
        <p>
          Auf jeder Filmseite, an jedem Beitrag und auf jedem Profil steht ein Weg zum Melden. Auch
          ohne Konto — du bekommst dann eine Empfangsbestätigung an die Adresse, die du angibst.
        </p>
        <p>
          Wir prüfen Meldungen und können Inhalte entfernen, Diskussionen schließen oder Konten
          sperren. <strong>Jede Entscheidung wird begründet</strong>, und du bekommst die Begründung
          — das verlangt Art. 17 des Digital Services Act, und es ist ohnehin das Mindeste.
        </p>
        <p>
          Hältst du eine Entscheidung für falsch, antworte auf diese Nachricht oder schreib an die
          Adresse oben. Wir sehen sie uns noch einmal an.
        </p>
      </Abschnitt>

      <Abschnitt nummer="7" titel="Verfügbarkeit">
        <p>
          BingeLog ist ein kostenloser Dienst eines Einzelunternehmens. Eine bestimmte Verfügbarkeit
          können wir nicht zusagen; es kann Wartungsfenster und Ausfälle geben.
        </p>
        <p>
          Wir dürfen Funktionen ändern oder einstellen. Fällt etwas Wesentliches weg oder stellen
          wir den Dienst ganz ein, sagen wir das mit angemessenem Vorlauf und geben dir Gelegenheit,
          deine Daten mitzunehmen.
        </p>
      </Abschnitt>

      <Abschnitt nummer="8" titel="Haftung">
        <p>
          Für Vorsatz und grobe Fahrlässigkeit haften wir unbeschränkt, ebenso bei Verletzung von
          Leben, Körper oder Gesundheit und nach dem Produkthaftungsgesetz.
        </p>
        <p>
          Bei einfacher Fahrlässigkeit haften wir nur, wenn eine Pflicht verletzt wird, auf deren
          Erfüllung du vertrauen darfst und die den Vertrag überhaupt erst möglich macht, und dann
          begrenzt auf den vorhersehbaren, vertragstypischen Schaden.
        </p>
        <p>
          <strong>Für die Inhalte anderer Nutzer haften wir nicht</strong>, solange wir von einer
          Rechtsverletzung nichts wissen. Werden wir darauf hingewiesen, handeln wir zügig (§§ 7 bis
          10 TMG, Art. 6 DSA).
        </p>
        <p>
          Filmdaten stammen aus Wikidata und werden von uns nicht auf Richtigkeit geprüft. Plakate
          kommen von TheTVDB und werden von dort verlinkt.
        </p>
      </Abschnitt>

      <Abschnitt nummer="9" titel="Ende">
        <p>
          Du kannst jederzeit gehen — Konto löschen genügt, eine Frist gibt es nicht. Wir können den
          Vertrag mit einer Frist von 14 Tagen kündigen; bei schweren oder wiederholten Verstößen
          auch sofort.
        </p>
      </Abschnitt>

      <Abschnitt nummer="10" titel="Änderungen">
        <p>
          Ändern wir diese Bedingungen, sagen wir es dir mindestens 30 Tage vorher per E-Mail.
          Widersprichst du nicht bis zum Stichtag, gelten die neuen Bedingungen; widersprichst du,
          endet der Vertrag zu diesem Zeitpunkt und dein Konto wird gelöscht. Darauf weisen wir in
          der Nachricht ausdrücklich hin.
        </p>
      </Abschnitt>

      <Abschnitt nummer="11" titel="Recht und Gerichtsstand">
        <p>
          Es gilt deutsches Recht. Bist du Verbraucher, bleiben die zwingenden
          Verbraucherschutzvorschriften deines Wohnsitzstaates unberührt, und du kannst uns an
          deinem Wohnsitz verklagen.
        </p>
        <p>
          Wir nehmen nicht an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle
          teil.
        </p>
      </Abschnitt>

      <p className="text-muted-foreground text-sm">
        <Link href="/datenschutz" className="underline underline-offset-4">
          Datenschutzerklärung
        </Link>{' '}
        ·{' '}
        <Link href="/impressum" className="underline underline-offset-4">
          Impressum
        </Link>
      </p>
    </main>
  );
}

function Abschnitt({
  nummer,
  titel,
  children,
}: {
  nummer: string;
  titel: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-base font-semibold tracking-tight">
        <span className="text-muted-foreground">§ {nummer}</span> {titel}
      </h2>
      <div className="text-muted-foreground flex flex-col gap-3 text-sm leading-relaxed">
        {children}
      </div>
    </section>
  );
}
