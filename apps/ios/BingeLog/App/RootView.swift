import SwiftUI

/// Was die App zeigt, je nachdem ob jemand angemeldet ist.
///
/// Auf dem iPhone eine Tab Bar, auf dem iPad eine geteilte Ansicht
/// (M5 5.4). Das iPad ist kein großes iPhone, und ein iPhone-Layout auf
/// dem iPad ist ein häufiger Ablehnungsgrund im App-Review.
struct RootView: View {
    @Environment(SessionStore.self) private var session
    @Environment(\.horizontalSizeClass) private var sizeClass

    let films: FilmRepository
    let profiles: ProfileRepository
    let discover: DiscoverRepository
    let lazyFilms: LazyFilmRepository
    let details: FilmDetailRepository
    let entries: FilmEntryRepository

    var body: some View {
        if session.isLoading {
            ProgressView()
        } else if session.needsUsername {
            // Angemeldet, aber ohne Profil. Hier die Anmeldung zu zeigen
            // ergäbe eine App, die angemeldet ist und abgemeldet
            // aussieht.
            UsernameView(profiles: profiles)
        } else if session.isSignedIn {
            if sizeClass == .compact {
                CompactShell(
                    films: films, discover: discover, lazyFilms: lazyFilms, details: details, entries: entries)
            } else {
                RegularShell(
                    films: films, discover: discover, lazyFilms: lazyFilms, details: details, entries: entries)
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

    var body: some View {
        TabView {
            // Zuerst und damit voreingestellt: hier landet man nach dem
            // Anmelden und nach jedem Kaltstart.
            NavigationStack {
                DiscoverView(repository: discover, details: details, entries: entries)
                    .toolbar { searchButton }
            }
            .tabItem { Label("Entdecken", systemImage: "house") }

            NavigationStack { WatchlistView() }
                .tabItem { Label("Watchlist", systemImage: "bookmark") }

            NavigationStack { DiaryView() }
                .tabItem { Label("Tagebuch", systemImage: "calendar") }

            NavigationStack { ProfileView() }
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
                    WatchlistView()
                case .diary:
                    DiaryView()
                case .profile:
                    ProfileView()
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
