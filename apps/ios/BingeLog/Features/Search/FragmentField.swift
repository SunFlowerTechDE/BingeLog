import SwiftUI

/// Tausend Splitter, die sich zu einer leeren Karte zusammensetzen.
///
/// 25 × 40. Die Zahl ist der Punkt, deshalb steht sie als Raster da und
/// nicht als Zahl.
///
/// Gezeichnet auf einer `Canvas` und nicht als tausend Ansichten: für
/// tausend Ansichten müsste das Layout in jedem Bild tausend Rahmen
/// rechnen, für eine Zeichenfläche keinen. Im Web ist es aus demselben
/// Grund ein `<canvas>`.
struct FragmentField: View {
    let seed: String
    let ground: Color
    let accent: Color
    let size: CGSize
    let isRunning: Bool
    /// Ab dem Titel-Takt ist die Karte fertig zusammengesetzt und muss
    /// nur noch dastehen — ohne das wäre sie leer, sobald die Uhr weiter
    /// ist.
    let isSettled: Bool

    private static let columns = 25
    private static let rows = 40

    /// Anteil des Taktes, den ein einzelner Splitter unterwegs ist.
    private static let travel = 0.45

    /// Anteil seines Fluges, in dem er seine eigene Tönung wieder
    /// abgibt.
    private static let settle = 0.32

    var body: some View {
        TimelineView(.animation(paused: !isRunning)) { timeline in
            Canvas { context, _ in
                let progress = isSettled ? 1 : self.progress(at: timeline.date)
                draw(in: &context, progress: progress)
            }
        }
        .frame(width: size.width, height: size.height)
        .onAppear { began = Date() }
        .accessibilityHidden(true)
    }

    @State private var began = Date()

    private func progress(at now: Date) -> Double {
        guard isRunning else { return 0 }
        let elapsed = now.timeIntervalSince(began)
        return min(max(elapsed / BuildBeat.assemble.seconds, 0), 1)
    }

    private func draw(in context: inout GraphicsContext, progress: Double) {
        for fragment in Self.fragments(seed: seed, size: size) {
            let raw = (progress - fragment.delay) / Self.travel
            guard raw > 0 else { continue }

            let p = min(raw, 1)
            let eased = 1 - pow(1 - p, 3)
            let scale = 0.3 + 0.7 * eased

            // Der halbe Punkt Überstand schließt die Fugen, sobald alle
            // angekommen sind.
            let w = fragment.size.width * scale + 0.6
            let h = fragment.size.height * scale + 0.6

            let x = fragment.from.x + (fragment.to.x - fragment.from.x) * eased
            let y = fragment.from.y + (fragment.to.y - fragment.from.y) * eased

            var layer = context
            layer.translateBy(x: x, y: y)
            layer.rotate(by: .radians(fragment.rotation * (1 - eased)))

            let box = CGRect(x: -w / 2, y: -h / 2, width: w, height: h)

            // Unterwegs trägt jeder Splitter seine eigene Tönung — das
            // ist es, was tausend davon als tausend lesbar macht. Beim
            // Ankommen gibt er sie ab: eine leere Karte ist ein Grund und
            // kein Mosaik.
            layer.opacity = eased
            layer.fill(Path(box), with: .color(mixed(fragment.tint)))

            let settled = (eased - (1 - Self.settle)) / Self.settle
            if settled > 0 {
                layer.opacity = settled
                layer.fill(Path(box), with: .color(ground))
            }
        }
    }

    private func mixed(_ amount: Double) -> Color {
        // Zwischen Grund und Schmuckfarbe, wie im Web.
        ground.mixed(with: accent, by: amount)
    }

    // ----------------------------------------------------------------

    private struct Fragment {
        let from: CGPoint
        let to: CGPoint
        let size: CGSize
        let rotation: Double
        let delay: Double
        let tint: Double
    }

    /// Derselbe Film streut immer gleich.
    ///
    /// Ein eigener Zufallsgenerator mit fester Saat, nicht
    /// `Double.random`: sonst sähe dieselbe Karte bei jedem Anlegen
    /// anders aus, und "dieselbe Karte überall" hörte hier auf.
    private static func fragments(seed: String, size: CGSize) -> [Fragment] {
        var random = Mulberry32(seed: hash32(seed))
        let cell = CGSize(width: size.width / Double(columns), height: size.height / Double(rows))
        var out: [Fragment] = []
        out.reserveCapacity(columns * rows)

        for row in 0..<rows {
            for column in 0..<columns {
                let angle = random.next() * 2 * .pi
                let distance = 160 + random.next() * 320
                out.append(
                    Fragment(
                        from: CGPoint(
                            x: size.width / 2 + cos(angle) * distance,
                            y: size.height / 2 + sin(angle) * distance),
                        to: CGPoint(
                            x: Double(column) * cell.width + cell.width / 2,
                            y: Double(row) * cell.height + cell.height / 2),
                        size: cell,
                        rotation: (random.next() - 0.5) * 2.4,
                        delay: random.next() * (1 - travel),
                        tint: random.next() * 0.85
                    ))
            }
        }
        return out
    }

    /// Derselbe Streuwert wie im Web (`hash32` aus `@binge-log/poster`).
    ///
    /// Über **UTF-16** und nicht über UTF-8: das Web zählt mit
    /// `charCodeAt`, und das sind UTF-16-Einheiten. Für eine
    /// Wikidata-ID macht das keinen Unterschied — sie ist `Q` und
    /// Ziffern —, aber eine Regel, die nur zufällig stimmt, stimmt
    /// nicht.
    static func hash32(_ text: String) -> UInt32 {
        var hash: UInt32 = 0x811c_9dc5
        for unit in text.utf16 {
            hash ^= UInt32(unit)
            hash = hash &* 0x0100_0193
        }
        return hash
    }

    private struct Mulberry32 {
        private var state: UInt32
        init(seed: UInt32) { state = seed }

        mutating func next() -> Double {
            state = state &+ 0x6d2b_79f5
            var t = state
            t = (t ^ (t >> 15)) &* (t | 1)
            t ^= t &+ ((t ^ (t >> 7)) &* (t | 61))
            return Double((t ^ (t >> 14))) / 4_294_967_296
        }
    }
}

extension Color {
    /// Linear zwischen zwei Farben.
    func mixed(with other: Color, by amount: Double) -> Color {
        let a = UIColor(self)
        let b = UIColor(other)
        var ar: CGFloat = 0, ag: CGFloat = 0, ab: CGFloat = 0, aa: CGFloat = 0
        var br: CGFloat = 0, bg: CGFloat = 0, bb: CGFloat = 0, ba: CGFloat = 0
        a.getRed(&ar, green: &ag, blue: &ab, alpha: &aa)
        b.getRed(&br, green: &bg, blue: &bb, alpha: &ba)
        let t = CGFloat(min(max(amount, 0), 1))
        return Color(
            .sRGB,
            red: Double(ar + (br - ar) * t),
            green: Double(ag + (bg - ag) * t),
            blue: Double(ab + (bb - ab) * t),
            opacity: 1
        )
    }
}
