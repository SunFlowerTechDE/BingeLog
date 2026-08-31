import SwiftUI

/// Die Einheit der Bewertung: Eimer Popcorn, keine Sterne.
///
/// Gespeichert wird 1 bis 10, gezeigt werden 0,5 bis 5,0. Halbe Stufen
/// gibt es von der ersten Migration an mit Absicht — von fünf Stufen
/// später auf zehn zu gehen, hätte stillschweigend geändert, was jede
/// bestehende Bewertung bedeutet (M3, Fallstricke).
///
/// Drei gezeichnete Zustände, dieselben Dateien wie im Web:
///
///   leer   nur die Umrisslinie
///   halb   der Eimer, gestreift, ohne Inhalt
///   voll   der Eimer mit Popcorn
///
/// Ein früherer Versuch hat die volle Zeichnung bei 50 % beschnitten.
/// Das ging nicht: ein Eimer ist eine Zeichnung mit Streifen und
/// ausgefranstem Rand, keine Silhouette, und die Hälfte davon liest sich
/// nicht als Hälfte von irgendetwas.
enum Popcorn {
    /// Kleiner geht nicht, ohne dass die drei Zustände verschwimmen.
    static let minimumSize: CGFloat = 18

    /// Wie gross ein Eimer sein darf, damit fünf davon in eine Breite
    /// passen.
    ///
    /// Zum Setzen sollen sie so gross sein wie der Platz hergibt — sie
    /// waren mit 22 Punkten zu klein, um sie mit dem Finger sicher zu
    /// treffen. Die Zeichnung wächst also mit der Karte statt fest zu
    /// stehen.
    static func size(fitting width: CGFloat, spacing: CGFloat = 2) -> CGFloat {
        let available = width - spacing * 4
        return max(minimumSize, min(38, available / 5))
    }

    /// „7" wird zu „3,5" — mit deutschem Komma.
    static func format(_ rating: Int) -> String {
        String(format: "%.1f", Double(rating) / 2).replacingOccurrences(of: ".", with: ",")
    }

    static func format(_ average: Double) -> String {
        String(format: "%.1f", average / 2).replacingOccurrences(of: ".", with: ",")
    }

    /// Wie viele Halbe eines Eimers gefüllt sind.
    static func fill(rating: Double, index: Int) -> Int {
        let halves = rating - Double(index) * 2
        if halves >= 2 { return 2 }
        if halves >= 1 { return 1 }
        return 0
    }
}

/// Ein Eimer.
struct PopcornBucket: View {
    let fill: Int
    let size: CGFloat

    var body: some View {
        // Jeder Zustand ist dasselbe Element in derselben Box. Im Web
        // hatten leerer und voller Eimer verschiedene Grundlinien, und
        // eine geänderte Bewertung schob alles darunter herum.
        Image(name)
            .resizable()
            .renderingMode(fill == 0 ? .template : .original)
            .aspectRatio(contentMode: .fit)
            .foregroundStyle(Theme.muted.opacity(0.7))
            .frame(width: size, height: size)
    }

    private var name: String {
        switch fill {
        case 2: return "PopcornOn"
        case 1: return "PopcornHalf"
        default: return "PopcornOff"
        }
    }
}

/// Eine Bewertung zum Lesen.
struct PopcornRating: View {
    let rating: Double
    var size: CGFloat = 20

    var body: some View {
        HStack(spacing: 2) {
            ForEach(0..<5, id: \.self) { index in
                PopcornBucket(fill: Popcorn.fill(rating: rating, index: index), size: size)
            }
        }
        .accessibilityElement()
        .accessibilityLabel("\(Popcorn.format(rating)) von 5 Popcorn")
    }
}

/// Eine Bewertung zum Setzen.
///
/// **Zwei Taps von der Filmseite bis zur Bewertung** — das ist die
/// wichtigste Kennzahl (ADR-009). Deshalb tippt man direkt auf den
/// Eimer; die halbe Stufe liegt auf der linken Hälfte.
struct PopcornPicker: View {
    @Binding var rating: Int
    var size: CGFloat = 32

    /// Wie viel Luft um einen Eimer herum noch mitzählt.
    ///
    /// Apple nennt 44 Punkte als kleinstes Ziel, das ein Finger sicher
    /// trifft. Ein Eimer von 28 ist kleiner — die fehlenden Punkte
    /// kommen als unsichtbarer Rand dazu, statt die Zeichnung
    /// aufzublasen, bis sie nicht mehr in die Karte passt.
    private var padding: CGFloat { max(0, (44 - size) / 2) }

    var body: some View {
        HStack(spacing: 2) {
            ForEach(0..<5, id: \.self) { index in
                PopcornBucket(fill: Popcorn.fill(rating: Double(rating), index: index), size: size)
                    .padding(.vertical, padding)
                    .contentShape(Rectangle())
                    .onTapGesture { location in
                        // Linke Hälfte ist die halbe Stufe, rechte die
                        // volle. Ziehen geht auch, siehe unten.
                        set(index: index, isHalf: location.x < size / 2)
                    }
            }
        }
        .contentShape(Rectangle())
        .gesture(
            DragGesture(minimumDistance: 0)
                .onChanged { value in
                    let step = size + 2
                    let index = min(4, max(0, Int(value.location.x / step)))
                    let inside = value.location.x - Double(index) * step
                    set(index: index, isHalf: inside < size / 2)
                }
        )
        .accessibilityElement()
        .accessibilityLabel("Deine Bewertung")
        .accessibilityValue("\(Popcorn.format(rating)) von 5 Popcorn")
        .accessibilityAdjustableAction { direction in
            switch direction {
            case .increment: rating = min(10, rating + 1)
            case .decrement: rating = max(1, rating - 1)
            default: break
            }
        }
    }

    private func set(index: Int, isHalf: Bool) {
        let value = index * 2 + (isHalf ? 1 : 2)
        guard value != rating else { return }
        rating = value
        UISelectionFeedbackGenerator().selectionChanged()
    }
}
