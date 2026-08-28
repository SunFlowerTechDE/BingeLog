# M4: Tagebuch und Social

**Ziel:** Aus einer Bewertungsdatenbank wird ein Filmtagebuch mit
Community. Das ist der Teil, der Nutzer hält.

**Vorbedingung:** M3 abgeschlossen.

**Aufwand:** 2 bis 3 Wochen.

---

## Aufgaben

### 4.1 Tagebuchansicht

- [ ] Chronologische Liste eigener Einträge, nach `watched_on` absteigend
- [ ] Gruppierung nach Monat
- [ ] Filter: Jahr, Bewertung, nur Rewatches, nur mit Review
- [ ] Kalenderansicht als Alternative (optional, nach hinten stellbar)

### 4.2 Profile

- [x] Öffentliche Profilseite unter `/@username`
- [x] Zuletzt gesehen, Lieblingsfilme (4 Slots, wie bei Letterboxd
      etabliert), Statistiken
- [x] Statistiken: Filme pro Jahr, Bewertungsverteilung, häufigste
      Regisseure, häufigste Jahrzehnte
- [x] Statistiken serverseitig berechnen, nicht pro Seitenaufruf im
      Client aggregieren. **Ohne Cache, mit Messung:** bei 3000
      Einträgen brauchen alle sechs Auswertungen zusammen unter 25 ms,
      die Leitung nach Frankfurt allein rund 14. Zwei Abfragen waren
      vorher aufgebläht (Regie 38 ms, Genres 16 ms) — erst je Film
      verdichten statt je Eintrag verbinden brachte beide unter 4 ms.
      Ein Cache käme, wenn die Summe in den Bereich der Leitung wächst,
      und dann als materialisierte Sicht wie bei den Facetten.

### 4.3 Listen

- [x] Nutzer legen benannte Filmlisten an, mit Beschreibung
- [x] Sortierbar, öffentlich oder privat
- [x] Neue Tabellen:

```sql
create table lists (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles(id) on delete cascade,
  title       text not null,
  description text,
  is_public   boolean not null default true,
  created_at  timestamptz not null default now()
);

create table list_items (
  list_id uuid references lists(id) on delete cascade,
  film_id text references films(wikidata_id) on delete cascade,
  ord     integer not null,
  note    text,
  primary key (list_id, film_id)
);
```

- [x] RLS entsprechend: öffentliche Listen für alle lesbar, private nur
      für den Besitzer

### 4.4 Folgen und Feed

- [x] `follows`-Tabelle (follower_id, following_id)
- [x] Feed: Einträge der gefolgten Nutzer, chronologisch — auf der
      Entdecken-Seite, die für Angemeldete die Startseite ist
- [x] **Kein algorithmischer Feed.** Chronologisch, vollständig,
      nachvollziehbar. Das ist ein Produktversprechen, kein
      Implementierungsdetail.
- [x] Paginierung per Cursor, nicht per Offset — auf `(created_at, id)`

### 4.5 Filmdiskussion (spoilergeschützt)

Siehe ADR-010 und ADR-011. Das Schema und die RLS-Policies stehen bereits
aus M0. Hier kommt die Oberfläche dazu.

#### Sichtbarkeitslogik

Drei Zustände auf der Filmdetailseite:

| Zustand                  | Anzeige                                                                                                                                         |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Nicht bewertet           | Hinweisfläche: "Diskussion sichtbar, sobald du den Film bewertet hast." Plus Anzahl der Beiträge. **Kein Inhalt, keine Vorschau, keine Namen.** |
| Bewertet, Thread inaktiv | "Noch keine Diskussion zu diesem Film. Sei die erste Person."                                                                                   |
| Bewertet, Thread aktiv   | Vollständiger Thread                                                                                                                            |

- [ ] Die Beitragszahl darf angezeigt werden, sie verrät nichts
- [ ] **Keine Vorschautexte, keine Autorennamen, keine Zeitstempel** im
      gesperrten Zustand
- [ ] Ehrliche Formulierung. Nicht "spoilerfrei garantiert", sondern
      "sichtbar nach deiner Bewertung". Das Gate ist absichtlich
      umgehbar, siehe ADR-010.

#### Thread-UI

