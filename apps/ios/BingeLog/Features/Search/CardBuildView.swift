import SwiftUI
import UIKit

/// Die Takte, aus denen das Anlegen besteht.
///
/// Dieselben sechs wie im Web (`apps/web/src/components/card-build.tsx`)
/// und in denselben Längen. Die Dauer ist Absicht und hängt nicht davon
/// ab, was gefunden wurde: ein Film mit Plakat und einer mit
/// prozeduraler Karte brauchen gleich lang, weil beides dasselbe
/// Ereignis ist — jemand hat einen Film in den Katalog gestellt, den es
/// darin nicht gab, und ab jetzt steht er für alle da.
enum BuildBeat: Int, CaseIterable {
    case dim, assemble, title, unroll, flip, restore, done

    /// Wie lang der Takt dauert.
    var seconds: Double {
        switch self {
        case .dim: return 2
        case .assemble: return 3
        case .title: return 3
        case .unroll: return 2
        case .flip: return 3
        case .restore: return 2
        case .done: return 0
        }
    }

    /// Ab welcher Sekunde er beginnt.
    var start: Double {
        BuildBeat.allCases.prefix(rawValue).reduce(0) { $0 + $1.seconds }
    }

    /// Insgesamt fünfzehn Sekunden.
    static var total: Double { BuildBeat.done.start }

    func hasReached(_ other: BuildBeat) -> Bool { rawValue >= other.rawValue }

    /// Was unter der Karte steht.
    func caption(hasPoster: Bool) -> String {
        switch self {
        case .dim: return "Wird angelegt"
        case .assemble: return "Die Karte setzt sich zusammen"
        case .title: return "Der Titel wird gesetzt"
        case .unroll: return hasPoster ? "Das Plakat wird abgerollt" : "TheTVDB hat kein Plakat"
        case .flip: return "Die Karte wird gewendet"
        case .restore, .done: return "Fertig"
        }
    }
}

/// Die Karte, während sie entsteht.
///
/// Der Vorhang ist der erste und der letzte Takt, deshalb hängt er an
/// derselben Uhr wie die Karte und ist nicht einfach an.
struct CardBuildView: View {
    let film: CreatedFilm
    let artwork: PosterArtwork?
    let onDone: () -> Void

    /// Wer weniger Bewegung eingestellt hat, bekommt die fertige Karte
    /// sofort — lange genug, um sie zu lesen, und die Bildunterschrift
    /// sagt trotzdem, was passiert ist.
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    @State private var beat: BuildBeat = .dim
    @State private var clock: Task<Void, Never>?

    private let cardWidth: CGFloat = 220
    private var cardHeight: CGFloat { cardWidth * 1.5 }

    private var hasPoster: Bool {
        if case .photograph = artwork { return true }
        return false
    }

    /// Klar vor dem ersten Takt und wieder, sobald der letzte beginnt.
    private var isDimmed: Bool {
        beat != .dim && beat != .restore && beat != .done
    }

    var body: some View {
        ZStack {
            Color.black
                .opacity(isDimmed ? 0.62 : 0)
                .ignoresSafeArea()
                .animation(.easeInOut(duration: 2), value: isDimmed)

            VStack(spacing: 28) {
                Text(titleLine)
                    .font(.title3.weight(.semibold))
                    .foregroundStyle(Theme.foreground)
                    .multilineTextAlignment(.center)
                    .opacity(beat == .dim ? 0 : 1)
                    .animation(.easeOut(duration: 0.7), value: beat == .dim)

                card

                VStack(spacing: 6) {
                    Text(beat.caption(hasPoster: hasPoster))
                        .font(.footnote)
                        .foregroundStyle(Theme.muted)
                        .accessibilityAddTraits(.updatesFrequently)
                    Text("Tippen überspringt")
                        .font(.caption2)
                        .foregroundStyle(Theme.quiet)
                }
            }
            .padding(.horizontal, 24)
        }
        // Antippen geht früher weiter. Der Film ist da längst
        // gespeichert — die Zeremonie ist ein Bericht, kein Schritt, den
        // man abbrechen könnte.
        .contentShape(Rectangle())
        .onTapGesture { finish() }
        .onAppear { start() }
        .onDisappear { clock?.cancel() }
    }

    private var titleLine: String {
        guard let year = film.releaseYear else { return film.title }
        return "\(film.title) (\(year))"
    }

    // ----------------------------------------------------------------
    // Die Karte
    // ----------------------------------------------------------------

