import Foundation

/// Was schiefgehen kann, als Aufzählung statt als Text.
///
/// Ein `Error` mit einer Zeichenkette zwingt jede aufrufende Stelle
/// dazu, Wörter zu vergleichen. Eine Aufzählung lässt sich vollständig
/// behandeln, und der Compiler merkt an, wenn ein Fall dazukommt
/// (M5 5.2).
enum BackendError: Error, Equatable {
    /// Kein Netz, oder das Backend antwortet nicht.
    case unreachable
    /// Zugangsdaten stimmen nicht.
    case invalidCredentials
    /// Angemeldet sein wäre nötig gewesen.
    case notSignedIn
    /// Die Antwort kam an, ließ sich aber nicht lesen.
    case malformedResponse
    /// Alles andere, mit dem Originaltext fürs Log — nie für den Nutzer.
    case other(String)

    /// Was ein Mensch dazu liest. Deutsch, geduzt, knapp.
    var message: String {
        switch self {
        case .unreachable:
            "Keine Verbindung. Versuch es gleich noch einmal."
        case .invalidCredentials:
            "E-Mail oder Passwort stimmen nicht."
        case .notSignedIn:
            "Melde dich an."
        case .malformedResponse:
            "Die Antwort war unbrauchbar."
        case .other:
            "Das hat nicht geklappt."
        }
    }

    /// Aus einem beliebigen Fehler einen benannten machen.
    static func from(_ error: Error) -> BackendError {
        if let known = error as? BackendError { return known }

        let text = String(describing: error).lowercased()
        if text.contains("invalid login") || text.contains("invalid_credentials") {
            return .invalidCredentials
        }
        if error is URLError { return .unreachable }
        return .other(String(describing: error))
    }
}
