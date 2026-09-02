# Was das Web nachziehen muss

Beim Bauen der iOS-App (M5) sind Funktionen und Gestaltung entstanden,
die es im Web noch nicht gibt. Diese Liste haelt fest, was fehlt, damit
beide Plattformen dasselbe koennen und gleich aussehen.

**Stand: 02.09.2026 — abgearbeitet.** Die Punkte 1 bis 6 und 8 bis 13
sind umgesetzt und auf der Testumgebung ausgeliefert. Punkt 7 bleibt
offen, weil er als Frage und nicht als Aufgabe hier steht.

Was jeweils gebaut wurde, steht unter dem Punkt. Was **weiterhin
offen** ist, steht am Ende der Datei — dort ist es kurz.

Die Reihenfolge war die empfohlene: erst was ohne Datenbank auskommt,
dann was auf einer Funktion sitzt, die schon steht.

---

## 1. Die Genre-Bilder

**Erledigt.** Die sechzehn Dateien liegen unter `apps/web/public/genres/`
und tragen **die Wikidata-ID als Dateinamen** (`Q200092.png`). Damit
gibt es die Fehlerquelle nicht mehr, vor der dieser Punkt warnt: es gibt
keinen Namen, der falsch geschrieben sein koennte. Die Zuordnung steht in
`apps/web/src/lib/genres.ts`, ein Test prueft, dass zu jeder ID eine
Datei existiert und umgekehrt.

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

**Erledigt.** `genreLabel()` in `apps/web/src/lib/genres.ts`. Ein Test
vergleicht die **ganze Tabelle** gegen die der App — weicht eine Seite
ab, faellt es auf, statt dass dasselbe Genre auf zwei Geraeten
verschieden heisst.

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

**Erledigt.** `apps/web/src/components/genre-tile.tsx`. Beide Fallen aus
diesem Punkt sind von Anfang an beruecksichtigt: die Beschriftung belegt
zwei Zeilen, ob sie sie braucht oder nicht, und das Bild hat einen festen
Platz, ob es eins gibt oder nicht.

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

**Erledigt.** `apps/web/src/components/weekly-top.tsx`, an zweiter
Stelle auf Entdecken. Gold nur fuer die ersten drei.

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

**Erledigt.** Das Feld steht neben dem Titel auf `/`, der Wert in der
Adresse als `?j=`. Vier Ziffern oder nichts; darunter ein Hinweis. Findet
die Suche mit Jahr nichts, steht "Ohne Jahr suchen" da.

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

**Erledigt.** Das Jahr geht durch `previewMissingFilm(term, year)` an die
Edge Function.

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

**Erledigt** bis auf die beiden Punkte, die Daten brauchen. Die
Reihenfolge steht, "Neu im Katalog" heisst "Neu veroeffentlicht" und hat
"Bald verfuegbar" neben sich, leere Bereiche verschwinden, `films_for_me`
traegt "Fuer dich", und "Von Freunden empfohlen" gibt es als Sektion und
als Knopf auf der Filmseite (`recommend-button.tsx`,
`lib/recommend-actions.ts`).

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

**„Neu in Deutschland" faellt weg.** Verworfen am 03.09.2026 — der
Bereich wird nicht gebraucht. Das spart nicht nur die Sektion, sondern
auch die Begruendung, die er dem deutschen Erscheinungsdatum gab.

Der Countdown „noch 12 Tage" bleibt offen und braucht es weiterhin: der
Katalog fuehrt nur `release_year`, und daraus laesst sich „bald" grob
sagen, aber nicht „am 14.". Wikidata hat P577 mit Landesqualifikator —
das waere eine Erweiterung der Pipeline, keine der Oberflaeche.

- **„Von Freunden empfohlen"** samt Knopf auf der Filmseite. Die
  Tabelle `recommendations` und die drei Funktionen stehen und sind
  eingespielt; im Web fehlt beides — der Knopf und die Sektion.
  Empfohlen wird nur unter Freunden, und das steht in der Policy, nicht
  in der Auswahlliste.

Ebenfalls offen: „Weil dir dieser
Film gefallen hat", „Heute passend", „Ueberrasch mich" und die
intelligente Watchlist-Auswahl. Das Konzept ordnet sie selbst unter
„Danach" ein.

## 9. Die Watchlist

**Erledigt, und ueber diesen Punkt hinaus.** `watchlist-page.tsx` mit
Raster, Suche, elf Sortierungen, Genre-, Laufzeit-, Prioritaets- und
Gruppenfilter, sozialem Hinweis, "Ueberrasch mich", Entfernen und
"gesehen" mit sofortiger Bewertung. Die Regeln stehen pruefbar in
`lib/watchlist.ts`. Prioritaeten, Gruppen und der Match-Wert sind nach
dem Schreiben dieser Datei dazugekommen und gleich mit umgesetzt.

Das Watchlist-Konzept vom 31.08.2026, Prioritaet 1, ist auf dem iPhone
umgesetzt: Plakatraster, Suche, neun Sortierungen, Genre- und
Laufzeitfilter, „von Freunden empfohlen"-Kennzeichnung samt Filter,
„Ueberrasch mich", Entfernen und „als gesehen markieren" mit sofortiger
Bewertung.

