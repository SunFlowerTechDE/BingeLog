import Foundation
import UIKit

/// Die Plakate des Startbildschirms, auf der Platte.
///
/// Der Startbildschirm hat drei Sekunden und kann in dieser Zeit nichts
/// laden. Gemessen am 31.08.2026: bei 1,8 Sekunden waren die Reihen
/// leer, bei 2,4 Sekunden voll — die Plakate erschienen also einzeln in
/// der letzten Sekunde, und genau das sah aus, als würde jedes Plakat
/// für sich animiert, statt dass eine Reihe fährt.
///
/// Der `URLCache` reicht dafür nicht. Er ist kein Versprechen: was drin
/// liegt, entscheidet der Server über seine Kopfzeilen, und geräumt wird
/// er, wann das System will. Für „beim nächsten Kaltstart ist das Bild
/// in Bild eins da" braucht es eine Ablage, die wir selbst füllen.
///
/// **Das ist kein Spiegel im Sinne der TheTVDB-Lizenz**
/// (`docs/legal/thetvdb-lizenz.md`). Verboten ist die Weitergabe — wir
/// legen fünfzig Bilder auf dem Gerät des Nutzers ab, der sie ohnehin
/// gerade angesehen hat, und geben sie an niemanden weiter. Es liegt in
/// `Caches`: nicht in der Sicherung, jederzeit vom System räumbar. Das
/// ist ein Cache und nichts anderes.
enum SplashPosterCache {
    private static let folder = "splash-posters"

    private static var directory: URL? {
        guard
            let base = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first
        else { return nil }
        let url = base.appendingPathComponent(folder, isDirectory: true)
        try? FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
        return url
    }

    private static func location(for film: Film) -> URL? {
        // Die Wikidata-ID ist `Q` plus Ziffern — als Dateiname
        // unbedenklich, aber geprüft statt geglaubt.
        let safe = film.wikidataID.filter { $0.isLetter || $0.isNumber }
        guard !safe.isEmpty else { return nil }
        return directory?.appendingPathComponent("\(safe).img")
    }

    /// Liest ein Plakat **ohne zu warten**.
    ///
    /// Synchron, weil der Aufrufer der Startbildschirm ist: er wird
    /// gebaut, bevor irgendetwas laufen kann, und ein Bild, das erst
    /// nachgereicht wird, ist genau das Problem, das diese Ablage löst.
    static func image(for film: Film) -> UIImage? {
        guard let location = location(for: film),
            let data = try? Data(contentsOf: location)
        else { return nil }
        return UIImage(data: data)
    }

    /// Holt die Plakate und legt sie ab.
    ///
    /// Gibt zurück, welche Filme danach wirklich ein Bild auf der Platte
    /// haben. Nur die gehören in die Liste für den nächsten Start —
    /// sonst steht dort ein Film, dessen Plakat wieder nachgeladen
    /// werden müsste, und die Lücke wäre zurück.
    static func fill(for films: [Film], webBase: URL) async -> [Film] {
        await withTaskGroup(of: Film?.self) { group in
            for film in films {
                group.addTask {
                    guard let source = film.posterAddress(webBase: webBase),
                        let location = location(for: film)
                    else { return nil }

                    if FileManager.default.fileExists(atPath: location.path) { return film }

                    guard let (data, response) = try? await URLSession.shared.data(from: source),
                        (response as? HTTPURLResponse)?.statusCode == 200,
                        UIImage(data: data) != nil
                    else { return nil }

                    try? data.write(to: location, options: .atomic)
                    return film
                }
            }

            var kept: [Film] = []
            for await film in group {
                if let film { kept.append(film) }
            }
            return kept
        }
    }

    /// Wirft weg, was der nächste Start nicht zeigt.
    ///
    /// Ohne das wächst die Ablage mit jedem Start um fünfzig Bilder,
    /// denn bei jedem Start sind es andere.
    static func prune(keeping films: [Film]) {
        guard let directory else { return }
        let keep = Set(films.compactMap { location(for: $0)?.lastPathComponent })
        let all =
            (try? FileManager.default.contentsOfDirectory(
                at: directory, includingPropertiesForKeys: nil)) ?? []
        for file in all where !keep.contains(file.lastPathComponent) {
            try? FileManager.default.removeItem(at: file)
        }
    }
}
