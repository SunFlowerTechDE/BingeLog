import SwiftUI

/// Der Startbildschirm beim Kaltstart.
///
/// Drei Reihen Plakate, die abwechselnd nach links und rechts ziehen,
/// darüber das Logo. Blendet ein und wieder aus.
///
/// **Kein Film wiederholt sich**, und bei jedem Start sind es andere:
/// die Auswahl kommt aus einem Vorrat der bekanntesten und wird gemischt
/// gezogen, ohne Zurücklegen.
///
/// Die Reihen ziehen nur ein Stück und laufen nicht endlos im Kreis. Für
/// drei Sekunden reicht das, und ein nahtloser Umlauf bräuchte dieselben
/// Plakate zweimal — was hier ausdrücklich nicht sein soll.
struct SplashView: View {
    let films: [Film]

    /// Wie weit eine Reihe in den drei Sekunden wandert.
    ///
    /// 130 Punkte statt der 60 vom ersten Versuch. Bei 60 bewegte sich
    /// zwar alles, aber so langsam, dass man es nicht als Fahrt sah —
    /// was auffiel, war das Erscheinen einzelner Plakate beim Laden.
    /// Eine Reihe muss sich sichtbar als Reihe bewegen, sonst ist es
    /// keine.
    private let travel: CGFloat = 130
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
                    PosterRow(
                        films: row,
                        width: posterWidth,
                        spacing: spacing,
                        offset: SplashView.offset(
                            forRow: index, travel: travel, hasStarted: hasStarted)
                    )
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
        }
        .onAppear {
            withAnimation(.linear(duration: 3)) { hasStarted = true }
            withAnimation(.easeOut(duration: 0.6)) { logoIsVisible = true }
        }
    }

    /// Wo eine Reihe steht.
    ///
    /// Gerade Reihen ziehen nach links, ungerade nach rechts — sie
    /// starten auf der einen Seite und enden auf der anderen, und die
    /// Animation dazwischen macht `withAnimation`.
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
    private var rows: [[Film]] {
        guard !films.isEmpty else { return [] }
        let perRow = max(1, Int(ceil(Double(films.count) / Double(rowCount))))
        return stride(from: 0, to: films.count, by: perRow).map {
            Array(films[$0..<min($0 + perRow, films.count)])
        }
    }
}

/// Eine Reihe Plakate, verschoben.
private struct PosterRow: View {
    let films: [Film]
    let width: CGFloat
    let spacing: CGFloat
    let offset: CGFloat

    var body: some View {
        HStack(spacing: spacing) {
            ForEach(films) { film in
                AsyncImage(
                    url: film.posterAddress(webBase: URL(string: "https://bingelog.eu")!)
                ) { phase in
                    // Eingeblendet statt hineingesprungen. Sonst
                    // erscheint jedes Plakat für sich, sobald es geladen
                    // ist, und der Eindruck ist ein Aufpoppen einzelner
                    // Bilder statt einer fahrenden Reihe.
                    ZStack {
                        Theme.card
                        if let image = phase.image {
                            image
                                .resizable()
                                .aspectRatio(2 / 3, contentMode: .fill)
                                .transition(.opacity)
                        }
                    }
                    .animation(.easeIn(duration: 0.45), value: phase.image != nil)
                }
                .frame(width: width, height: width * 1.5)
                .clipShape(RoundedRectangle(cornerRadius: 8))
            }
        }
        .offset(x: offset)
        .fixedSize()
        .accessibilityHidden(true)
    }
}
