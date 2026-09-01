import Foundation
import Supabase

/// Eine Binge-Liste in der Übersicht.
nonisolated struct ListSummary: Decodable, Identifiable, Sendable {
    let id: UUID
    let title: String
    let description: String?
    let isPublic: Bool
    let films: Int
    /// Die ersten drei Wikidata-IDs, für die Vorschau.
    let posters: [String]

    enum CodingKeys: String, CodingKey {
        case id, title, description, films, posters
        case isPublic = "is_public"
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(UUID.self, forKey: .id)
        title = try c.decode(String.self, forKey: .title)
        description = try c.decodeIfPresent(String.self, forKey: .description)
        isPublic = (try? c.decode(Bool.self, forKey: .isPublic)) ?? true
        films = (try? c.decode(Int.self, forKey: .films)) ?? 0
        posters = (try? c.decode([String].self, forKey: .posters)) ?? []
    }
}

/// Ein Film in einer Liste.
nonisolated struct ListFilm: Decodable, Identifiable, Sendable {
    let filmID: String
    let titleDE: String?
    let titleOriginal: String
    let releaseYear: Int?
    let posterSource: String?
    let posterURL: String?
    let ord: Int
    let note: String?

    var id: String { filmID }

    var film: Film {
        Film(
            wikidataID: filmID, titleDE: titleDE, titleOriginal: titleOriginal,
            releaseYear: releaseYear, posterSource: posterSource, posterURL: posterURL)
    }

    enum CodingKeys: String, CodingKey {
        case ord, note
        case filmID = "film_id"
        case titleDE = "title_de"
        case titleOriginal = "title_original"
        case releaseYear = "release_year"
        case posterSource = "poster_source"
        case posterURL = "poster_url"
    }
}

/// Binge-Listen lesen und pflegen.
protocol ListRepository: Sendable {
    func lists(of profile: UUID) async -> [ListSummary]
    func films(in list: UUID) async -> [ListFilm]
    func create(title: String, description: String?, isPublic: Bool) async -> SaveOutcome
    func update(id: UUID, title: String, description: String?, isPublic: Bool) async
        -> SaveOutcome
    func delete(id: UUID) async -> SaveOutcome
    func add(film: String, to list: UUID, at ord: Int) async -> SaveOutcome
    func remove(film: String, from list: UUID) async -> SaveOutcome
}

struct LiveListRepository: ListRepository {
    let backend: Backend

    nonisolated private struct ProfileArgument: Encodable { let profile: String }
    nonisolated private struct ListArgument: Encodable { let list: String }
    nonisolated private struct NewList: Encodable {
        let user_id: String
        let title: String
        let description: String?
        let is_public: Bool
    }
    nonisolated private struct ListFields: Encodable {
        let title: String
        let description: String?
        let is_public: Bool
    }
    nonisolated private struct NewItem: Encodable {
        let list_id: String
        let film_id: String
        let ord: Int
    }

    func lists(of profile: UUID) async -> [ListSummary] {
        let rows: [ListSummary]? = try? await backend.client
            .rpc("lists_of", params: ProfileArgument(profile: profile.uuidString))
            .execute()
            .value
        return rows ?? []
    }

    func films(in list: UUID) async -> [ListFilm] {
        let rows: [ListFilm]? = try? await backend.client
            .rpc("list_films", params: ListArgument(list: list.uuidString))
            .execute()
            .value
        return rows ?? []
    }

    func create(title: String, description: String?, isPublic: Bool) async -> SaveOutcome {
        guard let user = backend.client.auth.currentUser else {
            return .failed("Melde dich an.")
        }
        let name = title.trimmingCharacters(in: .whitespacesAndNewlines)
        // Dieselben Grenzen wie der CHECK auf der Tabelle, damit der
        // Nutzer sie vor dem Abschicken sieht und nicht danach.
        guard (1...80).contains(name.count) else {
            return .failed("Der Titel braucht ein bis achtzig Zeichen.")
        }

        do {
            try await backend.client
                .from("lists")
                .insert(
                    NewList(
                        user_id: user.id.uuidString, title: name,
                        description: clean(description), is_public: isPublic)
                )
                .execute()
            return .saved
        } catch {
            return .failed(BackendError.from(error).message)
        }
    }

    func update(id: UUID, title: String, description: String?, isPublic: Bool) async
        -> SaveOutcome
    {
        let name = title.trimmingCharacters(in: .whitespacesAndNewlines)
        guard (1...80).contains(name.count) else {
            return .failed("Der Titel braucht ein bis achtzig Zeichen.")
        }

        do {
            try await backend.client
                .from("lists")
                .update(
                    ListFields(
                        title: name, description: clean(description), is_public: isPublic)
                )
                .eq("id", value: id)
                .execute()
            return .saved
        } catch {
            return .failed(BackendError.from(error).message)
        }
    }

    func delete(id: UUID) async -> SaveOutcome {
        do {
            try await backend.client.from("lists").delete().eq("id", value: id).execute()
            return .saved
        } catch {
            return .failed(BackendError.from(error).message)
        }
    }

    /// Hinten anhängen.
    ///
    /// `ord` bekommt der Aufrufer aus der Länge der Liste. Eine
    /// eindeutige Bedingung gibt es auf `ord` bewusst nicht — zwei
    /// Filme auf derselben Zahl sind kein Schaden, solange die
    /// Sortierung eindeutig bleibt, und beim Umsortieren wäre sie nur
    /// im Weg.
    func add(film: String, to list: UUID, at ord: Int) async -> SaveOutcome {
        do {
            try await backend.client
                .from("list_items")
                .upsert(
                    NewItem(list_id: list.uuidString, film_id: film, ord: ord),
                    onConflict: "list_id,film_id"
                )
                .execute()
            return .saved
        } catch {
            return .failed(BackendError.from(error).message)
        }
    }

    func remove(film: String, from list: UUID) async -> SaveOutcome {
        do {
            try await backend.client
                .from("list_items")
                .delete()
                .eq("list_id", value: list)
                .eq("film_id", value: film)
                .execute()
            return .saved
        } catch {
            return .failed(BackendError.from(error).message)
        }
    }

    private func clean(_ text: String?) -> String? {
        let trimmed = text?.trimmingCharacters(in: .whitespacesAndNewlines)
        return (trimmed?.isEmpty ?? true) ? nil : trimmed
    }
}
