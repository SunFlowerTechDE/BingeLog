# Was das Web nachziehen muss

Beim Bauen der iOS-App (M5) sind Funktionen und Gestaltung entstanden,
die es im Web noch nicht gibt. Diese Liste haelt fest, was fehlt, damit
beide Plattformen dasselbe koennen und gleich aussehen.

**Stand: 31.08.2026.** Alles hier ist offen, nichts davon ist begonnen.

Die Reihenfolge ist die empfohlene: erst was ohne Datenbank auskommt,
dann was auf einer Funktion sitzt, die schon steht.

---

## 1. Die Genre-Bilder

Sechzehn freigestellte Symbole in Gold, 300 × 300 px mit
Alphakanal. Sie liegen unter
`apps/ios/BingeLog/Assets.xcassets/Genres/*.imageset/*.png` und muessen
ins Web uebernommen werden — dieselben Dateien, damit die Kachel im
Browser und auf dem iPhone dasselbe Bild zeigt.

**Zugeordnet wird ueber die Wikidata-ID, nie ueber die Beschriftung.**
Die Tabelle steht in `apps/ios/BingeLog/Features/Discover/GenreTile.swift`
(`GenreArtwork`). Wie noetig das ist, hat sich beim Einpflegen gezeigt:
eine Datei war als `Dramady` benannt, das Genre heisst `Dramedy`. Ueber
die Beschriftung haette diese Kachel kein Bild gehabt. Der Name ist
berichtigt, der Grund gilt weiter — die Dateinamen sind eine Bequemlichkeit
fuer uns, die Zuordnung haengt nicht an ihnen.

Der Katalog kennt vierzig Genres, Bilder gibt es fuer sechzehn. Die
uebrigen brauchen eine Kachel ohne Bild, so wie auf dem iPhone.

## 2. Die kurzen Genre-Namen

Auf dem iPhone steht auf der Kachel `Horror`, im Browser noch
`Horrorfilm`. Die Tabelle steht in derselben Datei (`GenreLabel`) und
muss gespiegelt werden, sonst heisst dasselbe Genre auf zwei Geraeten
verschieden.

| Katalog              | Kachel          |
| -------------------- | --------------- |
| Filmdrama            | Drama           |
| Filmkomödie          | Komödie         |
| Fantasyfilm          | Fantasy         |
| Abenteuerfilm        | Abenteuer       |
| Actionfilm           | Action          |
| Kriminalfilm         | Krimi           |
| Science-Fiction-Film | Science-Fiction |
| Musikfilm            | Musik           |
| Coming-of-Age-Film   | Coming of Age   |
| Horrorfilm           | Horror          |
| Mysteryfilm          | Mystery         |
| Dokumentarfilm       | Doku            |
| Liebesfilm           | Romantik        |
| Monumentalfilm       | Epos            |

Thriller und Dramedy waren schon kurz. **Romantik und Epos sind keine
Kuerzung, sondern ein anderes Wort** — „Liebe" und „Monumental" stehen
allein nicht als Genre da.

Es waere ueberlegenswert, diese Tabelle nicht zweimal zu pflegen,
sondern in ein gemeinsames Paket zu legen. Dagegen spricht, dass es
zwischen Swift und TypeScript kein gemeinsames Paket gibt und ein
Generator fuer sechzehn Zeilen mehr Aufwand ist als der Abgleich. Bei
der naechsten Liste dieser Art neu bewerten.

## 3. Die Kachel selbst

Im Browser ist die Genre-Kachel eine Textkarte mit Beschriftung und
Anzahl (`apps/web/src/components/discover.tsx`). Auf dem iPhone ist es
eine Kachel mit Symbol darueber, fester Groesse und goldenem Rand bei
Hervorhebung.

Zwei Dinge, die dabei nicht vergessen werden duerfen, weil sie auf dem
iPhone erst nachtraeglich aufgefallen sind:

- **Alle Kacheln gleich hoch.** Eine Beschriftung, die auf zwei Zeilen
  umbricht, machte ihre Kachel hoeher als die Nachbarn, und der
  Schieber wurde zur Zickzacklinie. Die Beschriftung muss beide Zeilen
  belegen, ob sie sie braucht oder nicht.
