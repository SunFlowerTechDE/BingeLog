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
                CompactShell(films: films)
            } else {
                RegularShell(films: films)
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

    var body: some View {
        TabView {
            NavigationStack {
                SearchView(repository: films)
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
    @State private var selection: Section? = .search

    private enum Section: Hashable {
        case search
        case account
    }

    var body: some View {
        NavigationSplitView {
            List(selection: $selection) {
                Label("Suche", systemImage: "magnifyingglass").tag(Section.search)
                Label("Konto", systemImage: "person").tag(Section.account)
            }
            .navigationTitle("BingeLog")
        } detail: {
            switch selection {
            case .account:
                AccountView()
            case .search, nil:
                SearchView(repository: films)
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
