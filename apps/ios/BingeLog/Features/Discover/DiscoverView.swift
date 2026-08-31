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

    init(repository: DiscoverRepository) {
        self.repository = repository
        _model = State(initialValue: DiscoverModel(repository: repository))
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 32) {
                if !model.tiles.isEmpty {
                    GenreSlider(tiles: model.tiles, repository: repository)
                }

                FeedSection(entries: model.feed, avatarBase: model.avatarBase)

                if !model.newest.isEmpty {
                    NewestSection(films: model.newest)
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

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionTitle(text: "Nach Genre")

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 12) {
                    ForEach(tiles) { tile in
                        NavigationLink {
                            GenreView(tile: tile, repository: repository)
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
                Text(tile.label)
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(Theme.foreground)
                    .lineLimit(2)
                    .multilineTextAlignment(.center)

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

    @State private var films: [Film] = []
    @State private var isLoading = true

    var body: some View {
        List(films) { film in
            FilmLine(film: film)
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
                    description: Text("Zu \(tile.label) steht noch kein Film im Katalog.")
                )
            }
        }
        .navigationTitle(tile.label)
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
                        FeedRow(entry: entry, avatarBase: avatarBase)
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
            PosterThumb(film: entry.film, width: 44)

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
                        Stars(rating: rating)
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

/// Die Bewertung, zehn Halbe als fünf Sterne.
///
/// Die Datenbank speichert 1 bis 10 — halbe Sterne gibt es, ganze
/// Zahlen sind einfacher zu rechnen (M3 3.4). Fünf Sterne sieht der
/// Nutzer.
private struct Stars: View {
    let rating: Int

    var body: some View {
        HStack(spacing: 1) {
            ForEach(1...5, id: \.self) { star in
                Image(systemName: symbol(for: star))
                    .font(.caption2)
                    .foregroundStyle(Theme.primary)
            }
        }
        .accessibilityElement()
        .accessibilityLabel("\(Double(rating) / 2, specifier: "%.1f") von fünf Sternen")
    }

    private func symbol(for star: Int) -> String {
        if rating >= star * 2 { return "star.fill" }
        if rating == star * 2 - 1 { return "star.leadinghalf.filled" }
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
// Neu im Katalog
// --------------------------------------------------------------------

private struct NewestSection: View {
    let films: [Film]

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionTitle(text: "Neu im Katalog")

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(alignment: .top, spacing: 12) {
                    ForEach(films) { film in
                        VStack(alignment: .leading, spacing: 6) {
                            PosterThumb(film: film, width: 104)
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
                }
                .padding(.horizontal, 20)
            }
        }
    }
}

/// Ein Plakat in fester Größe.
private struct PosterThumb: View {
    let film: Film
    let width: CGFloat

    var body: some View {
        AsyncImage(url: film.posterAddress(webBase: URL(string: "https://bingelog.eu")!)) { image in
            image.resizable().aspectRatio(contentMode: .fill)
        } placeholder: {
            Rectangle().fill(Theme.card)
        }
        .frame(width: width, height: width * 1.5)
        .clipShape(RoundedRectangle(cornerRadius: 6))
    }
}

/// Eine Filmzeile, wie in der Suche.
private struct FilmLine: View {
    let film: Film

    var body: some View {
        HStack(spacing: 12) {
            PosterThumb(film: film, width: 44)
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
