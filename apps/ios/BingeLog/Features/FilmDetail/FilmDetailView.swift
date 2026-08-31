import SwiftUI

/// Die Seite zu einem Film (M5 5.4).
///
/// Der Aufbau folgt dem Entwurf vom 31.08.2026: das Plakat über die
/// ganze Breite und nach unten ins Dunkle auslaufend, darüber der Titel,
/// darunter die beiden Zahlen, dann Besetzung, Rezension, Datum,
/// Sichtbarkeit und der Knopf.
///
/// **Zwei Taps bis zur Bewertung** — von hier aus einer auf den Eimer,
/// einer auf Speichern. Das ist die wichtigste Kennzahl, und alles
/// andere auf dieser Seite ist freiwillig (ADR-009).
struct FilmDetailView: View {
    @State private var model: FilmDetailModel
    @Environment(SessionStore.self) private var session
    @Environment(\.dismiss) private var dismiss

    init(film: Film, details: FilmDetailRepository, entries: FilmEntryRepository) {
        _model = State(
            initialValue: FilmDetailModel(film: film, details: details, entries: entries))
    }

    var body: some View {
        @Bindable var model = model

        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                Backdrop(film: model.film, artwork: model.artwork)

                VStack(alignment: .leading, spacing: 20) {
                    facts

                    RatingCards(
                        summary: model.summary,
                        rating: $model.rating,
                        canRate: session.isSignedIn
                    )

                    if let detail = model.detail, !detail.cast.isEmpty {
                        CastBlock(names: detail.cast)
                    }

                    if session.isSignedIn {
                        entryForm
                    } else {
                        Text("Melde dich an, um zu bewerten und einzutragen.")
                            .font(.footnote)
                            .foregroundStyle(Theme.muted)
                    }

                    Divider().overlay(Theme.border)

                    catalogue
                }
                .padding(.horizontal, 20)
            }
            .padding(.bottom, 28)
        }
        .background(Theme.background)
        .ignoresSafeArea(edges: .top)
        .navigationBarBackButtonHidden()
        .overlay(alignment: .top) { headerButtons }
        .task { await model.load() }
    }

    // ----------------------------------------------------------------
    // Kopf
    // ----------------------------------------------------------------

    private var headerButtons: some View {
        HStack {
            CircleButton(symbol: "arrow.left", label: "Zurück") { dismiss() }

            Spacer()

            if session.isSignedIn {
                CircleButton(
                    symbol: model.isOnWatchlist ? "bookmark.fill" : "bookmark",
                    label: model.isOnWatchlist ? "Von der Watchlist nehmen" : "Auf die Watchlist",
                    isOn: model.isOnWatchlist
                ) {
                    Task { await model.toggleWatchlist() }
                }
            }

            Menu {
                // Melden ist **immer und überall** erreichbar — das ist
                // eine Zusage und keine Bequemlichkeit (M4 4.7).
                Button("Melden", systemImage: "flag") {}
                    .disabled(true)
                Button("Teilen", systemImage: "square.and.arrow.up") {}
                    .disabled(true)
            } label: {
                CircleLabel(symbol: "ellipsis")
            }
            .accessibilityLabel("Mehr")
        }
        .padding(.horizontal, 16)
        .padding(.top, 8)
    }

    private var facts: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(model.film.title)
                .font(.largeTitle.weight(.bold))
                .foregroundStyle(Theme.foreground)
                .fixedSize(horizontal: false, vertical: true)

            if let other = model.detail?.alternativeTitle {
                Text(other)
                    .font(.subheadline)
                    .foregroundStyle(Theme.muted)
            }

            HStack(spacing: 8) {
                Text(factLine)
                    .font(.subheadline)
                    .foregroundStyle(Theme.muted)
                    .monospacedDigit()
            }
        }
    }

    private var factLine: String {
        var parts: [String] = []
        if let year = model.film.releaseYear { parts.append(String(year)) }
        if let minutes = model.detail?.runtimeMinutes { parts.append("\(minutes) Minuten") }
        if let director = model.detail?.directors.first { parts.append(director) }
        return parts.joined(separator: " · ")
    }

    // ----------------------------------------------------------------
    // Der eigene Eintrag
    // ----------------------------------------------------------------

    @ViewBuilder private var entryForm: some View {
        @Bindable var model = model

        VStack(alignment: .leading, spacing: 14) {
            Panel(title: "Deine Rezension") {
                TextEditor(text: $model.review)
                    .frame(minHeight: 96)
                    .scrollContentBackground(.hidden)
                    .font(.callout)
                    .foregroundStyle(Theme.foreground)
            }

            HStack(alignment: .top, spacing: 14) {
                VStack(alignment: .leading, spacing: 6) {
                    Text("Gesehen am")
                        .font(.caption)
                        .foregroundStyle(Theme.muted)

                    DatePicker(
                        "Gesehen am", selection: $model.watchedOn, displayedComponents: .date
                    )
                    .labelsHidden()
                    .datePickerStyle(.compact)
                    .onChange(of: model.watchedOn) { model.hasWatchedOn = true }
                }

                VStack(alignment: .leading, spacing: 6) {
                    Text("Wer sieht den Eintrag")
                        .font(.caption)
                        .foregroundStyle(Theme.muted)
                    VisibilityPicker(selection: $model.visibility)
                }
            }

            if let note = model.note {
                Text(note)
                    .font(.footnote)
                    .foregroundStyle(.red)
            }

            Button {
                Task { await model.save() }
            } label: {
                HStack(spacing: 8) {
                    if model.isSaving { ProgressView().controlSize(.small) }
                    Text(saveLabel)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 12)
            }
            .background(
                model.rating == 0 ? Theme.primary.opacity(0.4) : Theme.primary,
                in: RoundedRectangle(cornerRadius: 10)
            )
            .foregroundStyle(Theme.onPrimary)
            .font(.headline)
            .disabled(model.rating == 0 || model.isSaving)
        }
    }

    private var saveLabel: String {
        if model.savedAt != nil { return "Gespeichert" }
        // Die Bewertung ist der Pflichtteil. Wer noch keine gesetzt hat,
        // soll das lesen und nicht raten, warum der Knopf blass ist.
        if model.rating == 0 { return "Erst bewerten" }
        return model.hadEntry ? "Eintrag aktualisieren" : "Rezension speichern"
    }

    // ----------------------------------------------------------------
    // Was fest zum Film gehört
    // ----------------------------------------------------------------

    @ViewBuilder private var catalogue: some View {
        VStack(alignment: .leading, spacing: 16) {
            if let detail = model.detail {
                if !detail.genres.isEmpty {
                    LabelledRow(title: "Genre") {
                        FlowRow(spacing: 8) {
                            ForEach(detail.genres) { genre in
                                Text(genre.shortLabel)
                                    .font(.caption.weight(.medium))
                                    .foregroundStyle(Theme.foreground)
                                    .padding(.horizontal, 10)
                                    .padding(.vertical, 5)
                                    .background(Theme.card, in: Capsule())
                                    .overlay { Capsule().strokeBorder(Theme.border) }
                            }
                        }
                    }
                }

                LabelledRow(title: "Altersfreigabe") {
                    HStack(spacing: 8) {
                        FSKBadge(value: detail.fsk)
                        Text(FSKLevel.level(for: detail.fsk)?.text ?? "nicht bekannt")
                            .font(.caption)
                            .foregroundStyle(Theme.muted)
                    }
                }

                if detail.directors.count > 1 {
                    LabelledRow(title: "Regie") {
                        Text(detail.directors.joined(separator: ", "))
                            .font(.footnote)
                            .foregroundStyle(Theme.muted)
                    }
                }
            }

            // Attribution ist eine Lizenzpflicht und keine Höflichkeit,
            // und sie muss als direkter Link sichtbar sein
            // (docs/legal/thetvdb-lizenz.md).
            if case .photograph = model.artwork {
                Link(destination: URL(string: "https://thetvdb.com")!) {
                    Text("Plakat von TheTVDB")
                        .font(.caption2)
                        .foregroundStyle(Theme.quiet)
                        .underline()
                }
            }
        }
    }
}

