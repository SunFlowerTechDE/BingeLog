import Foundation
import Supabase

/// Ein Freund, dem man den Film schicken kann.
struct RecommendationTarget: Decodable, Identifiable, Hashable, Sendable {
    let id: UUID
    let username: String
    let avatarPath: String?
    /// Ob dieser Film schon einmal an ihn ging.
    let alreadySent: Bool

    enum CodingKeys: String, CodingKey {
        case id, username
        case avatarPath = "avatar_path"
        case alreadySent = "already_sent"
    }
}

/// Eine Empfehlung, wie sie im Posteingang steht.
struct Recommendation: Decodable, Identifiable, Sendable {
    let filmID: String
    let titleDE: String?
    let titleOriginal: String
    let releaseYear: Int?
    let posterSource: String?
    let posterURL: String?
    /// Wie viele Freunde ihn empfohlen haben.
    let friends: Int
    let firstFriend: String
    let note: String?
    /// Die Bewertung des zuletzt Empfehlenden, auf der Skala 1 bis 10.
    let friendRating: Int?

    var id: String { filmID }

    var film: Film {
        Film(
            wikidataID: filmID, titleDE: titleDE, titleOriginal: titleOriginal,
            releaseYear: releaseYear, posterSource: posterSource, posterURL: posterURL)
    }

    /// „Pascal empfiehlt dir diesen Film" oder „3 Freunde empfehlen dir
    /// diesen Film".
    var headline: String {
        friends == 1
            ? "\(firstFriend) empfiehlt dir diesen Film"
            : "\(friends) Freunde empfehlen dir diesen Film"
    }

    enum CodingKeys: String, CodingKey {
        case friends, note
        case filmID = "film_id"
        case titleDE = "title_de"
        case titleOriginal = "title_original"
        case releaseYear = "release_year"
        case posterSource = "poster_source"
        case posterURL = "poster_url"
        case firstFriend = "first_friend"
        case friendRating = "friend_rating"
    }
}

extension LiveFilmEntryRepository {
    nonisolated private struct FilmArgument: Encodable { let film: String }
    nonisolated private struct NewRecommendation: Encodable {
        let from_user: String
        let to_user: String
        let film_id: String
        let note: String?
    }

    /// Wem kann ich diesen Film schicken?
    ///
    /// Die Liste ist eine **Auswahl, keine Regel**: wer wirklich
    /// empfehlen darf, entscheidet die Policy auf `recommendations`.
    /// Eine Oberfläche, die nur Freunde anbietet, ist noch keine Sperre.
    func friendsForRecommendation(film: String) async -> [RecommendationTarget] {
        let rows: [RecommendationTarget]? = try? await backend.client
            .rpc("friends_for_recommendation", params: FilmArgument(film: film))
            .execute()
            .value
        return rows ?? []
    }

    /// Den Film an mehrere Freunde schicken.
    ///
    /// Eine Anweisung für alle statt eine je Person: schlägt eine fehl,
    /// weil jemand inzwischen entfolgt oder blockiert hat, soll das
    /// nicht die anderen mitnehmen — deshalb `upsert` mit
    /// `ignoreDuplicates`, und der Fehlerfall wird gemeldet, nicht
    /// verschluckt.
    func recommend(film: String, to friends: [UUID], note: String?) async -> SaveOutcome {
        guard !friends.isEmpty else { return .failed("Wähl mindestens einen Freund.") }
        guard let user = backend.client.auth.currentUser else {
            return .failed("Melde dich an, um zu empfehlen.")
        }

        let text = note?.trimmingCharacters(in: .whitespacesAndNewlines)
        let cleaned = (text?.isEmpty ?? true) ? nil : text
        // Fünfzig Zeichen, wie die Spalte. Hier abgeschnitten statt
        // abgewiesen: der Text steht daneben und ist mitgezählt.
        guard (cleaned?.count ?? 0) <= 50 else { return .failed("Höchstens 50 Zeichen.") }

        let rows = friends.map {
            NewRecommendation(
                from_user: user.id.uuidString, to_user: $0.uuidString,
                film_id: film, note: cleaned)
        }

        do {
            try await backend.client
                .from("recommendations")
                .upsert(rows, onConflict: "from_user,to_user,film_id")
                .execute()
            return .saved
        } catch {
            return .failed(BackendError.from(error).message)
        }
    }

    /// Was Freunde mir empfohlen haben.
    func recommendationsForMe(limit: Int = 12) async -> [Recommendation] {
        let rows: [Recommendation]? = try? await backend.client
            .rpc("recommendations_for_me", params: TileLimit(max_results: limit))
            .execute()
            .value
        return rows ?? []
    }

    /// Eine Empfehlung ausblenden.
    ///
    /// Ausgeblendet und nicht gelöscht — sonst könnte derselbe Freund
    /// denselben Film morgen wieder schicken, und das Ausblenden wäre
    /// folgenlos.
    func dismissRecommendation(film: String) async {
        guard let user = backend.client.auth.currentUser else { return }
        _ = try? await backend.client
            .from("recommendations")
            .update(Dismissal(dismissed_at: ISO8601DateFormatter().string(from: Date())))
            .eq("to_user", value: user.id)
            .eq("film_id", value: film)
            .execute()
    }

    nonisolated private struct Dismissal: Encodable { let dismissed_at: String }
    struct TileLimit: Encodable {
        let max_results: Int
        init(max_results: Int) { self.max_results = max_results }
    }
}
