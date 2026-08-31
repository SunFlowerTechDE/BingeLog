import SwiftUI

/// Entdecken — die Startseite für Angemeldete (M5 5.4, nach M4 4.4).
///
/// Drei Bereiche, in dieser Reihenfolge: die Genres als Schieber, dann
/// was die Leute eingetragen haben, denen du folgst, dann das Neueste im
/// Katalog.
///
/// Der Feed steht in der Mitte und nicht oben: die Kacheln sind ein
/// Einstieg, der Feed ist der Aufenthalt. Wer nichts Neues von seinen
/// Leuten hat, soll trotzdem etwas vorfinden.
///
/// Dieselbe Ordnung wie im Web (`src/components/discover.tsx`). Wer
/// zwischen Browser und iPhone wechselt, soll nicht neu suchen müssen,
/// wo etwas steht.
struct DiscoverView: View {
    @State private var model: DiscoverModel
    private let repository: DiscoverRepository

    private let details: FilmDetailRepository
    private let entries: FilmEntryRepository

    init(
        repository: DiscoverRepository, details: FilmDetailRepository,
        entries: FilmEntryRepository
    ) {
        self.repository = repository
        self.details = details
        self.entries = entries
        _model = State(initialValue: DiscoverModel(repository: repository))
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 32) {
                if !model.tiles.isEmpty {
                    GenreSlider(
                        tiles: model.tiles, repository: repository,
                        details: details, entries: entries)
                }

                if !model.top.isEmpty {
                    WeeklyTopSection(entries: model.top, details: details, filmEntries: entries)
                }

                FeedSection(
                    entries: model.feed, avatarBase: model.avatarBase,
                    details: details, filmEntries: entries)

                if !model.newest.isEmpty {
                    NewestSection(films: model.newest, details: details, entries: entries)
                }
            }
            .padding(.vertical, 8)
        }
        .background(Theme.background)
        .overlay {
            // Nur beim allerersten Laden. Ein Kringel über einer Seite,
            // die schon etwas zeigt, ist ein Rückschritt.
            if model.isLoading && model.tiles.isEmpty {
                ProgressView()
            }
        }
        .refreshable { await model.load() }
        .task { await model.load() }
        .navigationTitle("Entdecken")
    }
}

/// Eine Überschrift, wie sie über jedem Bereich steht.
private struct SectionTitle: View {
    let text: String

    var body: some View {
        Text(text)
            .font(.headline)
            .foregroundStyle(Theme.foreground)
            .padding(.horizontal, 20)
    }
}

// --------------------------------------------------------------------
// Die Genres
// --------------------------------------------------------------------

/// Ein Schieber und kein Raster.
///
/// Die Genres sind ein Einstieg, kein Inhaltsverzeichnis. Sechzehn
/// Kacheln untereinander wären eine Wand vor dem, was darunter steht.
private struct GenreSlider: View {
    let tiles: [GenreTile]
    let repository: DiscoverRepository
    let details: FilmDetailRepository
    let entries: FilmEntryRepository

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionTitle(text: "Nach Genre")

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(alignment: .top, spacing: 12) {
                    ForEach(tiles) { tile in
                        NavigationLink {
                            GenreView(tile: tile, repository: repository, details: details, entries: entries)
                        } label: {
                            GenreCard(tile: tile)
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.horizontal, 20)
            }
        }
    }
}

private struct GenreCard: View {
    let tile: GenreTile

    var body: some View {
        VStack(spacing: 10) {
            // Die Bilder sind freigestellte Symbole auf Gold. Sie
            // brauchen den dunklen Grund unter sich, keinen eigenen
            // Rahmen.
            Group {
                if let name = tile.artworkName {
                    Image(name)
                        .resizable()
                        .aspectRatio(contentMode: .fit)
                } else {
                    // Noch kein Bild für dieses Genre. Ein Platzhalter
                    // in derselben Größe hält die Reihe gerade.
                    Image(systemName: "film")
                        .resizable()
                        .aspectRatio(contentMode: .fit)
                        .padding(12)
                        .foregroundStyle(Theme.primary.opacity(0.5))
                }
            }
            .frame(width: 64, height: 64)

            VStack(spacing: 2) {
                // Immer zwei Zeilen hoch, auch bei einem kurzen
                // Namen. Sonst ist die Kachel von "Musikfilm" niedriger
                // als die von "Science-Fiction-Film", und der Schieber
                // wird zu einer Zickzacklinie.
                Text(tile.shortLabel)
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(Theme.foreground)
                    .lineLimit(2, reservesSpace: true)
                    .multilineTextAlignment(.center)
                    // Ein sehr langer Name darf die Kachel nicht
                    // breiter machen — lieber etwas kleiner gesetzt.
                    .minimumScaleFactor(0.8)

                Text("\(tile.films) Filme")
                    .font(.caption)
                    .foregroundStyle(Theme.muted)
                    .monospacedDigit()
            }
        }
        .frame(width: 128)
        .padding(.vertical, 14)
        .padding(.horizontal, 8)
        .background(Theme.card, in: RoundedRectangle(cornerRadius: 14))
        .overlay {
            RoundedRectangle(cornerRadius: 14).strokeBorder(Theme.border)
        }
    }
}

