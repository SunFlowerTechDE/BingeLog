# Mailvorlagen

> Zum Einfügen in Supabase unter Authentication → Emails.
> Deutsch, geduzt, knapp, keine Ausrufezeichen (02-product.md).

Supabase ersetzt `{{ .ConfirmationURL }}` beim Versand. Die übrigen
Platzhalter sind in den jeweiligen Vorlagen dokumentiert.

---

## Confirm signup

**Betreff:** `Bestätige deine Adresse`

```html
<p>Du hast ein Konto bei BingeLog angelegt.</p>

<p>Klick auf den folgenden Link, dann kann es losgehen:</p>

<p><a href="{{ .ConfirmationURL }}">Adresse bestätigen</a></p>

<p>Der Link gilt 24 Stunden.</p>

<p>Warst du das nicht, ignorier diese Mail. Ohne Bestätigung passiert
nichts.</p>
```

---

## Magic Link

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

<p>Klick auf den folgenden Link, um <strong>{{ .NewEmail }}</strong> zu
bestätigen:</p>

<p><a href="{{ .ConfirmationURL }}">Neue Adresse bestätigen</a></p>

<p>Bis dahin bleibt die alte Adresse aktiv.</p>
```

---

## Reset password

**Betreff:** `Passwort zurücksetzen`

```html
<p>Klick auf den folgenden Link, um ein neues Passwort zu setzen:</p>

<p><a href="{{ .ConfirmationURL }}">Neues Passwort setzen</a></p>

<p>Der Link gilt eine Stunde.</p>

<p>Hast du das nicht angefordert, ignorier diese Mail. Dein Passwort
bleibt dann unverändert.</p>
```

---

## Warum kein Marketington

Die Texte sagen, was zu tun ist, und was passiert, wenn man nichts tut.
Der letzte Absatz ist jeweils der wichtigste: Wer eine Mail bekommt, die
er nicht erwartet hat, will wissen, ob er handeln muss.
