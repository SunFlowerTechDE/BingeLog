import SwiftUI
import UIKit

/// Ein Plakat, das schon da ist.
///
/// Bild und nicht Adresse: der Startbildschirm zeigt nur, was beim Bauen
/// bereits auf der Platte liegt. Alles andere käme zu spät.
struct SplashPoster: Identifiable {
    let id: String
    let image: UIImage
}

/// Der Startbildschirm beim Kaltstart.
///
/// Fünf Reihen Plakate, die abwechselnd nach links und rechts ziehen,
/// darüber das Logo. Blendet ein und wieder aus.
///
/// **Kein Film wiederholt sich**, und bei jedem Start sind es andere:
/// die Auswahl kommt aus einem Vorrat der bekanntesten und wird gemischt
/// gezogen, ohne Zurücklegen.
///
/// Die Reihen ziehen nur ein Stück und laufen nicht endlos im Kreis. Für
/// drei Sekunden reicht das, und ein nahtloser Umlauf bräuchte dieselben
/// Plakate zweimal — was hier ausdrücklich nicht sein soll.
///
/// Alle Plakate stehen ab Bild eins. Solange sie einzeln nachgeladen
/// wurden, erschien jedes für sich in der letzten Sekunde, und der
/// Eindruck war: jedes Plakat animiert sich selbst. Es fuhr durchaus
/// jede Reihe als Block — nur war zur Fahrt noch nichts zu sehen.
/// Deshalb kommen die Bilder aus `SplashPosterCache` und nicht aus dem
/// Netz.
struct SplashView: View {
    let posters: [SplashPoster]

    /// Wie weit eine Reihe in den drei Sekunden wandert.
    private let travel: CGFloat = 160
    private let posterWidth: CGFloat = 104
    private let spacing: CGFloat = 8
    private let rowCount = 5

    @State private var hasStarted = false
    @State private var logoIsVisible = false

    var body: some View {
        ZStack {
            Theme.background.ignoresSafeArea()

            VStack(spacing: spacing) {
                ForEach(Array(rows.enumerated()), id: \.offset) { index, row in
                    PosterRow(posters: row, width: posterWidth, spacing: spacing)
                        .offset(
                            x: SplashView.offset(
                                forRow: index, travel: travel, hasStarted: hasStarted)
                        )
                        // An den Wert gebunden statt in `withAnimation`
                        // gepackt: so hängt die Fahrt an genau dieser
                        // einen Zustandsänderung und lässt sich von
                        // nichts anderem unterbrechen.
                        .animation(.linear(duration: 3), value: hasStarted)
                }
            }
            .frame(maxHeight: .infinity)
            .ignoresSafeArea()

            // Derselbe Schleier wie über der Wand auf dem
            // Anmeldebildschirm: ohne ihn steht das goldene Logo auf
            // einem hellen Plakat und verschwindet darin.
            Theme.background.opacity(0.72).ignoresSafeArea()

            Wordmark(markSize: 104)
                .opacity(logoIsVisible ? 1 : 0)
                .scaleEffect(logoIsVisible ? 1 : 0.94)
                .animation(.easeOut(duration: 0.6), value: logoIsVisible)
        }
        .onAppear {
            hasStarted = true
            logoIsVisible = true
        }
    }

    /// Wo eine Reihe steht.
    ///
    /// Gerade Reihen ziehen nach links, ungerade nach rechts — sie
    /// starten auf der einen Seite und enden auf der anderen.
    ///
    /// Als eigene Funktion, weil sich eine Animation nicht prüfen lässt,
    /// die Regel dahinter aber schon.
    static func offset(forRow index: Int, travel: CGFloat, hasStarted: Bool) -> CGFloat {
        let toTheLeft = index.isMultiple(of: 2)
        let target = toTheLeft ? -travel : travel
        return hasStarted ? target : -target
    }

    /// Fünf Reihen, gleichmäßig aufgeteilt.
    ///
    /// Fünf und nicht drei: bei drei Reihen à 156 Punkten blieb auf
    /// einem iPhone oben und unten ein schwarzer Streifen. Der
    /// Startbildschirm soll gefüllt sein, nicht ein Band in der Mitte.
    private var rows: [[SplashPoster]] {
        guard !posters.isEmpty else { return [] }
        let perRow = max(1, Int(ceil(Double(posters.count) / Double(rowCount))))
        return stride(from: 0, to: posters.count, by: perRow).map {
            Array(posters[$0..<min($0 + perRow, posters.count)])
        }
    }
}

/// Eine Reihe Plakate.
///
/// Verschoben wird die Reihe, nicht das einzelne Plakat: der Versatz
/// sitzt am `HStack`, und die Bilder darin haben keine eigene Animation.
private struct PosterRow: View {
    let posters: [SplashPoster]
    let width: CGFloat
    let spacing: CGFloat

    var body: some View {
        HStack(spacing: spacing) {
            ForEach(posters) { poster in
                Image(uiImage: poster.image)
                    .resizable()
                    .aspectRatio(2 / 3, contentMode: .fill)
                    .frame(width: width, height: width * 1.5)
                    .clipShape(RoundedRectangle(cornerRadius: 8))
            }
        }
        .fixedSize()
        .accessibilityHidden(true)
    }
}