// --------------------------------------------------------------------
// Bausteine
// --------------------------------------------------------------------

/// Das Plakat über die ganze Breite, nach unten ins Dunkle auslaufend.
private struct Backdrop: View {
    let film: Film
    let artwork: PosterArtwork?

    var body: some View {
        PosterImage(artwork: artwork)
            .frame(height: 420)
            .frame(maxWidth: .infinity)
            .clipped()
            .overlay {
                // Zwei Verläufe: einer, der das Bild unten in den Grund
                // übergehen lässt, und ein schwacher von oben, damit die
                // Knöpfe auf einem hellen Plakat noch zu sehen sind.
                LinearGradient(
                    stops: [
                        .init(color: Theme.background.opacity(0.55), location: 0),
                        .init(color: .clear, location: 0.28),
                        .init(color: Theme.background.opacity(0.7), location: 0.72),
                        .init(color: Theme.background, location: 1),
                    ],
                    startPoint: .top, endPoint: .bottom
                )
            }
            .accessibilityHidden(true)
    }
}

private struct CircleButton: View {
    let symbol: String
    let label: String
    var isOn = false
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            CircleLabel(symbol: symbol, isOn: isOn)
        }
        .accessibilityLabel(label)
    }
}

private struct CircleLabel: View {
    let symbol: String
    var isOn = false

