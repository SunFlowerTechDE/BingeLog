import SwiftUI

@main
struct BingeLogApp: App {
    /// Einmal zusammengesteckt, hier und nirgends sonst.
    ///
    /// Die Repositories bekommen das Backend, die Ansichten bekommen
    /// die Repositories. Keine Ansicht greift selbst auf das SDK zu
    /// (M5 5.2) — das ist die Zeile, an der das durchgesetzt wird.
    private let backend = Backend.live
    @State private var session: SessionStore

    init() {
        let backend = Backend.live
        _session = State(
            initialValue: SessionStore(
                auth: LiveAuthRepository(backend: backend),
                profiles: LiveProfileRepository(backend: backend)
            ))
    }

    var body: some Scene {
        WindowGroup {
            RootView(
                films: LiveFilmRepository(backend: backend),
                profiles: LiveProfileRepository(backend: backend)
            )
                .environment(session)
                .task { await session.restore() }
        }
    }
}
