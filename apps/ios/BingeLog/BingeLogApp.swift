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

    /// Der Startbildschirm, und zwar **nur beim Kaltstart**.
    ///
    /// Eine `App` wird einmal je Prozess gebaut. Aus dem Hintergrund
    /// zurückzukehren erzeugt sie nicht neu, also erscheint er dabei
    /// auch nicht — was richtig ist: wer die App wechselt und
    /// zurückkommt, will weiterarbeiten und keine Vorstellung sehen.
    @State private var isStarting = true

    /// Beim Bauen schon gefüllt, damit die Reihen nicht leer anfangen —
    /// die Auswahl stammt vom letzten Start (`SplashFilmStore`).
    @State private var splashFilms: [Film] = SplashFilmStore.load()

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
            ZStack {
                RootView(
                    films: LiveFilmRepository(backend: backend),
                    profiles: LiveProfileRepository(backend: backend)
                )
                .environment(session)

                if isStarting {
                    SplashView(films: splashFilms)
                        .transition(.opacity)
                }
            }
            .task { await start() }
        }
    }

    /// Der Kaltstart.
    ///
    /// Drei Sekunden **und** die Sitzung, nicht das eine oder das
    /// andere: verschwände der Startbildschirm nach drei Sekunden,
    /// während die Sitzung noch lädt, folgte auf die Vorstellung ein
    /// Ladekringel.
    private func start() async {
        let repository = LiveFilmRepository(backend: backend)

        // Die Sitzung sofort mitlaufen lassen, damit sie die drei
        // Sekunden nutzt statt sie zu verlängern.
        async let restored: Void = session.restore()

        // Die Auswahl für **das nächste Mal** ziehen. Diesmal steht
        // schon da, was der letzte Start hinterlassen hat.
        async let next: [Film] = repository.shuffledWithArtwork(count: 30)

        try? await Task.sleep(for: .seconds(3))
        await restored
        SplashFilmStore.save(await next)

        withAnimation(.easeInOut(duration: 0.5)) { isStarting = false }
    }
}
