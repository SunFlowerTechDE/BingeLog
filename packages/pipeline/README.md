# @binge-log/pipeline

Offline import jobs. Never deployed with an app, never bundled into the
web build.

- `src/wikidata/` — dump filtering and catalog import (M1)
- `src/tvdb/` — artwork batch over `/search/remoteid/{imdb_id}` (M2)
- `data/` — dumps and intermediate files, gitignored

Metadata comes exclusively from Wikidata (ADR-001). TheTVDB contributes
images and nothing else (ADR-002), matched only by IMDb ID (ADR-003).
