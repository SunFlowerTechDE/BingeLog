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

|                               | Grundpreis | pro Monat     | Aufwand  | kommerziell |
| ----------------------------- | ---------- | ------------- | -------- | ----------- |
| Vercel Hobby                  | 0 $        | 0 €           | keiner   | **nein**    |
| Vercel Pro                    | 20 $       | ca. 19 €      | keiner   | ja          |
| Cloudflare Workers, kostenlos | 0 $        | 0 €           | gering   | ja          |
| Cloudflare Workers, bezahlt   | 5 $        | ca. 5 €       | gering   | ja          |
| Hetzner Cloud (Nürnberg)      | —          | ca. 4 bis 6 € | **hoch** | ja          |

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

| Variante             | Fixkosten gesamt                 |
| -------------------- | -------------------------------- |
| Cloudflare kostenlos | ca. 35 € — Roadmap-Ziel gehalten |
| Cloudflare bezahlt   | ca. 40 €                         |
| Hetzner              | ca. 40 €                         |
| Vercel Pro           | ca. 54 € — **plus 54 Prozent**   |

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

| Geprüft                             | Ergebnis                                        |
| ----------------------------------- | ----------------------------------------------- |
| Build über `@opennextjs/cloudflare` | läuft durch                                     |
| Startseite und Suche                | 200, Treffer aus Supabase korrekt sortiert      |
| Filmdetail                          | Originaltitel kyrillisch, Attribution vorhanden |
| Prozedurale Karte                   | SVG mit korrekten Cache-Headern                 |
| Geschützte Route ohne Session       | 307 auf `/anmelden?weiter=…`                    |

Die Middleware, die die Session erneuert, funktioniert also — trotz der
Build-Warnung, dass Node.js-Middleware auf Cloudflare experimentell sei.
Das ist die Stelle, die man im Auge behalten muss, wenn ein Update von
OpenNext oder Next.js ansteht.

### Die Grenze, die zuerst greift, ist nicht der Traffic

| Grenze                   | Free    | Paid          | BingeLog heute            |
| ------------------------ | ------- | ------------- | ------------------------- |
| Worker-Größe komprimiert | 3 MB    | 10 MB         | **2,60 MB**               |
| Anfragen pro Tag         | 100.000 | 10 Mio./Monat | weit darunter             |
| CPU-Zeit pro Aufruf      | 10 ms   | 5 min         | Wartezeit zählt nicht mit |

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

### Die eigene Domain auf den Worker legen

`bingelog.eu` antwortete am 27.08.2026 mit **521 — Web server is down**.
Die Nameserver zeigten längst auf Cloudflare, aber der Worker war nirgends
daran gebunden: Cloudflare nahm die Anfrage an und suchte danach einen
Ursprungsserver, den es nicht gibt. Der Fehler sagt „Server down", die
Ursache ist eine fehlende Zuordnung.

Die Bindung heißt bei Wrangler `routes` mit `custom_domain: true`.
Cloudflare legt die DNS-Einträge dann selbst an — und verweigert das,
solange schon eigene Einträge für den Namen bestehen:

```
Hostname 'bingelog.eu' already has externally managed DNS records
```

Also erst im Cloudflare-Dashboard unter **DNS → Records** die A-Einträge
für `bingelog.eu` und `www` löschen, dann `cf:deploy` mit dem
`routes`-Block. Vorher nicht — der Deploy bricht sonst nach dem Hochladen
ab, und was schon umgestellt wurde, bleibt umgestellt.

Erledigt am 28.08.2026: die drei A-Eintraege standen noch auf
`185.181.104.242`, der geparkten Adresse aus der INWX-Zeit. Nach dem
Loeschen legte Cloudflare beim naechsten `cf:deploy` die eigenen
Eintraege an, und beide Namen antworten mit der App.

**Fallstrick:** Sobald `routes` in der Wrangler-Datei steht, schaltet
Wrangler die `workers.dev`-Adresse standardmäßig ab. Genau das ist beim
ersten Versuch passiert — die Seite war unter
`bingelog-web.binge-log-web.workers.dev` schlagartig ein 404. Deshalb
steht `"workers_dev": true` ausdrücklich in der Datei.

Ein zweiter, harmloser: unmittelbar nach dem Loeschen meldet der eigene
Rechner die Namen noch als nicht aufloesbar, weil er sich das negative
Ergebnis gemerkt hat. `dig` sieht sie laengst, `curl` noch nicht. Kein
Grund, an der Umstellung zu zweifeln.

## Teststand und Hauptseite

Seit dem 28.08.2026 sind es **zwei Worker**, nicht einer mit zwei
Adressen. Vorher hing beides am selben Worker, und jeder Deploy ging
gleichzeitig auf die Arbeitsadresse und auf die Hauptseite.

|            | Worker              | Adresse                                  |
| ---------- | ------------------- | ---------------------------------------- |
| Teststand  | `bingelog-web`      | `bingelog-web.binge-log-web.workers.dev` |
| Hauptseite | `bingelog-web-prod` | `bingelog.eu`, `www.bingelog.eu`         |

```
pnpm --filter @binge-log/web cf:build         # einmal bauen
pnpm --filter @binge-log/web cf:deploy        # auf den Teststand
pnpm --filter @binge-log/web cf:deploy:prod   # auf die Hauptseite
```

Der Standardbefehl trifft den Teststand. Die Hauptseite verlangt den
ausdruecklichen Griff zu `cf:deploy:prod`. Wer sich vertippt oder das
Ziel vergisst, veroeffentlicht auf dem Teststand — nicht umgekehrt.

Dass der unbenannte Worker der Teststand ist und die Hauptseite den
Zusatz `-prod` traegt, ist bewusst so herum: `workers.dev` leitet die
Adresse aus dem Worker-Namen ab, und `bingelog-web.binge-log-web.
workers.dev` ist die eingespielte Arbeitsadresse.

Nachgeprueft, nicht angenommen: mit einer Markierung im Suchfeld
veroeffentlicht, danach stand sie auf dem Teststand und nicht auf der
Hauptseite.

**Beide Worker sprechen mit derselben Supabase-Datenbank.** Ein Test auf
dem Teststand schreibt in dieselben Tabellen, aus denen die Hauptseite
liest. Getrennt sind die Staende des Codes, nicht die Daten. Wer das
auch trennen will, braucht ein zweites Supabase-Projekt.

`vars` werden von Umgebungen **nicht geerbt**. Sie stehen deshalb zweimal
in der Wrangler-Datei. Fehlen sie in der Umgebung, startet der Worker und
faellt erst beim ersten Zugriff auf Supabase um.