Die Funktion `watchlist_for_me()` liefert alles in einer Antwort. Das
Web kann sie unveraendert benutzen. **Gefiltert und sortiert wird im
Client** — eine Watchlist hat Dutzende Eintraege, keine
Hunderttausend; sollte das je nicht mehr stimmen, ist das der Punkt zum
Umdrehen.

## 10. Die Suche

**Erledigt.** Vorschau statt sofortigem Schreiben, mehrere Treffer zur
Auswahl, getrennte Fehlerzustaende, Suchverlauf (`lib/search-history.ts`,
lokal und loeschbar), Originaltitel und die Marken "Gesehen" /
"In Watchlist". **Die Quelle wird nirgends genannt**, wo ein Leser
hinsieht; in den Moderationswerkzeugen steht sie weiter, dort ist sie der
Punkt. Die Filmseite liest die Genres jetzt ueber `film_categories`.

Das Such-Konzept vom 31.08.2026, Prioritaet 1, ist auf dem iPhone
umgesetzt. Das Web hat davon noch nichts:

- **Vorschau vor der Aufnahme.** `lazy-film` kennt jetzt
  `mode: 'preview'` — nachsehen ohne zu schreiben — und nimmt bei
  `{ wikidataId }` genau einen Treffer auf. Der bisherige Aufruf des
  Webs mit `{ term }` schreibt weiterhin sofort; das ist der Weg, der
  abzuloesen ist.
- **Mehrere Treffer zur Auswahl** statt des ersten. „Halloween" sind
  drei Filme.
- **Die Quelle wird nicht genannt.** Im Web steht noch „Wikidata
  antwortet gerade nicht" und „Film anlegen". Beides muss weg.
- **Getrennte Fehlerzustaende**: kein Treffer, kein Netz, Quelle nicht
  erreichbar, Speichern fehlgeschlagen, schon vorhanden.
- **„Ohne Jahr suchen"** statt eines leeren Ergebnisses.
- **Suchverlauf**, Originaltitel neben dem deutschen, und die Marken
  „Gesehen" / „In Watchlist".

**Die Kartenanimation bleibt bei fuenfzehn Sekunden**, in App und Web.
Das Konzept schlaegt in §9 eine Sekunde vor; verworfen am 31.08.2026 —
ein Tipp auf den Bildschirm beendet sie ohnehin jederzeit.

**Das Genre-Mapping (§26) ist erledigt** und wirkt fuer beide
Plattformen: `genre_tiles` und `films_for_me` rechnen jetzt ueber
Kategorien, und `genres` traegt `is_category` und `category_id`. Aus
vierzig Kacheln sind sechzehn geworden.

Was das Web dazu noch braucht: **die Filmseite liest die Genres
weiterhin roh** aus `film_genres`, zeigt also neben „Kriminalfilm" auch
„Neo-Noir" und „Krimidrama". Sie muss auf die Sicht `film_categories`
umgestellt werden — eine Zeile, dieselbe wie auf dem iPhone.

## 11. Das Tagebuch

**Erledigt.** `diary-page.tsx` und `lib/diary.ts`: Monatsgruppen,
Jahresauswahl, sieben Sortierungen, Schnellfilter, "3. Sichtung",
Menue je Eintrag. Der Spoilerschutz gilt jetzt im Tagebuch, im Feed und
unter dem Film, und beim Schreiben gibt es das Haekchen.

Im Web ist das Tagebuch eine chronologische Liste ohne Suche, Filter
oder Sortierung, und Eintraege lassen sich dort nicht bearbeiten. Auf
dem iPhone ist es nach Monat gruppiert, hat drei Zahlen im Kopf, sucht
in Titel **und** Rezension, filtert nach Kategorie, Sichtbarkeit,
Rezension und Wiedersehen und laesst jeden Eintrag aendern oder
loeschen.

`diary_for_me()` und `diary_summary()` liefern beides in zwei Antworten
und stehen dem Web offen.

Eine Regel, die dabei gilt und im Web fehlt: ein Eintrag **ohne**
Sehdatum wird unter seinem Eintragszeitpunkt einsortiert, und die Zeile
sagt dazu „eingetragen am". Sonst stuende er als Eintrag von 1970 ganz
unten.

Dazu aus dem Tagebuch-Konzept vom 31.08.2026, Prioritaet 1: sieben
Sortierungen statt vier, Jahresauswahl, Filter „mit" und „ohne
Bewertung", „3. Sichtung" statt „Wiedergesehen", Drei-Punkte-Menue je
Eintrag, und das Nachtragen von Bewertung oder Rezension.

**Der Spoilerschutz gilt fuer beide Plattformen.** `diary_entries`
traegt jetzt `has_spoilers`, und `diary_for_me`, `following_feed` sowie
die Rezensionsliste reichen es durch. Im Web wird jede Rezension
weiterhin offen angezeigt — im Tagebuch, im Feed und unter dem Film.
Das ist **kein** Zugriffsschutz und soll keiner sein (das Spoiler-Gate
der Diskussion steht in der Policy, ADR-010), aber die Bitte des
Verfassers gehoert respektiert.

