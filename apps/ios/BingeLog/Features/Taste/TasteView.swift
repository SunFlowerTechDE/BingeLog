import SwiftUI

/// Der Geschmackscheck.
///
/// Ein Plakat, ein Titel, drei Knöpfe. Man muss den Film nicht kennen —
/// die Frage ist, ob er einen reizt, und die beantwortet ein Plakat.
struct TasteView: View {
    @State private var model: TasteModel

    init(taste: TasteRepository, entries: FilmEntryRepository) {
        _model = State(initialValue: TasteModel(taste: taste, entries: entries))
    }

    var body: some View {
        Group {
            if model.isLoading {
                ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if let card = model.current {
                deck(card)
            } else {
                done
            }
        }
        .background(Theme.background)
        .navigationTitle("Geschmackscheck")
        .navigationBarTitleDisplayMode(.inline)
        .task { await model.load() }
    }

    // ----------------------------------------------------------------

    private func deck(_ card: TasteCard) -> some View {
        VStack(spacing: 0) {
            ReadinessBar(readiness: model.readiness)
                .padding(.horizontal, 20)
                .padding(.bottom, 16)

            ZStack {
                // Die Karte darunter, nur angedeutet: sie sagt, dass es
                // weitergeht, ohne vom Plakat abzulenken.
                if let next = model.next {
                    CardFace(card: next, isSaved: false, onKeep: {})
                        .scaleEffect(0.94)
                        .offset(y: 14)
                        .opacity(0.45)
                        .allowsHitTesting(false)
                }

                CardFace(
                    card: card,
                    isSaved: model.saved.contains(card.filmID),
                    onKeep: { Task { await model.keep(card) } }
                )
                .id(card.filmID)
                .transition(.asymmetric(
                    insertion: .scale(scale: 0.95).combined(with: .opacity),
                    removal: .opacity))
            }
            .animation(.snappy(duration: 0.22), value: card.filmID)
            .padding(.horizontal, 20)

            Spacer(minLength: 12)

            buttons(card)
                .padding(.horizontal, 20)
                .padding(.bottom, 8)

            Text("Das ist keine Bewertung — sie trainiert nur die Vorschläge.")
                .font(.caption2)
                .foregroundStyle(Theme.quiet)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 24)
                .padding(.bottom, 12)

            if let note = model.note {
                Text(note)
                    .font(.footnote)
                    .foregroundStyle(.red)
                    .padding(.bottom, 12)
            }
        }
        .padding(.top, 12)
    }

    private func buttons(_ card: TasteCard) -> some View {
        HStack(spacing: 12) {
            ForEach(TasteVerdict.allCases) { verdict in
                Button {
                    model.decide(verdict, on: card)
                } label: {
                    VStack(spacing: 5) {
                        Image(systemName: verdict.symbol)
                            .font(.title3)
                        Text(shortLabel(verdict))
                            .font(.caption.weight(.medium))
                    }
                    .foregroundStyle(tint(verdict))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                    .background(Theme.card, in: RoundedRectangle(cornerRadius: 14))
                    .overlay {
                        RoundedRectangle(cornerRadius: 14).strokeBorder(Theme.border)
                    }
                }
                .buttonStyle(.plain)
                .accessibilityLabel(verdict.label)
            }
        }
    }

    /// Unter dem Symbol steht die kurze Form. „Gefällt mir nicht" bricht
    /// bei drei Knöpfen nebeneinander um.
    private func shortLabel(_ verdict: TasteVerdict) -> String {
        switch verdict {
        case .like: return "Ja"
        case .dislike: return "Nein"
        case .unsure: return "Weiß nicht"
        }
    }

    private func tint(_ verdict: TasteVerdict) -> Color {
        switch verdict {
        case .like: return Theme.primary
        case .dislike: return Theme.foreground
        case .unsure: return Theme.muted
        }
    }

    private var done: some View {
        VStack(spacing: 14) {
            Image(systemName: "checkmark.circle")
                .font(.system(size: 44, weight: .light))
                .foregroundStyle(Theme.primary.opacity(0.7))

            Text("Das war der Katalog.")
                .font(.callout)
                .foregroundStyle(Theme.foreground)
            Text("Mehr Karten gibt es, sobald neue Filme dazukommen.")
                .font(.footnote)
                .foregroundStyle(Theme.muted)

            ReadinessBar(readiness: model.readiness)
                .padding(.horizontal, 20)
                .padding(.top, 8)
        }
        .multilineTextAlignment(.center)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding(24)
        .task { await model.finish() }
    }
}

