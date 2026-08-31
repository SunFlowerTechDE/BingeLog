import SwiftUI

/// Die Watchlist (Watchlist-Konzept, Prioritaet 1).
///
/// Ein Plakatraster, darüber Suche, Sortierung, Filter und „Überrasch
/// mich". Sie soll nicht nur beantworten, was gespeichert ist, sondern
/// was man als Nächstes schauen sollte.
struct WatchlistView: View {
    @State private var model: WatchlistModel

    init(entries: FilmEntryRepository, details: FilmDetailRepository) {
        self.details = details
        self.entries = entries
        _model = State(initialValue: WatchlistModel(entries: entries))
    }

    private let details: FilmDetailRepository
    private let entries: FilmEntryRepository

    /// Drei Spalten auf dem iPhone. Bei vieren wird das Plakat zu klein,
    /// um den Film wiederzuerkennen.
    private let columns = [GridItem(.adaptive(minimum: 104, maximum: 160), spacing: 12)]

    @State private var seenEntry: WatchlistEntry?

    var body: some View {
        @Bindable var model = model

        Group {
            if model.isLoading {
                ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if model.all.isEmpty {
                empty
            } else {
                filled
            }
        }
        .background(Theme.background)
        .navigationTitle("Watchlist")
        .searchable(
            text: $model.term,
            placement: .navigationBarDrawer(displayMode: .automatic),
            prompt: "In der Watchlist suchen"
        )
        .toolbar {
            if !model.all.isEmpty {
                ToolbarItem(placement: .topBarTrailing) { sortMenu }
            }
        }
        .sheet(item: $seenEntry) { entry in
            MarkSeenSheet(entry: entry) { rating in
                Task { await model.markSeen(entry, rating: rating) }
            }
        }
        .sheet(item: $model.surprise) { entry in
            SurpriseSheet(entry: entry, details: details, entries: entries)
        }
        .task { await model.load() }
        .refreshable { await model.load() }
    }

    // ----------------------------------------------------------------

    private var empty: some View {
        VStack(spacing: 14) {
            Image(systemName: "bookmark")
                .font(.system(size: 44, weight: .light))
                .foregroundStyle(Theme.primary.opacity(0.6))

            Text("Deine vorgemerkten Filme erscheinen hier.")
                .font(.callout)
                .foregroundStyle(Theme.foreground)
            Text("Speichere Filme direkt auf ihrer Filmseite.")
                .font(.footnote)
                .foregroundStyle(Theme.muted)

            // Ein Weg heraus statt nur einer Erklärung (Konzept).
            NavigationLink {
                DiscoverPlaceholderLink()
            } label: {
                Text("Filme entdecken")
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(Theme.onPrimary)
                    .padding(.horizontal, 18)
                    .padding(.vertical, 10)
                    .background(Theme.primary, in: Capsule())
            }
            .padding(.top, 4)
        }
        .multilineTextAlignment(.center)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding(24)
    }

    private var filled: some View {
        @Bindable var model = model

        return ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                header

                if model.shown.isEmpty {
                    Text("Nichts passt zu dieser Auswahl.")
                        .font(.footnote)
                        .foregroundStyle(Theme.muted)
                        .padding(.horizontal, 20)
                } else {
                    LazyVGrid(columns: columns, alignment: .leading, spacing: 18) {
                        ForEach(model.shown) { entry in
                            WatchlistCard(
                                entry: entry, details: details, entries: entries,
                                onRemove: { Task { await model.remove(entry) } },
                                onSeen: { seenEntry = entry }
                            )
                        }
                    }
                    .padding(.horizontal, 20)
                }

                if let note = model.note {
                    Text(note)
                        .font(.footnote)
                        .foregroundStyle(.red)
                        .padding(.horizontal, 20)
                }
            }
            .padding(.vertical, 12)
        }
    }

    private var header: some View {
        @Bindable var model = model

        return VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text(model.all.count == 1 ? "1 Film" : "\(model.all.count) Filme")
                    .font(.subheadline)
                    .foregroundStyle(Theme.muted)
                    .monospacedDigit()

                Spacer()

                Button {
                    model.surpriseMe()
                } label: {
                    HStack(spacing: 6) {
                        Image(systemName: "dice")
                        Text("Überrasch mich")
                    }
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(Theme.primary)
                }
                .disabled(model.shown.isEmpty)
            }
            .padding(.horizontal, 20)

            // Die Filter als Schieber. Sie stehen über dem Raster, damit
            // sichtbar ist, warum weniger Filme dastehen als vorhin.
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    if model.hasFilters {
                        Chip(label: "Zurücksetzen", isOn: false, symbol: "xmark") {
                            model.clearFilters()
                        }
                    }

                    Chip(
                        label: "Von Freunden", isOn: model.onlyRecommended,
                        symbol: "person.2"
                    ) {
                        model.onlyRecommended.toggle()
                    }

                    ForEach([90, 120, 150], id: \.self) { minutes in
                        Chip(
                            label: "unter \(minutes) min",
                            isOn: model.maximumRuntime == minutes,
                            symbol: nil
                        ) {
                            model.maximumRuntime = model.maximumRuntime == minutes ? nil : minutes
                        }
                    }

                    ForEach(model.availableGenres) { genre in
                        Chip(
                            label: genre.shortLabel,
                            isOn: model.genre?.id == genre.id,
                            symbol: nil
                        ) {
                            model.genre = model.genre?.id == genre.id ? nil : genre
                        }
                    }
                }
                .padding(.horizontal, 20)
            }
        }
    }

    private var sortMenu: some View {
        @Bindable var model = model

        return Menu {
            Picker("Sortieren", selection: $model.order) {
                ForEach(WatchlistOrder.allCases) { option in
                    Text(option.label).tag(option)
                }
            }
        } label: {
            Image(systemName: "arrow.up.arrow.down")
        }
        .accessibilityLabel("Sortieren")
    }
}

