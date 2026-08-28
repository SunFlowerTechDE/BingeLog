# M3: Web-Kern

**Ziel:** Eine benutzbare Web-App. Registrieren, Film suchen, Film ansehen,
Film bewerten und eintragen.

**Vorbedingung:** M2 abgeschlossen.

**Aufwand:** 2 bis 3 Wochen.

---

## Aufgaben

### 3.1 Auth

- [ ] Supabase Auth: E-Mail plus Passwort, dazu Apple Sign-in
      (Pflicht für den App Store, wenn andere Social Logins angeboten
      werden. Am einfachsten: nur E-Mail und Apple)
- [ ] Nach der Registrierung: Username wählen, `profiles`-Zeile anlegen
- [ ] Username-Regeln: 3 bis 20 Zeichen, `[a-z0-9_]`, case-insensitive
      eindeutig, Sperrliste für reservierte Begriffe
- [ ] Middleware für geschützte Routen
- [ ] Session-Handling serverseitig, keine Tokens im Local Storage

### 3.2 Suche

**Das ist die Stelle, an der TheTVDB scheitert. Hier wird es besser
gemacht.**

Ranking-Formel, absteigend gewichtet:

1. Exakte Übereinstimmung mit `title_de`, `title_original` oder `title_en`
2. Trigram-Ähnlichkeit
3. `sitelink_count` als Relevanzmultiplikator
4. Erscheinungsjahr als schwacher Tiebreaker (neuer leicht bevorzugt)

- [ ] Query als Postgres-Funktion, nicht im Client
- [ ] Debounce 250 ms, Ergebnisse ab 2 Zeichen
- [ ] Jahr immer neben dem Titel anzeigen
- [ ] Bei mehreren Filmen gleichen Titels: Regie mit anzeigen

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

- [ ] Bei null Treffern: Lazy Creation aus M1 anstoßen

### 3.3 Filmdetailseite

- [ ] Plakat, Titel (deutsch mit Original als Untertitel, falls
      abweichend), Jahr, Laufzeit, Regie, Besetzung, Genres
- [ ] Eigene Bewertung und eigener Tagebucheintrag, falls vorhanden
- [ ] Durchschnittsbewertung der Community mit Anzahl
- [ ] Öffentliche Reviews, paginiert
- [ ] Aktionen: bewerten, eintragen, auf Watchlist
- [ ] TheTVDB-Attribution, wo Artwork von dort stammt

**Synopsis:** `synopsis_de` ist bei vielen Filmen leer (Wikidata liefert
keine Fließtexte). Entscheidung für M3: **keine Synopsis anzeigen.** In
einer Tagebuch-App wissen die Leute, welchen Film sie gesehen haben.
Wikipedia-Text über den Sitelink wäre CC BY-SA und würde ShareAlike
auslösen. Das ist bewusst zu entscheiden, nicht nebenbei einzubauen.

### 3.4 Logging

- [ ] Bewertung in halben Sternen (Skala 1 bis 10 in der Datenbank,
      Anzeige als 0,5 bis 5,0 Sterne)
- [ ] Datum, Rewatch-Flag, optionaler Review-Text
- [ ] Privat-Flag pro Eintrag
- [ ] Mehrere Einträge zum selben Film möglich (Rewatches)
- [ ] Bearbeiten und Löschen

### 3.4b Facettenbewertung

Siehe ADR-009.

- [ ] Sternebewertung ist Pflicht, Facetten sind optional
- [ ] Facetten standardmäßig **eingeklappt**. Ein Tap auf "Detailliert
      bewerten" klappt sie auf. Der Standardweg bleibt zwei Taps.
- [ ] Sieben Facetten, jeweils halbe Sterne wie die Gesamtbewertung
- [ ] Teilweises Ausfüllen ist gültig. Wer nur Schauspiel und Story
      bewertet, speichert genau diese zwei.
- [ ] Anzeige auf der Filmdetailseite: Balkendarstellung pro Facette mit
      Durchschnitt und Anzahl, **erst ab 5 Bewertungen** sichtbar
- [ ] Eigene Facettenbewertung neben dem Community-Wert anzeigen

**Nicht tun:**

- Facetten in die Sternebewertung einrechnen
- Facetten zur Pflicht machen
- Freitext-Facetten zulassen (nicht aggregierbar)
- Mehr als sieben Facetten anzeigen (Entscheidungsmüdigkeit)

### 3.5 Design-Grundlagen

- [ ] Dunkles Grundthema, weil Plakate darauf besser wirken
- [ ] Rastergröße 120 bis 150 px Kachelbreite als Referenz
- [ ] Typografisches System, das zur generierten Karte passt.
      Generierte und echte Plakate stehen nebeneinander im selben
      Raster und dürfen sich nicht beißen.
- [ ] Responsive ab 360 px Breite

---

## Definition of Done

- [ ] Registrieren, einloggen, Film suchen, bewerten, eintragen
      funktioniert Ende zu Ende
- [ ] Die fünf Such-Testfälle sind grün und laufen in CI
- [ ] Lighthouse Performance über 85 auf der Filmdetailseite
- [ ] RLS ist geprüft: Nutzer A kann Einträge von Nutzer B nicht ändern
- [ ] Private Einträge sind für andere nicht sichtbar, auch nicht über
      die API

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
