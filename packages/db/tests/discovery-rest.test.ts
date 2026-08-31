/**
 * Die neuen Funktionen, ueber PostgREST.
 *
 * Die Schema-Suite prueft dieselben Funktionen gegen ein lokales
 * Postgres. Das beweist, dass das SQL stimmt — nicht, dass ein Client
 * sie erreicht. Dazwischen liegt der Schema-Cache von PostgREST und die
 * Frage, ob der Aufruf ueberhaupt eindeutig ist: eine zweite Funktion
 * gleichen Namens faellt lokal nicht auf, ueber die API dagegen sofort.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { anonClient } from './helpers.ts';

describe('discovery over the API', () => {
  it('answers the weekly top ten without a session', async () => {
    const { error } = await anonClient().rpc('weekly_top_films', { max_results: 10 });
    assert.equal(error, null, 'weekly_top_films muss ohne Anmeldung antworten');
  });

  it('answers films_for_me only for a signed-in caller', async () => {
    // Ohne Anmeldung gibt es keine eigenen Bewertungen, also auch nichts
    // zu empfehlen. Die Funktion ist `authenticated` vorbehalten — der
    // anonyme Aufruf muss abgewiesen werden und nicht etwa fremde
    // Tagebuecher auswerten.
    const { error } = await anonClient().rpc('films_for_me', { max_results: 5 });
    assert.notEqual(error, null, 'films_for_me darf ohne Konto nicht antworten');
  });

  it('answers a search without a year', async () => {
    // Der Aufruf des Webs. Stuende die alte Funktion noch neben der
    // neuen, waere er mehrdeutig und PostgREST antwortete mit einem
    // Fehler statt mit Treffern.
    const antwort = await anonClient().rpc('search_films', { query: 'Solaris', max_results: 3 });
    assert.equal(antwort.error, null, 'der Aufruf ohne Jahr muss genau eine Funktion treffen');
    assert.ok(Array.isArray(antwort.data));
  });

  it('narrows a search to a year', async () => {
    const alle = await anonClient().rpc('search_films', { query: 'Solaris', max_results: 20 });
    assert.equal(alle.error, null);

    const jahre = new Set(
      ((alle.data ?? []) as { release_year: number | null }[]).map((row) => row.release_year),
    );
    assert.ok(jahre.size > 1, 'der Fall taugt nur, wenn es den Titel in mehreren Jahren gibt');

    const eines = [...jahre].find((jahr): jahr is number => jahr !== null);
    assert.ok(eines !== undefined);

    const eng = await anonClient().rpc('search_films', {
      query: 'Solaris',
      max_results: 20,
      in_year: eines,
    });
    assert.equal(eng.error, null);

    const gefunden = (eng.data ?? []) as { release_year: number | null }[];
    assert.ok(gefunden.length > 0, 'mit passendem Jahr bleibt ein Treffer');
    assert.deepEqual(
      [...new Set(gefunden.map((row) => row.release_year))],
      [eines],
      'mit Jahr bleibt nur dieses Jahr uebrig',
    );
  });
});
