# Mailvorlagen

> Zum Einfügen in Supabase unter Authentication → Emails.
> Deutsch, geduzt, knapp, keine Ausrufezeichen (02-product.md).

## Warum nicht `{{ .ConfirmationURL }}`

Der naheliegende Platzhalter ist der falsche. Er zeigt auf Supabases
eigenen Pruefpunkt: der bestaetigt die Adresse, erzeugt eine Sitzung im
URL-Fragment und leitet dann zur App weiter — **ohne Token**. Ein Server
kann ein URL-Fragment nicht lesen, und unsere Route unter
`/auth/bestaetigen` findet nichts vor, was sie pruefen koennte.

Nachgemessen am 28.08.2026: `email_confirmed_at` wurde gesetzt, eine
Sitzung entstand, und der Nutzer sah trotzdem „Der Bestaetigungslink ist
abgelaufen oder schon benutzt". Die Bestaetigung hatte funktioniert, nur
die Rueckmeldung war falsch — die schlechteste Sorte Fehler, weil beide
Seiten glaubwuerdig aussehen.

Richtig ist `{{ .TokenHash }}`: der Link zeigt dann direkt auf unsere
Route, die den Token selbst einloest und die Sitzung serverseitig setzt.

`{{ .SiteURL }}` ist die Site URL aus _Authentication → URL
Configuration_. Steht sie falsch, zeigen alle Links ins Leere.

---

## Confirm signup

**Betreff:** `Bestätige deine Adresse`

Tabellen statt Flexbox, Stile inline statt in einem `<style>`-Block, und
Farben als Hex statt als `oklch`: Mailprogramme sind keine Browser.
Outlook kennt kein Flexbox, Gmail wirft `<style>` aus der Nachricht, und
`oklch` versteht keines von beiden. Die Werte sind aus `globals.css`
umgerechnet, nicht geschätzt.

| Rolle         | Token                        | Hex       |
| ------------- | ---------------------------- | --------- |
| Hintergrund   | `--color-background`         | `#0c0d10` |
| Karte         | `--color-card`               | `#14161a` |
| Rand          | `--color-border`             | `#2b2e33` |
| Text          | `--color-foreground`         | `#edeef1` |
| Text gedämpft | `--color-muted-foreground`   | `#95989f` |
| Knopf         | `--color-primary`            | `#efbc4b` |
| Knopfschrift  | `--color-primary-foreground` | `#161107` |

Ändern sich die Tokens, ändert sich die Mail nicht mit. Das ist der Preis
dafür, dass sie in Outlook 2016 aussieht wie gedacht.

```html
<table
  role="presentation"
  width="100%"
  cellpadding="0"
  cellspacing="0"
  border="0"
  style="background-color:#0c0d10;margin:0;padding:32px 12px;"
>
  <tr>
    <td align="center">
      <table
        role="presentation"
        width="600"
        cellpadding="0"
        cellspacing="0"
        border="0"
        style="width:100%;max-width:600px;"
      >
        <tr>
          <td
            style="padding:0 0 24px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:20px;font-weight:700;letter-spacing:-0.01em;color:#efbc4b;"
          >
            BingeLog
          </td>
        </tr>

        <tr>
          <td
            style="background-color:#14161a;border:1px solid #2b2e33;border-radius:8px;padding:32px;"
          >
            <p
              style="margin:0 0 20px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:22px;font-weight:600;letter-spacing:-0.01em;line-height:1.3;color:#edeef1;"
            >
              Bestätige deine Adresse
            </p>

            <p
              style="margin:0 0 12px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#95989f;"
            >
              Du hast ein Konto bei BingeLog angelegt. Ein Klick, dann kann es losgehen.
            </p>

            <table
              role="presentation"
              cellpadding="0"
              cellspacing="0"
              border="0"
              style="margin:28px 0;"
            >
              <tr>
                <td align="center" bgcolor="#efbc4b" style="border-radius:6px;">
                  <a
                    href="{{ .SiteURL }}/auth/bestaetigen?token_hash={{ .TokenHash }}&type=signup"
                    style="display:inline-block;padding:13px 28px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;font-weight:600;color:#161107;text-decoration:none;border-radius:6px;"
                  >
                    Adresse bestätigen
                  </a>
                </td>
              </tr>
            </table>

            <p
              style="margin:0 0 4px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:13px;line-height:1.6;color:#95989f;"
            >
              Der Link gilt 24 Stunden.
            </p>

            <p
              style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:13px;line-height:1.6;color:#95989f;"
            >
              Warst du das nicht, ignorier diese Mail. Ohne Bestätigung passiert nichts.
            </p>
          </td>
        </tr>

        <tr>
          <td
            style="padding:20px 4px 0 4px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:12px;line-height:1.6;color:#6f7279;"
          >
            Filmtagebuch für den deutschsprachigen Raum · bingelog.eu
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
```

---

## Magic Link

> **Nicht in Supabase eintragen.** Dieser Weg ist in der App nicht
> gebaut: es gibt weder einen Knopf, der ihn ausloest, noch eine Route,
> die den Token einloest. Die Vorlage steht hier als Entwurf.

**Betreff:** `Dein Anmeldelink`

```html
<p>Klick auf den folgenden Link, um dich anzumelden:</p>

<p><a href="{{ .ConfirmationURL }}">Anmelden</a></p>

<p>Der Link gilt eine Stunde und funktioniert einmal.</p>

<p>Hast du ihn nicht angefordert, ignorier diese Mail.</p>
```

---

## Change email address

**Betreff:** `Bestätige deine neue Adresse`

```html
<p>Du willst die Adresse deines BingeLog-Kontos ändern.</p>

<p>Klick auf den folgenden Link, um <strong>{{ .NewEmail }}</strong> zu bestätigen:</p>

<p>
  <a href="{{ .SiteURL }}/auth/bestaetigen?token_hash={{ .TokenHash }}&type=email_change">
    Neue Adresse bestätigen
  </a>
</p>

<p>Bis dahin bleibt die alte Adresse aktiv.</p>
```

---

## Reset password

> **Nicht in Supabase eintragen.** Wie beim Magic Link fehlt beides:
> der Weg, ihn anzufordern, und die Seite, auf der man das neue Passwort
> setzt. Wer ihn trotzdem aktiviert, verschickt Links, die niemanden
> irgendwohin bringen.

**Betreff:** `Passwort zurücksetzen`

```html
<p>Klick auf den folgenden Link, um ein neues Passwort zu setzen:</p>

<p><a href="{{ .ConfirmationURL }}">Neues Passwort setzen</a></p>

<p>Der Link gilt eine Stunde.</p>

<p>Hast du das nicht angefordert, ignorier diese Mail. Dein Passwort bleibt dann unverändert.</p>
```

---

## Warum kein Marketington

Die Texte sagen, was zu tun ist, und was passiert, wenn man nichts tut.
Der letzte Absatz ist jeweils der wichtigste: Wer eine Mail bekommt, die
er nicht erwartet hat, will wissen, ob er handeln muss.
