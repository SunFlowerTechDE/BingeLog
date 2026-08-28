# Mailversand

Supabase verschickt die Anmelde- und Bestätigungsmails. Ohne eigenen
Versand nimmt es dafür seinen eingebauten Absender — **zwei Mails pro
Stunde für das ganze Projekt**, gedacht zum Ausprobieren und für nichts
sonst. Am 28.08.2026 umgestellt.

## Warum Brevo

Gemessen wurde nicht die Zustellrate, sondern der Zuschnitt: Gebraucht
werden **nur SMTP-Zugangsdaten für Supabase**. Damit fällt der eigentliche
Vorzug von Resend — seine Entwicklerschnittstelle — als Argument weg, und
übrig bleibt, dass Resend US-inkorporiert ist und Standardvertrags-
klauseln braucht. Brevo sitzt in Frankreich, verarbeitet in der EU, und
300 Mails am Tag reichen für Anmeldebestätigungen um Größenordnungen.

## Was in der DNS steht

Sieben Einträge auf `bingelog.eu`, alle bei Cloudflare, alle **DNS only**
(kein Proxy — sonst antwortet Cloudflare mit eigenen Adressen statt mit
Brevos Schlüssel, und die Prüfung scheitert):

| Typ   | Name                | Zweck                         |
| ----- | ------------------- | ----------------------------- |
| TXT   | `@`                 | Brevo-Code, Eigentumsnachweis |
| CNAME | `brevo1._domainkey` | DKIM                          |
| CNAME | `brevo2._domainkey` | DKIM, rotiert                 |
| TXT   | `_dmarc`            | `p=none`, nur Beobachtung     |
| CNAME | `registrierung`     | gebrandete Subdomain          |
| CNAME | `r.registrierung`   | Weiterleitung                 |
| CNAME | `img.registrierung` | Bilder                        |

**Kein SPF-Eintrag.** Brevo prüft den Envelope-Absender auf eigenen
Servern und stellt deshalb keinen bereit. Die meisten Anleitungen im Netz
sind an dieser Stelle veraltet.

Die drei Branding-Einträge sahen zunächst nach Beiwerk aus. Brevo
verweigert die Authentifizierung ohne sie — und sachlich sind sie
richtig, siehe unten.

## Tracking

**Brevo lässt sich das Tracking bei transaktionalen Mails über SMTP nicht
abschalten.** Nur anonymisieren, was eingeschaltet ist: Öffnungen und
Klicks werden gezählt, aber keiner Person zugeordnet.

Daraus folgt: **Der Bestätigungslink wird umgeschrieben, immer.** Die
einzige Wahl ist, wessen Domain dabei erscheint. Mit den Branding-
Einträgen läuft er über `r.registrierung.bingelog.eu` statt über
`brevosend.com` — in einer Anmeldemail keine Kleinigkeit, denn wer den
Link vor dem Klicken prüft, soll den eigenen Namen sehen.

## Zugangsdaten

```
Host      smtp-relay.brevo.com
Port      587
Username  b6f615001@smtp-brevo.com
Absender  registrierung@bingelog.eu ("BingeLog")
```

Der Schlüssel heißt `supabase-auth`, Variante Standard, **ohne
Ablaufdatum**. Er liegt ausschließlich in den Supabase-Projekt-
einstellungen.

**Die 90-Tage-Regel gilt trotzdem:** Brevo lässt SMTP-Schlüssel nach 90
Tagen ohne Nutzung verfallen, unabhängig vom Ablaufdatum. Vor dem Start,
wenn sich niemand registriert, ist das der wahrscheinlichste Weg, wie der
Versand ohne Vorwarnung ausfällt — und die Fehlermeldung wird nicht
darauf hindeuten.

## Nicht einschalten

Brevo bietet unter _SMTP & API_ an, den Versand auf autorisierte
IP-Adressen zu beschränken. Der Kasten klingt nach Sicherheit. Die Mails
verschickt aber Supabase, dessen Absender-IPs weder fest noch
dokumentiert sind. Einschalten legt den Versand lahm.

## Empfang: mailbox.org

Maschinenpost und Menschenpost sind getrennt. **Brevo verschickt die
Anmeldemails, mailbox.org ist das Postfach.** Automatischen Versand
ueber ein persoenliches Postfach zu leiten heisst, dessen Grenzen und
dessen Ruf an die Anmeldung zu binden — und einen Posteingang zu fluten,
sobald etwas schiefgeht.

Cloudflare Email Routing waere kostenlos gewesen, kann aber nur
weiterleiten. Antworten kaemen dann von einer Gmail-Adresse. Fuer ein
Impressum und fuer Post an die FSK ist das das falsche Signal, also ein
echtes Postfach: mailbox.org, 3 EUR/Monat bei Jahreszahlung, Berlin.

| Typ | Name         | Wert                                                    |
| --- | ------------ | ------------------------------------------------------- |
| TXT | `57d57faef…` | Eigentumsnachweis von mailbox.org                       |
| MX  | `@`          | `mxext1.mailbox.org`, Prioritaet 10                     |
| MX  | `@`          | `mxext2.mailbox.org`, Prioritaet 10                     |
| MX  | `@`          | `mxext3.mailbox.org`, Prioritaet 10                     |
| MX  | `@`          | `mxext4.mailbox.org`, Prioritaet 10                     |
| TXT | `@`          | `v=spf1 include:mailbox.org include:spf.brevo.com ~all` |

Vier MX mit **gleicher** Prioritaet: sie sind gleichwertig, Absender
verteilen sich und weichen aus, wenn einer schweigt.

Der SPF-Eintrag ist fuer mailbox.org noetig — wer von
`registrierung@bingelog.eu` schreibt, wird gegen den SPF dieser Domain
geprueft. Fuer Brevo waere er entbehrlich, weil dort der technische
Absender auf Brevos eigener Domain steht; er ist trotzdem aufgenommen,
damit ein Wechsel auf deren Seite den Versand nicht ohne erkennbaren
Grund kippt. `~all` statt `-all`, solange gebaut wird: ein uebersehener
Absender landet dann im Spam statt im Nichts.

**Der CNAME `registrierung.bingelog.eu` (Brevos Links) und die Adresse
`registrierung@bingelog.eu` stoeren sich nicht.** Das eine ist ein
Hostname, das andere ein Postfach; Mail richtet sich nach dem MX der
Domain.

## Nachgeprueft am 28.08.2026

Beide Richtungen, mit echten Mails:

|                              |                                                |
| ---------------------------- | ---------------------------------------------- |
| Anmeldemail von Brevo        | Posteingang, DKIM signiert mit `bingelog.eu`   |
| Bestaetigungslink            | fuehrt auf `/willkommen`, Konto bestaetigt     |
| Empfang an `registrierung@`  | kam im mailbox.org-Postfach an                 |
| Antwort von `registrierung@` | kam bei Gmail im Posteingang an, nicht im Spam |

Unterwegs ist ein Zwischenstand aufgetreten, der wie ein Fehler aussah
und keiner war: **unbezahlte mailbox.org-Testkonten duerfen nicht nach
aussen senden** (`554 5.7.1 Relay access denied`). Empfang lief da
laengst. Wer die Meldung nicht liest, sucht den Fehler in der DNS.

## Was noch fehlt

- **Mailtexte.** Nur „Confirm signup" ist eingetragen. Magic Link und
  Passwort-Zuruecksetzen bleiben absichtlich leer, siehe
  `mailvorlagen.md`.
