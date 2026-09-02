# BingeLog

Filmtagebuch- und Bewertungsplattform für den deutschsprachigen Raum.
Web (Next.js) + iOS/iPadOS (SwiftUI) + Android ab M9 (Kotlin/Compose),
gemeinsames Supabase-Backend.

## Vor jeder Aufgabe lesen

- `docs/roadmap/00-overview.md` — Stack, Meilensteine, kritischer Pfad
- `docs/roadmap/01-decisions.md` — Architekturentscheidungen (ADR-001 bis 012)
- `docs/roadmap/02-product.md` — Produkthaltung, Zielgruppe, Tonalität

Die ADRs sind getroffen und empirisch abgesichert. Sie werden nicht neu
diskutiert. Läuft eine Umsetzung gegen eine ADR, ist die Umsetzung falsch.

## Die fünf häufigsten Fehler in diesem Projekt

1. **Kein TMDB.** Kommerzielle Lizenz kostet 149 USD/Monat, TheTVDB
   deckt dasselbe kostenlos ab. (ADR-005)
2. **TheTVDB liefert nur Bilder.** Niemals Titel, Alternativtitel oder
   Synopsis. Die Titelfelder dort sind nachweislich unzuverlässig.
   Metadaten kommen ausschließlich aus Wikidata. (ADR-002)
3. **Matching nur über IMDb-ID.** `/search/remoteid/{imdb_id}`. Keine
   Titelsuche, auch nicht als Fallback. Kein Treffer heißt: prozedurale
   Karte. (ADR-003)
4. **Spoiler-Gate nur per RLS in Postgres.** Nie in der UI, nie im
   Client, nie in der API-Schicht. Eine ausgeblendete Komponente ist
   kein Schutz. (ADR-010)
5. **Facetten sind optional, Sterne sind Pflicht.** Eintragen muss zwei
   Taps dauern. Das ist die wichtigste Retention-Kennzahl. (ADR-009)

## Konventionen

- UI-Texte: **Deutsch**, geduzt, knapp, keine Ausrufezeichen. Das ist
  die Sprachregel, an der etwas hängt — sie liest der Nutzer.
- Bezeichner und Kommentare: frei, aber innerhalb einer Datei
  einheitlich. Entschieden am 30.08.2026: die Sprache im Code betrifft
  niemanden außer uns, der Aufwand einer nachträglichen Umbenennung
  dagegen schon.
- Commits: **Englisch**
- Einheiten: **metrisch**
- RLS ab der ersten Migration, keine Tabelle ohne
- Keine Business-Logik in Client-Komponenten
- Sicherheitsregeln werden in der Datenbank durchgesetzt, nicht im Client
- TypeScript strict, `noUncheckedIndexedAccess` aktiv

## Repo-Layout

```
apps/web            Next.js 16
apps/ios            Xcode-Projekt (ab M5)
packages/db         Migrationen, RLS-Tests, generierte Typen
packages/pipeline   Wikidata-Import, TheTVDB-Batch (offline, Standalone)
docs/roadmap        die Roadmap-Dateien
```

Der Service-Role-Key existiert ausschliesslich in `packages/pipeline`.
Der ESLint-Config bricht den Build, wenn er in `apps/web` auftaucht.

## Aktueller Meilenstein

M0 (Fundament) — siehe `docs/roadmap/10-m0-fundament.md`

M0 ist abgeschlossen. Das Supabase-Projekt läuft in Frankfurt
(eu-central-1), alle Migrationen sind eingespielt, die Typen sind aus dem
Schema generiert und eingecheckt.

- `pnpm test` — lokales Postgres, alle Migrationen, Policies. Stand
  30.08.2026: 241 Tests über alle Pakete, davon 108 auf dem Schema
- `pnpm test:rls` — dieselben Zusicherungen über PostgREST
- `pnpm db:verify` — 11 Schemaprüfungen gegen das Projekt
- iOS: siehe `docs/betrieb/ios-projekt.md`

Das Spoiler-Gate ist auf beiden Wegen belegt.

M2 ist ebenfalls durch. Die prozedurale Karte steht, der TheTVDB-Key
liegt vor, und der Artwork-Batch läuft. Die Lizenzprüfung steht in
`docs/legal/thetvdb-lizenz.md` — Kurzfassung: **Bilder werden verlinkt,
nie gespiegelt.**

Der Katalog enthält 155 Filme (Stand 28.08.2026, gewachsen durch die
Lazy Creation aus dem Startbestand von 59) — die meistverlinkten plus die Filme, die
die Such-Testfälle brauchen, samt ihrer Beinahe-Treffer. Der Volldump
(M1 1.1) ist bewusst zurückgestellt; die Messungen dazu stehen in
`docs/roadmap/11-m1-datenpipeline.md`.

