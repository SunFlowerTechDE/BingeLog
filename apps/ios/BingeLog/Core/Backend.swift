import Foundation
import Supabase

/// Der eine Zugang zum Backend.
///
/// Views kennen dieses Objekt nicht. Zwischen beiden liegen die
/// Repositories (M5 5.2) — sonst wandert die Kenntnis des SDK in die
/// Oberfläche, und ein Wechsel oder eine zweite Plattform kostet jedes
/// Mal beides.
struct Backend {
    let client: SupabaseClient

    static let live = Backend(
        client: SupabaseClient(
            supabaseURL: AppConfiguration.supabaseURL,
            supabaseKey: AppConfiguration.supabaseAnonKey
        )
    )
}
