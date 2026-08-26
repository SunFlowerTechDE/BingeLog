# M1: Datenpipeline (Wikidata)

**Ziel:** Der Katalog ist befüllt. Rund 350.000 Filme mit Titeln, Jahr,
Regie, Cast, Genres, IMDb-IDs und Sitelink-Zahlen liegen in Postgres.

**Vorbedingung:** M0 abgeschlossen.

**Aufwand:** 3 bis 5 Tage.

---

## Vorbemerkung zum Ansatz

Der Import läuft über den **Dump**, nicht über den SPARQL-Endpoint. Der
Query Service hat ein 60-Sekunden-Timeout und ist für Massenabfragen
ungeeignet. Belegt: Eine `schema:about`-Abfrage über alle Filme ohne
IMDb-ID lief in einen 502.

Der SPARQL-Endpoint wird nur für zwei Dinge genutzt: Lazy Creation
einzelner fehlender Filme zur Laufzeit (Aufgabe 1.5) und Stichproben
während der Entwicklung.

### Nachgemessen am 26.08.2026

Der Versuch, den Dump durch API-Abfragen zu ersetzen, ist an drei Stellen
gescheitert. Die Zahlen stehen hier, damit der Umweg nicht noch einmal
genommen wird:

| Weg | Ergebnis |
|---|---|
| SPARQL mit `wdt:P31/wdt:P279* wd:Q11424` | 502 nach 12 s |
| SPARQL mit der statischen Klassenliste als `VALUES` | funktioniert bis etwa 50 Sitelinks, darunter 504 |
| SPARQL mit Bereichsfilter `FILTER(?s >= a && ?s <= b)` | 500/502/504, jeder Bereich |
| Volltextsuche `haswbstatement:P31=Q11424` | kennt alle 348.737 Filme, blättert aber nur 10.000 tief |

**Brauchbar bleibt:** der Kopf der Verteilung per SPARQL, ein exakter
Sitelink-Wert pro Abfrage, mit der Klassenliste als `VALUES` statt als
Pfad. Damit sind rund 1.000 bis 2.000 Filme erreichbar — genug für die
Entwicklung von M3, nicht genug für den Betrieb.

Zwei Verbesserungen sind daraus geblieben und stehen in `src/wikidata/api.ts`:
Die Klassenliste wird per POST als `VALUES` übergeben statt als
Pfadabfrage, und die Titelsuche der Lazy Creation läuft über den
Suchindex statt über SPARQL.

---

## Aufgaben

### 1.1 Dump beschaffen und filtern

- [ ] `latest-all.json.bz2` von `dumps.wikimedia.org` ziehen
      (Größenordnung 100 GB komprimiert, Plattenplatz vorher prüfen)
- [ ] Mit `wikibase-dump-filter` auf Filme reduzieren
- [ ] Filterkriterium: `P31` gegen `Q11424` **und** dessen Unterklassen
      (Dokumentarfilm, Animationsfilm, Kurzfilm sind eigene Klassen)
- [ ] Die Liste der Unterklassen einmalig per SPARQL ziehen und als
      statische Datei im Repo ablegen, nicht zur Laufzeit auflösen

```sparql
SELECT DISTINCT ?sub WHERE { ?sub wdt:P279* wd:Q11424 . }
```

### 1.2 Extraktion

Pro Film-Entity zu extrahieren:

| Feld              | Property    | Zielspalte                   |
| ----------------- | ----------- | ---------------------------- |
| Originaltitel     | P1476       | `title_original`             |
| Label `de`        | Label       | `title_de`                   |
| Label `en`        | Label       | `title_en`                   |
| Erscheinungsdatum | P577        | `release_year`               |
| Laufzeit          | P2047       | `runtime_min`                |
| Regie             | P57         | `film_credits` role=director |
| Besetzung         | P161        | `film_credits` role=cast     |
| Drehbuch          | P58         | `film_credits` role=writer   |
| Genre             | P136        | `film_genres`                |
| IMDb-ID           | P345        | `imdb_id`                    |
| Sitelinks         | `sitelinks` | `sitelink_count`             |

Hinweise:

- **P577 kann mehrfach vorkommen** (Festivalpremiere, Kinostart pro Land).
  Nimm das früheste Datum. Nicht das erstbeste im Array.
- **P2047 hat Einheiten.** Prüfe die Unit-ID, konvertiere auf Minuten.
- Personen landen in `people`, nicht als Freitext in `films`.
- Bei `title_de`: Wenn kein deutsches Label existiert, Feld auf `null`
  lassen. **Nicht** mit dem englischen Titel füllen. Die Fallback-Logik
  gehört in die Query, nicht in die Daten.

### 1.3 Laden

- [ ] Bulk-Insert über `COPY`, nicht zeilenweise
- [ ] Idempotent: `on conflict (wikidata_id) do update`
- [ ] Import in Batches mit Fortschrittsprotokoll, damit ein Abbruch
      nicht den ganzen Lauf kostet
- [ ] Nach dem Lauf: Zählwerte protokollieren (Filme gesamt, davon mit
      IMDb-ID, davon mit deutschem Titel, davon mit Sitelinks > 10)

**Erwartungswerte zur Kontrolle:** rund 348.000 Filme, davon rund 78,5
Prozent mit IMDb-ID. Weicht das stark ab, stimmt der Filter nicht.

### 1.4 Inkrementelle Updates

- [ ] Wikidata EventStreams (SSE) abonnieren
- [ ] Auf Änderungen an bekannten Q-IDs reagieren
- [ ] Als eigener Prozess, nicht im Web-Deployment
- [ ] Kann nach M6 nachgezogen werden, ist für den Start nicht kritisch

### 1.5 Lazy Creation

Für Filme, die nicht im Katalog sind (Neuzugänge, Longtail):

- [ ] Suchtreffer leer -> SPARQL-Query gegen `query.wikidata.org`
- [ ] Bei Treffer: Film anlegen, direkt in M2 den Artwork-Lookup anstoßen
- [ ] Rate-Limit einbauen, maximal wenige Abfragen pro Minute
- [ ] Bei Timeout oder Fehler: sauber degradieren, kein Fehler in der UI

---

## Definition of Done

- [ ] `select count(*) from films` liegt in der erwarteten Größenordnung
- [ ] Stichprobe von 20 Filmen aus `01-decisions.md` ist vorhanden und
      korrekt befüllt, inklusive Tarkowskis Solaris (**Q125772**, tt0069293)

      > Korrektur: hier stand Q188473. Das ist das Genre "Actionfilm",
          > nicht der Film. Die richtige ID zu tt0069293 ist Q125772,
          > gegengeprüft über `wdt:P345`.

- [ ] Der Import ist wiederholbar ausführbar, ohne Duplikate zu erzeugen
- [ ] Laufzeit des Vollimports ist dokumentiert

## Fallstricke

- **Nicht über den SPARQL-Endpoint importieren.** Timeouts und faktische
  Rate-Limits machen den Vollimport unmöglich.
- **Der Dump ist groß.** Plattenplatz vor dem Download prüfen. Es gab in
  diesem Projektumfeld bereits eine Speicherplatzkrise auf C:.
- **Nicht auf `wdt:P31 wd:Q11424` allein filtern.** Das war die
  Messabfrage, nicht der Importfilter. Dokumentarfilme fehlen sonst.
- **Kein Filmtitel wird jemals aus TheTVDB nachgeladen.** Siehe ADR-002.
