# BingeLog: Produktbeschreibung

> Diese Datei beschreibt, **was für ein Produkt** BingeLog ist.
> `00-overview.md` beschreibt, was technisch gebaut wird.
> `01-decisions.md` beschreibt, warum es so gebaut wird.
>
> Wenn eine Umsetzungsfrage nicht durch die Meilensteine beantwortet wird,
> ist diese Datei der Maßstab.

---

## In einem Satz

BingeLog ist ein Filmtagebuch für den deutschsprachigen Raum: Man trägt
ein, was man gesehen hat, bewertet es differenziert und diskutiert es mit
Leuten, die den Film ebenfalls gesehen haben.

---

## Für wen

**Kernzielgruppe:** Menschen, die regelmäßig Filme sehen und darüber
nachdenken wollen. Kinogänger, Programmkinopublikum, Filmnerds. Leute,
die nach dem Abspann noch zwanzig Minuten weiterreden.

**Nicht die Zielgruppe:** Leute, die wissen wollen, was heute Abend auf
Netflix läuft. Das ist ein anderes Produkt und wird bewusst nicht bedient.

**Sprachraum:** Deutschland, Österreich, Schweiz. UI-Sprache ist Deutsch.
Das ist eine Positionierung, keine Einschränkung: Letterboxd ist
englischsprachig und deckt deutsche Programmkinos nicht ab.

---

## Der Kernloop

Alles Weitere hängt daran, dass diese drei Schritte reibungslos sind:

```
Film gesehen  ->  eintragen und bewerten  ->  Diskussion wird sichtbar
                          ^                            |
                          |                            v
                   Feed der Leute,  <-  andere lesen und antworten
                   denen man folgt
```

**Eintragen muss zwei Taps dauern.** Das ist die wichtigste Kennzahl der
App. Alles, was diesen Weg verlängert, ist im Zweifel falsch. Facetten,
Reviews, Rewatch-Flags sind alles optionale Erweiterungen eines Vorgangs,
der auch ohne sie vollständig ist.

---

## Was BingeLog anders macht

Drei Dinge, in dieser Reihenfolge der Wichtigkeit:

### 1. Spoilergeschützte Filmdiskussion

Der Diskussionsbereich eines Films öffnet sich erst, wenn man ihn bewertet
hat. Das löst ein reales Problem: Auf jeder anderen Plattform muss man
Kommentare meiden, bis man den Film gesehen hat.

Es ist gleichzeitig ein Anreiz, Filme einzutragen, und damit der
wichtigste Wachstumsmechanismus der App.

### 2. Facettenbewertung

Ein Stern-Wert sagt zu wenig. Ein Film kann grandios aussehen und eine
schwache Story haben. BingeLog lässt Schauspiel, Story, Regie, Bild, Ton,
Setting und Tempo getrennt bewerten, optional.

Der Nutzen entsteht in der Aggregation: zu sehen, dass ein Film beim Bild
hoch und beim Drehbuch niedrig bewertet wird, ist eine Information, die
ein Durchschnittsstern nie liefert.

### 3. Deutsche Kinolandschaft

Programmkinos, lokale Spielpläne, Neustarts im deutschen Verleihkalender.
Das ist die Lücke, die Letterboxd offenlässt, und langfristig das
Geschäftsmodell (M8).

---

## Haltung

Diese Punkte sind Produktversprechen, keine Implementierungsdetails. Sie
werden nicht später "aus Wachstumsgründen" zurückgenommen.

- **Kein algorithmischer Feed.** Chronologisch, vollständig,
  nachvollziehbar. Man sieht, was die Leute gesehen haben, denen man
  folgt. In dieser Reihenfolge.
- **Keine Werbung.** (ADR-007)
- **Kein Verkauf von Nutzerdaten.** (ADR-007)
- **Keine Dark Patterns.** Kein Countdown, kein künstlicher Druck, kein
  versteckter Kündigungsweg.
- **Kostenlos vollwertig.** Das Supporter-Abo (M7) kauft Komfort, nie
  Grundfunktionen.
- **Ehrlich über Grenzen.** Das Spoiler-Gate heißt "sichtbar nach deiner
  Bewertung", nicht "spoilerfrei garantiert". Es ist absichtlich umgehbar.

---

## Was BingeLog nicht ist

Wenn ein Feature-Vorschlag in eine dieser Kategorien fällt, gehört er
nicht rein:

| Nicht                               | Warum                                                                      |
| ----------------------------------- | -------------------------------------------------------------------------- |
| Streaming-Guide                     | Verfügbarkeitsdaten sind lizenzpflichtig, und es ist ein anderes Produkt   |
| Allgemeines soziales Netzwerk       | Der Anlass ist immer ein Film, nie ein Statusupdate                        |
| Bewertungsaggregator wie Metacritic | Es geht um das eigene Tagebuch, nicht um einen Konsenswert                 |
| Serientracker                       | Der Name legt es nahe, der Fokus ist trotzdem Film. Siehe Anmerkung unten. |
| Empfehlungsmaschine                 | Kein Algorithmus, der einem sagt, was man sehen soll                       |

---

## Gestaltung

- **Dunkles Grundthema.** Plakate wirken darauf besser, und es passt zum
  Anlass.
- **Das Raster ist die Hauptansicht.** Kachelbreite 120 bis 150 px als
  Referenzgröße. Bei dieser Größe zählt Kontrast, nicht Detail.
- **Typografie trägt die Marke.** Jede Film-App der Welt zieht dieselben
  Plakate und sieht deshalb identisch aus. Das eigene typografische
  System für die prozeduralen Karten (M2) ist das einzige verbleibende
  visuelle Alleinstellungsmerkmal in dieser Produktkategorie.
- **Generierte und echte Plakate stehen im selben Raster nebeneinander
  und dürfen sich nicht beißen.** Die generierte Karte ist kein
  Platzhalter, sondern ein gleichwertiger Zustand.
- **Ruhig statt laut.** Keine Badges, keine Streaks, keine
  Gamification-Schleifen.

---

## Tonalität der UI-Texte

- Deutsch, geduzt
- Knapp und konkret. "Bewerten" statt "Jetzt Bewertung abgeben"
- Keine Ausrufezeichen, kein Marketington
- Fehlermeldungen sagen, was zu tun ist, nicht was schiefging
- Keine Emojis in der System-UI

---

## Anmerkung zum Namen

Zwei Punkte, die vor der Markenanmeldung und vor der Reservierung in
App Store Connect zu klären sind:

1. **Verfügbarkeit prüfen.** DPMA-Register und EUIPO auf "BingeLog" und
   ähnliche Marken, dazu Domain und die Namensvergabe in beiden App
   Stores.

2. **"Binge" verweist umgangssprachlich eher auf Serienkonsum am Stück.**
   Das Produkt ist filmzentriert. Das ist kein Ausschlussgrund, der Name
   ist kurz und einprägsam, aber es kann eine Erwartung erzeugen, die die
   App bewusst nicht bedient (siehe "Was BingeLog nicht ist"). Entweder
   in der Positionierung auffangen oder bewusst in Kauf nehmen.
