import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Datenschutzerklärung',
  description: 'Welche Daten BingeLog verarbeitet, wozu, und wie du sie wieder loswirst.',
};

/**
 * Die Datenschutzerklärung (M6).
 *
 * **Das ist die einzige Fassung.** Die App verlinkt hierher, statt eine
 * zweite mitzuliefern — zwei Fassungen laufen auseinander, und bei einem
 * Rechtstext merkt man das erst, wenn jemand fragt.
 *
 * Jede Aussage ist gegen den Code geprüft; die Belege stehen in
 * `docs/legal/datenschutz.md`. Was hier nicht steht, passiert auch
 * nicht: es gibt keine Analyse, kein Tracking und keine Werbung.
 */
export default function DatenschutzPage() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-8 px-5 py-10">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Datenschutzerklärung</h1>
        <p className="text-muted-foreground text-sm">Stand: 3. September 2026</p>
      </div>

      <Abschnitt titel="Kurz vorweg">
        <p>
          BingeLog ist ein Filmtagebuch. Wir verarbeiten, was du einträgst, und sonst nichts. Es
          gibt <strong>keine Werbung, keine Analyse-Dienste und kein Tracking</strong> — weder von
          uns noch von Dritten. Niemand bekommt deine Daten verkauft.
        </p>
      </Abschnitt>

      <Abschnitt titel="Verantwortlich">
        <p>
          {/* Ohne diese Angaben darf die Seite nicht online gehen. Sie
              stehen bewusst als Lücke da, statt erfunden zu werden. */}
          SunFlower Tech
          <br />
          [Rechtsform, Anschrift]
          <br />
          [E-Mail-Adresse]
        </p>
        <p>
          Bei Fragen zum Datenschutz schreib an [E-Mail-Adresse]. Einen Datenschutzbeauftragten
          haben wir nicht — dafür ist der Betrieb zu klein.
        </p>
      </Abschnitt>

      <Abschnitt titel="Was wir verarbeiten, und warum">
        <p>
          Alles hier steht in einer Datenbank in <strong>Frankfurt am Main</strong>. Nichts davon
          verlässt die EU, außer wo es unten ausdrücklich steht.
        </p>

        <Tabelle
          zeilen={[
            [
              'Konto',
              'E-Mail-Adresse, verschlüsseltes Passwort, Benutzername',
              'Damit du dich anmelden kannst und dein Name dir gehört',
              'Vertrag (Art. 6 Abs. 1 lit. b DSGVO)',
            ],
            [
              'Profil',
              'Anzeigename, Beschreibung, Profil- und Kopfbild, Favoriten',
              'Damit andere sehen, wer du bist — soweit du es ausfüllst',
              'Vertrag',
            ],
            [
              'Tagebuch',
              'Film, Bewertung, Rezension, Sehdatum, Sichtbarkeit, Spoilermarke',
              'Das ist der Zweck der App',
              'Vertrag',
            ],
            [
              'Listen',
              'Watchlist, Binge-Listen, Prioritäten, eigene Gruppen',
              'Damit du dir merken kannst, was du sehen willst',
              'Vertrag',
            ],
            [
              'Soziales',
              'Wem du folgst, wen du blockierst, Empfehlungen, Diskussionsbeiträge',
              'Damit die sozialen Funktionen funktionieren',
              'Vertrag',
            ],
            [
              'Geschmackscheck',
              'Deine Ja/Nein/Weiß-nicht-Stimmen zu Plakaten',
              'Nur für die Vorschläge. Das sind keine Bewertungen und stehen in keinem Profil',
              'Vertrag',
            ],
            [
              'Meldungen',
              'Was du meldest, warum, und optional ein Bild',
              'Damit wir Inhalte prüfen können, die gegen die Regeln verstoßen',
              'Rechtliche Pflicht (Art. 6 Abs. 1 lit. c), DSA',
            ],
            [
              'Moderation',
              'Eingriffe an Konten samt Begründung',
              'Damit jeder Eingriff nachvollziehbar bleibt und du davon erfährst',
              'Rechtliche Pflicht, berechtigtes Interesse (lit. f)',
            ],
            [
              'Import',
              'Die Exportdatei, die du selbst hochlädst, und was daraus wurde',
              'Damit deine bisherige Filmhistorie mitkommt',
              'Einwilligung (lit. a) — du stößt ihn selbst an',
            ],
          ]}
        />

        <p>
          <strong>Wir holen deine Daten nirgendwo ab.</strong> Beim Import lädst du deine eigene
          Exportdatei hoch. Es wird kein fremdes Profil ausgelesen und keine Plattform anhand eines
          Benutzernamens abgefragt.
        </p>
      </Abschnitt>

      <Abschnitt titel="Wer sonst noch etwas sieht">
        <p>Wir setzen vier Dienstleister ein, alle mit Auftragsverarbeitungsvertrag:</p>
        <ul className="ml-5 list-disc space-y-2">
          <li>
            <strong>Supabase</strong> — Datenbank, Anmeldung und Dateispeicher. Die Server stehen in
            Frankfurt am Main (AWS eu-central-1). Der Anbieter sitzt in den USA und kann im
            Supportfall zugreifen.
          </li>
          <li>
            <strong>Cloudflare</strong> — Auslieferung der Webseite. Dabei fallen technisch
            notwendige Verbindungsdaten an, darunter deine IP-Adresse.
          </li>
          <li>
            <strong>Brevo</strong> — Versand der Bestätigungs- und Passwortmails. Sitz in
            Frankreich. Bekommt deine Adresse und den Inhalt dieser Mails.
          </li>
          <li>
            <strong>TheTVDB</strong> — die Filmplakate. Wichtig zu wissen:{' '}
            <strong>wir spiegeln die Bilder nicht</strong>, dein Gerät lädt sie direkt dort. Damit
            erfährt TheTVDB deine IP-Adresse und welches Plakat du gerade siehst. Wo es kein Plakat
            gibt, zeichnen wir eine Karte selbst — die kommt von uns.
          </li>
        </ul>
        <p>
          Filmdaten kommen von <strong>Wikidata</strong>. Diese Abfragen laufen auf unserem Server;
          es geht nichts über dich dorthin.
        </p>
      </Abschnitt>

      <Abschnitt titel="Cookies und was im Browser liegt">
        <p>
          <strong>Wir setzen keine Cookies zur Analyse oder Werbung</strong>, deshalb gibt es auch
          kein Zustimmungsbanner. Es gibt genau zwei Dinge:
        </p>
        <ul className="ml-5 list-disc space-y-2">
          <li>
            <strong>Sitzungs-Cookies.</strong> Sie halten dich angemeldet. Ohne sie funktioniert die
            Anmeldung nicht. Beim Abmelden sind sie weg.
          </li>
          <li>
            <strong>Dein Suchverlauf.</strong> Der liegt ausschließlich in deinem Browser
            beziehungsweise auf deinem Gerät, nicht bei uns. Du kannst ihn in der Suche selbst
            leeren.
          </li>
        </ul>
        <p>
          Meldest du etwas, <strong>ohne</strong> angemeldet zu sein, prüft Cloudflare Turnstile,
          dass du kein Automat bist. Angemeldet passiert das nicht — dann hängt die Meldung an einem
          Konto.
        </p>
      </Abschnitt>

      <Abschnitt titel="Wie lange">
        <ul className="ml-5 list-disc space-y-2">
          <li>
            <strong>Konto und Inhalte</strong> bleiben, bis du sie löschst oder das Konto schließt.
            Einzelne Einträge kannst du jederzeit selbst entfernen.
          </li>
          <li>
            <strong>Meldungen und Moderationsentscheidungen</strong> bleiben auch dann stehen, wenn
            der gemeldete Inhalt verschwindet. Sonst gäbe es keine Spur mehr, und der DSA verlangt
            eine.
          </li>
          <li>
            <strong>Importdateien</strong> werden nach der Verarbeitung nicht mehr gebraucht und
            können auf Zuruf sofort gelöscht werden.
          </li>
        </ul>
      </Abschnitt>

      <Abschnitt titel="Deine Rechte">
        <p>
          Du hast das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung, Datenübertragung
          und Widerspruch (Art. 15 bis 21 DSGVO).
        </p>
        <p>
          <strong>Konto löschen:</strong> In den{' '}
          <Link href="/einstellungen" className="text-foreground underline underline-offset-4">
            Einstellungen
          </Link>{' '}
          unter „Konto", in der App ebenso. Das lässt sich nicht rückgängig machen.
        </p>
        <p>
          <strong>Weg sind dann:</strong> dein Name, dein Anzeigename, deine Beschreibung, Profil-
          und Kopfbild, Watchlist, Binge-Listen, Favoriten, wem du folgst und wer dir folgt,
          Blockaden, Empfehlungen, deine Stimmen aus dem Geschmackscheck und hochgeladene
          Importdateien. Anmelden kannst du dich danach nicht mehr.
        </p>
        <p>
          <strong>Bestehen bleiben deine Bewertungen, Rezensionen und Diskussionsbeiträge</strong> —
          aber ohne dich. Statt deines Namens steht dort „Konto gelöscht", und es führt kein Link
          mehr auf ein Profil. Der Grund: eine Bewertung ist eine Aussage über einen Film, und der
          Film steht weiter da. Ein Gespräch, aus dem eine Seite spurlos verschwindet, ist keins
          mehr, und ein Filmdurchschnitt, der bei jeder Kontolöschung springt, sagt nichts mehr aus.
        </p>
        <p>
          Willst du <strong>einzelne</strong> Einträge oder Beiträge nicht stehen lassen, lösch sie
          vor dem Konto — dann sind sie weg. Oder schreib an [E-Mail-Adresse], und wir entfernen
          sie.
        </p>
        <p>
          Bestehen bleiben außerdem <strong>Meldungen und Moderationsentscheidungen</strong>, beide
          ohne deinen Namen daran. Der DSA verlangt, dass diese Spur nachvollziehbar bleibt — eine
          Meldung, die mit dem gemeldeten Konto verschwindet, wäre keine.
        </p>
        <p>
          Bist du der Meinung, dass wir etwas falsch machen, kannst du dich bei einer
          Datenschutz-Aufsichtsbehörde beschweren — zuständig ist die deines Bundeslandes.
        </p>
      </Abschnitt>

      <Abschnitt titel="Änderungen">
        <p>
          Wenn sich am Produkt etwas ändert, ändert sich dieser Text mit. Das Datum oben sagt, wann
          zuletzt.
        </p>
      </Abschnitt>

      <p className="text-muted-foreground text-sm">
        <Link href="/" className="underline underline-offset-4">
          Zurück
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

/** Vier Spalten: Bereich, Daten, Zweck, Rechtsgrundlage. */
function Tabelle({ zeilen }: { zeilen: [string, string, string, string][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[34rem] border-collapse text-left text-xs">
        <thead>
          <tr className="border-border border-b">
            <th className="text-foreground py-2 pr-3 font-medium">Bereich</th>
            <th className="text-foreground py-2 pr-3 font-medium">Daten</th>
            <th className="text-foreground py-2 pr-3 font-medium">Wozu</th>
            <th className="text-foreground py-2 font-medium">Grundlage</th>
          </tr>
        </thead>
        <tbody>
          {zeilen.map((zeile) => (
            <tr key={zeile[0]} className="border-border/60 border-b align-top">
              <td className="text-foreground py-2 pr-3 font-medium">{zeile[0]}</td>
              <td className="py-2 pr-3">{zeile[1]}</td>
              <td className="py-2 pr-3">{zeile[2]}</td>
              <td className="py-2">{zeile[3]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