/// Nur damit der leere Zustand irgendwohin führt.
///
/// Entdecken ist ein eigener Reiter; von hier aus dorthin zu springen
/// ginge nur über einen gemeinsamen Zustand. Bis den jemand braucht,
/// sagt dieser Schritt schlicht, wo es langgeht.
private struct DiscoverPlaceholderLink: View {
    var body: some View {
        ComingSoon(
            title: "Filme entdecken",
            symbol: "sparkles",
            what: "Tipp unten auf Entdecken — dort stehen Genres, die Top 10 "
                + "der Woche und was neu ist.",
            step: "M5 5.4"
        )
    }
}

private struct Chip: View {
    let label: String
    let isOn: Bool
    let symbol: String?
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 5) {
                if let symbol { Image(systemName: symbol).font(.caption2) }
                Text(label).font(.caption.weight(isOn ? .semibold : .regular))
            }
            .foregroundStyle(isOn ? Theme.onPrimary : Theme.foreground)
            .padding(.horizontal, 12)
            .padding(.vertical, 7)
            .background(isOn ? Theme.primary : Theme.card, in: Capsule())
            .overlay { Capsule().strokeBorder(isOn ? .clear : Theme.border) }
        }
        .buttonStyle(.plain)
    }
}

/// Ein Film im Raster.
private struct WatchlistCard: View {
    let entry: WatchlistEntry
    let details: FilmDetailRepository
    let entries: FilmEntryRepository
    let onRemove: () -> Void
    let onSeen: () -> Void

