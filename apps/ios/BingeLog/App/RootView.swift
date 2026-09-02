import SwiftUI

/// Was die App zeigt, je nachdem ob jemand angemeldet ist.
///
/// Auf dem iPhone eine Tab Bar, auf dem iPad eine geteilte Ansicht
/// (M5 5.4). Das iPad ist kein großes iPhone, und ein iPhone-Layout auf
/// dem iPad ist ein häufiger Ablehnungsgrund im App-Review.
struct RootView: View {
    @Environment(SessionStore.self) private var session
    @Environment(\.horizontalSizeClass) private var sizeClass

    /// Ob die Frage nach der bisherigen Filmhistorie schon beantwortet
    /// ist. Lokal: sie gehört zur Einrichtung dieses Geräts.
    @AppStorage("onboarding.importAsked") private var hasAnsweredImport = false

    let films: FilmRepository
    let profiles: ProfileRepository
    let discover: DiscoverRepository
    let lazyFilms: LazyFilmRepository
    let details: FilmDetailRepository
    let entries: FilmEntryRepository
    let profilePages: ProfilePageRepository
    let taste: TasteRepository

    var body: some View {
        if session.isLoading {
            ProgressView()
        } else if session.needsUsername {
            // Angemeldet, aber ohne Profil. Hier die Anmeldung zu zeigen
            // ergäbe eine App, die angemeldet ist und abgemeldet
            // aussieht.
            UsernameView(profiles: profiles)
        } else if session.isSignedIn, !hasAnsweredImport {
            // Einmal je Gerät, direkt nach der Einrichtung. Die Antwort
            // wird gemerkt, damit die Frage nicht bei jedem Start
            // wiederkommt.
            ImportOfferView { hasAnsweredImport = true }
        } else if session.isSignedIn {
            if sizeClass == .compact {
                CompactShell(
                    films: films, discover: discover, lazyFilms: lazyFilms, details: details, entries: entries,
                    profilePages: profilePages, taste: taste)
            } else {
                RegularShell(
                    films: films, discover: discover, lazyFilms: lazyFilms, details: details, entries: entries,
                    profilePages: profilePages, taste: taste)
            }
        } else {
            SignInView(films: films, profiles: profiles)
        }
    }
}

/// iPhone: Tab Bar.
///
/// Fünf Einträge, wie im Entwurf vom 31.08.2026. **Die Suche ist keiner
/// davon** — sie sitzt als Lupe im Kopf von Entdecken, so wie im Web.
/// Eine Leiste ist für die Orte da, an denen man sich aufhält; die Suche
/// ist ein Werkzeug, das man von überall greift.
private struct CompactShell: View {
    @Environment(SessionStore.self) private var session
    let films: FilmRepository
    let discover: DiscoverRepository
    let lazyFilms: LazyFilmRepository
    let details: FilmDetailRepository
    let entries: FilmEntryRepository
    let profilePages: ProfilePageRepository
    let taste: TasteRepository

    var body: some View {
        TabView {
            // Zuerst und damit voreingestellt: hier landet man nach dem
            // Anmelden und nach jedem Kaltstart.
            NavigationStack {
                DiscoverView(repository: discover, details: details, entries: entries)
                    .toolbar { searchButton }
            }
            .tabItem { Label("Entdecken", systemImage: "house") }

            NavigationStack { WatchlistView(entries: entries, details: details, taste: taste) }
                .tabItem { Label("Watchlist", systemImage: "bookmark") }

            NavigationStack { DiaryView(entries: entries, details: details) }
                .tabItem { Label("Tagebuch", systemImage: "calendar") }

            NavigationStack { OwnProfileView() }
                .tabItem { Label("Profil", systemImage: "person") }

            NavigationStack { SettingsView() }
                .tabItem { Label("Einstellungen", systemImage: "gearshape") }
        }
        // Gold und nicht das Systemblau: die Tönung ist das
        // Erkennungszeichen, und im Web ist die aktive Markierung
        // ebenfalls golden.
        .tint(Theme.primary)
    }

    @ToolbarContentBuilder private var searchButton: some ToolbarContent {
        ToolbarItem(placement: .topBarTrailing) {
            NavigationLink {
                SearchView(
                    repository: films, lazyFilms: lazyFilms,
                    details: details, entries: entries)
            } label: {
                Image(systemName: "magnifyingglass")
            }
            .accessibilityLabel("Suche")
        }
    }
}

/// iPad: Seitenleiste und Detailspalte.
private struct RegularShell: View {
    let films: FilmRepository
    let discover: DiscoverRepository
    let lazyFilms: LazyFilmRepository
    let details: FilmDetailRepository
    let entries: FilmEntryRepository
    let profilePages: ProfilePageRepository
    let taste: TasteRepository
    @State private var selection: Section? = .discover

    private enum Section: Hashable {
        case discover
        case search
        case watchlist
        case diary
        case profile
        case settings
    }

    var body: some View {
        NavigationSplitView {
            List(selection: $selection) {
                Label("Entdecken", systemImage: "house").tag(Section.discover)
                // Am Schreibtisch ist Platz, also steht die Suche hier
                // in der Leiste statt hinter einer Lupe.
                Label("Suche", systemImage: "magnifyingglass").tag(Section.search)
                Label("Watchlist", systemImage: "bookmark").tag(Section.watchlist)
                Label("Tagebuch", systemImage: "calendar").tag(Section.diary)
                Label("Profil", systemImage: "person").tag(Section.profile)
                Label("Einstellungen", systemImage: "gearshape").tag(Section.settings)
            }
            .navigationTitle("BingeLog")
        } detail: {
            NavigationStack {
                switch selection {
                case .search:
                    SearchView(
                        repository: films, lazyFilms: lazyFilms,
                        details: details, entries: entries)
                case .watchlist:
                    WatchlistView(entries: entries, details: details, taste: taste)
                case .diary:
                    DiaryView(entries: entries, details: details)
                case .profile:
                    OwnProfileView()
                case .settings:
                    SettingsView()
                case .discover, nil:
                    DiscoverView(repository: discover, details: details, entries: entries)
                }
            }
        }
        .tint(Theme.primary)
    }
}

/// Das eigene Profil.
///
/// Braucht den eigenen Benutzernamen, und den kennt erst die Sitzung.
/// Ohne ihn — was nur zwischen Anmelden und Namenswahl vorkommt — steht
/// hier ein Ladekringel statt einer Fehlermeldung.
private struct OwnProfileView: View {
    @Environment(SessionStore.self) private var session

    var body: some View {
        if let username = session.username {
            ProfileView(username: username)
        } else {
            ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
        }
    }
}
