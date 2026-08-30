import Foundation

/// Merkt sich die Plakate für den nächsten Kaltstart.
///
/// Ohne das erscheint der Startbildschirm leer und füllt sich erst in
/// seiner letzten Sekunde: erst muss die Liste geholt werden, dann
/// dreißig Bilder. Gemessen am 31.08.2026 — bei 1,8 Sekunden waren die
/// Reihen noch leer, bei 2,4 Sekunden voll.
///
/// Also wird die Auswahl am Ende eines Starts abgelegt und beim nächsten
/// sofort gezeigt. Die Bilder liegen dann bereits im `URLCache` und sind
/// da, bevor die erste Sekunde vorbei ist.
///
/// **Zufällig bleibt es trotzdem**: jede Auswahl wird frisch gezogen,
/// nur eben einen Start früher. Von außen ist das dasselbe — bei jedem
/// Start andere Filme, keiner doppelt.
///
/// Der allererste Start nach der Installation zeigt leere Reihen. Dagegen
/// hilft nichts: die Bilder liegen dann noch auf keinem Gerät.
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
}
