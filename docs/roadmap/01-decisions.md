# Architekturentscheidungen (ADR)

> Diese Entscheidungen sind getroffen und empirisch abgesichert. Sie sind
> **nicht** neu zu diskutieren. Wenn eine Umsetzung gegen eine dieser
> Entscheidungen läuft, ist die Umsetzung falsch, nicht die Entscheidung.

---

## ADR-001: Wikidata als Metadaten-Backbone

**Entscheidung:** Alle Filmmetadaten (Titel, Jahr, Regie, Cast, Laufzeit,
Genre, externe IDs) stammen aus Wikidata.

**Begründung:** CC0-lizenziert, also kommerzielle Nutzung ohne Einschränkung
und ohne Gebühr. Vollständige Dumps verfügbar, kein API-Key, kein
Rate-Limit, keine Abhängigkeit von einem Anbieter, der Konditionen ändern
kann.

**Gemessen:** 348.586 Einträge mit `wdt:P31 wd:Q11424` (direkte Instanzen
von "Film"). Davon 273.576 mit IMDb-ID (P345), also 78,5 Prozent.

---

## ADR-002: TheTVDB als Artwork-Layer

**Entscheidung:** Filmplakate kommen von TheTVDB v4. TheTVDB liefert
**ausschließlich Bilder**, niemals Titel oder Metadaten.

**Begründung:** Lizenzstaffel nach Unternehmensumsatz. Unter 50.000 USD
Jahresumsatz kostenlos mit Attributionspflicht, kommerzielle Nutzung
(Abos, Werbung) ausdrücklich eingeschlossen.

**Warnung:** Maßgeblich ist der Umsatz des **Mutterunternehmens**, also
SunFlower Tech insgesamt, nicht nur diese App. Nächste Stufe ist
1.000 USD/Jahr ab 50.000 USD Umsatz, danach 10.000 USD/Jahr ab
250.000 USD. Harte Kanten, kein Gleitpfad.

**Warum keine Metadaten von dort:** Die Titelfelder sind unzuverlässig
gepflegt. Belegte Beispiele aus dem Abdeckungstest:

- "Das Kanu des Manitu (DE)" trägt das Länderkürzel im Namensfeld
- Bei "Der Himmel über Berlin" steht "Wim wenders" in den Alternativtiteln
- "Amrum" (2025) ist rein französisch angelegt, ohne deutschen Titel und
  ohne Synopsis
- "Jeder für sich und Gott gegen alle" ist als Alternativtitel hinterlegt,
  liefert bei der Titelsuche aber null Ergebnisse

---

## ADR-003: Matching ausschließlich über IMDb-ID

**Entscheidung:** Die Verknüpfung Wikidata zu TheTVDB läuft
**ausschließlich** über `GET /search/remoteid/{imdb_id}`.

**Verboten, auch als Fallback:**

- Titelsuche
- Titel-plus-Jahr-Abgleich
- Fuzzy-Matching
- Levenshtein-Distanz auf Titeln

Kein Treffer über die ID heißt: prozedurale Karte. Punkt.

**Begründung:** Die Titelsuche von TheTVDB rankt nach Titelübereinstimmung,
nicht nach Relevanz. Belegte Fehltreffer aus dem Test:

| Gesucht | Treffer 1 der Titelsuche |
|---|---|
| Der dritte Mann (1949) | Doku über den Film, 2000 |
| Solaris (1972, Tarkowski) | Sowjetische TV-Fassung, 1968 |
| Die Wand (2012) | Serie "Die Wanderhure", 2013 |
| Shoplifters (2018) | "The Shoplifters", 2019 |

Ein falsch verknüpfter Film ist ein stiller Fehler, der nie auffällt.
Eine fehlende Verknüpfung ist sichtbar und harmlos.

---

## ADR-004: Prozedurale Karte als Fallback

**Entscheidung:** Filme ohne Artwork bekommen eine deterministisch aus
Metadaten generierte typografische Karte. Diese wird **vor** der
TheTVDB-Anbindung gebaut.