/// Was hinter einer Kachel steht.
private struct GenreView: View {
    let tile: GenreTile
    let repository: DiscoverRepository
    let details: FilmDetailRepository
    let entries: FilmEntryRepository

    @State private var films: [Film] = []
    @State private var isLoading = true

    var body: some View {
        List(films) { film in
            NavigationLink {
                FilmDetailView(film: film, details: details, entries: entries)
            } label: {
                FilmLine(film: film)
            }
            .listRowBackground(Theme.background)
        }
        .listStyle(.plain)
        .scrollContentBackground(.hidden)
        .background(Theme.background)
        .overlay {
            if isLoading {
                ProgressView()
            } else if films.isEmpty {
                ContentUnavailableView(
                    "Nichts da",
                    systemImage: "film",
                    description: Text("Zu \(tile.shortLabel) steht noch kein Film im Katalog.")
                )
            }
        }
        .navigationTitle(tile.shortLabel)
        .navigationBarTitleDisplayMode(.inline)
        .task {
            films = await repository.films(inGenre: tile.genreID, limit: 60)
            isLoading = false
        }
    }
}

// --------------------------------------------------------------------
// Der Feed
// --------------------------------------------------------------------

private struct FeedSection: View {
    let entries: [FeedEntry]
    let avatarBase: URL?
    let details: FilmDetailRepository
    let filmEntries: FilmEntryRepository

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionTitle(text: "Letzte Aktivitäten")

            if entries.isEmpty {
                Text(
                    "Hier steht, was die Leute eintragen, denen du folgst. "
                        + "Noch ist es leer — folge jemandem, dann füllt es sich von selbst."
                )
                .font(.footnote)
                .foregroundStyle(Theme.muted)
                .padding(.horizontal, 20)
            } else {
                VStack(spacing: 0) {
                    ForEach(entries) { entry in
                        NavigationLink {
                            FilmDetailView(film: entry.film, details: details, entries: filmEntries)
                        } label: {
                            FeedRow(entry: entry, avatarBase: avatarBase)
                        }
                        .buttonStyle(.plain)
                        Divider().overlay(Theme.border).padding(.leading, 20)
                    }
                }
            }
        }
    }
}

private struct FeedRow: View {
    let entry: FeedEntry
    let avatarBase: URL?

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            PosterThumbnail(film: entry.film, width: 44)

            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 6) {
                    Avatar(path: entry.avatarPath, base: avatarBase)
                    Text(entry.username)
                        .font(.subheadline.weight(.medium))
                        .foregroundStyle(Theme.foreground)
                    if let when = entry.createdDate {
                        Text(when, format: .relative(presentation: .named))
                            .font(.caption)
                            .foregroundStyle(Theme.quiet)
                    }
                }

                Text(entry.film.title)
                    .font(.subheadline)
                    .foregroundStyle(Theme.foreground)

                HStack(spacing: 8) {
                    if let rating = entry.rating {
                        Stars(stars: Double(rating) / 2)
                    }
                    if entry.isRewatch {
                        Text("Wiedersehen")
                            .font(.caption2)
                            .foregroundStyle(Theme.quiet)
                    }
                }

                if let review = entry.review, !review.isEmpty {
                    Text(review)
                        .font(.footnote)
                        .foregroundStyle(Theme.muted)
                        .lineLimit(3)
                }
            }

            Spacer(minLength: 0)
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 12)
    }
}

/// Die Bewertung als fünf Sterne.
///
/// Die Datenbank speichert 1 bis 10 — halbe Sterne gibt es, ganze
/// Zahlen sind einfacher zu rechnen (M3 3.4). **Halbiert wird an der
/// Grenze**, nicht hier: diese Ansicht bekommt schon Sterne. Zweimal
/// halbieren war im Web bereits einmal der Fehler.
private struct Stars: View {
    let stars: Double
    var size: Font = .caption2

    var body: some View {
        HStack(spacing: 1) {
            ForEach(1...5, id: \.self) { star in
                Image(systemName: symbol(for: star))
                    .font(size)
                    .foregroundStyle(Theme.primary)
            }
        }
        .accessibilityElement()
        .accessibilityLabel(Text("\(stars, specifier: "%.1f") von fünf Sternen"))
    }

    private func symbol(for star: Int) -> String {
        let voll = Double(star)
        if stars >= voll - 0.001 { return "star.fill" }
        if stars >= voll - 0.501 { return "star.leadinghalf.filled" }
        return "star"
    }
}

private struct Avatar: View {
    let path: String?
    let base: URL?

    var body: some View {
        Group {
            if let path, let base {
                AsyncImage(url: base.appendingPathComponent(path)) { image in
                    image.resizable().aspectRatio(contentMode: .fill)
                } placeholder: {
                    Circle().fill(Theme.card)
                }
            } else {
                Circle().fill(Theme.card)
            }
        }
        .frame(width: 18, height: 18)
        .clipShape(Circle())
    }
}

