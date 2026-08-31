import SwiftUI

/// Die Seite zu einem Film.
///
/// Was der Katalog über ihn weiß: Plakat, Titel, Jahr, Laufzeit, Regie,
/// Besetzung, Genres, Inhalt.
///
/// **Bewerten, Tagebuch und Watchlist stehen noch aus** (M5 5.4). Sie
/// hier halb anzudeuten wäre schlechter als sie wegzulassen — ein Stern,
/// der nichts tut, ist ein kaputter Stern.
struct FilmDetailView: View {
    let film: Film
    let repository: FilmDetailRepository

    @State private var detail: FilmDetail?
    @State private var artwork: PosterArtwork?
    @State private var isLoading = true

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                header

                if let detail {
                    if !detail.genres.isEmpty {
                        GenreChips(genres: detail.genres)
                    }

                    if let synopsis = detail.synopsis, !synopsis.isEmpty {
                        Text(synopsis)
                            .font(.callout)
                            .foregroundStyle(Theme.foreground)
                    }

                    if !detail.directors.isEmpty {
                        NameList(title: "Regie", names: detail.directors)
                    }

                    if !detail.cast.isEmpty {
                        NameList(title: "Besetzung", names: detail.cast)
                    }
                }

                if !isLoading && detail?.synopsis == nil {
                    Text("Zu diesem Film steht noch keine Inhaltsangabe im Katalog.")
                        .font(.footnote)
                        .foregroundStyle(Theme.quiet)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(20)
        }
        .background(Theme.background)
        .navigationTitle(film.title)
        .navigationBarTitleDisplayMode(.inline)
        .task {
            // Das Plakat und die Angaben nebeneinander: keins wartet auf
            // das andere.
            async let loaded = repository.detail(for: film.wikidataID)
            async let poster = PosterLoader.load(for: film)
            detail = await loaded
            artwork = await poster
            isLoading = false
        }
    }

    private var header: some View {
        HStack(alignment: .top, spacing: 16) {
            PosterImage(artwork: artwork)
                .frame(width: 132, height: 198)
                .clipShape(RoundedRectangle(cornerRadius: 8))
                .overlay {
                    RoundedRectangle(cornerRadius: 8).strokeBorder(Theme.border)
                }

            VStack(alignment: .leading, spacing: 6) {
                Text(film.title)
                    .font(.title3.weight(.semibold))
                    .foregroundStyle(Theme.foreground)

                if let other = detail?.alternativeTitle {
                    Text(other)
                        .font(.subheadline)
                        .foregroundStyle(Theme.muted)
                }

                // Jahr, Laufzeit und Regie in einer Zeile, durch
                // Mittelpunkte getrennt — die drei Angaben, nach denen
                // man zuerst sucht.
                Text(facts)
                    .font(.footnote)
                    .foregroundStyle(Theme.quiet)
                    .monospacedDigit()
                    .padding(.top, 2)
            }

            Spacer(minLength: 0)
        }
    }

    private var facts: String {
        var parts: [String] = []
        if let year = film.releaseYear { parts.append(String(year)) }
        if let runtime = detail?.runtimeText { parts.append(runtime) }
        if let director = detail?.directors.first { parts.append(director) }
        return parts.joined(separator: " · ")
    }
}

private struct GenreChips: View {
    let genres: [FilmGenre]

    var body: some View {
        // Umbrechend und nicht schiebend: es sind selten mehr als fünf,
        // und ein Schieber mit fünf Einträgen versteckt vier davon.
        FlowRow(spacing: 8) {
            ForEach(genres) { genre in
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

private struct NameList: View {
    let title: String
    let names: [String]

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(Theme.foreground)
            Text(names.joined(separator: ", "))
                .font(.footnote)
                .foregroundStyle(Theme.muted)
        }
    }
}

/// Ein Umbruch-Layout, das SwiftUI selbst nicht mitbringt.
struct FlowRow: Layout {
    var spacing: CGFloat = 8

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let width = proposal.width ?? .infinity
        let rows = arrange(subviews: subviews, in: width)
        let height = rows.reduce(0) { $0 + $1.height } + spacing * CGFloat(max(0, rows.count - 1))
        return CGSize(width: proposal.width ?? rows.map(\.width).max() ?? 0, height: height)
    }

    func placeSubviews(
        in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()
    ) {
        var y = bounds.minY
        for row in arrange(subviews: subviews, in: bounds.width) {
            var x = bounds.minX
            for index in row.indices {
                let size = subviews[index].sizeThatFits(.unspecified)
                subviews[index].place(
                    at: CGPoint(x: x, y: y), anchor: .topLeading, proposal: ProposedViewSize(size))
                x += size.width + spacing
            }
            y += row.height + spacing
        }
    }

    private struct Row {
        var indices: [Int] = []
        var width: CGFloat = 0
        var height: CGFloat = 0
    }

    private func arrange(subviews: Subviews, in width: CGFloat) -> [Row] {
        var rows: [Row] = []
        var row = Row()

        for index in subviews.indices {
            let size = subviews[index].sizeThatFits(.unspecified)
            let needed = row.indices.isEmpty ? size.width : row.width + spacing + size.width

            if needed > width && !row.indices.isEmpty {
                rows.append(row)
                row = Row()
            }

            row.width = row.indices.isEmpty ? size.width : row.width + spacing + size.width
            row.height = max(row.height, size.height)
            row.indices.append(index)
        }

        if !row.indices.isEmpty { rows.append(row) }
        return rows
    }
}
