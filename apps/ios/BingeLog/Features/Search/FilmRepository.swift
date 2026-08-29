import Foundation
import Supabase

/// Filme suchen.
protocol FilmRepository: Sendable {
    func search(term: String, limit: Int) async throws(BackendError) -> [Film]
}

struct LiveFilmRepository: FilmRepository {
    let backend: Backend

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
