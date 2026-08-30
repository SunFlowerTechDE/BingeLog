import Foundation
import Supabase

/// Das Profil hinter einem Konto.
///
/// Ein Konto und ein Profil sind zweierlei: nach der Registrierung gibt
/// es ein Konto, aber noch keinen Benutzernamen. Genau dieser Zustand
/// führt im Web auf `/willkommen` und hier auf die Namenswahl.
protocol ProfileRepository: Sendable {
    func currentUsername() async -> String?
    func availability(of name: String) async -> NameAvailability
    func chooseUsername(_ name: String) async throws(BackendError)
}

/// Ob ein Name noch zu haben ist.
///
/// Die Antwort ist ein Hinweis, keine Zusage: zwischen Prüfung und
/// Absenden kann jemand schneller sein. Entschieden wird in der
/// Datenbank.
enum NameAvailability: Equatable, Sendable {
    case empty
    case tooShort
    case free
    case taken
    case reserved

    /// Was ein Mensch dazu liest.
    var message: String {
        switch self {
        case .empty: ""
        case .tooShort: "Mindestens drei Zeichen."
        case .free: "Frei."
        case .taken: "Schon vergeben."
        case .reserved: "Dieser Name ist reserviert."
        }
    }
}

/// Die Regeln für Benutzernamen.
///
/// **Nur Kleinbuchstaben**, dieselbe Regel wie im Web (Migration
/// 20260826130000). Gemischte Schreibung bräuchte einen eigenen Index
/// für die Eindeutigkeit, sonst könnten `BingeLog` und `bingelog` beide
/// existieren — zwei Profile, die in jeder Erwähnung gleich aussehen.
enum Username {
    static let pattern = /^[a-z0-9_]{3,20}$/

    /// Aus einer Eingabe einen zulässigen Namen machen.
    ///
    /// Kleinschreiben statt abweisen: wer „BingeLog" tippt, meint
    /// „bingelog", und eine Fehlermeldung dafür ist eine Hürde ohne
    /// Zweck.
    static func sanitise(_ input: String) -> String {
        let lowered = input.lowercased().replacingOccurrences(
            of: "\\s+", with: "_", options: .regularExpression)
        let allowed = lowered.filter { $0.isASCII && ($0.isLetter || $0.isNumber || $0 == "_") }
        return String(allowed.prefix(20))
    }
}

struct LiveProfileRepository: ProfileRepository {
    let backend: Backend

    private struct ProfileRow: Decodable { let username: String }
    private struct ReservedRow: Decodable { let username: String }
    private struct NewProfile: Encodable {
        let id: UUID
        let username: String
    }

    func currentUsername() async -> String? {
        guard let userID = try? await backend.client.auth.session.user.id else { return nil }

        let rows: [ProfileRow]? = try? await backend.client
            .from("profiles")
            .select("username")
            .eq("id", value: userID)
            .limit(1)
            .execute()
            .value

        return rows?.first?.username
    }

    func availability(of name: String) async -> NameAvailability {
        let clean = Username.sanitise(name)
        if clean.isEmpty { return .empty }
        guard (try? Username.pattern.wholeMatch(in: clean)) != nil else { return .tooShort }

        let reserved: [ReservedRow]? = try? await backend.client
            .from("reserved_usernames")
            .select("username")
            .eq("username", value: clean)
            .limit(1)
            .execute()
            .value
        if reserved?.isEmpty == false { return .reserved }

        let taken: [ProfileRow]? = try? await backend.client
            .from("profiles")
            .select("username")
            .eq("username", value: clean)
            .limit(1)
            .execute()
            .value
        if taken?.isEmpty == false { return .taken }

        return .free
    }

    func chooseUsername(_ name: String) async throws(BackendError) {
        let clean = Username.sanitise(name)
        guard (try? Username.pattern.wholeMatch(in: clean)) != nil else {
            throw BackendError.other("bad_username")
        }

        do {
            let userID = try await backend.client.auth.session.user.id
            try await backend.client
                .from("profiles")
                .insert(NewProfile(id: userID, username: clean))
                .execute()
        } catch {
            // Reservierte Namen fängt ein Trigger ab, doppelte der
            // Primärschlüssel. Beide sagen dasselbe: such dir einen
            // anderen.
            let text = String(describing: error).lowercased()
            if text.contains("reserved") || text.contains("duplicate")
                || text.contains("23505")
            {
                throw BackendError.other("name_taken")
            }
            throw BackendError.from(error)
        }
    }
}