    private var card: some View {
        ZStack {
            if beat.hasReached(.flip) {
                // Rückseite: die fertige Karte. Sie ist das, was die
                // Wendung zeigt, und was die Liste von hier an führt.
                PosterImage(artwork: artwork)
                    .frame(width: cardWidth, height: cardHeight)
                    .clipShape(RoundedRectangle(cornerRadius: 10))
                    // Gegen die Drehung des Behälters, sonst stünde sie
                    // spiegelverkehrt.
                    .rotation3DEffect(.degrees(180), axis: (x: 0, y: 1, z: 0))
            } else {
                front
            }
        }
        .frame(width: cardWidth, height: cardHeight)
        .shadow(radius: 24, y: 12)
        .rotation3DEffect(
            .degrees(beat.hasReached(.flip) ? 180 : 0),
            axis: (x: 0, y: 1, z: 0),
            perspective: 0.6
        )
        .animation(
            reduceMotion ? nil : .timingCurve(0.65, 0, 0.35, 1, duration: BuildBeat.flip.seconds),
            value: beat.hasReached(.flip)
        )
        .accessibilityLabel("Karte für \(film.title) wird angelegt")
    }

    private var front: some View {
        ZStack {
            // Die tausend Splitter. Gezeichnet und nicht gelayoutet: für
            // tausend Ansichten müsste SwiftUI in jedem Bild tausend
            // Rahmen rechnen, für eine Zeichenfläche keinen.
            FragmentField(
                seed: film.wikidataID,
                ground: artwork?.ground ?? Theme.card,
                accent: artwork?.accent ?? Theme.border,
                size: CGSize(width: cardWidth, height: cardHeight),
                isRunning: beat == .assemble,
                isSettled: beat.hasReached(.title)
            )
            .opacity(beat.hasReached(.assemble) ? 1 : 0)
            .animation(.easeOut(duration: 0.5), value: beat.hasReached(.assemble))

            // Der Titel wird gesetzt. Im Web sind das die Zeilen im SVG;
            // hier steht er darüber, weil die Karte vom Server kommt und
            // nicht zerlegt wird (ADR-012). Zu sehen ist dasselbe.
            VStack(alignment: .leading, spacing: 8) {
                Spacer(minLength: 0)

                Text(film.title)
                    .font(.system(size: 30, weight: .bold))
                    .foregroundStyle(Theme.foreground)
                    .lineLimit(3)
                    .minimumScaleFactor(0.6)
                    .opacity(beat.hasReached(.title) ? 1 : 0)
                    .blur(radius: beat.hasReached(.title) ? 0 : 5)
                    .offset(y: beat.hasReached(.title) ? 0 : 12)
                    .animation(
                        reduceMotion ? nil : .easeOut(duration: BuildBeat.title.seconds * 0.8),
                        value: beat.hasReached(.title))

                if let year = film.releaseYear {
                    // Jahr und Regie schließen die Karte im vierten Takt
                    // ab — dafür ist er da, wenn TheTVDB nichts zum
                    // Abrollen hat.
                    Text(String(year))
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(Theme.muted)
                        .opacity(beat.hasReached(.unroll) ? 1 : 0)
                        .animation(.easeOut(duration: 0.9), value: beat.hasReached(.unroll))
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(18)

            // Das Plakat rollt von der unteren Kante nach oben auf.
            if case .photograph(let image) = artwork {
                Image(uiImage: image)
                    .resizable()
                    .aspectRatio(contentMode: .fill)
                    .frame(width: cardWidth, height: cardHeight)
                    .clipped()
                    .mask(alignment: .bottom) {
                        Rectangle()
                            .frame(height: beat.hasReached(.unroll) ? cardHeight : 0)
                    }
                    .animation(
                        reduceMotion ? nil : .linear(duration: BuildBeat.unroll.seconds),
                        value: beat.hasReached(.unroll))
            }
        }
        .frame(width: cardWidth, height: cardHeight)
        .background(artwork?.ground ?? Theme.card)
        .clipShape(RoundedRectangle(cornerRadius: 10))
    }

    // ----------------------------------------------------------------
    // Die Uhr
    // ----------------------------------------------------------------

    /// Einmal angeworfen und an einem Punkt verankert.
    ///
    /// Jeder Übergang wird gegen den Beginn gerechnet und nicht gegen den
    /// vorherigen. So kann ein Bild mitten im Takt die Uhr nicht
    /// verschieben: das Ganze dauert fünfzehn Sekunden, immer.
    private func start() {
        guard clock == nil else { return }

        if reduceMotion {
            beat = .restore
            clock = Task {
                try? await Task.sleep(for: .seconds(2.6))
                guard !Task.isCancelled else { return }
                onDone()
            }
            return
        }

        clock = Task {
            let begin = ContinuousClock.now
            for next in BuildBeat.allCases.dropFirst() {
                let due = begin.advanced(by: .seconds(next.start))
                try? await Task.sleep(until: due, clock: .continuous)
                guard !Task.isCancelled else { return }
                beat = next
            }
            onDone()
        }
    }

    private func finish() {
        clock?.cancel()
        clock = nil
        onDone()
    }
}
