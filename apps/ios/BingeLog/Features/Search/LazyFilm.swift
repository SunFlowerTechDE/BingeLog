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

/// Warum nichts gefunden oder nichts angelegt wurde.
///
/// **Die Quelle wird nicht genannt.** Der Nutzer soll verstehen, dass
/// die App noch einmal ausserhalb des eigenen Katalogs gesucht hat —
/// woher die Daten kommen, ist unsere Sache und keine Auskunft, die ihm
/// weiterhilft (Suchkonzept, 6).
///
/// Die Fälle sind auseinandergehalten, weil sie verschiedene Antworten
/// verlangen: bei einem Tippfehler tippt man anders, bei fehlendem Netz
/// wartet man, und „steht schon im Katalog" ist überhaupt kein Fehler
/// (Suchkonzept, 23).
enum LazyFilmProblem: Error, Equatable {
    case tooShort
    case rateLimited
    case wrongYear
    case notFound
    case offline
    case sourceUnreachable
    case saveFailed
    case alreadyThere

    var message: String {
        switch self {
        case .tooShort:
            return "Gib mindestens zwei Zeichen ein."
        case .rateLimited:
            return "Gerade zu viele Abfragen. Versuch es in einer Minute noch einmal."
        case .wrongYear:
            return "Den Titel gibt es, aber nicht aus diesem Jahr. "
                + "Lass das Jahr weg oder prüf es."
        case .notFound:
            return "Kein passender Film gefunden. Prüf die Schreibweise "
                + "oder such nach dem Originaltitel."
        case .offline:
            return "Keine Internetverbindung."
        case .sourceUnreachable:
            return "Die Filmsuche ist gerade nicht erreichbar. "
                + "Versuch es gleich noch einmal."
        case .saveFailed:
            return "Der Film konnte nicht gespeichert werden."
        case .alreadyThere:
            return "Den Film gibt es inzwischen schon im Katalog."
        }
    }

    /// Ob es sich lohnt, das Jahr wegzulassen.
    var suggestsDroppingTheYear: Bool { self == .wrongYear }

    static func from(reason: String?) -> LazyFilmProblem {
        switch reason {
        case "rate_limited": return .rateLimited
        case "wrong_year": return .wrongYear
        case "lookup_failed": return .sourceUnreachable
        case "write_failed": return .saveFailed
        default: return .notFound
        }
    }

    /// Kein Netz ist etwas anderes als eine Quelle, die nicht antwortet.
    static func from(error: Error) -> LazyFilmProblem {
        let code = (error as NSError).code
        let offline = [
            NSURLErrorNotConnectedToInternet, NSURLErrorNetworkConnectionLost,
            NSURLErrorDataNotAllowed,
        ]
        return offline.contains(code) ? .offline : .sourceUnreachable
    }
}

/// Ein Fund, den es so noch nicht im Katalog gibt.
///
/// Steht in der Pruefkarte, bevor irgendetwas geschrieben wird
/// (Suchkonzept, 8).
struct FilmCandidate: Decodable, Identifiable, Hashable, Sendable {
    let wikidataID: String
    let title: String
    let titleOriginal: String
    let releaseYear: Int?
    let runtimeMinutes: Int?
    let director: String?
    let posterURL: String?

    var id: String { wikidataID }

    /// Der Originaltitel, aber nur wenn er etwas hinzufügt.
    var alternativeTitle: String? {
        titleOriginal == title ? nil : titleOriginal
    }

    var facts: String {
        var parts: [String] = []
        if let releaseYear { parts.append(String(releaseYear)) }
        if let runtimeMinutes { parts.append("\(runtimeMinutes) Minuten") }
        if let director { parts.append(director) }
        return parts.joined(separator: " · ")
    }

    enum CodingKeys: String, CodingKey {
        case title, director
        case wikidataID = "wikidataId"
        case titleOriginal
        case releaseYear
        case runtimeMinutes = "runtimeMin"
        case posterURL = "posterUrl"
    }
}

/// Einen fehlenden Film suchen und aufnehmen.
///
/// Zwei Schritte, nicht einer. Erst nachsehen, was es gäbe, dann
/// aufnehmen, was der Nutzer ausgesucht hat — bei „Halloween" sind das
/// drei verschiedene Filme, und den ersten zu nehmen wäre eine
/// Vermutung, die danach alle mitlesen (Suchkonzept, 8 und 14).
protocol LazyFilmRepository: Sendable {
    func look(term: String, year: Int?) async -> Result<[FilmCandidate], LazyFilmProblem>
    func adopt(_ candidate: FilmCandidate) async -> Result<CreatedFilm, LazyFilmProblem>
}

struct LiveLazyFilmRepository: LazyFilmRepository {
    let backend: Backend

    private struct LookRequest: Encodable {
        let term: String
        let year: Int?
        let mode = "preview"
    }

    private struct AdoptRequest: Encodable {
        let wikidataId: String
    }

    private struct LookAnswer: Decodable {
        let candidates: [FilmCandidate]?
        let reason: String?
    }

    private struct AdoptAnswer: Decodable {
        let created: [String]?
        let reason: String?
    }

    /// Nachsehen, ohne zu schreiben.
    ///
    /// Die Vorschau legt nichts an. Sie beantwortet nur, was ausserhalb
    /// des Katalogs zu finden wäre — geschrieben wird erst, wenn der
    /// Nutzer einen der Treffer aussucht.
    func look(term: String, year: Int?) async -> Result<[FilmCandidate], LazyFilmProblem> {
        let trimmed = term.trimmingCharacters(in: .whitespacesAndNewlines)
        guard trimmed.count >= 2 else { return .failure(.tooShort) }

        let answer: LookAnswer
        do {
            answer = try await backend.client.functions.invoke(
                "lazy-film",
                options: FunctionInvokeOptions(body: LookRequest(term: trimmed, year: year))
            )
        } catch {
            return .failure(LazyFilmProblem.from(error: error))
        }

        let found = answer.candidates ?? []
        guard !found.isEmpty else { return .failure(.from(reason: answer.reason)) }
        return .success(found)
    }

    /// Geschrieben wird **in der Edge Function**, nicht hier.
    ///
    /// Der Katalog gehört niemandem sonst: schreiben darf nur, wer den
    /// Service-Role-Key hat, und den hält keine App (M0 0.2). Diese
    /// Stelle bittet nur darum, mit demselben anonymen Schlüssel wie
    /// jede andere Anfrage — und nennt dabei genau eine Id, damit nicht
    /// noch einmal gesucht wird und etwas anderes herauskommt.
    func adopt(_ candidate: FilmCandidate) async -> Result<CreatedFilm, LazyFilmProblem> {
        let answer: AdoptAnswer
        do {
            answer = try await backend.client.functions.invoke(
                "lazy-film",
                options: FunctionInvokeOptions(
                    body: AdoptRequest(wikidataId: candidate.wikidataID))
            )
        } catch {
            return .failure(LazyFilmProblem.from(error: error))
        }

        guard (answer.created ?? []).isEmpty == false else {
            return .failure(.from(reason: answer.reason))
        }

        let rows: [CreatedFilm]? = try? await backend.client
            .from("films")
            .select("wikidata_id, title_de, title_original, release_year, poster_source, poster_url")
            .eq("wikidata_id", value: candidate.wikidataID)
            .execute()
            .value

        guard let film = rows?.first else { return .failure(.saveFailed) }
        return .success(film)
    }
}