**Begründung:** Die App muss ohne TheTVDB vollständig funktionsfähig sein.
Wenn TheTVDB die Konditionen ändert, die Abdeckung nicht reicht oder der
Dienst ausfällt, degradiert die App, statt kaputtzugehen.

Zusätzlich: Ein Plakatraster sieht bei jeder Film-App gleich aus. Ein
eigenes typografisches System ist das einzige verbleibende visuelle
Alleinstellungsmerkmal in dieser Produktkategorie.

---

## ADR-005: Kein TMDB

**Entscheidung:** TMDB wird nicht eingebunden, weder für Metadaten noch
für Bilder.

**Begründung:** Kommerzielle Nutzung erfordert eine Lizenz zu 149 USD/Monat
unterhalb von 1 Mio. USD Jahresumsatz. Das sind rund 1.620 € im Jahr und
damit etwa 79 Prozent der gesamten Fixkosten, für eine Leistung, die
TheTVDB kostenlos abdeckt.

Zusätzlich untersagen die TMDB-Nutzungsbedingungen die Verwendung ihrer
Inhalte im Zusammenhang mit KI- oder ML-Anwendungen, und bei Lizenzende
muss der gesamte Cache gelöscht werden.

**Ebenfalls geprüft und verworfen:**

- **OMDb:** CC BY-NC 4.0, kommerzielle Nutzung in keinem Tier erlaubt.
  Kein Weg zu einer kommerziellen Lizenz. Datenherkunft aus IMDb ohne
  Lizenz.
- **IMDb offiziell:** sechsstelliges Minimum.

---

## ADR-006: Keine KI-generierten Filmplakate

**Entscheidung:** Es wird kein Bildmodell eingesetzt, das ein bestehendes
Filmplakat als Referenz oder Eingabe erhält.

**Begründung:** §24 UrhG (freie Benutzung) wurde im Juni 2021 gestrichen.
Es gilt §23 Abs. 1 UrhG: Bearbeitungen brauchen die Erlaubnis des
Rechteinhabers, frei ist ein Werk nur bei "hinreichendem Abstand"
(Verblassensmaßstab). Ein Fair-Use-Äquivalent existiert im deutschen
Recht nicht.

Der Zweck einer Plakatkachel ist Wiedererkennbarkeit. Wiedererkennbarkeit
und hinreichender Abstand schließen einander aus. Es gibt kein Fenster,
in dem beides gilt.

Hinzu kommen: die Eingabe ist bereits eine Vervielfältigung nach §16 UrhG,
Persönlichkeitsrechte abgebildeter Personen nach §22 KUG, und
Titelschriftzüge als eingetragene Wort-Bild-Marken.

Kostenrechnung als Nebenargument: 400.000 Bilder zu 0,04 bis 0,17 USD
ergeben 16.000 bis 68.000 USD, um Kosten von 1.620 €/Jahr zu vermeiden.

---

## ADR-007: Keine Werbung, kein Datenverkauf

**Entscheidung:** Die App zeigt keine Werbung und verkauft keine
Nutzerdaten.

**Begründung Werbung:** Bei Banner-eCPM von rund 1 € und etwa 40
Impressions pro aktivem Nutzer und Monat ergeben sich 0,04 € pro Nutzer
und Monat. Zur Deckung von 170 €/Monat wären etwa 4.250 monatlich aktive
Nutzer nötig, also rund 12.000 Registrierungen. Dazu kommen
CMP-Pflicht im EWR, ATT-Prompt auf iOS und Retention-Verlust.

**Begründung Datenverkauf:** Bewertungsprofile sind personenbezogen und
schwer anonymisierbar (vgl. De-Anonymisierung des Netflix-Prize-Datensatzes
2008 über öffentliche IMDb-Bewertungen). Filmpräferenzen offenbaren
Merkmale nach Art. 9 DSGVO (politische Meinung, religiöse Überzeugung,
sexuelle Orientierung). Zusätzlich ohne Skalierung wirtschaftlich wertlos.

**Stattdessen:** Supporter-Abo (M7) und Kino-B2B (M8). Ein einziges Kino
zu 59 €/Monat deckt die gesamten Fixkosten.

