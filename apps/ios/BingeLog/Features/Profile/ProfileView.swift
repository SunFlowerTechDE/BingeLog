import SwiftUI

/// Ein Profil (M5 5.6).
///
/// Dieselbe Ansicht für das eigene und für ein fremdes: was sich
/// unterscheidet, ist der Folgen-Knopf und wie viel die Policy hergibt.
/// Eine zweite Ansicht für dasselbe wäre zwei Wahrheiten über einen
/// Bildschirm.
struct ProfileView: View {
    let username: String

    /// Erst in `.task` gebaut: ein `@State`-Initialisierer kommt an die
    /// Umgebung nicht heran.
    @State private var model: ProfileModel?
    @Environment(Repositories.self) private var repos
    @State private var isEditing = false
    @State private var isReporting = false
    @State private var confirmingBlock = false
    @State private var isEditingFavourites = false

    var body: some View {
        Group {
            if let model { loaded(model) } else { ProgressView() }
        }
        .background(Theme.background)
        .navigationTitle(model?.overview?.title ?? username)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            if let head = model?.overview {
                ToolbarItem(placement: .topBarTrailing) {
                    if head.isMe {
                        Button("Bearbeiten") { isEditing = true }
                    } else {
                        Menu {
                            // Melden ist **immer und überall**
                            // erreichbar — das ist eine Zusage (M4 4.7).
                            Button("Melden", systemImage: "flag") { isReporting = true }

                            // Blockieren ist einseitig und still: der
                            // Blockierte erfährt es nicht (M4 4.5).
                            Button(
                                head.iBlocked ? "Blockierung aufheben" : "Blockieren",
                                systemImage: head.iBlocked ? "hand.raised.slash" : "hand.raised",
                                role: head.iBlocked ? nil : .destructive
                            ) {
                                if head.iBlocked {
                                    Task { await model?.toggleBlock() }
                                } else {
                                    confirmingBlock = true
                                }
                            }
                        } label: {
                            Image(systemName: "ellipsis.circle")
                        }
                        .accessibilityLabel("Mehr")
                    }
                }
            }
        }
        .confirmationDialog(
            "\(model?.overview?.username ?? "") blockieren?",
            isPresented: $confirmingBlock, titleVisibility: .visible
        ) {
            Button("Blockieren", role: .destructive) { Task { await model?.toggleBlock() } }
            Button("Abbrechen", role: .cancel) {}
        } message: {
            Text("Ihr seht einander dann nicht mehr. Er erfährt es nicht.")
        }
        .sheet(isPresented: $isReporting) {
            if let head = model?.overview {
                ReportSheet(targetKind: "profile", targetID: head.id.uuidString)
            }
        }
        .sheet(isPresented: $isEditingFavourites) {
            EditFavouritesSheet(slots: model?.favourites ?? []) {
                Task { await model?.load() }
            }
        }
        .sheet(isPresented: $isEditing) {
            if let head = model?.overview {
                EditProfileSheet(
                    head: head, avatarBase: model?.avatarBase, bannerBase: model?.bannerBase
                ) {
                    Task { await model?.load() }
                }
            }
        }
        .task {
            if model == nil {
                model = ProfileModel(username: username, repository: repos.profilePages)
            }
            await model?.load()
        }
        .refreshable { await model?.load() }
    }

    private func loaded(_ model: ProfileModel) -> some View {
        Group {
            if model.isLoading {
                ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if model.isMissing {
                ContentUnavailableView(
                    "Kein Profil",
                    systemImage: "person.slash",
                    description: Text("Den Namen \(model.username) gibt es nicht.")
                )
            } else if let head = model.overview, head.blockedMe {
                // Wer blockiert hat, wird nicht gezeigt — und der Grund
                // steht dabei, sonst sieht es aus wie ein Fehler.
                ContentUnavailableView(
                    "Nicht verfügbar",
                    systemImage: "hand.raised",
                    description: Text("Dieses Profil ist für dich nicht sichtbar.")
                )
            } else if let head = model.overview {
                content(model, head)
            }
        }
    }

    private func content(_ model: ProfileModel, _ head: ProfileOverview) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                ProfileHeader(
                    head: head, avatarBase: model.avatarBase, bannerBase: model.bannerBase
                ) {
                    Task { await model.toggleFollow() }
                }

                numbers(model)

                // Auf dem eigenen Profil steht die Tafel auch leer da:
                // sonst gäbe es keinen Weg, den ersten zu setzen.
                if !model.favourites.isEmpty || head.isMe {
                    Favourites(
                        slots: model.favourites,
                        canEdit: head.isMe,
                        onEdit: { isEditingFavourites = true })
                }

                if !model.genres.isEmpty {
                    Section(title: "Sieht am liebsten") {
                        FlowRow(spacing: 8) {
                            ForEach(model.genres) { genre in
                                HStack(spacing: 5) {
                                    Text(genre.shortLabel)
                                        .font(.caption.weight(.medium))
                                    Text("\(genre.films)")
                                        .font(.caption2)
                                        .foregroundStyle(Theme.quiet)
                                        .monospacedDigit()
                                }
                                .foregroundStyle(Theme.foreground)
                                .padding(.horizontal, 10)
                                .padding(.vertical, 5)
                                .background(Theme.card, in: Capsule())
                                .overlay { Capsule().strokeBorder(Theme.border) }
                            }
                        }
                    }
                }

                // Auf dem eigenen Profil auch leer: sonst gäbe es
                // keinen Weg, die erste Liste anzulegen.
                if !model.lists.isEmpty || head.isMe {
                    SectionWithMore(
                        title: "Binge-Listen",
                        more: "Alle",
                        destination: {
                            AnyView(ListsView(profileID: head.id, isMine: head.isMe))
                        }
                    ) {
                        VStack(alignment: .leading, spacing: 8) {
                            if model.lists.isEmpty {
                                Text("Noch keine Liste.")
                                    .font(.footnote)
                                    .foregroundStyle(Theme.muted)
                                    .padding(.horizontal, 20)
                            }
                            ForEach(model.lists) { list in
                                HStack(spacing: 8) {
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(list.title)
                                            .font(.subheadline.weight(.medium))
                                            .foregroundStyle(Theme.foreground)
                                        if let text = list.description, !text.isEmpty {
                                            Text(text)
                                                .font(.caption2)
                                                .foregroundStyle(Theme.muted)
                                                .lineLimit(2)
                                        }
                                    }
                                    Spacer(minLength: 0)
                                    // Nur auf dem eigenen Profil kann
                                    // eine private Liste überhaupt
                                    // auftauchen — dass sie privat ist,
                                    // gehört dann dazu.
                                    if !list.isPublic {
                                        Text("privat")
                                            .font(.caption2)
                                            .foregroundStyle(Theme.quiet)
                                    }
                                }
                                .padding(12)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .background(Theme.card, in: RoundedRectangle(cornerRadius: 10))
                            }
                        }
                    }
                }

                if model.hasCharts {
                    Charts(model: model)
                }

                // Ob hier etwas steht, entscheidet die Policy auf
                // `watchlist`. Bei einer privaten kommt nichts zurück —
                // dann ist auch die Überschrift fehl am Platz, sonst
                // liest sich „leer" als „hat nichts vorgemerkt".
                if head.isMe || head.watchlistPublic {
                    SectionWithMore(
                        title: "Watchlist",
                        more: head.isMe ? "Alle" : nil,
                        destination: { AnyView(WatchlistView(
                            entries: repos.entries, details: repos.details,
                            taste: repos.taste)) }
                    ) {
                        if model.watchlist.isEmpty {
                            Text(head.isMe ? "Noch nichts vorgemerkt." : "Nichts zu sehen.")
                                .font(.footnote)
                                .foregroundStyle(Theme.muted)
                        } else {
                            ScrollView(.horizontal, showsIndicators: false) {
                                HStack(alignment: .top, spacing: 10) {
                                    ForEach(model.watchlist) { item in
                                        NavigationLink {
                                            FilmDetailView(film: item.film)
                                        } label: {
                                            VStack(alignment: .leading, spacing: 4) {
                                                PosterThumbnail(film: item.film, width: 76)
                                                Text(item.film.title)
                                                    .font(.caption2)
                                                    .foregroundStyle(Theme.foreground)
                                                    .lineLimit(2)
                                            }
                                            .frame(width: 76, alignment: .leading)
                                        }
                                        .buttonStyle(.plain)
                                    }
                                }
                            }
                        }
                    }
                }

                if !model.recent.isEmpty {
                    SectionWithMore(
                        title: head.isMe ? "Zuletzt eingetragen" : "Zuletzt gesehen",
                        // „Alle" führt ins eigene Tagebuch. Bei einem
                        // fremden Profil gibt es diese Seite nicht —
                        // was von ihm sichtbar ist, steht hier schon.
                        more: head.isMe ? "Alle" : nil,
                        destination: { AnyView(DiaryView(
                            entries: repos.entries, details: repos.details)) }
                    ) {
                        VStack(spacing: 0) {
                            ForEach(model.recent) { entry in
                                NavigationLink {
                                    FilmDetailView(film: entry.film)
                                } label: {
                                    RecentRow(entry: entry)
                                }
                                .buttonStyle(.plain)
                                Divider().overlay(Theme.border)
                            }
                        }
                    }
                }
            }
            .padding(.bottom, 24)
        }
    }

    private func numbers(_ model: ProfileModel) -> some View {
        HStack(spacing: 10) {
            Figure(value: "\(model.stats.films)", label: "Filme")
            Figure(value: "\(model.stats.ratings)", label: "Bewertungen")
            Figure(
                value: model.stats.average.map(Popcorn.format) ?? "—", label: "im Schnitt")
            Figure(value: "\(model.stats.reviews)", label: "Rezensionen")
            if model.overview?.isMe == true || model.overview?.watchlistPublic == true {
                Figure(value: "\(model.watchlistCount)", label: "Watchlist")
            }
        }
        .padding(.horizontal, 20)
    }
}

