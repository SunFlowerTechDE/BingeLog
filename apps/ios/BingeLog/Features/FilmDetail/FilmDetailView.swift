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

    /// Damit die Rezension die Tastatur wieder hergibt.
    @FocusState private var isWriting: Bool

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

                    Divider().overlay(Theme.border)

                    OtherFacets(averages: model.facetAverages, own: model.facets)

                    ReviewList(reviews: model.reviews)

                    DiscussionSection(model: model)
                }
                .padding(.horizontal, 20)
            }
            .padding(.bottom, 28)
        }
        // Wegwischen geht immer. Ein `TextEditor` bringt keine
        // Return-Taste zum Schliessen mit — ohne das hier stand die
        // Tastatur fest, sobald man die Rezension angefasst hatte.
        .scrollDismissesKeyboard(.interactively)
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

            // Die Altersfreigabe steht bei den harten Angaben und nicht
            // als Hinweis irgendwo: sie ist eine Tatsache über den Film,
            // keine Warnung an den Leser.
            HStack(spacing: 10) {
                FSKBadge(value: model.detail?.fsk)

                Text(factLine)
                    .font(.subheadline)
                    .foregroundStyle(Theme.muted)
                    .monospacedDigit()
                    .fixedSize(horizontal: false, vertical: true)
            }
            .padding(.top, 2)
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
                    .focused($isWriting)
                    .toolbar {
                        ToolbarItemGroup(placement: .keyboard) {
                            if isWriting {
                                Spacer()
                                Button("Fertig") { isWriting = false }
                            }
                        }
                    }
            }

            FacetForm(scores: $model.facets)

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
        // Beide Karten sind gleich hoch und gleich breit. Dafür haben
        // sie denselben Aufbau — Überschrift, Reihe Eimer, Zeile
        // darunter —, auch wenn links noch nichts zu zeigen ist: eine
        // Karte ohne Eimer ist niedriger als eine mit, und zwei
        // verschieden hohe Karten nebeneinander sehen aus wie ein
        // Fehler.
        HStack(alignment: .top, spacing: 12) {
            Panel(title: "Ø Bewertung") {
                PopcornRating(rating: summary.average ?? 0, size: 22)

                if let average = summary.average {
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
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)

            if canRate {
                Panel(title: "Deine Bewertung") {
                    // So gross, wie die Karte es hergibt: mit 22 Punkten
                    // gingen die Eimer unter dem Finger unter.
                    GeometryReader { geometry in
                        PopcornPicker(
                            rating: $rating, size: Popcorn.size(fitting: geometry.size.width))
                    }
                    .frame(height: 44)
                    Text(rating == 0 ? "Noch keine" : Popcorn.format(rating))
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(rating == 0 ? Theme.quiet : Theme.foreground)
                        .monospacedDigit()
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            }
        }
        // Die Reihe nimmt die Höhe der höheren Karte an, und weil beide
        // `maxHeight: .infinity` haben, füllen sie diese aus. Ohne das
        // hier zöge `.infinity` bis ans Ende der Seite.
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
                        // Einzeilig: "Öffent-lich" umgebrochen sah aus
                        // wie ein Fehler, und die drei Felder wurden
                        // dadurch verschieden hoch.
                        .lineLimit(1)
                        .minimumScaleFactor(0.75)
                        .multilineTextAlignment(.center)
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


// --------------------------------------------------------------------
// Erweiterte Bewertung
// --------------------------------------------------------------------

/// Die sieben Facetten, jede freiwillig.
///
/// Zugeklappt, weil sie das sind: freiwillig. Aufgeklappt stünde vor der
/// Pflichtbewertung eine Wand aus sieben Reihen, und zwei Taps wären
/// keine zwei mehr (ADR-009).
private struct FacetForm: View {
    @Binding var scores: [FacetKind: Int]
    @State private var isOpen = false

    private var setCount: Int { scores.values.filter { $0 > 0 }.count }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Button {
                withAnimation(.easeInOut(duration: 0.2)) { isOpen.toggle() }
            } label: {
                HStack {
                    Text("Erweiterte Bewertung")
                        .font(.subheadline.weight(.medium))
                        .foregroundStyle(Theme.foreground)
                    if setCount > 0 {
                        Text("\(setCount) von \(FacetKind.allCases.count)")
                            .font(.caption2)
                            .foregroundStyle(Theme.primary)
                            .monospacedDigit()
                    }
                    Spacer()
                    Image(systemName: isOpen ? "chevron.up" : "chevron.down")
                        .font(.caption)
                        .foregroundStyle(Theme.muted)
                }
            }
            .buttonStyle(.plain)

            if isOpen {
                Text("Freiwillig. Die Gesamtbewertung bleibt davon unberührt.")
                    .font(.caption2)
                    .foregroundStyle(Theme.quiet)

                ForEach(FacetKind.allCases, id: \.self) { facet in
                    HStack(spacing: 10) {
                        Text(facet.label)
                            .font(.footnote)
                            .foregroundStyle(Theme.foreground)
                            .lineLimit(2)
                            .frame(maxWidth: .infinity, alignment: .leading)

                        PopcornPicker(
                            rating: Binding(
                                get: { scores[facet] ?? 0 },
                                set: { scores[facet] = $0 }
                            ),
                            size: 26
                        )
                    }
                }
            }
        }
        .padding(12)
        .background(Theme.card.opacity(0.5), in: RoundedRectangle(cornerRadius: 10))
        .overlay { RoundedRectangle(cornerRadius: 10).strokeBorder(Theme.border) }
    }
}

