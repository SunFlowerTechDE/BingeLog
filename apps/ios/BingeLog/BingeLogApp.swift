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

    /// Das Zeichen zum Abgang. Der Startbildschirm blendet daraufhin
    /// selbst aus — erst seinen Inhalt, dann seinen Grund —, und erst
    /// wenn er damit durch ist, wird er entfernt.
    @State private var splashIsLeaving = false

    /// Beim Bauen schon gefüllt, und zwar mit fertigen Bildern von der
    /// Platte — die Auswahl stammt vom letzten Start
    /// (`SplashFilmStore`, `SplashPosterCache`). Nichts wird während
    /// der drei Sekunden nachgeladen.
    @State private var splashPosters: [SplashPoster] = SplashFilmStore.posters()

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
                    profiles: LiveProfileRepository(backend: backend),
                    discover: LiveDiscoverRepository(backend: backend),
                    lazyFilms: LiveLazyFilmRepository(backend: backend)
                )
                .environment(session)

                if isStarting {
                    SplashView(posters: splashPosters, isLeaving: splashIsLeaving)
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
        async let next: [Film] = repository.shuffledWithArtwork(count: 50)

        try? await Task.sleep(for: .seconds(3))
        await restored

        // Ausblenden und dann erst entfernen. Andersherum — entfernen
        // und das Ausblenden einer Transition überlassen — lägen die
        // halbdurchsichtigen Plakate eine halbe Sekunde über der App
        // darunter. So sieht man nie zwei Bilder gleichzeitig.
        splashIsLeaving = true
        try? await Task.sleep(for: .seconds(SplashView.exitDuration))
        isStarting = false

        // Erst danach die Bilder holen. Fünfzig Plakate herunterzuladen
        // dauert länger als der Startbildschirm steht — das gehört
        // hinter ihn, nicht vor ihn. Gemerkt wird nur, was danach
        // wirklich auf der Platte liegt.
        let base = URL(string: "https://bingelog.eu")!
        let cached = await SplashPosterCache.fill(for: await next, webBase: base)
        SplashFilmStore.save(cached)
        SplashPosterCache.prune(keeping: cached)
    }
}
