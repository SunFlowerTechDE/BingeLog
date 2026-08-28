# Domain und Mailversand

> Stand 26.08.2026. `bingelog.eu` ist bei INWX registriert.
> Betrifft M3 3.1 (Bestätigungsmails) und M6 (Launch).

## Stand

| Schritt                              | Stand                                               |
| ------------------------------------ | --------------------------------------------------- |
| Domain bei INWX registriert          | erledigt, 26.08.2026                                |
| Cloudflare-Konto, Zone `bingelog.eu` | erledigt, 27.08.2026                                |
| Nameserver bei INWX auf Cloudflare   | erledigt — `felicity` / `jocelyn.ns.cloudflare.com` |
| TLS-Zertifikat                       | stellt Cloudflare selbst aus                        |
| Worker deployen                      | offen, wenn M3 steht                                |
| SMTP-Versand                         | offen                                               |
| `site_url` auf die Domain            | offen, **erst nach dem Deployment**                 |

DNS liegt jetzt bei Cloudflare. Neue Einträge — MX, SPF, DKIM, DMARC für
den Mailversand — kommen dorthin, nicht mehr zu INWX. INWX bleibt die
Stelle, an der die Domain registriert ist und verlängert wird.

Es gibt keine MX-Einträge und kein DNSSEC. Beim Wechsel ging also nichts
verloren, und der eine Fehler, der eine Domain unerreichbar macht — eine
Signatur ohne passenden Schlüssel — konnte nicht auftreten.

## Reihenfolge

Die Schritte hängen voneinander ab. In dieser Reihenfolge, sonst brechen
Bestätigungslinks:

1. Mailversand einrichten (unabhängig vom Deployment)
2. App deployen, Domain darauf zeigen lassen
3. **Erst danach** `site_url` in Supabase umstellen

Grund für Schritt 3 zuletzt: `site_url` bestimmt, wohin die Links in den
Bestätigungsmails zeigen. Steht dort `bingelog.eu`, bevor dort etwas
läuft, geht jede Registrierung ins Leere — auch die lokale.

---

## 1. Mailversand

### Warum nicht der eingebaute Versand

Supabase' eigener Mailer ist auf **2 Mails pro Stunde** begrenzt und
ausdrücklich nur zum Entwickeln gedacht. Gemessen im Projekt:
`rate_limit_email_sent = 2`.

### Absenderadresse

`no-reply@bingelog.eu`. Keine Adresse, die jemand liest — Antworten auf
Bestätigungsmails sind kein Kanal, den es gibt.

### DNS bei INWX

Drei Einträge, damit die Mails nicht im Spam landen. Die konkreten Werte
liefert der SMTP-Anbieter; die Form ist immer dieselbe:

| Typ | Name                    | Wert                                                   |
| --- | ----------------------- | ------------------------------------------------------ |
| TXT | `@`                     | `v=spf1 include:<anbieter> ~all`                       |
| TXT | `<selector>._domainkey` | vom Anbieter erzeugter DKIM-Schlüssel                  |
| TXT | `_dmarc`                | `v=DMARC1; p=quarantine; rua=mailto:dmarc@bingelog.eu` |

**SPF nur einmal.** Ein zweiter `v=spf1`-Eintrag auf derselben Domain
macht beide ungültig. Kommt später ein weiterer Versender dazu, wird er
in denselben Eintrag aufgenommen.

**DMARC zunächst auf `p=none`**, wenn du sehen willst, was passiert,
bevor du ablehnst. Auf `quarantine` erhöhen, sobald die Berichte sauber
sind.

### In Supabase eintragen

Authentication → Emails → SMTP Settings: Host, Port, Nutzer, Passwort,
Absenderadresse und Absendername (`BingeLog`).

---

## 2. Vorlagen auf Deutsch

Die Standardvorlagen sind englisch. Die App ist durchgehend deutsch und
geduzt (02-product.md), also die Vorlagen auch. Text siehe
`docs/betrieb/mailvorlagen.md`.

---

## 3. Nach dem Deployment

Authentication → URL Configuration:

- **Site URL:** `https://bingelog.eu`
- **Redirect URLs:** beide Umgebungen, sonst funktioniert entweder die
  lokale Entwicklung nicht mehr oder die Produktion:
  ```
  http://localhost:3000/auth/bestaetigen
  https://bingelog.eu/auth/bestaetigen
  https://www.bingelog.eu/auth/bestaetigen
  ```

Die App leitet den Rückweg selbst aus dem Request ab (`signUp` in
`apps/web/src/lib/auth-actions.ts`), damit lokal, Vorschau und Produktion
ohne Umkonfiguration funktionieren. Die Allow-List muss die Ziele
trotzdem kennen.

---

## Offen, unabhängig von der Technik

**Markenprüfung.** `02-product.md` nennt sie vor der Markenanmeldung und
vor der Reservierung in den App Stores: DPMA- und EUIPO-Register auf
"BingeLog" und Ähnliches. Die Domain ist einer von drei Punkten, die
anderen beiden stehen noch aus.

**Impressumspflicht.** Ein geschäftsmäßiges Angebot aus Deutschland
braucht ein Impressum nach §5 DDG, und die Attributionspflicht von
TheTVDB gehört dorthin (M6).
