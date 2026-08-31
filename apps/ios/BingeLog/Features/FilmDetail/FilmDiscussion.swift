import Foundation
import Supabase

/// Der Zustand der Diskussion zu einem Film.
struct ThreadState: Decodable, Sendable {
    let messageCount: Int
    let viewerCount: Int
    let isActive: Bool
    let isLocked: Bool
    let lockedReason: String?

    enum CodingKeys: String, CodingKey {
        case messageCount = "message_count"
        case viewerCount = "viewer_count"
        case isActive = "is_active"
        case isLocked = "is_locked"
        case lockedReason = "locked_reason"
    }

    static let none = ThreadState(
        messageCount: 0, viewerCount: 0, isActive: false, isLocked: false, lockedReason: nil)

    init(
        messageCount: Int, viewerCount: Int, isActive: Bool, isLocked: Bool, lockedReason: String?
    ) {
        self.messageCount = messageCount
        self.viewerCount = viewerCount
        self.isActive = isActive
        self.isLocked = isLocked
        self.lockedReason = lockedReason
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        messageCount = (try? c.decode(Int.self, forKey: .messageCount)) ?? 0
        viewerCount = (try? c.decode(Int.self, forKey: .viewerCount)) ?? 0
        isActive = (try? c.decode(Bool.self, forKey: .isActive)) ?? false
        isLocked = (try? c.decode(Bool.self, forKey: .isLocked)) ?? false
        lockedReason = try? c.decodeIfPresent(String.self, forKey: .lockedReason)
    }
}

/// Ein Beitrag.
struct ThreadMessage: Decodable, Identifiable, Sendable {
    let id: UUID
    let parentID: UUID?
    let body: String
    let createdAt: String
    let editedAt: String?
    let userID: UUID
    let username: String?

    var created: Date? { FeedEntry.timestamp(from: createdAt) }

    private struct Profile: Decodable { let username: String }

    enum CodingKeys: String, CodingKey {
        case id, body, profiles
        case parentID = "parent_id"
        case createdAt = "created_at"
        case editedAt = "edited_at"
        case userID = "user_id"
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(UUID.self, forKey: .id)
        parentID = try c.decodeIfPresent(UUID.self, forKey: .parentID)
        body = try c.decode(String.self, forKey: .body)
        createdAt = try c.decode(String.self, forKey: .createdAt)
        editedAt = try c.decodeIfPresent(String.self, forKey: .editedAt)
        userID = try c.decode(UUID.self, forKey: .userID)
        username = (try? c.decodeIfPresent(Profile.self, forKey: .profiles))??.username
    }
}

extension LiveFilmEntryRepository {
    private struct SettingRow: Decodable { let value: Int }
    private struct NewMessage: Encodable {
        let film_id: String
        let user_id: String
        let parent_id: String?
        let body: String
    }

    /// Ob der Raum überhaupt aufgegangen ist.
    func thread(for filmID: String) async -> ThreadState {
        let rows: [ThreadState]? = try? await backend.client
            .from("film_threads")
            .select("message_count, viewer_count, is_active, is_locked, locked_reason")
            .eq("film_id", value: filmID)
            .execute()
            .value
        return rows?.first ?? .none
    }

    /// Ab wie vielen Zuschauern er aufgeht.
    ///
    /// Aus der Konfiguration und nicht fest verdrahtet: die Schwelle
    /// ändert sich mit der Nutzerzahl (Migration …340000).
    func discussionThreshold() async -> Int {
        let rows: [SettingRow]? = try? await backend.client
            .from("app_settings")
            .select("value")
            .eq("key", value: "discussion_threshold")
            .execute()
            .value
        return rows?.first?.value ?? 5
    }

    /// Die Beiträge.
    ///
    /// **Das Spoiler-Gate steht in der Policy auf `thread_messages`,
    /// nicht hier** (ADR-010). Wer den Film nicht bewertet hat, bekommt
    /// von Postgres eine leere Antwort — die Ansicht darunter blendet
    /// nichts aus, sie hat schlicht nichts. Eine ausgeblendete
    /// Komponente wäre kein Schutz.
    func messages(for filmID: String) async -> [ThreadMessage] {
        let rows: [ThreadMessage]? = try? await backend.client
            .from("thread_messages")
            .select(
                "id, parent_id, body, created_at, edited_at, user_id, profiles(username)")
            .eq("film_id", value: filmID)
            .order("created_at", ascending: true)
            .execute()
            .value
        return rows ?? []
    }

    /// Einen Beitrag schreiben.
    func post(filmID: String, body: String, replyingTo parent: UUID?) async -> SaveOutcome {
        let text = body.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return .failed("Schreib etwas.") }
        guard text.count <= 2000 else { return .failed("Höchstens 2000 Zeichen.") }
        guard let user = backend.client.auth.currentUser else {
            return .failed("Melde dich an, um mitzureden.")
        }

        do {
            try await backend.client
                .from("thread_messages")
                .insert(
                    NewMessage(
                        film_id: filmID, user_id: user.id.uuidString,
                        parent_id: parent?.uuidString, body: text)
                )
                .execute()
            return .saved
        } catch {
            return .failed(BackendError.from(error).message)
        }
    }
}