/// Wie andere im Einzelnen bewerten.
///
/// Ausdrücklich nur die Werte der anderen. Die eigenen stehen im
/// Formular darüber und ließen sich hier bloß ein zweites Mal ablesen.
/// Der eigene Wert steht daneben, wo es einen gibt: ohne Vergleich ist
/// eine Facette nur eine Zahl (M3 3.4b).
private struct OtherFacets: View {
    let averages: [FacetAverage]
    let own: [FacetKind: Int]

    var body: some View {
        if !averages.isEmpty {
            VStack(alignment: .leading, spacing: 10) {
                Text("Wie andere bewerten")
                    .font(.headline)
                    .foregroundStyle(Theme.foreground)

                ForEach(averages) { row in
                    HStack(spacing: 10) {
                        Text(row.facet.label)
                            .font(.footnote)
                            .foregroundStyle(Theme.muted)
                            .frame(maxWidth: .infinity, alignment: .leading)

                        PopcornRating(rating: row.average, size: 15)

                        Text(Popcorn.format(row.average))
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(Theme.foreground)
                            .monospacedDigit()

                        if let mine = own[row.facet], mine > 0 {
                            Text("du \(Popcorn.format(mine))")
                                .font(.caption2)
                                .foregroundStyle(Theme.primary)
                                .monospacedDigit()
                        }
                    }
                }

                Text("Facetten erscheinen ab fünf Stimmen.")
                    .font(.caption2)
                    .foregroundStyle(Theme.quiet)
            }
        }
    }
}

// --------------------------------------------------------------------
// Was die anderen geschrieben haben
// --------------------------------------------------------------------

private struct ReviewList: View {
    let reviews: [FilmReview]

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Neueste Bewertungen")
                .font(.headline)
                .foregroundStyle(Theme.foreground)

            if reviews.isEmpty {
                Text("Noch keine Rezension zu diesem Film.")
                    .font(.footnote)
                    .foregroundStyle(Theme.muted)
            } else {
                ForEach(reviews) { entry in
                    VStack(alignment: .leading, spacing: 5) {
                        HStack(spacing: 8) {
                            Text(entry.username ?? "Jemand")
                                .font(.subheadline.weight(.medium))
                                .foregroundStyle(Theme.foreground)

                            if let rating = entry.rating {
                                PopcornRating(rating: Double(rating), size: 13)
                            }

                            if entry.isRewatch {
                                Text("Wiedersehen")
                                    .font(.caption2)
                                    .foregroundStyle(Theme.quiet)
                            }

                            Spacer(minLength: 0)

                            if let when = entry.created {
                                Text(when, format: .relative(presentation: .named))
                                    .font(.caption2)
                                    .foregroundStyle(Theme.quiet)
                            }
                        }

                        Text(entry.review)
                            .font(.footnote)
                            .foregroundStyle(Theme.muted)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    .padding(12)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Theme.card.opacity(0.5), in: RoundedRectangle(cornerRadius: 10))
                }
            }
        }
    }
}

// --------------------------------------------------------------------
// Diskussion
// --------------------------------------------------------------------

/// Der Raum zum Film.
///
/// **Das Gate steht in der Policy auf `thread_messages`, nicht hier**
/// (ADR-010). Was diese Ansicht zeigt, ist eine Erklärung für das, was
/// Postgres nicht herausgegeben hat — kein Schutz. Eine ausgeblendete
/// Komponente wäre keiner.
private struct DiscussionSection: View {
    @Bindable var model: FilmDetailModel
    @Environment(SessionStore.self) private var session
    @FocusState private var isWriting: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Diskussion")
                .font(.headline)
                .foregroundStyle(Theme.foreground)

