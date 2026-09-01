import SwiftUI

/// Alle Binge-Listen eines Profils (M5 5.6).
///
/// Welche hier stehen, entscheidet die Policy: öffentliche sieht jeder,
/// private nur der Eigner. Diese Ansicht filtert nichts nach.
struct ListsView: View {
    let profileID: UUID
    let isMine: Bool

    @Environment(Repositories.self) private var repos
    @State private var lists: [ListSummary] = []
    @State private var isLoading = true
    @State private var editing: ListSummary?
    @State private var isCreating = false

    var body: some View {
        Group {
            if isLoading {
                ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if lists.isEmpty {
                ContentUnavailableView(
                    "Keine Listen",
                    systemImage: "list.bullet.rectangle",
                    description: Text(
                        isMine
                            ? "Eine Binge-Liste ist eine Reihenfolge — Platz eins heißt: damit fängst du an."
                            : "Dieses Profil zeigt keine Listen.")
                )
            } else {
                content
            }
        }
        .background(Theme.background)
        .navigationTitle("Binge-Listen")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            if isMine {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Neu") { isCreating = true }
                }
            }
        }
        .sheet(isPresented: $isCreating) {
            EditListSheet(list: nil) { await load() }
        }
        .sheet(item: $editing) { list in
            EditListSheet(list: list) { await load() }
        }
        .task { await load() }
        .refreshable { await load() }
    }

    private var content: some View {
        ScrollView {
            LazyVStack(spacing: 12) {
                ForEach(lists) { list in
                    NavigationLink {
                        ListDetailView(list: list, isMine: isMine)
                    } label: {
                        ListCard(list: list)
                    }
                    .buttonStyle(.plain)
                    .contextMenu {
                        if isMine {
                            Button("Bearbeiten", systemImage: "pencil") { editing = list }
                        }
                    }
                }
            }
            .padding(20)
        }
    }

    private func load() async {
        lists = await repos.lists.lists(of: profileID)
        isLoading = false
    }
}

/// Eine Liste in der Übersicht, mit drei Plakaten.
private struct ListCard: View {
    let list: ListSummary

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            // Drei Plakate übereinandergelegt: ein Stapel sagt „hier
            // sind mehrere" ohne die Karte breit zu machen.
            ZStack(alignment: .leading) {
                ForEach(Array(list.posters.enumerated().reversed()), id: \.offset) { index, id in
                    PosterThumbnail(film: Film.placeholder(id), width: 44)
                        .offset(x: CGFloat(index) * 16)
                        .zIndex(Double(-index))
                }
            }
            .frame(width: list.posters.isEmpty ? 0 : 44 + CGFloat(max(0, list.posters.count - 1)) * 16,
                   height: 66, alignment: .leading)

            VStack(alignment: .leading, spacing: 3) {
                Text(list.title)
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(Theme.foreground)
                    .lineLimit(2)

                if let text = list.description, !text.isEmpty {
                    Text(text)
                        .font(.caption2)
                        .foregroundStyle(Theme.muted)
                        .lineLimit(2)
                }

                HStack(spacing: 8) {
                    Text(list.films == 1 ? "1 Film" : "\(list.films) Filme")
                        .font(.caption2)
                        .foregroundStyle(Theme.quiet)
                        .monospacedDigit()
                    // „privat" steht nur da, wenn es zutrifft. Bei jeder
                    // Liste „öffentlich" zu schreiben, sagt nichts.
                    if !list.isPublic {
                        Text("privat")
                            .font(.caption2)
                            .foregroundStyle(Theme.primary)
                    }
                }
            }

            Spacer(minLength: 0)
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.card, in: RoundedRectangle(cornerRadius: 10))
        .overlay { RoundedRectangle(cornerRadius: 10).strokeBorder(Theme.border) }
    }
}

extension Film {
    /// Nur die Id, für ein Plakat in einer Vorschau.
    ///
    /// Die Übersicht liefert bewusst nur `wikidata_id` — die Adresse des
    /// Plakats baut der Client daraus ohnehin selbst, und die Titel
    /// stünden in einer Vorschau ohnehin nicht.
    nonisolated static func placeholder(_ wikidataID: String) -> Film {
        Film(
            wikidataID: wikidataID, titleDE: nil, titleOriginal: "", releaseYear: nil,
            posterSource: nil, posterURL: nil)
    }
}
