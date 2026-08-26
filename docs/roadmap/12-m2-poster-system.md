# M2: Poster-System

**Ziel:** Jeder Film im Katalog hat eine darstellbare Kachel. Ohne
Ausnahme, ohne Platzhalter-Grauflächen.

**Vorbedingung:** M1 abgeschlossen.

**Aufwand:** 3 bis 4 Tage.

---

## Reihenfolge ist zwingend

**2.1 (prozedurale Karte) wird vollständig fertiggestellt, bevor 2.2
(TheTVDB) begonnen wird.**

Grund: Wenn die UI zuerst gegen echte Plakate gebaut wird, entstehen
implizite Annahmen über Bildinhalte, Kontraste und Lesbarkeit, die die
generierte Karte später nicht erfüllen kann. Der Fallback wird dann zum
sichtbaren Notbehelf statt zum gleichwertigen Zustand.

---

## 2.1 Prozedurale Karte

**Eingabe:** `title_de` oder `title_original`, `release_year`, Regie,
`wikidata_id` als Seed.

**Ausgabe:** SVG im Seitenverhältnis 2:3, serverseitig gerendert,
cachebar.

### Anforderungen

- [ ] **Deterministisch.** Gleiche `wikidata_id` ergibt immer dieselbe
      Karte. Kein Zufall zur Laufzeit, kein Zeitstempel im Seed.
- [ ] **Farbpalette aus dem Seed abgeleitet.** Definierte Palette von 8
      bis 12 Farbpaaren, Auswahl per Hash. Keine zufälligen HSL-Werte,
      sonst entstehen unschöne Kombinationen.
- [ ] **Typografie trägt das Layout.** Der Titel ist das Bild, nicht eine
      Beschriftung auf einem Muster.
- [ ] **Lange Titel funktionieren.** Automatische Schriftgrößenanpassung,
      Umbruch an Wortgrenzen. Testfall: "Jeder für sich und Gott gegen
      alle" und "Orgullo, Pasión, y Gloria: Tres Noches en la Ciudad de
      México".
- [ ] **Nicht-lateinische Schriften funktionieren.** Testfall: "万引き家族",
      "Соляρис".
- [ ] **Lesbar bei 120 px Breite.** Das ist die reale Rastergröße. Bei
      dieser Größe zählt Kontrast, nicht Detail.
- [ ] Optionales generatives Muster mit demselben Seed, dezent, nie
      über dem Text.

### Nicht tun

- Keine Emojis, keine Icons, keine Genre-Symbole
- Kein "Kein Bild verfügbar"-Text
- Keine Stock-Bilder als Hintergrund

### Umsetzung

- [ ] Als reine Funktion `renderPosterSVG(film): string` in
      `/packages` implementieren, damit Web und Pipeline sie teilen
- [ ] Serverseitig als SVG ausliefern, `Cache-Control: immutable`
- [ ] Für iOS: entweder SVG vom Server oder native Nachimplementierung
      in SwiftUI. Entscheidung in M5, die Farb- und Layoutregeln müssen
      identisch sein.

---

## 2.2 TheTVDB-Layer

**Vorbedingung:** v4-API-Key liegt vor. Beantragung siehe unten,
startet parallel zu M1.

### Key beantragen

- [ ] Account auf thetvdb.com anlegen
- [ ] Dashboard -> API Keys -> Create a v4 API Key
- [ ] **Negotiated Contract** wählen, nicht End-User Subscriptions
- [ ] Umsatzstufe: unter 50.000 USD (kostenlos, Attributionspflicht)
- [ ] Projektbeschreibung ehrlich: Filmtagebuch-App, Metadaten aus
      Wikidata, TheTVDB ausschließlich für Artwork
- [ ] Manuelle Prüfung, kann dauern. Blockiert nichts.

### Batch-Job

- [ ] Läuft in `/packages/pipeline`, nicht im Web-Deployment
- [ ] Iteriert über `films where imdb_id is not null`, absteigend nach
      `sitelink_count` (relevante Filme zuerst)
- [ ] Ruft `GET /search/remoteid/{imdb_id}` auf
- [ ] Bei Treffer: `tvdb_id`, `poster_url` und
      `poster_source = 'tvdb'` setzen
- [ ] Bei keinem Treffer: `poster_source = 'generated'` setzen. **Kein
      zweiter Versuch über den Titel.**
- [ ] Rate-Limit respektieren, Wiederaufnahme nach Abbruch möglich
- [ ] JWT-Token-Refresh implementieren (Bearer-Auth, Token läuft ab)

### Vor dem Caching klären

- [ ] **Caching-Klausel in den TheTVDB-Lizenzbedingungen lesen**, bevor
      Bilder lokal gespeichert werden. TMDB verlangt Löschung bei
      Lizenzende, TheTVDB formuliert das anders. Das Ergebnis dieser
      Prüfung hier dokumentieren.
- [ ] Attribution im Impressum und auf Filmdetailseiten umsetzen

### Sprachvarianten

Die Website zeigt nur das Primary Artwork, die API liefert unter
`artworks` alle Varianten mit `language`-Feld.

**Entscheidung: keine Sprachfilterung.** Das Plakat wird bei 120 px
gerendert, dort ist der Schriftzug ein Farbfleck. Erkennung läuft über
Komposition und Farbe. Primary Artwork nehmen, fertig.

---

## Definition of Done

- [ ] `select count(*) from films where poster_source is null` ergibt 0
- [ ] Alle 20 Testfilme aus `01-decisions.md` haben ein TheTVDB-Plakat
- [ ] Die generierte Karte ist für die genannten Testfälle geprüft
      (lange Titel, CJK, Kyrillisch)
- [ ] Ein Raster aus 50 zufälligen Filmen sieht bei 120 px Breite
      einheitlich aus, generierte und echte Plakate nebeneinander
- [ ] Attributionspflicht ist umgesetzt

## Fallstricke

- **Keine Titelsuche als Fallback.** Siehe ADR-003. Die Versuchung ist
  groß, weil sie ein paar Prozent Abdeckung bringt. Der Preis sind
  Fehlverknüpfungen, die niemand entdeckt.
- **Nicht die Synopsis von TheTVDB übernehmen.** Siehe ADR-002.
- **Nicht 200 GB Bilder lokal ablegen**, bevor die Lizenzfrage geklärt
  ist.
