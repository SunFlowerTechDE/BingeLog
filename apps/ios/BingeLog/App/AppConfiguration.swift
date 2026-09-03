import Foundation

/// Wo das Backend steht.
///
/// Die Werte kommen aus `Config/Shared.xcconfig` über die erzeugte
/// `Info.plist` (M5 5.1). Im Quelltext steht keine Adresse und kein
/// Schlüssel — ändert sich das Projekt, ändert sich eine Zeile
/// Konfiguration und nicht der Code.
///
/// Der Schlüssel hier ist der publishable: derselbe liegt im
/// Browser-Bundle der Webseite. Er trägt keine Rechte, sondern nur die
/// Identität „niemand". Was geschützt ist, schützt RLS in Postgres.
enum AppConfiguration {
    static let supabaseURL: URL = {
        guard
            let raw = Bundle.main.object(forInfoDictionaryKey: "SupabaseURL") as? String,
            let url = URL(string: raw)
        else {
            // Ohne Adresse gibt es keine App. Früh und laut scheitern
            // ist hier besser als ein Bildschirm, der ewig lädt.
            fatalError("SupabaseURL fehlt in der Info.plist — siehe Config/Shared.xcconfig")
        }
        return url
    }()

    static let supabaseAnonKey: String = {
        guard let key = Bundle.main.object(forInfoDictionaryKey: "SupabaseAnonKey") as? String,
              !key.isEmpty
        else {
            fatalError("SupabaseAnonKey fehlt in der Info.plist — siehe Config/Shared.xcconfig")
        }
        return key
    }()

    /// Die Webseite.
    ///
    /// **Rechtstexte stehen dort und nicht in der App.** Zwei Fassungen
    /// eines Rechtstexts laufen auseinander, und man merkt es erst, wenn
    /// jemand fragt. Ein Link kostet dafür einen Wechsel in den Browser
    /// — das ist der Preis, und er ist kleiner.
    ///
    /// Anders als die beiden Werte darüber ist dies kein Grund zum
    /// Abbruch: ohne Adresse fehlt ein Link, nicht die App.
    static let webBaseURL: URL? = {
        guard
            let raw = Bundle.main.object(forInfoDictionaryKey: "WebBaseURL") as? String,
            let url = URL(string: raw)
        else { return nil }
        return url
    }()

    /// Die Datenschutzerklärung.
    static var privacyPolicyURL: URL? { webBaseURL?.appendingPathComponent("datenschutz") }

    /// Das Impressum (§ 5 DDG).
    static var imprintURL: URL? { webBaseURL?.appendingPathComponent("impressum") }

    /// Die Nutzungsbedingungen.
    static var termsURL: URL? { webBaseURL?.appendingPathComponent("nutzungsbedingungen") }
}
