import SwiftUI

/// Ein Platzhalter, der sagt, was fehlt.
///
/// Kein leerer Bildschirm und keine angedeutete Oberfläche: eine Liste
/// ohne Inhalt sieht aus wie ein Fehler, und Knöpfe, die nichts tun,
/// sind schlimmer als keine. Hier steht, was hier stehen wird und woran
/// es hängt.
struct ComingSoon: View {
    let title: String
    let symbol: String
    let what: String
    /// Der Punkt in der Roadmap, damit die Auskunft nachprüfbar ist.
    let step: String

    var body: some View {
        VStack(spacing: 14) {
            Image(systemName: symbol)
                .font(.system(size: 44, weight: .light))
                .foregroundStyle(Theme.primary.opacity(0.6))

            Text(title)
                .font(.title3.weight(.semibold))
                .foregroundStyle(Theme.foreground)

            Text(what)
                .font(.callout)
                .foregroundStyle(Theme.muted)
                .multilineTextAlignment(.center)
                .frame(maxWidth: 320)

            Text(step)
                .font(.caption2)
                .foregroundStyle(Theme.quiet)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding(24)
        .background(Theme.background)
        .navigationTitle(title)
    }
}