M3 ist durch: Auth, Suche, Filmdetail, Bewerten, Tagebuch, Watchlist und
Reviews stehen; die fünf Pflicht-Testfälle der Suche laufen gegen
lokales Postgres, also ohne Projekt.

M4 ist durch. Profil, Kopf- und Profilbild, Folgen, Favoriten (zehn
Plätze) und Binge-Listen stehen. Der Header hat drei Zonen: Ziele in der
Mitte, Suche als Lupe, das eigene Konto rechts hinter einem Klappmenü.
Entdecken ist für Angemeldete die Startseite: Genre-Kacheln als
Schieber, der chronologische Feed der gefolgten Profile, die neuesten
Filme. Diskussion, Melden, Blockieren, Thread sperren und das
Moderations-Dashboard stehen.

Laufend ist M5, die iOS-App unter `apps/ios`. Projektaufbau (5.1) und
Architektur (5.2) stehen: Xcode-Projekt mit synchronisierten Ordnern,
Supabase-SDK über SPM, Konfiguration in `Config/*.xcconfig`,
Repository-Schicht, `@Observable`, typisierte Fehler. Anmelden,
Registrieren, Namenswahl und Filmsuche laufen — geprüft im Simulator und
auf einem echten iPhone.

Die Leiste hat fünf Einträge: Entdecken, Watchlist, Tagebuch, Profil,
Einstellungen. Watchlist und Tagebuch sind gebaut; gefiltert und sortiert wird bei
beiden **im Client**, weil beide Listen klein sind. Das Tagebuch
gruppiert nach Monat und lässt Einträge bearbeiten und löschen.

Eine Rezension kann als Spoiler markiert sein (`diary_entries.
has_spoilers`); die Oberfläche verdeckt sie dann, bis jemand tippt.
**Das ist kein Zugriffsschutz** — der Text kommt über dieselbe Antwort
wie jeder andere. Das Spoiler-Gate der Diskussion ist etwas anderes und
steht in der Policy (ADR-010). Das Profil steht ebenfalls — dieselbe Ansicht für das eigene und ein
fremdes, was sich unterscheidet, ist der Folgen-Knopf und wie viel die
Policy hergibt. **Kein Platzhalter mehr in der Leiste.** Name,
Beschreibung, Profil- und Kopfbild lassen sich ändern, und die
**zehn** Favoritenplätze ebenfalls — von vier erweitert am 31.08.2026,
in App, Web und `favourites.position` gleichzeitig. Dazu die vier Auswertungen (Notenverteilung, Filme pro
Jahr, Jahrzehnte, häufigste Regie), die Watchlist-Vorschau, Blockieren
und Melden.

Der **Letterboxd-Import** liegt unter Einstellungen → Daten und Import.
Der Nutzer lädt seinen eigenen Export hoch — **kein Scraping, keine
Abfrage über einen Benutzernamen**. Analysieren und Importieren sind
zwei Schritte: vor der Bestätigung wird nichts am Konto geändert.

Nach der Namenswahl wird **gefragt**, ob die bisherige Filmhistorie
übernommen werden soll — in App und Web. Die Funktion unten in den
Einstellungen zu verstecken bringt niemandem etwas.

**Der Import treibt sich selbst weiter** — die Edge Function ruft sich
für jede weitere Scheibe selbst auf und weist sich dabei mit dem
Service-Role-Key aus. Client und App stoßen nur einmal an und sehen
danach zu; wer die App verlässt, unterbricht nichts.
Importierte Einträge tragen `diary_entries.import_batch_id` und
**erscheinen nicht im Feed** — historische Daten sind keine
Neuigkeiten.

Binge-Listen gibt es auf dem iPhone vollständig: Übersicht je Profil,
Inhalt in seiner Reihenfolge, anlegen, ändern, löschen, Filme
hinzufügen und entfernen.

**Melden geht jetzt überall** (`ReportSheet`) — auf der Filmseite und
auf fremden Profilen. Ein ausgegrauter Menüpunkt war die vorherige
Fassung und keine gute.

Die Repositories liegen in der Umgebung (`Repositories`). **Nur die
Blätter lesen dort** — `FilmDetailView` und `ProfileView` sind von
überall erreichbar. Alle anderen Ansichten bekommen ihre
Abhängigkeiten weiterhin im Initialisierer, weil dort sichtbar ist,
wovon sie abhängen. **Die Suche ist keiner davon** — sie sitzt als Lupe im
Kopf von Entdecken, wie im Web. Watchlist, Tagebuch und Profil sind
Platzhalter, die sagen, was fehlt und woran es hängt; das Abmelden ist
mit nach Einstellungen gezogen und funktioniert dort.