## 12. Das Profil

**Erledigt.** Die Lieblingskategorien tragen den kurzen Namen, und die
Listenseite laeuft ueber `lists_of` — Zahl und drei Plakate in einer
Antwort statt einer zweiten Abfrage je Liste.

Auf dem iPhone gebaut: Kopfbild mit auslaufendem Verlauf, Profilbild,
Name und Kennung, Beschreibung, Follower- und Folgt-Zahlen,
Folgen-Knopf, vier Zahlen, die vier Favoritenplaetze mit Luecken als
Luecken, Lieblingskategorien, Binge-Listen und die juengsten Eintraege.

`profile_overview(name)` und `profile_favourites(profile)` sind neu und
stehen dem Web offen. `profile_overview` beantwortet in einer Antwort,
was die Seite beim Aufschlagen fragt — wer das ist, wie viele folgen,
folge ich, folgt er zurueck, und hat er mich blockiert.

**`profile_genres` rechnet jetzt ueber Kategorien** statt ueber
Rohgenres. Im Web stand dadurch "Kriminalfilm", "Neo-Noir" und
"Krimidrama" nebeneinander — dreimal dieselbe Vorliebe. Die Funktion
gibt zusaetzlich `genre_id` zurueck; der bisherige Aufruf muss die neue
Spalte nur ignorieren.

Bearbeiten geht inzwischen vollstaendig: Name, Beschreibung, Profil-
und Kopfbild und die zehn Favoritenplaetze.

Die Profilseite ist am 31.08.2026 mit der Webansicht abgeglichen worden
und traegt jetzt dasselbe: die vier Auswertungen, die
Watchlist-Vorschau samt Kennzahl, Blockieren und Melden.
`profile_overview` gibt dafuer zusaetzlich `watchlist_public` und
`i_blocked` zurueck — der bisherige Aufruf muss die neuen Spalten nur
ignorieren.

Alles davon ist inzwischen da: die „mehr"-Wege zu Tagebuch, Watchlist
und Listen, und die antippbaren Follower-Zahlen.

Die Listenseiten gibt es jetzt auch auf dem iPhone. `lists_of(profile)`
und `list_films(list)` sind neu und stehen dem Web offen — `lists_of`
liefert Zahl und drei Plakate je Liste, was das Web heute mit einer
zweiten Abfrage je Liste holt.

## 13. Das Logo

**Erledigt.** `apps/web/public/logo.png`, im Header und auf beiden
Anmeldebildschirmen. Der Schriftzug bleibt gesetzt.

Die Bildmarke liegt als Asset in der App
(`apps/ios/BingeLog/Assets.xcassets/LogoMark.imageset`). Im Web wird der
Schriftzug bisher gesetzt, nicht gezeigt. Die Marke gehoert in den
Header und auf den Anmeldebildschirm.

Der Schriftzug selbst ist bislang **nirgends** eine Bilddatei — auch in
der App wird er von SwiftUI gesetzt. Wenn es ihn als Datei geben soll,
gilt das fuer beide Plattformen.

---

## Was weiterhin offen ist

- **Punkt 7, die Filmseite.** Steht hier als Frage: am Schreibtisch ist
  eine zweispaltige Seite nicht dasselbe wie auf einem Telefon. Popcorn,
  FSK-Farben und die drei Sichtbarkeiten sind auf beiden gleich, und das
  war der Teil, der gleich bleiben musste.
- **Der Countdown „noch 12 Tage"** und die Erinnerung fuer kommende
  Filme in der Watchlist. Beide brauchen ein deutsches
  Erscheinungsdatum; der Katalog fuehrt nur `release_year`. "Bald
  verfuegbar" steht schon und kommt mit dem Jahr aus — auf den Tag
  genau wird es erst mit P577 samt Landesqualifikator, und das ist eine
  Erweiterung der Pipeline, keine der Oberflaeche.
  („Neu in Deutschland" ist am 03.09.2026 verworfen worden.)
- **Aus den Konzepten der Block "Danach"**: "Weil dir dieser Film
  gefallen hat", "Heute passend", Monatsstatistik, Bewertungsverlauf,
  Share Cards, Kalenderansicht.
- **Der Geschmackscheck** (`taste_deck`, `taste_readiness`,
  `film_match`) gibt es bislang nur in der App. Im Web fehlt der Stapel;
  den Match-Wert zeigt die Watchlist schon.
- **Watchlist-Gruppen anlegen und zuordnen.** Das Web filtert nach ihnen,
  verwalten lassen sie sich nur in der App.

---

## Was ausdruecklich **nicht** ins Web gehoert

- **Der Startbildschirm** (`SplashView`). Eine Webseite hat keinen
  Kaltstart, und drei Sekunden Vorstellung vor einer Seite waeren drei
  Sekunden zu viel.
- **Der Plakat-Cache auf der Platte** (`SplashPosterCache`). Der Browser
  hat seinen eigenen.