---

## ADR-008: Sitelink-Anzahl als Relevanzsignal

**Entscheidung:** Die Anzahl der Wikipedia-Sprachversionen
(`wikibase:sitelinks`) wird beim Import als Spalte mitgespeichert und
dient als Relevanzsignal für Suchranking und Batch-Priorisierung.

**Begründung:** Gemessen: Nur **9 Filme** im gesamten Wikidata-Bestand
haben mehr als 10 Sitelinks und keine IMDb-ID. Davon sind vier
Konzertfilme, einer ist eine Wochenschau-Reihe. Der einzige relevante
Fall ist "Nymphomaniac", weil Wikidata das Gesamtwerk führt und IMDb nur
die beiden Volumes.

Daraus folgt: Die fehlenden 21,5 Prozent ohne IMDb-ID liegen praktisch
vollständig im Longtail. Eine zweite Matching-Brücke (etwa über
TMDB-ID P4947) ist nicht nötig.

Sitelinks lösen zusätzlich das Ranking-Problem, an dem TheTVDB scheitert:
Ein Film mit 60 Sprachversionen gehört vor einen mit zweien.

---

## Empirische Basis: Abdeckungstest TheTVDB

20 Filme, vier Kategorien, manuell geprüft.

| Gruppe | Über Titelsuche | Über IMDb-ID |
|---|---|---|
| Aktuelle Titel | 5/5 | 5/5 |
| Deutschsprachig | 5/5 | 5/5 |
| Klassiker vor 1980 | 4/5 | 5/5 |
| Arthouse | 2/5 | 5/5 |
| **Summe** | **16/20** | **20/20** |

Alle 20 mit Plakat. Einziger inhaltlicher Mangel: "Amrum" ohne Synopsis.

**Kernbefund:** Die Abdeckung war nie das Problem. Der Zugriffsweg war es.

---

## ADR-009: Facettenbewertung neben der Sternebewertung

**Entscheidung:** Neben der Gesamtbewertung (halbe Sterne, 1 bis 10
intern) können Nutzer den Film in festen Facetten bewerten.

**Feste Facetten, als Enum, nicht als Freitext:**

| Enum-Wert | UI-Label |
|---|---|
| `acting` | Schauspiel |
| `story` | Story und Drehbuch |
| `directing` | Regie |
| `cinematography` | Bild und Kamera |
| `sound` | Ton und Musik |
| `production_design` | Setting und Ausstattung |
| `pacing` | Tempo |

**Warum ein Enum:** Freitext-Facetten lassen sich nicht aggregieren.
Ohne Aggregation ist das Feature wertlos, weil der Nutzen genau darin
liegt, zu sehen, dass ein Film beim Bild stark und bei der Story schwach
bewertet wurde.

**Zwingende Randbedingungen:**

1. **Facetten sind optional, die Sternebewertung ist es nicht.**
   Letterboxd funktioniert, weil Eintragen zwei Taps dauert. Wenn sieben
   Facetten Pflicht werden, sinkt die Logging-Frequenz, und damit die
   Retention.
2. **Facetten fließen nicht in die Sternebewertung ein.** Kein
   Durchschnitt, keine Ableitung. Der Nutzer setzt beides unabhängig.
3. **Facetten werden separat aggregiert** und getrennt angezeigt.
4. Erst ab einer Mindestzahl von Bewertungen (Vorschlag: 5) wird ein
   Facettendurchschnitt öffentlich angezeigt.

**Erweiterbarkeit:** Neue Facetten sind eine Migration am Enum. Bestehende
Facetten werden nie entfernt oder umbenannt, nur deaktiviert.

---

## ADR-010: Spoilergeschützte Filmdiskussion

**Entscheidung:** Jeder Film hat einen Diskussionsbereich. Dieser ist nur
sichtbar und beschreibbar, wenn der Nutzer den Film als gesehen markiert
**und** eine Sternebewertung abgegeben hat.