    var body: some View {
        Image(systemName: symbol)
            .font(.system(size: 16, weight: .semibold))
            .foregroundStyle(isOn ? Theme.primary : Theme.foreground)
            .frame(width: 38, height: 38)
            .background(.ultraThinMaterial, in: Circle())
            .overlay { Circle().strokeBorder(Theme.border.opacity(0.6)) }
    }
}

/// Die beiden Zahlen nebeneinander.
private struct RatingCards: View {
    let summary: RatingSummary
    @Binding var rating: Int
    let canRate: Bool

    var body: some View {
        HStack(spacing: 12) {
            Panel(title: "Ø Bewertung") {
                if let average = summary.average {
                    PopcornRating(rating: average, size: 22)
                    HStack(spacing: 6) {
                        Text(Popcorn.format(average))
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(Theme.foreground)
                            .monospacedDigit()
                        Text(summary.votes == 1 ? "1 Bewertung" : "\(summary.votes) Bewertungen")
                            .font(.caption2)
                            .foregroundStyle(Theme.quiet)
                            .monospacedDigit()
                    }
                } else {
                    Text("Noch keine")
                        .font(.subheadline)
                        .foregroundStyle(Theme.quiet)
                }
            }

            if canRate {
                Panel(title: "Deine Bewertung") {
                    PopcornPicker(rating: $rating, size: 22)
                    Text(rating == 0 ? "Noch keine" : Popcorn.format(rating))
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(rating == 0 ? Theme.quiet : Theme.foreground)
                        .monospacedDigit()
                }
            }
        }
        .fixedSize(horizontal: false, vertical: true)
    }
}

/// Die Besetzung, mit Mittelpunkten getrennt.
private struct CastBlock: View {
    let names: [String]

    /// So viele stehen da, bevor aufgeklappt wird.
    private static let shown = 12

    @State private var isExpanded = false

    private var visible: [String] {
        isExpanded ? names : Array(names.prefix(Self.shown))
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("Besetzung")
                .font(.caption)
                .foregroundStyle(Theme.muted)

            Text(visible.joined(separator: " · "))
                .font(.callout)
                .foregroundStyle(Theme.foreground)
                .fixedSize(horizontal: false, vertical: true)

            if names.count > Self.shown {
                Button {
                    withAnimation(.easeInOut(duration: 0.25)) { isExpanded.toggle() }
                } label: {
                    Text(
                        isExpanded
                            ? "Weniger anzeigen"
                            : "Mehr anzeigen (\(names.count - Self.shown))"
                    )
                    .font(.footnote.weight(.medium))
                    .foregroundStyle(Theme.primary)
                    .underline()
                }
            }
        }
    }
}

/// Eine Karte mit Überschrift, wie sie auf dieser Seite mehrfach steht.
private struct Panel<Content: View>: View {
    let title: String
    @ViewBuilder let content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.caption)
                .foregroundStyle(Theme.muted)
            content
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(Theme.card, in: RoundedRectangle(cornerRadius: 10))
        .overlay { RoundedRectangle(cornerRadius: 10).strokeBorder(Theme.border) }
    }
}

private struct LabelledRow<Content: View>: View {
    let title: String
    @ViewBuilder let content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title)
                .font(.caption)
                .foregroundStyle(Theme.muted)
            content
        }
    }
}

/// Öffentlich, nur für Freunde, nur für mich.
private struct VisibilityPicker: View {
    @Binding var selection: EntryVisibility

    var body: some View {
        HStack(spacing: 0) {
            ForEach(EntryVisibility.allCases, id: \.self) { option in
                Button {
                    selection = option
                } label: {
                    Text(option.label)
                        .font(.caption.weight(selection == option ? .semibold : .regular))
                        .foregroundStyle(
                            selection == option ? Theme.onPrimary : Theme.muted
                        )
                        .padding(.horizontal, 8)
                        .padding(.vertical, 7)
                        .frame(maxWidth: .infinity)
                        .background(selection == option ? Theme.primary : .clear)
                }
                .buttonStyle(.plain)
            }
        }
        .background(Theme.card, in: RoundedRectangle(cornerRadius: 8))
        .overlay { RoundedRectangle(cornerRadius: 8).strokeBorder(Theme.border) }
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }
}