- **Die Bilder brauchen den dunklen Grund unter sich**, keinen eigenen
  Rahmen. Sie sind freigestellt.

## 4. Top 10 in dieser Woche

Gibt es im Web ueberhaupt nicht. Auf dem iPhone steht die Sektion an
**zweiter Stelle**, zwischen den Genres und dem Feed.

Die Datenbankfunktion steht und ist eingespielt:
`public.weekly_top_films(max_results integer default 10)`, ausfuehrbar
fuer `anon` und `authenticated`. Sie liefert `place`, die Filmspalten,
`ratings` und `average`.

Was das Web davon wissen muss:

- **Der Zeitraum ist die laufende Kalenderwoche**, Montag 00:00 bis
  Sonntag 23:59 in `Europe/Berlin`. Er wird in der Funktion gezogen.
  Kein Client zieht ihn selbst — sonst zoege er ihn in seiner eigenen
  Zeitzone.
- **Gezaehlt werden nur oeffentliche Bewertungen.** Damit ist die Liste
  fuer jeden Leser dieselbe.
- **`average` steht auf der internen Skala 1 bis 10** und wird fuer die
  Sterne **genau einmal** halbiert. Zweimal halbieren war im Web schon
  einmal der Fehler (Migration `…320000_rating_spread_uses_the_real_scale`).
- **`numeric` kommt als Zeichenkette an**, nicht als Zahl. Die
  erzeugten Typen behaupten `number` — das ist eine Schwaeche der
  Typerzeugung, nicht der Funktion.

Zur Gestaltung: jede Karte hat eine Box um das Plakat, die die
Platzierung hervorhebt — Gold fuer die ersten drei, sonst der
gewoehnliche Rand. Nicht alle zehn in Gold: wenn jede Karte
hervorgehoben ist, ist keine hervorgehoben. Darunter die Platzierung
gross gesetzt, daneben Durchschnitt und Anzahl als schnelle Info.

Vorbild: `apps/ios/BingeLog/Features/Discover/DiscoverView.swift`,
`WeeklyTopSection` und `RankedCard`.

## 5. Das Jahr in der Suche

Die Funktion kann es schon, die Oberflaeche fragt nur nicht danach.

`public.search_films(query text, max_results integer default 20,
in_year integer default null)` ist eingespielt. Der bisherige Aufruf des
Webs mit `query` und `max_results` trifft sie weiterhin — das ist durch
`packages/db/tests/discovery-rest.test.ts` abgedeckt.

Was noch fehlt, ist das Feld. Auf dem iPhone steht es **ueber der
Trefferliste, nicht in der Suchleiste**: die gehoert dem Titel, und eine
Leiste mit zwei Feldern ist eine Leiste, in der man das falsche trifft.

Zwei Regeln aus der iOS-Umsetzung, die im Web genauso gelten:

- **Vier Ziffern oder nichts.** Bei dreien wuerde beim Tippen von
  „1999" kurz nach dem Jahr 199 gesucht und die Liste geleert — das
  sieht aus, als gaebe es den Film nicht. Solange das Jahr angefangen
  ist, steht ein Hinweis darunter.
- **Das Jahr filtert, es gewichtet nicht.** Findet die Suche mit Jahr
  nichts, sagt sie das ausdruecklich: „Nichts gefunden. Ohne das Jahr
  gibt es vielleicht Treffer."

## 6. Das Jahr beim Anlegen

Die Edge Function `lazy-film` nimmt jetzt ein optionales `year` und legt
dann nur den Film aus diesem Jahr an. Eine Titelsuche bei Wikidata
antwortet mit bis zu fuenf Filmen, und bei „Solaris" sind das
verschiedene — ohne Jahr wandern alle fuenf in den Katalog, den alle
anderen mitlesen.

`fetchMissingFilm(term, year?)` reicht es schon durch, und der Grund
`wrong_year` ist bereits uebersetzt. **Was fehlt, ist der Aufruf mit
dem Jahr** — er kommt zusammen mit dem Feld aus Punkt 5.