// --------------------------------------------------------------------

/// Kopfbild, Profilbild, Name, Beschreibung, Folgen.
private struct ProfileHeader: View {
    let head: ProfileOverview
    let avatarBase: URL?
    let bannerBase: URL?
    let onFollow: () -> Void

    @Environment(SessionStore.self) private var session

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            ZStack(alignment: .bottomLeading) {
                banner
                avatar.offset(y: 34).padding(.leading, 20)
            }
            .padding(.bottom, 34)

            VStack(alignment: .leading, spacing: 4) {
                Text(head.title)
                    .font(.title2.weight(.semibold))
                    .foregroundStyle(Theme.foreground)

                // Der Benutzername steht auch dann da, wenn es einen
                // Anzeigenamen gibt: er ist die Kennung, unter der man
                // jemanden wiederfindet.
                Text("@\(head.username)")
                    .font(.subheadline)
                    .foregroundStyle(Theme.muted)

                if let bio = head.bio, !bio.isEmpty {
                    Text(bio)
                        .font(.callout)
                        .foregroundStyle(Theme.foreground)
                        .padding(.top, 4)
                }

                HStack(spacing: 14) {
                    NavigationLink {
                        FollowListView(
                            profileID: head.id, incoming: true, avatarBase: avatarBase)
                    } label: {
                        Count(value: head.followers, label: "Follower")
                    }
                    .buttonStyle(.plain)

                    NavigationLink {
                        FollowListView(
                            profileID: head.id, incoming: false, avatarBase: avatarBase)
                    } label: {
                        Count(value: head.following, label: "folgt")
                    }
                    .buttonStyle(.plain)
                    if head.areFriends {
                        Text("befreundet")
                            .font(.caption2)
                            .foregroundStyle(Theme.primary)
                    } else if head.followsMe {
                        Text("folgt dir")
                            .font(.caption2)
                            .foregroundStyle(Theme.quiet)
                    }
                }
                .padding(.top, 6)
            }
            .padding(.horizontal, 20)

