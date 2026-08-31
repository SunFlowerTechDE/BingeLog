import Foundation
import Supabase

/// Ein Film, den es gerade noch nicht gab.
struct CreatedFilm: Decodable, Identifiable, Hashable, Sendable {
    let wikidataID: String
    let titleDE: String?
    let titleOriginal: String
    let releaseYear: Int?
    let posterSource: String?
    let posterURL: String?

    var id: String { wikidataID }
    var title: String { titleDE ?? titleOriginal }

    var film: Film {
        Film(
            wikidataID: wikidataID,
            titleDE: titleDE,
            titleOriginal: titleOriginal,
            releaseYear: releaseYear,
            posterSource: posterSource,
            posterURL: posterURL
        )
    }

    enum CodingKeys: String, CodingKey {
        case wikidataID = "wikidata_id"
        case titleDE = "title_de"
        case titleOriginal = "title_original"
        case releaseYear = "release_year"
        case posterSource = "poster_source"
        case posterURL = "poster_url"
    }
}

/// Warum nichts angelegt wurde.
///
/// Uebersetzt hier und nicht in der Ansicht: derselbe Grund muss auf
/// iPhone und im Browser dasselbe heissen.
enum LazyFilmProblem: Error, Equatable {
    case tooShort
    case rateLimited
    case wrongYear
    case notFound
    case unreachable

    var message: String {
        switch self {
        case .tooShort:
            return "Gib mindestens zwei Zeichen ein."
        case .rateLimited:
            return "Gerade zu viele Abfragen. Versuch es in einer Minute noch einmal."
        case .wrongYear:
            return "Bei Wikidata gibt es den Titel, aber nicht aus diesem Jahr. "
                + "Lass das Jahr weg oder prüf es."
        case .notFound:
            return "Auch bei Wikidata nichts gefunden. Prüf die Schreibweise "
                + "oder such nach dem Originaltitel."
        case .unreachable:
            return "Wikidata antwortet gerade nicht. Versuch es gleich noch einmal."
        }
    }

    static func from(reason: String?) -> LazyFilmProblem {
        switch reason {
        case "rate_limited": return .rateLimited
        case "wrong_year": return .wrongYear
        default: return .notFound
        }
    }
}

/// Einen fehlenden Film anlegen.
protocol LazyFilmRepository: Sendable {
    func create(term: String, year: Int?) async -> Result<[CreatedFilm], LazyFilmProblem>
}

struct LiveLazyFilmRepository: LazyFilmRepository {
    let backend: Backend

    private struct Request: Encodable {
        let term: String
        let year: Int?
    }

    private struct Answer: Decodable {
        let created: [String]?
        let reason: String?
    }

    /// Geschrieben wird **in der Edge Function**, nicht hier.
    ///
    /// Der Katalog gehört niemandem sonst: schreiben darf nur, wer den
    /// Service-Role-Key hat, und den hält keine App (M0 0.2). Diese
    /// Stelle bittet nur darum, mit demselben anonymen Schlüssel wie
    /// jede andere Anfrage.
    func create(term: String, year: Int?) async -> Result<[CreatedFilm], LazyFilmProblem> {
        let trimmed = term.trimmingCharacters(in: .whitespacesAndNewlines)
        guard trimmed.count >= 2 else { return .failure(.tooShort) }

        let answer: Answer
        do {
            answer = try await backend.client.functions.invoke(
                "lazy-film",
                options: FunctionInvokeOptions(body: Request(term: trimmed, year: year))
            )
        } catch {
            return .failure(.unreachable)
        }

        let ids = answer.created ?? []
        guard !ids.isEmpty else { return .failure(.from(reason: answer.reason)) }

        // Die Karte wird gezeigt, während sie entsteht — dafür braucht
        // sie dieselben Felder wie die Plakatstrecke, und zwar von hier
        // und nicht aus einer zweiten Anfrage: der Sinn ist, dass die
        // Karte in dem Moment da ist, in dem es den Film gibt.
        let rows: [CreatedFilm]? = try? await backend.client
            .from("films")
            .select("wikidata_id, title_de, title_original, release_year, poster_source, poster_url")
            .in("wikidata_id", values: ids)
            .execute()
            .value

        guard let rows, !rows.isEmpty else { return .failure(.notFound) }
        return .success(rows)
    }
}
