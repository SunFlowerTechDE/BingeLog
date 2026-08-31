import Foundation
import Supabase

/// Filme suchen.
protocol FilmRepository: Sendable {
    func search(term: String, limit: Int, year: Int?) async throws(BackendError) -> [Film]
    /// Bekannte Filme mit echtem Plakat, für die Wand auf dem
    /// Anmeldebildschirm.
    func wellKnownWithArtwork(limit: Int) async -> [Film]
    /// Dieselben, aber gemischt — für den Startbildschirm, der bei jedem
    /// Start andere zeigen soll.
    func shuffledWithArtwork(count: Int) async -> [Film]
}

struct LiveFilmRepository: FilmRepository {
    let backend: Backend

    /// Filme mit echtem Plakat, die bekanntesten zuerst.
    ///
    /// `sitelink_count` ist die Zahl der Wikipedia-Sprachversionen und
    /// damit das einzige Mass für Bekanntheit, das der Katalog kennt.
    ///
    /// Wirft nicht: für eine Zierde ist ein Fehler kein Ereignis. Ohne
    /// Netz bleibt die Wand leer, und der Bildschirm steht trotzdem.
    func wellKnownWithArtwork(limit: Int = 12) async -> [Film] {
        let films: [Film]? = try? await backend.client
            .from("films")
            .select("wikidata_id, title_de, title_original, release_year, poster_source, poster_url")
            .eq("poster_source", value: "tvdb")
            .order("sitelink_count", ascending: false)
            .limit(limit)
            .execute()
            .value

        return films ?? []
    }

    /// Ein Vorrat der bekanntesten, dann gemischt.
    ///
    /// Gemischt **hier** und nicht in der Datenbank: `order by random()`
    /// müsste über die ganze Tabelle sortieren, und das für eine
    /// Zierde. Ein Vorrat der Bekanntesten liefert außerdem die
    /// schöneren Plakate — Zufall soll die Reihenfolge bestimmen, nicht
    /// die Qualität.
    ///
    /// Jeder Film kommt höchstens einmal vor: der Vorrat ist eine
    /// Menge, und `shuffled().prefix()` nimmt daraus ohne
    /// Zurücklegen.
    func shuffledWithArtwork(count: Int) async -> [Film] {
        let pool = await wellKnownWithArtwork(limit: max(count * 3, 60))
        return Array(pool.shuffled().prefix(count))
    }

    /// Die Argumente von `search_films`. Als Struktur statt als
    /// Wörterbuch, damit ein Tippfehler beim Übersetzen auffällt und
    /// nicht erst zur Laufzeit.
    private struct SearchArguments: Encodable {
        let query: String
        let max_results: Int
        /// Ohne Angabe `nil`, und dann sucht die Funktion wie bisher.
        let in_year: Int?
    }

    /// Gesucht wird **in der Datenbank**, nicht hier.
    ///
    /// Rangfolge und Tippfehlertoleranz stecken in `search_films`. Ein
    /// zweiter Client, der sie nachbaut, baut sie leicht anders — und
    /// dieselbe Eingabe fände auf iPhone und im Browser Verschiedenes
    /// (M5, Grundsatzentscheidungen).
    /// Das Jahr grenzt ein, es gewichtet nicht.
    ///
    /// Gefiltert wird in `search_films`, nicht hier: wer das Jahr
    /// eintippt, soll auf iPhone und im Browser dasselbe finden.
    func search(term: String, limit: Int = 20, year: Int? = nil) async throws(BackendError)
        -> [Film]
    {
        let trimmed = term.trimmingCharacters(in: .whitespacesAndNewlines)
        // Unter zwei Zeichen trifft jede Anfrage den halben Katalog.
        guard trimmed.count >= 2 else { return [] }

        do {
            return try await backend.client
                .rpc(
                    "search_films",
                    params: SearchArguments(query: trimmed, max_results: limit, in_year: year)
                )
                .execute()
                .value
        } catch {
            throw BackendError.from(error)
        }
    }
}