            if !head.isMe, session.isSignedIn {
                Button(action: onFollow) {
                    Text(head.iFollow ? "Folge ich" : "Folgen")
                        .font(.subheadline.weight(.medium))
                        .foregroundStyle(head.iFollow ? Theme.foreground : Theme.onPrimary)
                        .padding(.horizontal, 20)
                        .padding(.vertical, 9)
                        .background(head.iFollow ? Theme.card : Theme.primary, in: Capsule())
                        .overlay {
                            Capsule().strokeBorder(head.iFollow ? Theme.border : .clear)
                        }
                }
                .buttonStyle(.plain)
                .padding(.horizontal, 20)
            }
        }
    }

    private var banner: some View {
        Group {
            if let path = head.bannerPath, let base = bannerBase {
                AsyncImage(url: base.appendingPathComponent(path)) { image in
                    image.resizable().aspectRatio(contentMode: .fill)
                } placeholder: {
                    Theme.card
                }
            } else {
                Theme.card
            }
        }
        .frame(height: 132)
        .frame(maxWidth: .infinity)
        .clipped()
        .overlay {
            // Unten ins Dunkle auslaufend, damit das Profilbild darauf
            // steht und nicht darin verschwindet.
            LinearGradient(
                colors: [.clear, Theme.background.opacity(0.85)],
                startPoint: .center, endPoint: .bottom)
        }
    }

    private var avatar: some View {
        Group {
            if let path = head.avatarPath, let base = avatarBase {
                AsyncImage(url: base.appendingPathComponent(path)) { image in
                    image.resizable().aspectRatio(contentMode: .fill)
                } placeholder: {
                    Circle().fill(Theme.card)
                }
            } else {
                Circle().fill(Theme.card)
                    .overlay {
                        Image(systemName: "person")
                            .font(.title2)
                            .foregroundStyle(Theme.quiet)
                    }
            }
        }
        .frame(width: 76, height: 76)
        .clipShape(Circle())
        .overlay { Circle().strokeBorder(Theme.background, lineWidth: 3) }
    }
}

