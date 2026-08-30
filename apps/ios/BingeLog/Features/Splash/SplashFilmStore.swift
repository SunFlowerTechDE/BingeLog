import Foundation

/// Merkt sich die Plakate für den nächsten Kaltstart.
///
/// Der Startbildschirm hat drei Sekunden und kann in dieser Zeit weder
/// die Liste holen noch fünfzig Bilder. Also wird beides einen Start
/// früher besorgt: die Auswahl landet hier, die Bilder in
/// ``SplashPosterCache``.
///
/// **Zufällig bleibt es trotzdem**: jede Auswahl wird frisch gezogen,
/// nur eben einen Start früher. Von außen ist das dasselbe — bei jedem
/// Start andere Filme, keiner doppelt.
///
/// Der allererste Start nach der Installation zeigt keine Plakate,
/// sondern nur Logo auf dunklem Grund. Dagegen hilft nichts: die Bilder
/// liegen dann noch auf keinem Gerät. Das ist ein ruhiger Anblick und
/// allemal besser als Reihen, die sich vor den Augen des Nutzers
/// füllen.
enum SplashFilmStore {
    private static let key = "splash.films"

    static func load() -> [Film] {
        guard let data = UserDefaults.standard.data(forKey: key),
            let films = try? JSONDecoder().decode([Film].self, from: data)
        else { return [] }
        return films
    }

    static func save(_ films: [Film]) {
        guard let data = try? JSONEncoder().encode(films) else { return }
        UserDefaults.standard.set(data, forKey: key)
    }

    /// Was der Startbildschirm zeigen kann — jetzt sofort.
    ///
    /// Ein gemerkter Film ohne Bild auf der Platte fällt raus. Lieber
    /// eine kürzere Reihe als eine Lücke, die sich später füllt.
    static func posters() -> [SplashPoster] {
        load().compactMap { film in
            guard let image = SplashPosterCache.image(for: film) else { return nil }
            return SplashPoster(id: film.wikidataID, image: image)
        }
    }
}
