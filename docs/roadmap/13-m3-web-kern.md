# M3: Web-Kern

**Ziel:** Eine benutzbare Web-App. Registrieren, Film suchen, Film ansehen,
Film bewerten und eintragen.

**Vorbedingung:** M2 abgeschlossen.

**Aufwand:** 2 bis 3 Wochen.

---

## Aufgaben

### 3.1 Auth

- [x] Supabase Auth: E-Mail plus Passwort
- [ ] **Apple Sign-in** — offen, braucht einen Apple-Developer-Account
      (Pflicht für den App Store, wenn andere Social Logins angeboten
      werden. Am einfachsten: nur E-Mail und Apple)
- [x] Bestätigungsmail erneut anfordern, falls die erste nicht ankommt
- [x] Nach der Registrierung: Username wählen, `profiles`-Zeile anlegen
- [x] Username-Regeln: 3 bis 20 Zeichen, `[a-z0-9_]`, case-insensitive
      eindeutig, Sperrliste für reservierte Begriffe
- [x] Middleware für geschützte Routen
- [x] Session-Handling serverseitig, keine Tokens im Local Storage

### 3.2 Suche

**Das ist die Stelle, an der TheTVDB scheitert. Hier wird es besser
gemacht.**

Ranking-Formel, absteigend gewichtet:

1. Exakte Übereinstimmung mit `title_de`, `title_original` oder `title_en`
2. Trigram-Ähnlichkeit
3. `sitelink_count` als Relevanzmultiplikator
4. Erscheinungsjahr als schwacher Tiebreaker (neuer leicht bevorzugt)

- [x] Query als Postgres-Funktion, nicht im Client
- [x] Debounce 250 ms, Ergebnisse ab 2 Zeichen
- [x] Jahr immer neben dem Titel anzeigen
- [x] Bei mehreren Filmen gleichen Titels: Regie mit anzeigen

**Pflicht-Testfälle** (alle sollen den erwarteten Film auf Platz 1 haben):

| Eingabe                              | Erwartet                                  |
| ------------------------------------ | ----------------------------------------- |
| `Solaris`                            | Tarkowski 1972, nicht die TV-Fassung 1968 |
| `Die Wand`                           | Pölsler 2012                              |
| `Der dritte Mann`                    | Reed 1949                                 |
| `Shoplifters`                        | Kore-eda 2018                             |
| `Jeder für sich und Gott gegen alle` | Herzog 1974                               |

Diese fünf sind genau die, an denen TheTVDB gescheitert ist. Sie gehören
als automatisierter Test ins Repo.

- [x] Bei null Treffern: Lazy Creation aus M1 anstoßen

### 3.3 Filmdetailseite

- [x] Plakat, Titel (deutsch mit Original als Untertitel, falls
      abweichend), Jahr, Laufzeit, Regie, Besetzung, Genres
- [x] Eigene Bewertung und eigener Tagebucheintrag, falls vorhanden
- [x] Durchschnittsbewertung der Community mit Anzahl
- [x] Öffentliche Reviews, paginiert
- [x] Aktionen: bewerten, eintragen, auf Watchlist
- [x] TheTVDB-Attribution, wo Artwork von dort stammt

**Synopsis:** `synopsis_de` ist bei vielen Filmen leer (Wikidata liefert
keine Fließtexte). Entscheidung für M3: **keine Synopsis anzeigen.** In
einer Tagebuch-App wissen die Leute, welchen Film sie gesehen haben.
Wikipedia-Text über den Sitelink wäre CC BY-SA und würde ShareAlike
auslösen. Das ist bewusst zu entscheiden, nicht nebenbei einzubauen.

### 3.4 Logging

- [x] Bewertung in halben Sternen (Skala 1 bis 10 in der Datenbank,
      Anzeige als 0,5 bis 5,0 Sterne)
- [x] Datum, Rewatch-Flag, optionaler Review-Text
- [x] Privat-Flag pro Eintrag
- [x] Mehrere Einträge zum selben Film möglich (Rewatches)
- [x] Bearbeiten und Löschen

