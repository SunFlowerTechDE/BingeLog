import SwiftUI

/// Die Farben der Seite, in Swift.
///
/// Dieselben Werte wie im Web, aus `globals.css` umgerechnet — und
/// dieselben wie in den Mailvorlagen (`docs/betrieb/mailvorlagen.md`).
/// Als Hex und nicht als `oklch`, weil SwiftUI das nicht kennt.
///
/// Fest verdrahtet und nicht aus dem Systemfarbschema: das Gold ist das
/// Erkennungszeichen. Eine Tönung, die auf einem anderen Gerät anders
/// ausfällt, wäre keins.
enum Theme {
    static let background = Color(hex: 0x0C0D10)
    static let card = Color(hex: 0x14161A)
    static let border = Color(hex: 0x2B2E33)
    static let foreground = Color(hex: 0xEDEEF1)
    static let muted = Color(hex: 0x95989F)
    static let quiet = Color(hex: 0x6F7279)
    static let primary = Color(hex: 0xEFBC4B)
    static let onPrimary = Color(hex: 0x161107)
}

extension Color {
    /// Aus einem Hexwert, wie ihn die Web-Tokens hergeben.
    init(hex: UInt32) {
        self.init(
            .sRGB,
            red: Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8) & 0xFF) / 255,
            blue: Double(hex & 0xFF) / 255,
            opacity: 1
        )
    }
}
