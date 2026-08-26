# M7: Monetarisierung (Supporter-Abo)

**Ziel:** Die laufenden Kosten von rund 35 € im Monat sind gedeckt.

**Vorbedingung:** M6 abgeschlossen, App läuft im Store, es gibt Nutzer.

**Aufwand:** 1 Woche.

---

## Zielgröße

Das Ziel ist Kostendeckung, nicht Gewinn.

| Modell | Netto pro Nutzer/Jahr | Nötig für 35 €/Monat |
|---|---|---|
| Supporter 3 €/Monat | 25,71 € | **17 Abos** |
| Supporter 25 €/Jahr | 17,86 € | 24 Abos |

Netto nach 19 % MwSt und 15 % Apple (Small Business Program, gilt unter
1 Mio. USD Jahresumsatz).

**Empfehlung: 3 € im Monat oder 25 € im Jahr.** Nicht 3 € im Jahr. Die
Hürde beim Abschließen eines Abos ist bei 3 € genauso hoch wie bei 25 €,
also verschenkt ein zu niedriger Preis die Zahlungsbereitschaft. Zum
Vergleich: Letterboxd Pro liegt bei 19 USD im Jahr.

---

## Aufgaben

### 7.1 Was Supporter bekommen

Das Prinzip: **Der kostenlose Zugang bleibt vollwertig.** Bezahlt wird
für Komfort, nicht für Grundfunktionen.

Geeignet:

- [ ] Erweiterte Statistiken (Jahresrückblick, detaillierte Auswertungen)
- [ ] Unbegrenzte Listen (kostenlos etwa 5)
- [ ] Eigene Sortierungen und Filter
- [ ] Facetten-Auswertung über das eigene Tagebuch (etwa: welche
      Regisseure du beim Bild am höchsten bewertest)
- [ ] Profil-Anpassung (Akzentfarbe, Hintergrund)
- [ ] Supporter-Abzeichen im Profil
- [ ] CSV- und JSON-Export mit mehr Feldern

Ungeeignet, weil es die App entwertet:

- Bewertungen limitieren
- Tagebucheinträge limitieren
- Werbung, die man wegkauft (es gibt keine Werbung, siehe ADR-007)

### 7.2 Technische Umsetzung

- [ ] StoreKit 2 für iOS, `Product.SubscriptionInfo`
- [ ] Web: Stripe oder Paddle. **Paddle als Merchant of Record** nimmt
      die Umsatzsteuerabwicklung ab, was bei internationalen Nutzern
      erheblichen Aufwand spart.
- [ ] Serverseitige Validierung der Kaufbelege. **Nie** dem Client
      glauben.
- [ ] Tabelle:

```sql
create table subscriptions (
  user_id     uuid primary key references profiles(id) on delete cascade,
  status      text not null,   -- 'active' | 'expired' | 'grace'
  source      text not null,   -- 'apple' | 'google' | 'web'
  expires_at  timestamptz,
  updated_at  timestamptz not null default now()
);
```

- [ ] Apple Server Notifications V2 als Webhook
- [ ] Plattformübergreifende Freischaltung: Wer über iOS kauft, ist auch
      im Web Supporter. Ab M9 gilt dasselbe für Google Play.
- [ ] Grace Period bei Zahlungsproblemen

### 7.3 Steuerliches

- [ ] Steuerliche Behandlung mit dem Steuerberater klären, bevor der
      erste Euro fließt
- [ ] Prüfen, ob und wie sich das auf die bestehende
      Unternehmensstruktur auswirkt
- [ ] **Umsatzschwelle TheTVDB im Blick behalten**: Ab 50.000 USD
      Gesamtumsatz von SunFlower Tech kostet die Artwork-Lizenz
      1.000 USD im Jahr. Siehe ADR-002.

### 7.4 Kommunikation

- [ ] Ehrliche Begründung im Produkt: was die App kostet, wofür das Geld
      verwendet wird
- [ ] Kein Dark Pattern, kein Countdown, kein künstlicher Druck
- [ ] Kündigung leicht auffindbar

---

## Definition of Done

- [ ] Kauf funktioniert auf iOS und im Web
- [ ] Ein auf iOS gekauftes Abo schaltet die Web-Funktionen frei
- [ ] Ablauf und Verlängerung werden korrekt verarbeitet
- [ ] Kaufbelege werden serverseitig validiert
- [ ] Kündigung und Rückerstattung sind getestet

## Fallstricke

- **Nicht dem Client glauben.** Ein manipulierter Client darf keine
  Supporter-Funktionen freischalten.
- **Keine Kernfunktion hinter die Bezahlschranke.** 17 Abos sind das
  Ziel. Dafür muss die App wachsen, und das tut sie nur, wenn sie
  kostenlos vollwertig ist.
- **Umsatzsteuer bei Web-Verkäufen nicht unterschätzen.** Deshalb
  Merchant of Record.