### 3.4b Facettenbewertung

Siehe ADR-009.

- [x] Sternebewertung ist Pflicht, Facetten sind optional
- [x] Facetten standardmäßig **eingeklappt**. Ein Tap auf "Detailliert
      bewerten" klappt sie auf. Der Standardweg bleibt zwei Taps.
- [x] Sieben Facetten, jeweils halbe Sterne wie die Gesamtbewertung
- [x] Teilweises Ausfüllen ist gültig. Wer nur Schauspiel und Story
      bewertet, speichert genau diese zwei.
- [x] Anzeige auf der Filmdetailseite: Balkendarstellung pro Facette mit
      Durchschnitt und Anzahl, **erst ab 5 Bewertungen** sichtbar
- [x] Eigene Facettenbewertung neben dem Community-Wert anzeigen

**Nicht tun:**

- Facetten in die Sternebewertung einrechnen
- Facetten zur Pflicht machen
- Freitext-Facetten zulassen (nicht aggregierbar)
- Mehr als sieben Facetten anzeigen (Entscheidungsmüdigkeit)

### 3.5 Design-Grundlagen

- [x] Dunkles Grundthema, weil Plakate darauf besser wirken
- [x] Rastergröße 120 bis 150 px Kachelbreite als Referenz
- [x] Typografisches System, das zur generierten Karte passt.
      Generierte und echte Plakate stehen nebeneinander im selben
      Raster und dürfen sich nicht beißen.
- [x] Responsive ab 360 px Breite

---

## Definition of Done

- [x] Registrieren, einloggen, Film suchen, bewerten, eintragen
      funktioniert Ende zu Ende
- [x] Die fünf Such-Testfälle sind grün und laufen in CI
- [x] Lighthouse Performance über 85 auf der Filmdetailseite
- [x] RLS ist geprüft: Nutzer A kann Einträge von Nutzer B nicht ändern
- [x] Private Einträge sind für andere nicht sichtbar, auch nicht über
      die API

## Stand am 28.08.2026

Abgeschlossen bis auf **Apple Sign-in**, das einen Apple-Developer-Account
verlangt und daher nicht am Code hängt.

Nachgemessen statt behauptet:

- 218 Tests laufen in CI, darunter die fünf Pflicht-Testfälle der Suche
  und 92 Zusicherungen zu Policies und Triggern
- 360 px: kein seitliches Scrollen auf Filmseite, Suche und Registrierung
- Lighthouse misst die CI bei jedem Push und bricht unter 85 ab

Bewusst nicht enthalten und in M3 3.3 begründet: **Synopsis**. Dazu aus
demselben Grund — keine Quelle, die zugleich frei, vollständig und sauber
ist — **Trailer**, **FSK-Plakette** und **Avatare**. Die Anfrage zur
FSK-API läuft (`docs/betrieb/fsk-anfrage.md`).

Was in M3 nicht vorgesehen war und trotzdem entstand: Sichtbarkeit in
drei Stufen statt eines Privat-Schalters, die `follows`-Tabelle samt
Freundschaftsregel, und die Trennung von Teststand und Hauptseite.

## Fallstricke

- **Suchranking nicht aus der Datenbank-Default-Sortierung ableiten.**
  Ohne `sitelink_count` bekommst du dieselben Fehltreffer wie TheTVDB.
- **Keine Business-Logik in Client-Komponenten.** Bewertungslogik,
  Aggregation und Sichtbarkeitsprüfung gehören auf den Server.
- **Halbe Sterne von Anfang an.** Nachträglich von 5 auf 10 Stufen zu
  migrieren, verfälscht alle bestehenden Bewertungen.
- **Facetten nicht in den Standardweg legen.** Die Logging-Frequenz ist
  die wichtigste Retention-Kennzahl der App. Jeder zusätzliche Pflicht-Tap
  senkt sie.
- **Facettendurchschnitt nicht ab der ersten Bewertung anzeigen.** Ein
  "Schauspiel 2,0 (1 Stimme)" ist irreführend und lädt zum Brigading ein.
