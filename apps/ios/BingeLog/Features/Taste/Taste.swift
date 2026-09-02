import Foundation
import Supabase

/// Eine Karte im Geschmackscheck.
nonisolated struct TasteCard: Decodable, Identifiable, Sendable {
    let filmID: String
    let titleDE: String?
    let titleOriginal: String
    let releaseYear: Int?
    let posterSource: String?
    let posterURL: String?
    /// Eine der sechzehn Kategorien, als Anhaltspunkt auf der Karte.
    let categoryLabel: String?

    var id: String { filmID }
    var title: String { titleDE ?? titleOriginal }

    var film: Film {
        Film(
            wikidataID: filmID, titleDE: titleDE, titleOriginal: titleOriginal,
            releaseYear: releaseYear, posterSource: posterSource, posterURL: posterURL)
    }

    enum CodingKeys: String, CodingKey {
        case filmID = "film_id"
        case titleDE = "title_de"
        case titleOriginal = "title_original"
        case releaseYear = "release_year"
        case posterSource = "poster_source"
        case posterURL = "poster_url"
        case categoryLabel = "category_label"
    }
}

/// Die drei Knöpfe.
///
/// **Das ist keine Bewertung.** Die Stimme sagt, ob ein Film reizt, und
/// landet in `taste_votes` — nicht im Tagebuch und in keinem
/// Filmdurchschnitt. Sie trainiert nur das Match Making.
nonisolated enum TasteVerdict: String, CaseIterable, Identifiable, Sendable {
    case like
    case dislike
    case unsure

    var id: String { rawValue }

    var label: String {
        switch self {
        case .like: return "Gefällt mir"
        case .dislike: return "Gefällt mir nicht"
        case .unsure: return "Weiß nicht"
        }
    }

    var symbol: String {
        switch self {
        case .like: return "hand.thumbsup.fill"
        case .dislike: return "hand.thumbsdown.fill"
        case .unsure: return "questionmark"
        }
    }
}

/// Wie weit das Geschmacksprofil trägt.
nonisolated struct TasteReadiness: Decodable, Sendable, Equatable {
    let votes: Int
    let rated: Int
    /// Gewichtete Beobachtungen: eine Note zählt 1,0, eine Stimme 0,4.
    let observations: Double
    let categoriesCovered: Int
    /// 0 bis 100.
    let readiness: Int
    let label: String

    static let empty = TasteReadiness(
        votes: 0, rated: 0, observations: 0, categoriesCovered: 0, readiness: 0,
        label: "Noch zu wenig")

    /// Ob der Wert für eine Auswahl reicht.
    ///
    /// Die Grenze steht bei 50 — darunter ist es eine Richtung, keine
    /// Aussage. Die Zahl selbst bleibt trotzdem sichtbar: eine Anzeige,
    /// die erst ab einer Schwelle erscheint, sagt einem nicht, wie weit
    /// man noch ist.
    var isUsable: Bool { readiness >= 50 }

    enum CodingKeys: String, CodingKey {
        case votes, rated, observations, readiness, label
        case categoriesCovered = "categories_covered"
    }

    init(
        votes: Int, rated: Int, observations: Double, categoriesCovered: Int, readiness: Int,
        label: String
    ) {
        self.votes = votes
        self.rated = rated
        self.observations = observations
        self.categoriesCovered = categoriesCovered
        self.readiness = readiness
        self.label = label
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        votes = (try? c.decode(Int.self, forKey: .votes)) ?? 0
        rated = (try? c.decode(Int.self, forKey: .rated)) ?? 0
        // `numeric` kommt als Zeichenkette an.
        if let text = try? c.decode(String.self, forKey: .observations) {
            observations = Double(text) ?? 0
        } else {
            observations = (try? c.decode(Double.self, forKey: .observations)) ?? 0
        }
        categoriesCovered = (try? c.decode(Int.self, forKey: .categoriesCovered)) ?? 0
        readiness = (try? c.decode(Int.self, forKey: .readiness)) ?? 0
        label = (try? c.decode(String.self, forKey: .label)) ?? "Noch zu wenig"
    }
}

/// Die Übereinstimmung eines Films in Prozent.
nonisolated struct FilmMatch: Decodable, Sendable {
    let filmID: String
    let match: Int

    enum CodingKeys: String, CodingKey {
        case match
        case filmID = "film_id"
    }
}

protocol TasteRepository: Sendable {
    func deck(count: Int) async -> [TasteCard]
    func vote(_ verdict: TasteVerdict, on filmID: String) async -> SaveOutcome
    func readiness() async -> TasteReadiness
    func matches(for filmIDs: [String]) async -> [String: Int]
}

struct LiveTasteRepository: TasteRepository {
    let backend: Backend

    func deck(count: Int) async -> [TasteCard] {
        let rows: [TasteCard]? = try? await backend.client
            .rpc("taste_deck", params: ["wanted": count])
            .execute()
            .value
        return rows ?? []
    }

    /// Eine Stimme je Film, überschreibbar: wer zurückgeht und anders
    /// entscheidet, soll nicht zwei Aussagen hinterlassen.
    func vote(_ verdict: TasteVerdict, on filmID: String) async -> SaveOutcome {
        guard let mine = backend.client.auth.currentUser?.id else {
            return .failed("Du bist nicht angemeldet.")
        }
        do {
            try await backend.client
                .from("taste_votes")
                .upsert(
                    [
                        "user_id": mine.uuidString,
                        "film_id": filmID,
                        "verdict": verdict.rawValue,
                    ],
                    onConflict: "user_id,film_id"
                )
                .execute()
            return .saved
        } catch {
            return .failed(BackendError.from(error).message)
        }
    }

    func readiness() async -> TasteReadiness {
        let rows: [TasteReadiness]? = try? await backend.client
            .rpc("taste_readiness")
            .execute()
            .value
        return rows?.first ?? .empty
    }

    /// Alle auf einmal. Eine Watchlist mit vierzig Einträgen darf keine
    /// vierzig Anfragen kosten.
    ///
    /// Trägt das Profil noch nicht, kommt eine leere Antwort — die
    /// Schwelle steht in der Datenbank, nicht hier.
    func matches(for filmIDs: [String]) async -> [String: Int] {
        guard !filmIDs.isEmpty else { return [:] }

        let rows: [FilmMatch]? = try? await backend.client
            .rpc("film_match", params: ["films": filmIDs])
            .execute()
            .value
        return Dictionary(uniqueKeysWithValues: (rows ?? []).map { ($0.filmID, $0.match) })
    }
}