    var body: some View {
        NavigationLink {
            FilmDetailView(film: entry.film)
        } label: {
            VStack(alignment: .leading, spacing: 5) {
                PosterThumbnail(film: entry.film, width: 104)

                Text(entry.title)
                    .font(.caption)
                    .foregroundStyle(Theme.foreground)
                    .lineLimit(2)

                if let year = entry.releaseYear {
                    Text(String(year))
                        .font(.caption2)
                        .foregroundStyle(Theme.quiet)
                        .monospacedDigit()
                }

                if let average = entry.average {
                    PopcornRating(rating: average, size: 11)
                }

                // Der soziale Hinweis, aber nur einer. Die Karte darf
                // nicht überladen werden (Konzept).
                if let note = entry.recommendationNote {
                    Text(note)
                        .font(.caption2)
                        .foregroundStyle(Theme.primary)
                        .lineLimit(2)
                }
            }
            .frame(width: 104, alignment: .leading)
        }
        .buttonStyle(.plain)
        .contextMenu {
            Button("Als gesehen markieren", systemImage: "checkmark.circle", action: onSeen)
            Button("Aus der Watchlist", systemImage: "bookmark.slash", role: .destructive,
                action: onRemove)
        }
    }
}

/// Gesehen — und gleich bewertet.
///
/// Die Bewertung ist der Pflichtteil (ADR-009), deshalb steht sie hier
/// und nicht als Nachfrage danach. Zwei Taps: ein Eimer, ein Knopf.
private struct MarkSeenSheet: View {
    let entry: WatchlistEntry
    let onSave: (Int) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var rating = 0

    var body: some View {
        NavigationStack {
            VStack(spacing: 20) {
                PosterThumbnail(film: entry.film, width: 120)

                Text(entry.title)
                    .font(.headline)
                    .foregroundStyle(Theme.foreground)
                    .multilineTextAlignment(.center)

                GeometryReader { geometry in
                    PopcornPicker(
                        rating: $rating, size: Popcorn.size(fitting: geometry.size.width))
                }
                .frame(height: 52)
                .padding(.horizontal, 40)

                Text(rating == 0 ? "Wie war er?" : Popcorn.format(rating))
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(rating == 0 ? Theme.quiet : Theme.foreground)
                    .monospacedDigit()

                Text("Der Film wandert danach von der Watchlist ins Tagebuch.")
                    .font(.caption2)
                    .foregroundStyle(Theme.quiet)
                    .multilineTextAlignment(.center)

                Spacer()
            }
            .padding(24)
            .frame(maxWidth: .infinity)
            .background(Theme.background)
            .navigationTitle("Gesehen")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Abbrechen") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Eintragen") {
                        onSave(rating)
                        dismiss()
                    }
                    .disabled(rating == 0)
                }
            }
        }
    }
}

/// Was „Überrasch mich" gezogen hat.
private struct SurpriseSheet: View {
    let entry: WatchlistEntry
    let details: FilmDetailRepository
    let entries: FilmEntryRepository

    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            VStack(spacing: 16) {
                PosterThumbnail(film: entry.film, width: 160)

                Text(entry.title)
                    .font(.title3.weight(.semibold))
                    .foregroundStyle(Theme.foreground)
                    .multilineTextAlignment(.center)

                if let year = entry.releaseYear, let minutes = entry.runtimeMinutes {
                    Text("\(year) · \(minutes) Minuten")
                        .font(.footnote)
                        .foregroundStyle(Theme.muted)
                        .monospacedDigit()
                }

                if let average = entry.average {
                    PopcornRating(rating: average, size: 18)
                }

                if let days = entry.daysWaiting, days >= 30 {
                    // Die „Schon lange vorgemerkt"-Angabe aus dem
                    // Konzept — hier, wo sie einen Anlass hat.
                    Text("Seit \(days) Tagen vorgemerkt")
                        .font(.caption)
                        .foregroundStyle(Theme.quiet)
                        .monospacedDigit()
                }

                NavigationLink {
                    FilmDetailView(film: entry.film)
                } label: {
                    Text("Zum Film")
                        .font(.subheadline.weight(.medium))
                        .foregroundStyle(Theme.onPrimary)
                        .padding(.horizontal, 20)
                        .padding(.vertical, 11)
                        .background(Theme.primary, in: Capsule())
                }

                Spacer()
            }
            .padding(24)
            .frame(maxWidth: .infinity)
            .background(Theme.background)
            .navigationTitle("Überrasch mich")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Schliessen") { dismiss() }
                }
            }
        }
    }
}
