import Foundation
import Supabase

/// Filme suchen.
protocol FilmRepository: Sendable {
    func search(term: String, limit: Int) async throws(BackendError) -> [Film]
    /// Bekannte Filme mit echtem Plakat, für die Wand auf dem
    /// Anmeldebildschirm.
    func wellKnownWithArtwork(limit: Int) async -> [Film]
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

    /// Die Argumente von `search_films`. Als Struktur statt als
    /// Wörterbuch, damit ein Tippfehler beim Übersetzen auffällt und
    /// nicht erst zur Laufzeit.
    private struct SearchArguments: Encodable {
        let query: String
        let max_results: Int
    }

    /// Gesucht wird **in der Datenbank**, nicht hier.
    ///
    /// Rangfolge und Tippfehlertoleranz stecken in `search_films`. Ein
    /// zweiter Client, der sie nachbaut, baut sie leicht anders — und
    /// dieselbe Eingabe fände auf iPhone und im Browser Verschiedenes
    /// (M5, Grundsatzentscheidungen).
    func search(term: String, limit: Int = 20) async throws(BackendError) -> [Film] {
        let trimmed = term.trimmingCharacters(in: .whitespacesAndNewlines)
        // Unter zwei Zeichen trifft jede Anfrage den halben Katalog.
        guard trimmed.count >= 2 else { return [] }

        do {
            return try await backend.client
                .rpc("search_films", params: SearchArguments(query: trimmed, max_results: limit))
                .execute()
                .value
        } catch {
            throw BackendError.from(error)
        }
    }
}