Entdecken ist auch auf dem iPhone die Startseite: Genre-Schieber,
Top 10 der Woche, chronologischer Feed, Neu im Katalog — dieselbe
Ordnung wie im Web. Filme sind überall antippbar und führen auf die
Filmseite; **Bewerten, Tagebuch und Watchlist stehen dort noch aus**
(5.4). Fehlt ein Film, sucht die Suche **erst nach** und zeigt eine Prüfkarte,
bevor irgendetwas geschrieben wird; bei mehreren Treffern entscheidet
der Nutzer. Die Datenquelle wird in der Oberfläche **nie genannt**. Die
Zeremonie dauert fünfzehn Sekunden wie im Web und endet bei einem Tipp.

Empfehlen geht **nur unter Freunden** — beidseitiges Folgen. Die Regel
steht in der Policy auf `recommendations`, nicht in der Auswahlliste:
eine Oberfläche, die nur Freunde anbietet, ist eine Auswahl und keine
Sperre. Die Notiz ist auf 50 Zeichen begrenzt.

Die prozedurale Karte ist ein SVG. `AsyncImage` kann keins — sie läuft
über `PosterThumbnail`/`PosterImage`, die nach dem Inhaltstyp
entscheiden und das SVG über WebKit anzeigen. Ein neues `AsyncImage`
für ein Plakat ist deshalb fast immer ein Fehler.
Die Genre-Bilder liegen in `Assets.xcassets/Genres` und sind über die
**Wikidata-ID** zugeordnet (`GenreArtwork`), nie über die Beschriftung.

Es gibt **sechzehn feste Kategorien**. Was Wikidata sonst noch an einem
Film führt, wird darauf abgebildet (`genres.category_id`) oder auf
nichts — eine siebzehnte Kategorie entsteht nie von selbst. Die
Rohzuordnung bleibt in `film_genres` stehen; gezeigt und gezählt wird
über die Sicht `film_categories`.

Die Bestätigung per Mail führt in den Browser, nicht zurück in die App:
beim Registrieren entsteht noch keine Sitzung. Ein Deep-Link zurück ist
ein eigener Punkt (5.7).

Anmelden und Registrieren folgen den Entwürfen vom 30.08.2026:
Plakatwand, Schriftzug, Felder mit Symbolen, Passwort aufdecken,
Passwort vergessen, Passwort wiederholen, Zustimmung als Häkchen.

Der Benutzername steht **in** der Registrierung, nicht in einem zweiten
Schritt. Gespeichert wird er erst beim ersten Anmelden: bei
eingeschalteter Mailbestätigung gibt es beim Registrieren noch keine
Sitzung, und `profiles` verlangt eine. Bis dahin liegt er in den
Metadaten des Kontos. Ist er inzwischen vergeben, greift die
Namenswahl — der einzige Fall, in dem sie noch gebraucht wird.

**Datenschutzerklärung und Nutzungsbedingungen sind noch keine Links**,
weil es beide Dokumente nicht gibt (M6). Ohne sie nimmt Apple die App
nicht an.
**Ohne Apple- und Google-Anmeldung** — beide brauchen Konten außerhalb
des Repos, und Apple verlangt „Sign in with Apple", sobald es Google
gibt. Also entweder beide oder keins (`docs/betrieb/ios-projekt.md`).

Vor dem Bauen für iOS:

- `xcodebuild -project apps/ios/BingeLog.xcodeproj -scheme BingeLog \
 -destination 'platform=iOS Simulator,name=iPhone 17' build`
- Die Info.plist liegt unter `Config/`, **nicht** unter `BingeLog/` —
  der Ordner dort ist eine synchronisierte Gruppe, und eine Datei, die
  zugleich kopiert und als Info.plist erzeugt wird, bricht den Build.
- Eigene Info.plist-Schlüssel gehen nicht über `INFOPLIST_KEY_…`.

Die Bilder liegen im Objektspeicher, nicht in der Datenbank. **Beim
Löschen eines Kontos müssen beide Ordner mit** — `avatars` und
`banners`. Die Kaskade räumt die Zeile, den Objektspeicher räumt sie
nicht.

Die Lazy Creation liegt in einer Edge Function (`packages/db/supabase/
functions/lazy-film`), weil `apps/web` den Katalog nicht schreiben darf.
Ihr Wikidata-Code ist eine **erzeugte Kopie** aus `packages/pipeline` —
`pnpm --filter @binge-log/db functions:deploy` synchronisiert sie. Ändere
immer das Original, nie die Kopie unter `_shared`.

Offen: Wiedersehen und „Mail erneut senden" sind gebaut, aber nicht
verdrahtet. Dazu 360 px und Lighthouse. Apple Sign-in braucht einen
Apple-Developer-Account.

Wenn du eine Policy oder einen Trigger anfasst, gehört ein Test in
`packages/db/tests/schema/rls.test.ts` dazu. Eine Policy ohne Test ist
eine Behauptung.
