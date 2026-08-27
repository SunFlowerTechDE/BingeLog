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

## Empfehlung

**Cloudflare Workers**, zunächst kostenlos, bei Bedarf 5 $. Es hält das
Budget der Roadmap, ist von Anfang an kommerziell zulässig und
verursacht keinen Wartungsaufwand.

Der Adapter ist vor der Entscheidung an einem Deployment zu erproben.
Zeigt sich dort ein Problem, ist **Hetzner** die Rückfallposition — nicht
Vercel, weil dessen Preis das Budget dauerhaft verschiebt.

**Was jetzt zu tun ist: nichts.** Die Entscheidung wird gebraucht, wenn
M3 steht. Am Code ändert sie nichts, und keine der Varianten verlangt
eine Festlegung im Voraus.
