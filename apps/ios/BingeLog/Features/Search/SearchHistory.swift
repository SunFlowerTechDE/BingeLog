import Foundation

/// Zuletzt gesucht.
///
/// **Lokal auf dem Gerät**, nicht im Konto. Was jemand gesucht hat, ist
/// eine Spur, die niemanden sonst angeht — und für einen Verlauf, der
/// zwischen Geräten wandert, hat noch niemand einen Grund genannt.
///
/// Löschbar, wie das Konzept es verlangt (16).
enum SearchHistory {
    private static let key = "search.history"
    private static let limit = 8

    static func load() -> [String] {
        UserDefaults.standard.stringArray(forKey: key) ?? []
    }

    /// Merkt sich einen Begriff.
    ///
    /// Als eigene Funktion, weil sich `UserDefaults` schlecht prüfen
    /// lässt, die Regel dahinter aber gut.
    static func adding(_ term: String, to existing: [String]) -> [String] {
        let trimmed = term.trimmingCharacters(in: .whitespacesAndNewlines)
        guard trimmed.count >= 2 else { return existing }

        // Ein wiederholter Begriff rückt nach vorn, statt zweimal
        // dazustehen. Gross- und Kleinschreibung zählen dabei nicht.
        var out = existing.filter { $0.caseInsensitiveCompare(trimmed) != .orderedSame }
        out.insert(trimmed, at: 0)
        return Array(out.prefix(limit))
    }

    static func remember(_ term: String) {
        UserDefaults.standard.set(adding(term, to: load()), forKey: key)
    }

    static func forget(_ term: String) {
        UserDefaults.standard.set(load().filter { $0 != term }, forKey: key)
    }

    static func clear() {
        UserDefaults.standard.removeObject(forKey: key)
    }
}