- [ ] Beiträge chronologisch, älteste zuerst
- [ ] Eine Antwortebene (`parent_id`), keine tiefere Verschachtelung
- [ ] Bearbeiten mit sichtbarer "bearbeitet"-Markierung
- [ ] Löschen setzt `is_removed`, entfernt die Zeile nicht (Moderationsspur)
- [ ] Markdown minimal: fett, kursiv, Zeilenumbrüche. **Keine Bilder,
      keine Links** in Version 1, das reduziert Spam erheblich.
- [ ] Live-Aktualisierung eines geöffneten Threads über Supabase Realtime
      ist erlaubt und sinnvoll. Das Datenmodell bleibt asynchron.

#### Spoiler-Markierung innerhalb der Diskussion

Auch unter Leuten, die den Film gesehen haben, gibt es Spoiler für
**andere** Filme (Fortsetzungen, Vergleiche).

- [ ] Spoiler-Tag im Editor, rendert als verdeckter Block zum Aufdecken
- [ ] Syntax analog zu gängigen Foren, etwa `||Text||`

#### Moderation (Pflicht)

- [ ] Melden pro Beitrag, mit Grund
- [ ] Nutzer blockieren: blockierte Beiträge werden ausgeblendet
- [ ] Thread sperren (`is_locked`) durch Admin
- [ ] Rate Limiting serverseitig, maximal 10 Beiträge pro Stunde
- [ ] Wortfilter für offensichtlich Verbotenes, bewusst schmal halten

Ohne diese vier Punkte ist die App nicht App-Store-fähig und
DSA-rechtlich angreifbar. Siehe M6.

#### Aktivierungsschwelle

- [ ] `film_threads.is_active` wird gesetzt, sobald 5 Nutzer den Film
      eingetragen haben
- [ ] Trigger auf `diary_entries` pflegt `viewer_count`
- [ ] Der Schwellenwert liegt in einer Konfigurationstabelle, nicht im
      Code. Er wird sich mit wachsender Nutzerzahl ändern.

### 4.6 Interaktion

- [ ] Reviews mit "Gefällt mir" markieren
- [ ] Kommentare auf Reviews (optional, erhöht den Moderationsaufwand
      erheblich, kann bewusst weggelassen werden)
- [ ] Melde-Funktion für Reviews. **Pflicht**, sobald nutzergenerierte
      Inhalte öffentlich sind, siehe M6.

### 4.7 Moderation

- [ ] Admin-Ansicht für gemeldete Inhalte
- [ ] Nutzer sperren, Inhalte entfernen
- [ ] Protokollierung der Moderationsentscheidungen

Das ist kein Nice-to-have. Ohne Melde- und Moderationsweg ist die App
nicht App-Store-fähig und rechtlich angreifbar.

---

## Definition of Done

- [ ] Ein Nutzer kann einem anderen folgen und sieht dessen Einträge
- [ ] Profilstatistiken sind korrekt und laden unter 300 ms
- [ ] Private Listen und private Einträge sind nachweislich nicht über
      die API abrufbar
- [ ] Meldeweg funktioniert und landet in der Admin-Ansicht
- [ ] **Spoiler-Gate hält gegen direkten API-Zugriff.** Automatisierter
      Test: authentifizierter Nutzer ohne Eintrag ruft
      `thread_messages` zu einem Film mit Beiträgen ab, bekommt null
      Zeilen. Dieser Test läuft in CI.
- [ ] Ein Thread aktiviert sich korrekt beim fünften Eintrag
- [ ] Blockierte Nutzer sind im Thread nicht sichtbar

## Fallstricke

- **Statistiken nicht live aggregieren.** Bei 500 Einträgen pro Nutzer
  wird das langsam, und es trifft genau die aktivsten Nutzer.
- **Follows nicht ohne Cursor paginieren.** Offset-Paginierung bricht,
  sobald neue Einträge oben dazukommen.
- **Moderation nicht auf später schieben.** Siehe M6.
- **Das Spoiler-Gate niemals in der UI durchsetzen.** Eine ausgeblendete
  Komponente ist kein Schutz. Die Policy gehört in die Datenbank, und der
  CI-Test dazu ist nicht verhandelbar.
- **Keine Thread-Vorschau im gesperrten Zustand.** Auch nicht die ersten
  20 Zeichen, auch nicht ausgegraut. Das erste Wort eines Beitrags kann
  die Auflösung sein.
- **Chat nicht für alle 350.000 Filme aktivieren.** Leere Räume schaden
  mehr, als sie nutzen.