/// Wie weit das Profil trägt, als Balken mit Zahl.
///
/// Die Zahl steht **immer** da, auch bei 12 von 100. Eine Anzeige, die
/// erst ab einer Schwelle erscheint, sagt einem nicht, wie weit man
/// noch ist.
struct ReadinessBar: View {
    let readiness: TasteReadiness

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text(readiness.label)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(readiness.isUsable ? Theme.primary : Theme.foreground)

                Spacer()

                Text("\(readiness.readiness) von 100")
                    .font(.caption)
                    .foregroundStyle(Theme.muted)
                    .monospacedDigit()
            }

            GeometryReader { geometry in
                ZStack(alignment: .leading) {
                    Capsule().fill(Theme.card)
                    Capsule()
                        .fill(readiness.isUsable ? Theme.primary : Theme.muted)
                        .frame(width: geometry.size.width * CGFloat(readiness.readiness) / 100)
                }
            }
            .frame(height: 6)

            Text(detail)
                .font(.caption2)
                .foregroundStyle(Theme.quiet)
        }
        .animation(.easeOut(duration: 0.3), value: readiness.readiness)
    }

    /// Sagt, woran es hängt. „Noch zu wenig" allein hilft niemandem
    /// weiter — die Abdeckung ist der Teil, den man beeinflussen kann.
    private var detail: String {
        let gedeckt = "\(readiness.categoriesCovered) von 16 Kategorien"
        if readiness.rated == 0 {
            return "\(gedeckt) · \(readiness.votes) Karten"
        }
        return "\(gedeckt) · \(readiness.votes) Karten, \(readiness.rated) Bewertungen"
    }
}

/// Das Plakat in Kartengröße.
///
/// `PosterThumbnail` gibt es schon, aber mit fester Breite — hier soll
/// das Plakat den Platz nehmen, den es kriegt, und dabei sein
/// Seitenverhältnis behalten.
private struct BigPoster: View {
    let film: Film

    @State private var artwork: PosterArtwork?

    var body: some View {
        PosterImage(artwork: artwork)
            .aspectRatio(2.0 / 3.0, contentMode: .fit)
            .frame(maxWidth: .infinity)
            .clipShape(RoundedRectangle(cornerRadius: 16))
            .task(id: film.wikidataID) {
                artwork = await PosterLoader.load(for: film)
            }
    }
}

/// Eine Karte: Plakat, Titel, Jahr, Kategorie — und Merken.
private struct CardFace: View {
    let card: TasteCard
    let isSaved: Bool
    let onKeep: () -> Void

    var body: some View {
        VStack(spacing: 0) {
            BigPoster(film: card.film)
                .overlay(alignment: .topTrailing) { keepButton }

            VStack(spacing: 3) {
                Text(card.title)
                    .font(.headline)
                    .foregroundStyle(Theme.foreground)
                    .lineLimit(2)
                    .multilineTextAlignment(.center)

                Text(subtitle)
                    .font(.caption)
                    .foregroundStyle(Theme.muted)
            }
            .padding(.top, 12)
            .padding(.horizontal, 8)
        }
    }

    private var subtitle: String {
        [card.releaseYear.map(String.init), card.categoryLabel]
            .compactMap { $0 }
            .joined(separator: " · ")
    }

    /// Merken sitzt auf dem Plakat, nicht bei den drei Knöpfen: eine
    /// Stimme blättert weiter, danach gäbe es nichts mehr zu merken.
    private var keepButton: some View {
        Button(action: onKeep) {
            Image(systemName: isSaved ? "bookmark.fill" : "bookmark")
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(isSaved ? Theme.onPrimary : .white)
                .padding(9)
                .background(isSaved ? AnyShapeStyle(Theme.primary) : AnyShapeStyle(.ultraThinMaterial),
                    in: Circle())
        }
        .buttonStyle(.plain)
        .padding(10)
        .disabled(isSaved)
        .accessibilityLabel(isSaved ? "Vorgemerkt" : "Auf die Watchlist")
    }
}