// --------------------------------------------------------------------
// Top 10 in dieser Woche
// --------------------------------------------------------------------

/// Die meistbewerteten Filme der laufenden Woche.
///
/// Der Zeitraum ist die Kalenderwoche, Montag 00:00 bis Sonntag 23:59
/// deutscher Zeit, und er wird in `weekly_top_films` gezogen. Montags
/// fängt die Liste neu an.
///
/// Gezählt werden **nur öffentliche** Bewertungen. Damit ist die Liste
/// für jeden Leser dieselbe — eine Rangliste, die sich je nach Betrachter
/// ändert, ist keine.
private struct WeeklyTopSection: View {
    let entries: [WeeklyTopFilm]
    let details: FilmDetailRepository
    let filmEntries: FilmEntryRepository

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionTitle(text: "Top 10 in dieser Woche")

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(alignment: .top, spacing: 14) {
                    ForEach(entries) { entry in
                        NavigationLink {
                            FilmDetailView(film: entry.film, details: details, entries: filmEntries)
                        } label: {
                            RankedCard(entry: entry)
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.horizontal, 20)
                // Der Rahmen der ersten Karte darf nicht am Rand
                // abgeschnitten werden.
                .padding(.vertical, 4)
            }
        }
    }
}

private struct RankedCard: View {
    let entry: WeeklyTopFilm

    private var isPodium: Bool { entry.place <= 3 }

    /// Gold für die ersten drei, sonst der gewöhnliche Rand.
    ///
    /// Nicht alle zehn in Gold: wenn jede Karte hervorgehoben ist, ist
    /// keine hervorgehoben.
    private var accent: Color { isPodium ? Theme.primary : Theme.border }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            // Die Box um das Plakat. Sie trägt die Hervorhebung, damit
            // schon beim Überfliegen sichtbar ist, wo oben ist.
            PosterThumbnail(film: entry.film, width: 118)
                .padding(5)
                .background(Theme.card, in: RoundedRectangle(cornerRadius: 12))
                .overlay {
                    RoundedRectangle(cornerRadius: 12)
                        .strokeBorder(accent, lineWidth: isPodium ? 2 : 1)
                }

            HStack(alignment: .firstTextBaseline, spacing: 6) {
                // Die Platzierung, präsent. Groß gesetzt und in der
                // Farbe der Marke — sie ist der Grund, warum diese
                // Sektion anders aussieht als die anderen.
                Text("\(entry.place)")
                    .font(.system(.title, design: .rounded, weight: .bold))
                    .foregroundStyle(isPodium ? Theme.primary : Theme.foreground)
                    .monospacedDigit()

                Text(entry.film.title)
                    .font(.caption)
                    .foregroundStyle(Theme.foreground)
                    .lineLimit(2)
            }

            // Die schnelle Information: wie gut, und von wie vielen.
            HStack(spacing: 6) {
                if let stars = entry.stars {
                    Stars(stars: stars)
                    Text(String(format: "%.1f", stars))
                        .font(.caption2)
                        .foregroundStyle(Theme.muted)
                        .monospacedDigit()
                }

                Text(entry.ratings == 1 ? "1 Bewertung" : "\(entry.ratings) Bewertungen")
                    .font(.caption2)
                    .foregroundStyle(Theme.quiet)
                    .monospacedDigit()
            }
        }
        .frame(width: 128, alignment: .leading)
        .accessibilityElement(children: .combine)
        .accessibilityLabel(
            Text(
                "Platz \(entry.place): \(entry.film.title), \(entry.ratings) Bewertungen"
            ))
    }
}

// --------------------------------------------------------------------
// Neu im Katalog
// --------------------------------------------------------------------

private struct NewestSection: View {
    let films: [Film]
    let details: FilmDetailRepository
    let entries: FilmEntryRepository

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionTitle(text: "Neu im Katalog")

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(alignment: .top, spacing: 12) {
                    ForEach(films) { film in
                        NavigationLink {
                            FilmDetailView(film: film, details: details, entries: entries)
                        } label: {
                        VStack(alignment: .leading, spacing: 6) {
                            PosterThumbnail(film: film, width: 104)
                            Text(film.title)
                                .font(.caption)
                                .foregroundStyle(Theme.foreground)
                                .lineLimit(2)
                            if let year = film.releaseYear {
                                Text(String(year))
                                    .font(.caption2)
                                    .foregroundStyle(Theme.quiet)
                                    .monospacedDigit()
                            }
                        }
                        .frame(width: 104)
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.horizontal, 20)
            }
        }
    }
}

/// Eine Filmzeile, wie in der Suche.
private struct FilmLine: View {
    let film: Film

    var body: some View {
        HStack(spacing: 12) {
            PosterThumbnail(film: film, width: 44)
            VStack(alignment: .leading, spacing: 2) {
                Text(film.title)
                    .foregroundStyle(Theme.foreground)
                if let year = film.releaseYear {
                    Text(String(year))
                        .font(.caption)
                        .foregroundStyle(Theme.quiet)
                        .monospacedDigit()
                }
            }
        }
        .padding(.vertical, 2)
    }
}
