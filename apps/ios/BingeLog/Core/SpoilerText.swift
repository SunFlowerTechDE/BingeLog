import SwiftUI

/// Eine Rezension, die der Verfasser als Spoiler markiert hat.
///
/// Verdeckt, bis jemand tippt. **Das ist kein Zugriffsschutz** — der
/// Text kommt über dieselbe Antwort wie jeder andere, und wer die API
/// liest, liest ihn. Das Spoiler-Gate der Diskussion ist etwas anderes:
/// es steht in der Policy, und dort gibt Postgres gar nichts heraus
/// (ADR-010).
///
/// Hier geht es um eine Bitte des Verfassers, und die wird respektiert,
/// weil sie vernünftig ist — nicht, weil sie durchgesetzt wäre.
struct SpoilerText: View {
    let text: String
    let hasSpoilers: Bool
    var lineLimit: Int = 3

    @State private var isRevealed = false

    var body: some View {
        if hasSpoilers && !isRevealed {
            Button {
                withAnimation(.easeOut(duration: 0.2)) { isRevealed = true }
            } label: {
                HStack(spacing: 6) {
                    Image(systemName: "eye.slash")
                        .font(.caption2)
                    VStack(alignment: .leading, spacing: 1) {
                        Text("Enthält Spoiler")
                            .font(.caption.weight(.medium))
                        Text("Tippen zum Anzeigen")
                            .font(.caption2)
                            .foregroundStyle(Theme.quiet)
                    }
                }
                .foregroundStyle(Theme.muted)
                .padding(.horizontal, 10)
                .padding(.vertical, 7)
                .frame(maxWidth: .infinity, alignment: .leading)
                .overlay {
                    RoundedRectangle(cornerRadius: 8)
                        .strokeBorder(Theme.border, style: StrokeStyle(lineWidth: 1, dash: [4, 3]))
                }
            }
            .buttonStyle(.plain)
        } else {
            VStack(alignment: .leading, spacing: 2) {
                Text(text)
                    .font(.footnote)
                    .foregroundStyle(Theme.muted)
                    .lineLimit(lineLimit)
                    .fixedSize(horizontal: false, vertical: true)

                // Einmal aufgedeckt bleibt es aufgedeckt, solange die
                // Seite steht. Die Kennzeichnung bleibt aber sichtbar —
                // sonst weiss der Leser hinterher nicht mehr, worauf er
                // sich eingelassen hat.
                if hasSpoilers {
                    Text("Enthält Spoiler")
                        .font(.caption2)
                        .foregroundStyle(Theme.quiet)
                }
            }
        }
    }
}
