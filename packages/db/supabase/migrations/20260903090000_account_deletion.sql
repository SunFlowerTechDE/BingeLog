-- Die Kontoloeschung, Artikel 17 DSGVO.
--
-- Zwei Dinge standen ihr im Weg. Das erste ist ein Widerspruch, der
-- seit dem 28.08.2026 in der Tabelle steht:
--
--   target_id uuid **not null** references profiles(id) **on delete set null**
--
-- Beide Regeln zugleich sind nicht erfuellbar. Faellt das Profil, will
-- der Fremdschluessel `null` einsetzen, und die Spaltenbedingung
-- verbietet es — die Loeschung bricht ab. Jedes Konto mit auch nur
-- einem Vermerk waere damit unloeschbar gewesen, und ausgerechnet die
-- Konten mit Vermerk sind die, bei denen jemand auf sein Recht besteht.
--
-- **`not null` faellt, nicht `set null`.** Der Eintrag soll die
-- Loeschung ueberleben: der Nachweis, dass moderiert wurde, gehoert zur
-- Moderation. Lesbar bleibt er ueber `target_name`, das genau dafuer
-- als Text danebensteht.

alter table public.account_actions
  alter column target_id drop not null;

comment on column public.account_actions.target_id is
  'Das betroffene Konto, oder null, wenn es geloescht wurde. Der Name '
  'steht als Text in target_name — der Eintrag muss die Loeschung '
  'ueberleben und lesbar bleiben (Art. 17 DSGVO gegen die '
  'Nachweispflicht der Moderation).';

-- --------------------------------------------------------------------
-- Was beim Loeschen bleibt
-- --------------------------------------------------------------------
--
-- Alles, was am Konto haengt, faellt mit: Tagebuch, Watchlist, Listen,
-- Favoriten, Folgen, Blockaden, Empfehlungen, Diskussionsbeitraege,
-- Geschmacksstimmen, Importe. Das erledigen die Kaskaden.
--
-- Stehen bleiben **Meldungen und Moderationseintraege**, beide ohne den
-- Namen daran. Der DSA verlangt die Spur, und eine Meldung, die mit dem
-- gemeldeten Konto verschwindet, waere keine.
--
-- **Der Objektspeicher kaskadiert nicht.** Profilbild, Kopfbild und die
-- hochgeladene Importdatei muessen eigens weg; das erledigt die Edge
-- Function `delete-account`, weil nur sie den Service-Role-Key hat.
-- Bilder an Meldungen liegen unter der Melde-ID und nicht unter der
-- Nutzer-ID — sie gehoeren zur Meldung und bleiben mit ihr.
