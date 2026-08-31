import Foundation
import Supabase

/// Ein Genre, wie es an einem Film hängt.
struct FilmGenre: Identifiable, Hashable, Sendable {
    let id: String
    let label: String

    /// Auf der Filmseite steht derselbe kurze Name wie auf der Kachel.
    var shortLabel: String { GenreLabel.short(for: id) ?? label }
}

/// Ein Film, ausführlich.
///
/// Was der Katalog über ihn weiß. **Ohne Bewerten, Tagebuch und
/// Watchlist** — die stehen in M5 5.4 und sind jeweils mehr als ein
/// Feld auf dieser Seite.
struct FilmDetail: Sendable, Equatable {
    let film: Film
    let titleEN: String?
    let runtimeMinutes: Int?
    let synopsis: String?
    let directors: [String]
    let cast: [String]
    let genres: [FilmGenre]

    /// Die Laufzeit, wie ein Mensch sie liest.
    var runtimeText: String? {
        guard let runtimeMinutes, runtimeMinutes > 0 else { return nil }
        let hours = runtimeMinutes / 60
        let minutes = runtimeMinutes % 60
        if hours == 0 { return "\(minutes) min" }
        if minutes == 0 { return "\(hours) h" }
        return "\(hours) h \(minutes) min"
    }

    /// Der Originaltitel, aber nur wenn er etwas hinzufügt.
    var alternativeTitle: String? {
        let shown = film.title
        for candidate in [film.titleOriginal, titleEN] {
            if let candidate, candidate != shown { return candidate }
        }
        return nil
    }
}

/// Einen Film ausführlich lesen.
protocol FilmDetailRepository: Sendable {
    func detail(for wikidataID: String) async -> FilmDetail?
}

struct LiveFilmDetailRepository: FilmDetailRepository {
    let backend: Backend

    private struct Row: Decodable {
        let wikidata_id: String
        let title_de: String?
        let title_original: String
        let title_en: String?
        let release_year: Int?
        let runtime_min: Int?
        let synopsis_de: String?
        let poster_source: String?
        let poster_url: String?
    }

    private struct CreditRow: Decodable {
        let person_id: String
        let role: String
    }

    private struct PersonRow: Decodable {
        let wikidata_id: String
        let name: String
    }

    private struct GenreLinkRow: Decodable {
        let genre_id: String
    }

    private struct GenreRow: Decodable {
        let wikidata_id: String
        let label_de: String?
        let label_en: String?
    }

    /// Der Film, die Mitwirkenden und die Genres nebeneinander.
    ///
    /// Und die Namen dazu in **einer** Abfrage, nicht in einer je Zeile:
    /// zwölf Mitwirkende wären sonst zwölf Anfragen für eine Seite.
    func detail(for wikidataID: String) async -> FilmDetail? {
        async let filmRow: Row? = try? await backend.client
            .from("films")
            .select(
                "wikidata_id, title_de, title_original, title_en, release_year, "
                    + "runtime_min, synopsis_de, poster_source, poster_url"
            )
            .eq("wikidata_id", value: wikidataID)
            .single()
            .execute()
            .value

        async let credits: [CreditRow] = fetch(
            table: "film_credits", columns: "person_id, role", column: "film_id",
            value: wikidataID, ordered: true)

        async let links: [GenreLinkRow] = fetch(
            table: "film_genres", columns: "genre_id", column: "film_id",
            value: wikidataID, ordered: false)

        guard let row = await filmRow else { return nil }
        let creditRows = await credits
        let linkRows = await links

        async let people: [PersonRow] = lookup(
            table: "people", columns: "wikidata_id, name", ids: creditRows.map(\.person_id))

        async let genres: [GenreRow] = lookup(
            table: "genres", columns: "wikidata_id, label_de, label_en",
            ids: linkRows.map(\.genre_id))

        let nameFor = Dictionary(
            (await people).map { ($0.wikidata_id, $0.name) },
            uniquingKeysWith: { first, _ in first })

        let labelFor = Dictionary(
            (await genres).compactMap { entry -> (String, String)? in
                guard let label = entry.label_de ?? entry.label_en else { return nil }
                return (entry.wikidata_id, label)
            },
            uniquingKeysWith: { first, _ in first })

        // Die Reihenfolge kommt schon sortiert aus der Abfrage.
        let named = { (role: String) in
            creditRows.filter { $0.role == role }.compactMap { nameFor[$0.person_id] }
        }

        return FilmDetail(
            film: Film(
                wikidataID: row.wikidata_id,
                titleDE: row.title_de,
                titleOriginal: row.title_original,
                releaseYear: row.release_year,
                posterSource: row.poster_source,
                posterURL: row.poster_url
            ),
            titleEN: row.title_en,
            runtimeMinutes: row.runtime_min,
            synopsis: row.synopsis_de,
            directors: named("director"),
            // Zwölf reichen. Eine Besetzungsliste ist keine Filmseite.
            cast: Array(named("cast").prefix(12)),
            genres: linkRows.compactMap { link in
                guard let label = labelFor[link.genre_id] else { return nil }
                return FilmGenre(id: link.genre_id, label: label)
            }
        )
    }

    private func fetch<T: Decodable>(
        table: String, columns: String, column: String, value: String, ordered: Bool
    ) async -> [T] {
        let query = backend.client.from(table).select(columns).eq(column, value: value)
        let result: [T]? =
            ordered
            ? try? await query.order("ord", ascending: true).execute().value
            : try? await query.execute().value
        return result ?? []
    }

    private func lookup<T: Decodable>(table: String, columns: String, ids: [String]) async -> [T] {
        guard !ids.isEmpty else { return [] }
        let result: [T]? = try? await backend.client
            .from(table)
            .select(columns)
            .in("wikidata_id", values: ids)
            .execute()
            .value
        return result ?? []
    }
}
