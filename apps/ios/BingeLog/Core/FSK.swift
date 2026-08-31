import SwiftUI

/// Die FSK-Kennzeichen.
///
/// Die fünf Stufen und ihre amtlichen Farben. Die Farben sind fest und
/// **nicht** aus dem Farbschema der App: sie sind das Erkennungszeichen.
/// Ein blaues Kennzeichen, das anderswo grün würde, wäre keins mehr.
///
/// Deshalb steht die Zahl auch immer darin — Farbe allein trägt keine
/// Information für den, der sie nicht unterscheiden kann.
struct FSKLevel: Sendable {
    let value: Int
    let label: String
    let text: String
    let ground: Color
    let ink: Color

    static let all: [FSKLevel] = [
        FSKLevel(
            value: 0, label: "FSK 0", text: "ohne Altersbeschränkung",
            ground: Color(hex: 0xFFFFFF), ink: Color(hex: 0x111111)),
        FSKLevel(
            value: 6, label: "FSK 6", text: "ab 6 Jahren",
            ground: Color(hex: 0xF2C200), ink: Color(hex: 0x111111)),
        FSKLevel(
            value: 12, label: "FSK 12", text: "ab 12 Jahren",
            ground: Color(hex: 0x009C49), ink: Color(hex: 0xFFFFFF)),
        FSKLevel(
            value: 16, label: "FSK 16", text: "ab 16 Jahren",
            ground: Color(hex: 0x0071B9), ink: Color(hex: 0xFFFFFF)),
        FSKLevel(
            value: 18, label: "FSK 18", text: "ab 18 Jahren",
            ground: Color(hex: 0xD4021D), ink: Color(hex: 0xFFFFFF)),
    ]

    static func level(for value: Int?) -> FSKLevel? {
        all.first { $0.value == value }
    }
}

/// Das Kennzeichen selbst.
struct FSKBadge: View {
    let value: Int?

    var body: some View {
        // `nil` heisst „wir wissen es nicht" und **nicht** „ohne
        // Beschränkung". Der Unterschied ist bei einer Altersfreigabe
        // kein sprachlicher, deshalb ein eigenes, farbloses Zeichen.
        if let level = FSKLevel.level(for: value) {
            Text(level.label)
                .font(.caption2.weight(.bold))
                .foregroundStyle(level.ink)
                .padding(.horizontal, 7)
                .padding(.vertical, 3)
                .background(level.ground, in: RoundedRectangle(cornerRadius: 4))
                .accessibilityLabel("\(level.label), \(level.text)")
        } else {
            Text("FSK ?")
                .font(.caption2.weight(.bold))
                .foregroundStyle(Theme.muted)
                .padding(.horizontal, 7)
                .padding(.vertical, 3)
                .overlay { RoundedRectangle(cornerRadius: 4).strokeBorder(Theme.border) }
                .accessibilityLabel("Altersfreigabe nicht bekannt")
        }
    }
}