## 7. Die Filmseite

Der Entwurf vom 31.08.2026 ist auf dem iPhone umgesetzt und weicht vom
Web ab: Plakat ueber die ganze Breite und nach unten ins Dunkle
auslaufend, Titel darauf, darunter die beiden Zahlen nebeneinander, dann
Besetzung mit „Mehr anzeigen (n)", Rezension, Datum, Sichtbarkeit,
Knopf. Im Web steht das Plakat links in einer eigenen Schiene.

Ob das Web nachziehen soll, ist eine offene Frage und keine Aufgabe: am
Schreibtisch ist eine zweispaltige Seite nicht dasselbe wie auf einem
Telefon. **Die Popcorn-Skala, die FSK-Farben und die drei
Sichtbarkeiten sind auf beiden gleich** — das ist der Teil, der gleich
bleiben muss.

## 8. Entdecken nach dem Konzept

Das Entdecken-Konzept vom 31.08.2026 ist auf dem iPhone in seiner ersten
Stufe umgesetzt. Das Web hat davon noch nichts:

- **Die Reihenfolge** (Konzept 18, Fall „kaum Nutzerdaten"): Nach Genre,
  Top 10, Fuer dich, Neu veroeffentlicht, Bald verfuegbar, Letzte
  Aktivitaeten.
- **Der gewichtete Score** in `weekly_top_films` — die Funktion gibt jetzt
  zusaetzlich `score` zurueck, und die Schwelle steht in
  `app_settings.weekly_top_minimum`. Der bisherige Aufruf laeuft
  unveraendert weiter.
- **`films_for_me`** fuer „Fuer dich". Nur fuer Angemeldete; PUBLIC ist
  das Ausfuehren entzogen.
- **„Neu im Katalog" heisst „Neu veroeffentlicht"** und schliesst Filme
  aus, deren Jahr noch aussteht — die stehen unter „Bald verfuegbar".
- **Leere Bereiche werden ausgeblendet**, nicht mit erklaerendem Text
  gefuellt. Der Hinweis „folge jemandem" stand dauerhaft auf der
  Startseite.

Zwei Punkte des Konzepts sind **bewusst offen**, weil die Daten fehlen:
„Neu in Deutschland" und der Countdown „noch 12 Tage" brauchen ein
deutsches Erscheinungsdatum. Der Katalog fuehrt nur `release_year`.
Wikidata hat P577 mit Landesqualifikator — das waere eine Erweiterung der
Pipeline, keine der Oberflaeche.

- **„Von Freunden empfohlen"** samt Knopf auf der Filmseite. Die
  Tabelle `recommendations` und die drei Funktionen stehen und sind
  eingespielt; im Web fehlt beides — der Knopf und die Sektion.
  Empfohlen wird nur unter Freunden, und das steht in der Policy, nicht
  in der Auswahlliste.

Ebenfalls offen: „Weil dir dieser
Film gefallen hat", „Heute passend", „Ueberrasch mich" und die
intelligente Watchlist-Auswahl. Das Konzept ordnet sie selbst unter
„Danach" ein.

## 9. Das Logo

Die Bildmarke liegt als Asset in der App
(`apps/ios/BingeLog/Assets.xcassets/LogoMark.imageset`). Im Web wird der
Schriftzug bisher gesetzt, nicht gezeigt. Die Marke gehoert in den
Header und auf den Anmeldebildschirm.

Der Schriftzug selbst ist bislang **nirgends** eine Bilddatei — auch in
der App wird er von SwiftUI gesetzt. Wenn es ihn als Datei geben soll,
gilt das fuer beide Plattformen.

---

## Was ausdruecklich **nicht** ins Web gehoert

- **Der Startbildschirm** (`SplashView`). Eine Webseite hat keinen
  Kaltstart, und drei Sekunden Vorstellung vor einer Seite waeren drei
  Sekunden zu viel.
- **Der Plakat-Cache auf der Platte** (`SplashPosterCache`). Der Browser
  hat seinen eigenen.
