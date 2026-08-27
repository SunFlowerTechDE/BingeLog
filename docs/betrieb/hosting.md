# Hosting: Optionen und Kosten

> Recherchiert am 27.08.2026. Preise vor der Entscheidung noch einmal
> prüfen, sie ändern sich.
>
> Die Kostentabelle in `00-overview.md` führt **keine Hosting-Zeile**.
> Die dort genannten 35 €/Monat setzen stillschweigend voraus, dass das
> Hosting nichts kostet. Das stimmt nur in einem der Fälle unten.

## Die Einschränkung, die alles andere bestimmt

Vercels Hobby-Tarif ist ausdrücklich auf nicht-kommerzielle private
Nutzung beschränkt:

> Hobby teams are restricted to non-commercial personal use only. All
> commercial usage of the platform requires either a Pro or Enterprise
> plan.

Und ausdrücklich: **Spenden zählen als kommerzielle Nutzung.** Das
Supporter-Abo aus M7 fällt eindeutig darunter.

Solange BingeLog kein Geld einnimmt, ist Hobby zulässig. Ab M7 nicht
mehr. Wer dort startet, plant einen Umzug ein.

## Vergleich

| | Grundpreis | pro Monat | Aufwand | kommerziell |
|---|---|---|---|---|
| Vercel Hobby | 0 $ | 0 € | keiner | **nein** |
| Vercel Pro | 20 $ | ca. 19 € | keiner | ja |
| Cloudflare Workers, kostenlos | 0 $ | 0 € | gering | ja |
| Cloudflare Workers, bezahlt | 5 $ | ca. 5 € | gering | ja |
| Hetzner Cloud (Nürnberg) | — | ca. 4 bis 6 € | **hoch** | ja |

Umsatzsteuer nicht enthalten. Für ein Unternehmen mit USt-IdNr. greift
bei US-Anbietern in der Regel das Reverse-Charge-Verfahren.

### Was jeweils enthalten ist

**Vercel Pro:** 20 $ Grundgebühr, darin ein Deploy-Sitzplatz, 20 $
Nutzungsguthaben, 1 TB Datentransfer und 10 Mio. Edge-Requests. Für
diese App weit jenseits des Bedarfs.

**Cloudflare Workers kostenlos:** 100.000 Anfragen pro Tag, 10 ms
CPU-Zeit pro Aufruf. Die CPU-Grenze ist der Haken bei serverseitigem
Rendern.

**Cloudflare Workers bezahlt:** 5 $ Minimum, 10 Mio. Anfragen und 30
Mio. CPU-Millisekunden inklusive, kein Traffic-Preis, bis 5 Minuten
CPU-Zeit pro Aufruf.

**Hetzner:** eigener Server. Rechenzentren in Nürnberg und Falkenstein,
also die kürzeste Strecke zum deutschsprachigen Publikum und zur
Supabase-Instanz in Frankfurt. Deutsches Unternehmen, was die
DSGVO-Betrachtung vereinfacht.

## Auswirkung auf das Budget

| Variante | Fixkosten gesamt |
|---|---|
| Cloudflare kostenlos | ca. 35 € — Roadmap-Ziel gehalten |
| Cloudflare bezahlt | ca. 40 € |
| Hetzner | ca. 40 € |
| Vercel Pro | ca. 54 € — **plus 54 Prozent** |

## Abwägung

**Vercel** ist der erste Weg für Next.js: keine Anpassung, keine
Wartung, Funktionen lassen sich auf Frankfurt festlegen. Der Preis ist,
dass eine einzelne Zeile das Infrastrukturbudget um über die Hälfte
erhöht, bevor ein einziger Nutzer da ist.

**Cloudflare** braucht `@opennextjs/cloudflare`, also einen Adapter
statt des ersten Wegs. Diese App ist einfach gebaut — Server Components,
zwei Route Handler, kein ISR — und sollte passen. Trotzdem ist das die
Variante mit dem größten Integrationsrisiko, und das zeigt sich erst
beim Ausprobieren.

**Hetzner** ist am billigsten und am schnellsten zum Zielpublikum, und
es ist die einzige Variante, bei der Betriebssystem-Updates, Zertifikate,
Deployments, Backups und Überwachung an dir hängen. Bei Teilzeitarbeit
neben einem Hauptjob ist das keine Kleinigkeit, sondern eine
wiederkehrende Verpflichtung.

## Erprobt am 27.08.2026

Der Adapter wurde nicht angenommen, sondern ausprobiert. Die App läuft
lokal auf `workerd`, dem Laufzeitsystem, das Cloudflare auch in Produktion
benutzt:

| Geprüft | Ergebnis |
|---|---|
| Build über `@opennextjs/cloudflare` | läuft durch |
| Startseite und Suche | 200, Treffer aus Supabase korrekt sortiert |
| Filmdetail | Originaltitel kyrillisch, Attribution vorhanden |
| Prozedurale Karte | SVG mit korrekten Cache-Headern |
| Geschützte Route ohne Session | 307 auf `/anmelden?weiter=…` |

Die Middleware, die die Session erneuert, funktioniert also — trotz der
Build-Warnung, dass Node.js-Middleware auf Cloudflare experimentell sei.
Das ist die Stelle, die man im Auge behalten muss, wenn ein Update von
OpenNext oder Next.js ansteht.

### Die Grenze, die zuerst greift, ist nicht der Traffic

| Grenze | Free | Paid | BingeLog heute |
|---|---|---|---|
| Worker-Größe komprimiert | 3 MB | 10 MB | **2,60 MB** |
| Anfragen pro Tag | 100.000 | 10 Mio./Monat | weit darunter |
| CPU-Zeit pro Aufruf | 10 ms | 5 min | Wartezeit zählt nicht mit |

Gemessen mit `wrangler deploy --dry-run`: 11.692 KiB roh, **2.664 KiB
komprimiert**. Das sind 87 Prozent der kostenlosen Grenze, bei einer App
mit fünf Seiten.

**Daraus folgt:** Die kostenlose Stufe trägt den aktuellen Stand, aber
voraussichtlich nicht bis zum Launch. Tagebuch, Facetten, Listen, Feed
und Diskussion kommen noch dazu. Der Wechsel auf 5 $ wird eher durch die
Bundle-Größe ausgelöst als durch Nutzerzahlen — und ist ein Klick im
Dashboard, keine Migration.

## Entscheidung

**Cloudflare Workers**, zunächst die kostenlose Stufe. Getroffen am
27.08.2026, nachdem der Adapter erprobt war.

Begründung: Es hält das Budget der Roadmap, ist von Anfang an kommerziell
zulässig, verursacht keinen Wartungsaufwand, und die App läuft
nachweislich darauf.

**Rückfallposition ist Hetzner**, nicht Vercel — dessen 20 $ verschieben
das Infrastrukturbudget dauerhaft um mehr als die Hälfte, für eine
Leistung, die diese App nicht braucht.

### Was das im Alltag heißt

- `pnpm --filter @binge-log/web cf:build` baut das Worker-Bundle
- `cf:preview` fährt es lokal auf `workerd`
- `cf:deploy` veröffentlicht, sobald ein Cloudflare-Konto besteht
- `bingelog.eu` bleibt bei INWX registriert, die Nameserver zeigen auf
  Cloudflare — das verlangt eine Umstellung bei INWX, sonst kann keine
  eigene Domain auf den Worker zeigen
