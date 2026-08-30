import SwiftUI

/// Die Plakatwand über dem Anmeldebildschirm.
///
/// Sie läuft nach unten ins Dunkle aus, wie das Kopfbild auf der
/// Profilseite im Web: oben ganz zu sehen, unten geht sie in den
/// Seitengrund über. Ein harter Schnitt wäre eine Kante quer durch den
/// Bildschirm.
///
/// Die Plakate kommen von TheTVDB und werden **verlinkt, nie
/// gespiegelt** (docs/legal/thetvdb-lizenz.md). Ohne Netz bleibt die
/// Wand leer und der Bildschirm steht trotzdem — für eine Zierde ist ein
/// Fehler kein Ereignis.
struct PosterWall: View {
    let films: [Film]
    var height: CGFloat = 300

    var body: some View {
        ZStack(alignment: .bottom) {
            if films.isEmpty {
                Theme.card
            } else {
                HStack(spacing: 6) {
                    ForEach(columns, id: \.first?.id) { column in
                        VStack(spacing: 6) {
                            ForEach(column) { film in
                                poster(for: film)
                            }
                        }
                    }
                }
                // Leicht angeschnitten und angehoben: eine Reihe, die
                // exakt aufgeht, sieht nach Raster aus statt nach Wand.
                .offset(y: -20)
            }

            // Zwei Lagen, und beide gehören dazu.
            //
            // Ein gleichmäßiger Schleier nimmt der Wand die Buntheit —
            // ohne ihn steht der goldene Schriftzug auf einem hellen
            // Plakat und verschwindet darin. Der Verlauf darüber führt
            // nach unten in den Seitengrund; ein harter Schnitt wäre
            // eine Kante quer durch den Bildschirm.
            //
            // Beide enden auf `Theme.background` und nicht auf Schwarz:
            // die Wand soll in die Seite übergehen, nicht in ein Loch.
            Theme.background.opacity(0.55)

            LinearGradient(
                colors: [
                    Theme.background.opacity(0.1),
                    Theme.background.opacity(0.85),
                    Theme.background,
                ],
                startPoint: .top,
                endPoint: .bottom
            )
        }
        .frame(height: height)
        .clipped()
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }

    /// Drei Spalten, versetzt gefüllt.
    private var columns: [[Film]] {
        let perColumn = max(1, films.count / 3)
        return stride(from: 0, to: films.count, by: perColumn).map {
            Array(films[$0..<min($0 + perColumn, films.count)])
        }
    }

    private func poster(for film: Film) -> some View {
        AsyncImage(url: film.posterAddress(webBase: URL(string: "https://bingelog.eu")!)) { image in
            image.resizable().aspectRatio(2 / 3, contentMode: .fill)
        } placeholder: {
            Rectangle().fill(Theme.card)
        }
        .frame(height: 132)
        .clipShape(RoundedRectangle(cornerRadius: 6))
    }
}