private struct Count: View {
    let value: Int
    let label: String

    var body: some View {
        HStack(spacing: 4) {
            Text("\(value)")
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(Theme.foreground)
                .monospacedDigit()
            Text(label)
                .font(.caption)
                .foregroundStyle(Theme.muted)
        }
    }
}

/// Die vier Plätze.
///
/// Lücken bleiben Lücken: wer nur zwei gewählt hat, hat zwei gewählt.
private struct Favourites: View {
    let slots: [FavouriteSlot]
    let canEdit: Bool
    let onEdit: () -> Void

    /// Zehn, seit dem 31.08.2026.
    private static let places = 10

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("Favoriten")
                    .font(.headline)
                    .foregroundStyle(Theme.foreground)
                Spacer()
                if canEdit {
                    Button("Bearbeiten", action: onEdit)
                        .font(.caption)
                        .foregroundStyle(Theme.primary)
                }
            }
            .padding(.horizontal, 20)

            // Waagerecht: zehn Plakate nebeneinander passen auf kein
            // Telefon, und untereinander wären sie eine Wand.
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(alignment: .top, spacing: 10) {
                    ForEach(1...Self.places, id: \.self) { position in
                        if let slot = slots.first(where: { $0.slot == position }) {
                            NavigationLink {
                                FilmDetailView(film: slot.film)
                            } label: {
                                VStack(alignment: .leading, spacing: 4) {
                                    PosterThumbnail(film: slot.film, width: 76)
                                    Text(slot.film.title)
                                        .font(.caption2)
                                        .foregroundStyle(Theme.foreground)
                                        .lineLimit(2)
                                }
                                .frame(width: 76, alignment: .leading)
                            }
                            .buttonStyle(.plain)
                        } else if canEdit {
                            // Leere Plätze nur auf dem eigenen Profil.
                            // Bei einem fremden sagt eine gestrichelte
                            // Kachel nichts, ausser dass jemand nicht
                            // fertig geworden ist.
                            Button(action: onEdit) {
                                RoundedRectangle(cornerRadius: 6)
                                    .strokeBorder(
                                        Theme.border,
                                        style: StrokeStyle(lineWidth: 1, dash: [4, 3])
                                    )
                                    .frame(width: 76, height: 114)
                                    .overlay {
                                        Text("\(position)")
                                            .font(.caption)
                                            .foregroundStyle(Theme.quiet)
                                            .monospacedDigit()
                                    }
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
                .padding(.horizontal, 20)
            }
        }
    }
}

private struct RecentRow: View {
    let entry: FeedEntry

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            PosterThumbnail(film: entry.film, width: 44)

            VStack(alignment: .leading, spacing: 3) {
                Text(entry.film.title)
                    .font(.subheadline)
                    .foregroundStyle(Theme.foreground)
                    .lineLimit(2)

                HStack(spacing: 8) {
                    if let rating = entry.rating {
                        PopcornRating(rating: Double(rating), size: 12)
                    }
                    if let when = entry.createdDate {
                        Text(when, format: .relative(presentation: .named))
                            .font(.caption2)
                            .foregroundStyle(Theme.quiet)
                    }
                }

                if let review = entry.review, !review.isEmpty {
                    SpoilerText(text: review, hasSpoilers: entry.hasSpoilers, lineLimit: 2)
                }
            }
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 10)
        .contentShape(Rectangle())
    }
}

