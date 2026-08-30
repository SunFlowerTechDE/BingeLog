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
/// darüber das Logo.
///
/// **Kein Film wiederholt sich**, und bei jedem Start sind es andere:
/// die Auswahl kommt aus einem Vorrat der bekanntesten und wird gemischt
/// gezogen, ohne Zurücklegen.
///
/// Alle Plakate stehen ab Bild eins — sie kommen aus
/// ``SplashPosterCache`` und nicht aus dem Netz. Solange sie einzeln
/// nachgeladen wurden, erschien jedes für sich in der letzten Sekunde,
/// und der Eindruck war: jedes Plakat animiert sich selbst.
///
/// ## Der Ablauf
///
/// Der dunkle Grund liegt von Anfang bis Ende. Darauf:
///
/// 1. **Auf** — Plakate und Logo kommen aus dem Schwarz, 0,9 s.
/// 2. **Stand** — die Reihen ziehen, das Logo steht.
/// 3. **Zu** — Plakate und Logo gehen ins Schwarz zurück, 0,7 s, und
///    erst danach hebt sich der Grund und gibt die App frei, 0,55 s.
///
/// Die letzte Stufe ist der Grund für den eigenen Grund. Blendete der
/// ganze Bildschirm auf einmal aus, lägen die halbdurchsichtigen Plakate
/// eine halbe Sekunde lang über der App darunter. Nacheinander sieht man
/// nie zwei Bilder gleichzeitig.
struct SplashView: View {
    let posters: [SplashPoster]

    /// Sagt von außen, dass es vorbei ist. Wie es vorbei ist, entscheidet
    /// diese Ansicht.
    let isLeaving: Bool

    /// Wie lange der Abgang insgesamt dauert — die Zeit, die der Aufrufer
    /// nach `isLeaving` noch warten muss, bevor er die Ansicht entfernt.
    static let exitDuration: Double = 1.25

    /// Wie weit eine Reihe wandert, und in welcher Zeit.
    ///
    /// Die Zeit deckt die ganze sichtbare Dauer ab. Wäre sie kürzer,
    /// stünden die Reihen am Ende still, und ein Standbild fällt mehr
    /// auf als eine Bewegung.
    private let travel: CGFloat = 240
    private let travelDuration: Double = 4.8
    private let spacing: CGFloat = 8
    private let rowCount = 5

    @State private var hasStarted = false
    @State private var contentIsVisible = false

    var body: some View {
        GeometryReader { geometry in
            let width = SplashView.posterWidth(
                in: geometry.size, rowCount: rowCount, perRow: perRow,
                spacing: spacing, travel: travel)

            ZStack {
                // Der Grund. Liegt bis zuletzt und geht als Letztes.
                Theme.background
                    .opacity(isLeaving ? 0 : 1)
                    .animation(
                        .easeInOut(duration: 0.55).delay(isLeaving ? 0.7 : 0),
                        value: isLeaving)

                ZStack {
                    VStack(spacing: spacing) {
                        ForEach(Array(rows.enumerated()), id: \.offset) { index, row in
                            PosterRow(posters: row, width: width, spacing: spacing)
                                .offset(
                                    x: SplashView.offset(
                                        forRow: index, travel: travel, hasStarted: hasStarted)
                                )
                                // An den Wert gebunden statt in
                                // `withAnimation` gepackt: so hängt die
                                // Fahrt an genau dieser einen
                                // Zustandsänderung und lässt sich von
                                // nichts anderem unterbrechen.
                                .animation(.linear(duration: travelDuration), value: hasStarted)
                        }
                    }
                    .frame(width: geometry.size.width, height: geometry.size.height)

                    // Derselbe Schleier wie über der Wand auf dem
                    // Anmeldebildschirm: ohne ihn steht das goldene Logo
                    // auf einem hellen Plakat und verschwindet darin.
                    Theme.background.opacity(0.72)

                    Wordmark(markSize: 104)
                }
                .opacity(contentIsVisible && !isLeaving ? 1 : 0)
                // Auf und zu verschieden: hereinkommen darf ruhig etwas
                // dauern, hinausgehen soll zügig sein.
                .animation(
                    isLeaving
                        ? .easeIn(duration: 0.7)
                        : .easeOut(duration: 0.9),
                    value: contentIsVisible && !isLeaving)
            }
            .ignoresSafeArea()
        }
        .ignoresSafeArea()
        .onAppear {
            hasStarted = true
            contentIsVisible = true
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

    /// Wie breit ein Plakat sein muss, damit die Wand den Bildschirm
    /// deckt — in der Breite **und** in der Höhe.
    ///
    /// Bei fester Breite blieb auf dem iPad an allen vier Seiten ein
    /// schwarzer Rand, und beim Fahren schob sich der seitliche ins
    /// Bild. Die Wand hat immer dieselbe Zahl Plakate — mehr gibt es
    /// nicht, ohne dass sich eines wiederholt —, also wächst statt ihrer
    /// Zahl ihre Größe.
    ///
    /// Der Zuschlag für die Fahrt gehört dazu: gedeckt sein muss nicht
    /// die Ruhelage, sondern der äußerste Punkt.
    static func posterWidth(
        in size: CGSize, rowCount: Int, perRow: Int, spacing: CGFloat, travel: CGFloat
    ) -> CGFloat {
        guard perRow > 0, rowCount > 0 else { return 104 }

        let needed = size.width + 2 * travel
        let forWidth = (needed - CGFloat(perRow - 1) * spacing) / CGFloat(perRow)

        let height = (size.height - CGFloat(rowCount - 1) * spacing) / CGFloat(rowCount)
        let forHeight = height / 1.5

        return max(104, forWidth, forHeight)
    }

    /// Wie viele Plakate in eine Reihe kommen.
    private var perRow: Int {
        guard !posters.isEmpty else { return 0 }
        return max(1, Int(ceil(Double(posters.count) / Double(rowCount))))
    }

    /// Fünf Reihen, gleichmäßig aufgeteilt.
    ///
    /// Fünf und nicht drei: bei drei Reihen blieb auf einem iPhone oben
    /// und unten ein schwarzer Streifen. Der Startbildschirm soll
    /// gefüllt sein, nicht ein Band in der Mitte.
    private var rows: [[SplashPoster]] {
        guard perRow > 0 else { return [] }
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
