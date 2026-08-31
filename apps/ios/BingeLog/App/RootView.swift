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
            }
            .tabItem { Label("Entdecken", systemImage: "sparkles") }

            NavigationStack {
                SearchView(repository: films, lazyFilms: lazyFilms, details: details, entries: entries)
            }
            .tabItem { Label("Suche", systemImage: "magnifyingglass") }

            NavigationStack {
                AccountView()
            }
            .tabItem { Label("Konto", systemImage: "person") }
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
        case account
    }

    var body: some View {
        NavigationSplitView {
            List(selection: $selection) {
                Label("Entdecken", systemImage: "sparkles").tag(Section.discover)
                Label("Suche", systemImage: "magnifyingglass").tag(Section.search)
                Label("Konto", systemImage: "person").tag(Section.account)
            }
            .navigationTitle("BingeLog")
        } detail: {
            switch selection {
            case .account:
                AccountView()
            case .search:
                SearchView(repository: films, lazyFilms: lazyFilms, details: details, entries: entries)
            case .discover, nil:
                DiscoverView(repository: discover, details: details, entries: entries)
            }
        }
    }
}

/// Vorläufig: nur abmelden. Das Profil kommt in einem eigenen Schritt.
private struct AccountView: View {
    @Environment(SessionStore.self) private var session

    var body: some View {
        List {
            Button("Abmelden", role: .destructive) {
                Task { await session.signOut() }
            }
        }
        .navigationTitle("Konto")
    }
}