/// Eine Überschrift mit Inhalt, wie sie auf dieser Seite mehrfach steht.
private struct Section<Content: View>: View {
    let title: String
    @ViewBuilder let content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(title)
                .font(.headline)
                .foregroundStyle(Theme.foreground)
            content
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 20)
    }
}

private struct Figure: View {
    let value: String
    let label: String

    var body: some View {
        VStack(spacing: 2) {
            Text(value)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(Theme.foreground)
                .monospacedDigit()
            Text(label)
                .font(.caption2)
                .foregroundStyle(Theme.muted)
                .lineLimit(1)
                .minimumScaleFactor(0.8)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 10)
        .background(Theme.card, in: RoundedRectangle(cornerRadius: 10))
        .overlay { RoundedRectangle(cornerRadius: 10).strokeBorder(Theme.border) }
    }
}


/// Die vier Auswertungen.
///
/// Sie erscheinen einzeln, jede erst wenn sie etwas sagt: ein Diagramm
/// mit einem Balken ist keins.
private struct Charts: View {
    let model: ProfileModel

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            if model.spread.contains(where: { $0.films > 0 }) {
                Bars(title: "Wie du bewertest", data: model.spread, unit: "Filme")
            }
            if model.years.count > 1 {
                Bars(title: "Filme pro Jahr", data: model.years, unit: "Filme")
            }
            if model.decades.count > 1 {
                Bars(title: "Aus welchen Jahrzehnten", data: model.decades, unit: "Filme")
            }
            // Ab zwei Filmen je Person — einer macht keinen
            // Lieblingsregisseur. Die Untergrenze steckt in der
            // Funktion; hier fällt nur die leere Tafel weg.
            if !model.directors.isEmpty {
                Bars(title: "Häufigste Regie", data: model.directors, unit: "Filme")
            }
        }
    }
}

/// Ein Balkendiagramm, waagerecht.
///
/// Waagerecht und nicht als Säulen: die Beschriftungen sind Jahreszahlen
/// und Namen, und die stehen auf einem Telefon nebeneinander nicht mehr
/// lesbar.
private struct Bars: View {
    let title: String
    let data: [ProfileBar]
    let unit: String

    private var maximum: Int { max(1, data.map(\.films).max() ?? 1) }

    var body: some View {
        Section(title: title) {
            VStack(alignment: .leading, spacing: 6) {
                ForEach(data) { bar in
                    HStack(spacing: 8) {
                        Text(bar.label)
                            .font(.caption)
                            .foregroundStyle(Theme.muted)
                            .frame(width: 74, alignment: .leading)
                            .lineLimit(1)
                            .minimumScaleFactor(0.7)

                        GeometryReader { geometry in
                            let share = Double(bar.films) / Double(maximum)
                            RoundedRectangle(cornerRadius: 3)
                                .fill(Theme.primary.opacity(bar.films == 0 ? 0.15 : 0.85))
                                .frame(width: max(2, geometry.size.width * share))
                        }
                        .frame(height: 14)

                        Text("\(bar.films)")
                            .font(.caption2)
                            .foregroundStyle(Theme.quiet)
                            .monospacedDigit()
                            .frame(width: 28, alignment: .trailing)
                    }
                }
            }
            .accessibilityElement(children: .combine)
            .accessibilityLabel(
                "\(title): "
                    + data.map { "\($0.label) \($0.films) \(unit)" }.joined(separator: ", "))
        }
    }
}


/// Eine Überschrift mit einem Weg zu allem.
private struct SectionWithMore<Content: View>: View {
    let title: String
    /// `nil` heisst: es gibt keinen Weg. Ein „mehr", das nirgendwohin
    /// führt, ist schlechter als keins.
    let more: String?
    let destination: () -> AnyView
    @ViewBuilder let content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text(title)
                    .font(.headline)
                    .foregroundStyle(Theme.foreground)
                Spacer()
                if let more {
                    NavigationLink(more) { destination() }
                        .font(.caption)
                        .foregroundStyle(Theme.primary)
                }
            }
            .padding(.horizontal, 20)

            content
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}
