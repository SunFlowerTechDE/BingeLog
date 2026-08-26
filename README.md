# BingeLog

Filmtagebuch- und Bewertungsplattform für den deutschsprachigen Raum.

Roadmap und Architekturentscheidungen: [`docs/roadmap/00-overview.md`](docs/roadmap/00-overview.md).
Arbeitsregeln für dieses Repo: [`CLAUDE.md`](CLAUDE.md).

## Aufbau

| Pfad                | Inhalt                                            |
| ------------------- | ------------------------------------------------- |
| `apps/web`          | Next.js 16, TypeScript strict, Tailwind           |
| `apps/ios`          | Xcode-Projekt, SwiftUI (ab M5)                    |
| `packages/db`       | Supabase-Migrationen, RLS-Tests, generierte Typen |
| `packages/pipeline` | Wikidata-Import und TheTVDB-Batch, offline        |
| `docs/roadmap`      | Meilensteine M0 bis M9                            |

## Einrichten

Voraussetzungen: Node 22.12 oder neuer, pnpm 10, Supabase CLI, Xcode 26.

```bash
corepack enable
pnpm install
```

Danach ein Supabase-Projekt in der EU-Region (Frankfurt) anlegen und
verknüpfen:

```bash
cp packages/db/.env.example packages/db/.env   # ausfüllen
cp apps/web/.env.example apps/web/.env.local   # ausfüllen
pnpm --filter @binge-log/db link
pnpm --filter @binge-log/db push
pnpm db:types
```

## Testen

Es gibt zwei Ebenen, und beide prüfen dasselbe Versprechen: das
Spoiler-Gate hält in der Datenbank, nicht in der Oberfläche.

**Schema-Tests, ohne Supabase-Projekt.** Startet ein eigenes Postgres im
Nutzerkontext, legt die Supabase-Rollen und `auth.uid()` nach, spielt alle
Migrationen ein und prüft die Policies per `SET ROLE` — genau der Weg, den
PostgREST nimmt. Kein Docker, keine Zugangsdaten.

```bash
pnpm test
```

**REST-Tests, gegen das echte Projekt.** Dieselben Zusicherungen, aber
über PostgREST und Supabase Auth. Braucht `packages/db/.env`.

```bash
pnpm test:rls
```

Dazu die Schema-Prüfungen der Definition of Done gegen das verknüpfte
Projekt:

```bash
pnpm db:verify
```

Die Schema-Tests weichen bewusst an zwei Stellen von der Produktion ab:
Postgres 18 statt 15/17, und `pg_cron` fehlt, weshalb der Refresh der
Facetten-Sicht dort nicht eingeplant wird. Beides fängt `db:verify` auf
dem echten Projekt ab.

## Zwei Regeln, die alles andere überstimmen

1. Sicherheitsregeln werden in der Datenbank durchgesetzt, nie im Client.
2. Metadaten kommen aus Wikidata, Bilder aus TheTVDB, verknüpft
   ausschließlich über die IMDb-ID.