**Durchsetzung ausschließlich in der Datenbank per RLS.** Nicht in der
UI, nicht in der API-Schicht, nicht im Client. Eine ausgeblendete
Komponente ist kein Spoilerschutz.

```sql
create policy discussion_read_gate on thread_messages
for select using (
  exists (
    select 1 from diary_entries d
    where d.user_id  = auth.uid()
      and d.film_id  = thread_messages.film_id
      and d.rating is not null
  )
);
```

**Was das Gate leistet und was nicht:**

Es schützt zuverlässig gegen **versehentliche** Spoiler, also gegen den
Fall, dass jemand auf einer Filmseite landet und beim Scrollen die
Auflösung liest. Das ist der reale Schadensfall und der ist damit gelöst.

Es schützt **nicht** gegen absichtliches Umgehen. Jeder kann einen Film
in drei Sekunden als gesehen markieren und pauschal bewerten, um den
Bereich zu öffnen. Das ist hinnehmbar, muss aber im Produkt ehrlich
kommuniziert werden. Formulierung im UI: "Diskussion sichtbar, sobald du
den Film bewertet hast", nicht "spoilerfrei garantiert".

**Zwei zusätzliche Regeln:**

1. **Mindestschwelle vor Aktivierung.** Ein Diskussionsbereich wird erst
   angelegt, wenn mindestens 5 Nutzer den Film eingetragen haben. Bei
   350.000 Filmen entstünden sonst 350.000 leere Räume, und ein leerer
   Raum ist schlimmer als kein Raum.
2. **Asynchron, nicht live.** Siehe ADR-011.

---

## ADR-011: Diskussion asynchron, nicht als Live-Chat

**Entscheidung:** Der Diskussionsbereich wird als asynchroner Thread mit
Antworten umgesetzt, nicht als Echtzeit-Chat.

**Begründung:**

- **Kaltstart.** Live-Chat braucht Gleichzeitigkeit. Bei einer neuen App
  mit wenigen hundert Nutzern sind nie zwei Leute gleichzeitig beim
  selben Film. Ein leerer Chatraum signalisiert "hier ist nichts los".
  Ein Thread mit drei Beiträgen von letzter Woche funktioniert.
- **Moderation.** Echtzeitnachrichten sind ungleich schwerer zu
  moderieren als Beiträge, die stehen bleiben. Bei nutzergenerierten
  Inhalten ist Moderation App-Store-Pflicht und DSA-Pflicht, nicht
  optional.
- **Kosten.** Persistente Realtime-Verbindungen über viele Filme hinweg
  treiben die Supabase-Kosten, und das Ziel sind 35 € im Monat.
- **Zum Medium passend.** Filmdiskussion ist reflexiv. Man schreibt einen
  Absatz nach dem Kinobesuch, nicht eine Zeile im Sekundentakt.

Realtime-Aktualisierung eines offenen Threads über Supabase Realtime ist
davon unbenommen und ein sinnvolles Detail. Der Unterschied liegt im
Datenmodell und in der Moderationsarchitektur, nicht in der
Aktualisierungsgeschwindigkeit.

---

## ADR-012: Android nach dem App-Store-Launch

**Entscheidung:** Die Android-App (nativ, Kotlin und Jetpack Compose)
beginnt erst, wenn Version 1 im App Store live ist.

**Begründung:** Bis zum ersten erfolgreichen Review ändern sich Schema
und API noch. Jede Änderung parallel in drei Clients nachzuziehen,
verdreifacht den Aufwand genau in der Phase, in der am meisten geändert
wird.

**Folgeentscheidung, die ADR-004 präzisiert:** Bei drei Zielplattformen
wird die prozedurale Karte **nicht** dreimal nativ implementiert. Sie
wird serverseitig als SVG gerendert und clientseitig gecacht. Eine
dreifache Nachimplementierung führt unweigerlich dazu, dass derselbe Film
auf drei Geräten unterschiedlich aussieht.

Konsequenz für M5: Die dort ursprünglich empfohlene native
SwiftUI-Nachimplementierung entfällt. Stattdessen SVG vom Server mit
lokalem Dateicache, auf beiden mobilen Plattformen identisch.