            if !model.thread.isActive {
                // Noch nicht aufgegangen. Das ist kein Versäumnis,
                // sondern Absicht: 350.000 leere Räume sind schlimmer
                // als keine (ADR-010).
                Note(
                    "Die Diskussion geht auf, sobald \(model.threshold) Leute den Film "
                        + "eingetragen haben. Bisher sind es \(model.thread.viewerCount)."
                )
            } else if !session.isSignedIn || !model.hasRated {
                VStack(alignment: .leading, spacing: 6) {
                    Text(
                        "Sichtbar, sobald du den Film bewertet hast. "
                            + (model.thread.messageCount == 1
                                ? "1 Beitrag bisher."
                                : "\(model.thread.messageCount) Beiträge bisher.")
                    )
                    .font(.footnote)
                    .foregroundStyle(Theme.foreground)

                    Text(
                        "Hier wird über das Ende geredet, über Wendungen, über alles. "
                            + "Deshalb erst danach."
                    )
                    .font(.caption2)
                    .foregroundStyle(Theme.quiet)
                }
                .padding(12)
                .frame(maxWidth: .infinity, alignment: .leading)
                .overlay {
                    RoundedRectangle(cornerRadius: 10)
                        .strokeBorder(Theme.border, style: StrokeStyle(lineWidth: 1, dash: [4, 4]))
                }
            } else {
                open
            }
        }
    }

    @ViewBuilder private var open: some View {
        // Eine geschlossene Tür mit Schild. Ohne den Grund wirkt eine
        // Sperre wie ein Fehler.
        if model.thread.isLocked {
            Note(
                "Diese Diskussion ist geschlossen. "
                    + (model.thread.lockedReason ?? "Lesen geht weiter, schreiben nicht.")
            )
        }

        if model.messages.isEmpty {
            Text("Noch keine Beiträge. Fang an.")
                .font(.footnote)
                .foregroundStyle(Theme.muted)
        }

        VStack(alignment: .leading, spacing: 10) {
            ForEach(model.topLevel) { message in
                MessageBubble(message: message, isReply: false) {
                    model.replyingTo = message
                    isWriting = true
                }

                ForEach(model.replies(to: message.id)) { reply in
                    MessageBubble(message: reply, isReply: true, onReply: nil)
                        .padding(.leading, 24)
                }
            }
        }

        if !model.thread.isLocked {
            VStack(alignment: .leading, spacing: 8) {
                if let parent = model.replyingTo {
                    HStack(spacing: 6) {
                        Text("Antwort an \(parent.username ?? "jemanden")")
                            .font(.caption2)
                            .foregroundStyle(Theme.muted)
                        Button("Abbrechen") { model.replyingTo = nil }
                            .font(.caption2)
                            .foregroundStyle(Theme.primary)
                    }
                }

                TextEditor(text: $model.draft)
                    .frame(minHeight: 72)
                    .scrollContentBackground(.hidden)
                    .font(.callout)
                    .foregroundStyle(Theme.foreground)
                    .focused($isWriting)
                    .padding(8)
                    .background(Theme.card, in: RoundedRectangle(cornerRadius: 10))
                    .overlay { RoundedRectangle(cornerRadius: 10).strokeBorder(Theme.border) }
                    .toolbar {
                        ToolbarItemGroup(placement: .keyboard) {
                            if isWriting {
                                Spacer()
                                Button("Fertig") { isWriting = false }
                            }
                        }
                    }

                if let note = model.discussionNote {
                    Text(note)
                        .font(.caption)
                        .foregroundStyle(.red)
                }

                Button {
                    isWriting = false
                    Task { await model.send() }
                } label: {
                    HStack(spacing: 8) {
                        if model.isPosting { ProgressView().controlSize(.small) }
                        Text("Beitrag senden")
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 10)
                }
                .background(Theme.card, in: RoundedRectangle(cornerRadius: 10))
                .overlay { RoundedRectangle(cornerRadius: 10).strokeBorder(Theme.border) }
                .foregroundStyle(Theme.foreground)
                .font(.subheadline.weight(.medium))
                .disabled(model.draft.trimmingCharacters(in: .whitespaces).isEmpty
                    || model.isPosting)
            }
        }
    }
}

private struct MessageBubble: View {
    let message: ThreadMessage
    let isReply: Bool
    let onReply: (() -> Void)?

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 8) {
                Text(message.username ?? "Jemand")
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(Theme.foreground)
                if let when = message.created {
                    Text(when, format: .relative(presentation: .named))
                        .font(.caption2)
                        .foregroundStyle(Theme.quiet)
                }
                if message.editedAt != nil {
                    Text("bearbeitet")
                        .font(.caption2)
                        .foregroundStyle(Theme.quiet)
                }
                Spacer(minLength: 0)
            }

            Text(message.body)
                .font(.footnote)
                .foregroundStyle(Theme.muted)
                .fixedSize(horizontal: false, vertical: true)

            if let onReply {
                Button("Antworten", action: onReply)
                    .font(.caption2)
                    .foregroundStyle(Theme.primary)
            }
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            (isReply ? Theme.card.opacity(0.35) : Theme.card),
            in: RoundedRectangle(cornerRadius: 10)
        )
    }
}

/// Ein Hinweis in gestricheltem Rahmen.
private struct Note: View {
    let text: String
    init(_ text: String) { self.text = text }

    var body: some View {
        Text(text)
            .font(.footnote)
            .foregroundStyle(Theme.muted)
            .padding(12)
            .frame(maxWidth: .infinity, alignment: .leading)
            .overlay {
                RoundedRectangle(cornerRadius: 10)
                    .strokeBorder(Theme.border, style: StrokeStyle(lineWidth: 1, dash: [4, 4]))
            }
    }
}
