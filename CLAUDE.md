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

- Code, Bezeichner, Kommentare, Commits: **Englisch**
- UI-Texte: **Deutsch**, geduzt, knapp, keine Ausrufezeichen
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

- `pnpm test` — lokales Postgres, alle Migrationen, Policies: 108 Tests
- `pnpm test:rls` — dieselben Zusicherungen über PostgREST: 33 Tests
- `pnpm db:verify` — 9 Schemaprüfungen gegen das Projekt

Das Spoiler-Gate ist auf beiden Wegen belegt.

M2 ist ebenfalls durch. Die prozedurale Karte steht, der TheTVDB-Key
liegt vor, und der Artwork-Batch läuft. Die Lizenzprüfung steht in
`docs/legal/thetvdb-lizenz.md` — Kurzfassung: **Bilder werden verlinkt,
nie gespiegelt.**

Der Katalog enthält 59 Filme — die meistverlinkten plus die Filme, die
die Such-Testfälle brauchen, samt ihrer Beinahe-Treffer. Der Volldump
(M1 1.1) ist bewusst zurückgestellt; die Messungen dazu stehen in
`docs/roadmap/11-m1-datenpipeline.md`.

Laufend ist M3. Die Suche (3.2) steht: das Ranking ist eine
Postgres-Funktion, die fünf Pflicht-Testfälle sind grün und laufen gegen
lokales Postgres, also ohne Projekt.

Wenn du eine Policy oder einen Trigger anfasst, gehört ein Test in
`packages/db/tests/schema/rls.test.ts` dazu. Eine Policy ohne Test ist
eine Behauptung.
